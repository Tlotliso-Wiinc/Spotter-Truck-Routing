from django.test import TestCase
from datetime import datetime, timezone, timedelta
from rest_framework.test import APIClient
from truckapp.services.risk_engine import RiskEngine
from truckapp.services.recommendation_engine import RecommendationEngine
from truckapp.services.route_service import RouteService
from truckapp.services.weather_service import WeatherService
from unittest.mock import patch, MagicMock
import os
import requests


class RiskEngineTests(TestCase):
    def setUp(self):
        self.engine = RiskEngine()

    def test_wind_thresholds(self):
        # <25 mph -> Low
        self.assertEqual(self.engine._get_condition_risk('wind', 20), 'Low')
        # 25-34 mph -> Moderate
        self.assertEqual(self.engine._get_condition_risk('wind', 25), 'Moderate')
        self.assertEqual(self.engine._get_condition_risk('wind', 34), 'Moderate')
        # 35-44 mph -> High
        self.assertEqual(self.engine._get_condition_risk('wind', 35), 'High')
        self.assertEqual(self.engine._get_condition_risk('wind', 44), 'High')
        # 45-54 mph -> Severe
        self.assertEqual(self.engine._get_condition_risk('wind', 45), 'Severe')
        self.assertEqual(self.engine._get_condition_risk('wind', 54), 'Severe')
        # >=55 mph -> No Travel
        self.assertEqual(self.engine._get_condition_risk('wind', 55), 'No Travel')
        self.assertEqual(self.engine._get_condition_risk('wind', 65), 'No Travel')

    def test_rain_thresholds(self):
        # <0.10 in/hr -> Low
        self.assertEqual(self.engine._get_condition_risk('rain', 0.05), 'Low')
        # 0.10-0.25 -> Moderate
        self.assertEqual(self.engine._get_condition_risk('rain', 0.10), 'Moderate')
        self.assertEqual(self.engine._get_condition_risk('rain', 0.20), 'Moderate')
        # 0.25-0.50 -> High
        self.assertEqual(self.engine._get_condition_risk('rain', 0.25), 'High')
        self.assertEqual(self.engine._get_condition_risk('rain', 0.45), 'High')
        # 0.50-1.00 -> Severe
        self.assertEqual(self.engine._get_condition_risk('rain', 0.50), 'Severe')
        self.assertEqual(self.engine._get_condition_risk('rain', 0.95), 'Severe')
        # >1.00 -> No Travel
        self.assertEqual(self.engine._get_condition_risk('rain', 1.05), 'No Travel')

    def test_snow_thresholds(self):
        # <0.5 in/hr -> Low
        self.assertEqual(self.engine._get_condition_risk('snow', 0.2), 'Low')
        # 0.5-1.0 -> Moderate
        self.assertEqual(self.engine._get_condition_risk('snow', 0.5), 'Moderate')
        # 1.0-2.0 -> High
        self.assertEqual(self.engine._get_condition_risk('snow', 1.5), 'High')
        # 2.0-3.0 -> Severe
        self.assertEqual(self.engine._get_condition_risk('snow', 2.5), 'Severe')
        # >3.0 -> No Travel
        self.assertEqual(self.engine._get_condition_risk('snow', 3.5), 'No Travel')

    def test_load_rules(self):
        # >=55 mph -> No Travel for any load
        self.assertEqual(self.engine._apply_load_rules('Low', 56, 10000), 'No Travel')
        self.assertEqual(self.engine._apply_load_rules('Low', 55, None), 'No Travel')

        # 45-54 mph + >30,000 lb -> No Travel
        self.assertEqual(self.engine._apply_load_rules('Severe', 48, 35000), 'No Travel')
        # 45-54 mph + <=30,000 lb -> stays current risk (Severe)
        self.assertEqual(self.engine._apply_load_rules('Severe', 48, 25000), 'Severe')

        # 35-44 mph + >40,000 lb -> Severe
        self.assertEqual(self.engine._apply_load_rules('High', 38, 45000), 'Severe')
        # 35-44 mph + <=40,000 lb -> stays High
        self.assertEqual(self.engine._apply_load_rules('High', 38, 35000), 'High')


    def test_checkpoint_assessment_integration(self):
        # Heavy load + 38 mph wind -> Severe
        weather = {'temperature': 65, 'wind_speed': 38, 'precipitation': 0.0}
        risk = self.engine.assess_risk(weather, load_weight=45000)
        self.assertEqual(risk, 'Severe')

        # Sub-freezing snow: 2.2 in/hr -> Severe
        weather = {'temperature': 25, 'wind_speed': 10, 'precipitation': 2.2}
        risk = self.engine.assess_risk(weather, load_weight=20000)
        self.assertEqual(risk, 'Severe')


class RecommendationEngineTests(TestCase):
    def setUp(self):
        self.engine = RecommendationEngine()

    def test_recommendation_prefers_fewer_severe_miles(self):
        route1 = {
            'route_id': 'r1',
            'name': 'Route 1',
            'duration': 10,
            'risk_summary': {
                'risk_counts': {'Low': 5, 'Moderate': 2, 'High': 1, 'Severe': 2, 'No Travel': 0},
                'average_risk_score': 2.5
            }
        }
        route2 = {
            'route_id': 'r2',
            'name': 'Route 2',
            'duration': 11,
            'risk_summary': {
                'risk_counts': {'Low': 7, 'Moderate': 1, 'High': 0, 'Severe': 0, 'No Travel': 0},
                'average_risk_score': 1.2
            }
        }
        best = self.engine.recommend_route([route1, route2])
        self.assertEqual(best['route_id'], 'r2')
        self.assertTrue(best['is_recommended'])
        self.assertFalse(route1['is_recommended'])


class RouteServiceCheckpointTests(TestCase):
    def test_checkpoint_etas_reflect_departure_time(self):
        service = RouteService()
        dep_time = datetime(2026, 10, 20, 9, 30, tzinfo=timezone.utc)
        fake_route = {
            'name': 'Test Route',
            'distance': 100.0,
            'duration': 2.0,  # 50 mph
            'geometry': {
                'coordinates': [
                    [-104.9903, 39.7392],
                    [-104.5, 39.9],
                    [-104.0, 40.1],
                    [-103.5, 40.3],
                    [-103.0, 40.5]
                ]
            }
        }
        checkpoints = service.generate_checkpoints(fake_route, departure_time=dep_time)
        self.assertTrue(len(checkpoints) >= 2)
        # First checkpoint ETA must equal departure time
        self.assertEqual(checkpoints[0]['eta'], dep_time)
        # Last checkpoint ETA must be departure time + route duration (2 hours)
        expected_arrival = dep_time + timedelta(hours=2.0)
        self.assertEqual(checkpoints[-1]['eta'], expected_arrival)


class WeatherServiceCacheTests(TestCase):
    def test_prefetch_deduplicates_nearby_coords(self):
        service = WeatherService()
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        # Batch API returns list of forecasts
        mock_response.json.return_value = [
            {
                'hourly': {
                    'time': ['2026-01-01T00:00'] * 48,
                    'temperature_2m': [65.0] * 48,
                    'windspeed_10m': [20.0] * 48,
                    'precipitation': [0.0] * 48,
                }
            }
        ]
        coords = [
            {'lat': 41.871111, 'lng': -87.759444},
            {'lat': 41.871119, 'lng': -87.759431},
        ]
        with patch('truckapp.services.weather_service.requests.get', return_value=mock_response) as mock_get:
            service.prefetch_locations(coords)
            self.assertEqual(mock_get.call_count, 1)
            service.get_weather_at_checkpoint(coords[0], datetime(2026, 1, 1, 3, tzinfo=timezone.utc))
            service.get_weather_at_checkpoint(coords[1], datetime(2026, 1, 1, 5, tzinfo=timezone.utc))
            self.assertEqual(mock_get.call_count, 1)
            self.assertEqual(service.stats['cache_hits'], 2)

    def test_visual_crossing_fallback(self):
        """Test that Visual Crossing API is used as fallback when Open-Meteo fails."""
        # Set a fake API key for testing
        with patch.dict(os.environ, {'VISUAL_CROSSING_API_KEY': 'test_key'}, clear=False):
            # Reload the module to pick up the new env var
            from importlib import reload
            import truckapp.services.weather_service as weather_module
            reload(weather_module)
            
            service = weather_module.WeatherService()
            
            # Mock Open-Meteo to fail with RequestException
            open_meteo_response = MagicMock()
            open_meteo_response.raise_for_status.side_effect = requests.RequestException("Open-Meteo failed")
            
            # Mock Visual Crossing to succeed
            visual_crossing_response = MagicMock()
            visual_crossing_response.raise_for_status = MagicMock()
            visual_crossing_response.json.return_value = {
                'days': [
                    {
                        'hours': [
                            {
                                'datetime': '2026-01-01T00:00',
                                'temp': 65.0,
                                'windspeed': 20.0,
                                'precip': 0.0,
                            }
                        ] * 48
                    }
                ]
            }
            
            call_count = [0]
            
            def mock_get(url, **kwargs):
                call_count[0] += 1
                if 'open-meteo.com' in url:
                    return open_meteo_response
                elif 'visualcrossing.com' in url:
                    return visual_crossing_response
                return MagicMock()
            
            with patch('truckapp.services.weather_service.requests.get', side_effect=mock_get):
                forecast = service._fetch_forecast_from_api(41.87, -87.76)
                
                # Should have called both APIs (Open-Meteo failed, Visual Crossing succeeded)
                self.assertGreater(call_count[0], 1)
                self.assertEqual(forecast['source'], 'visual_crossing')
                self.assertEqual(service.stats['visual_crossing_calls'], 1)

    def test_visual_crossing_parsing(self):
        """Test Visual Crossing response parsing."""
        service = WeatherService()
        
        # Mock Visual Crossing response
        data = {
            'days': [
                {
                    'hours': [
                        {
                            'datetime': '2026-01-01T00:00',
                            'temp': 65.0,
                            'windspeed': 20.0,
                            'precip': 0.0,
                        },
                        {
                            'datetime': '2026-01-01T01:00',
                            'temp': 64.0,
                            'windspeed': 18.0,
                            'precip': 0.1,
                        }
                    ]
                }
            ]
        }
        
        hourly = service._parse_visual_crossing_hourly(data)
        
        # Should parse the hours and fill remaining with defaults
        self.assertEqual(len(hourly), 48)
        self.assertEqual(hourly[0]['temperature'], 65.0)
        self.assertEqual(hourly[0]['wind_speed'], 20.0)
        self.assertEqual(hourly[0]['precipitation'], 0.0)
        self.assertEqual(hourly[1]['temperature'], 64.0)
        # Remaining hours should be defaults
        self.assertEqual(hourly[2]['temperature'], 70.0)


class APIEndpointsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_route_plan_endpoint(self):
        dep_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        payload = {
            'origin': 'Denver, CO, USA',
            'destination': 'Chicago, IL, USA',
            'origin_coords': {'lat': 39.7392, 'lng': -104.9903},
            'destination_coords': {'lat': 41.8781, 'lng': -87.6298},
            'departure_time': dep_time,
            'load_weight': 38000
        }
        response = self.client.post('/api/routes/', payload, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('routes', data)
        self.assertEqual(len(data['routes']), 3)
        self.assertIsNotNone(data.get('recommended_route_id'))
        first_route = data['routes'][0]
        self.assertIn('checkpoints', first_route)
        self.assertIn('risk_summary', first_route)
