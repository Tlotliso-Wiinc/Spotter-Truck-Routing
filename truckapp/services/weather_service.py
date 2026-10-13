import logging
import requests
from datetime import datetime, timezone
from typing import Dict
import time

logger = logging.getLogger(__name__)


class WeatherService:
    def __init__(self):
        self.base_url = 'https://api.open-meteo.com/v1/forecast'
        self.max_retries = 3
    
    def get_weather_at_checkpoint(self, coords: Dict, eta: datetime) -> Dict:
        """Get weather forecast for a checkpoint at ETA and for 0-48 hours"""
        lat = coords['lat']
        lon = coords['lng']
        logger.debug(f"[WEATHER_SERVICE] Fetching weather for coords ({lat:.4f}, {lon:.4f}) at ETA {eta}")
        
        # Calculate hours from now for the forecast handling timezone awareness
        if eta.tzinfo is not None:
            now = datetime.now(eta.tzinfo)
        else:
            now = datetime.now()
        
        hours_ahead = int((eta - now).total_seconds() / 3600)
        if hours_ahead < 0:
            hours_ahead = 0
        if hours_ahead > 47:
            hours_ahead = 47
        logger.debug(f"[WEATHER_SERVICE] Forecast hours ahead: {hours_ahead}")
        
        params = {
            'latitude': lat,
            'longitude': lon,
            'hourly': 'temperature_2m,windspeed_10m,precipitation',
            'forecast_hours': 48,
            'wind_speed_unit': 'mph',
            'precipitation_unit': 'inch',
            'temperature_unit': 'fahrenheit'
        }
        
        # Retry logic with exponential backoff
        for attempt in range(self.max_retries):
            logger.debug(f"[WEATHER_SERVICE] Attempt {attempt + 1}/{self.max_retries} to fetch weather")
            try:
                response = requests.get(self.base_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                logger.debug(f"[WEATHER_SERVICE] Weather API response received successfully")
                
                hourly_data = data.get('hourly', {})
                times = hourly_data.get('time', [])
                temps = hourly_data.get('temperature_2m', [])
                winds = hourly_data.get('windspeed_10m', [])
                precips = hourly_data.get('precipitation', [])
                
                hourly_list = []
                for h in range(min(48, len(times))):
                    hourly_list.append({
                        'hour': h,
                        'time': times[h],
                        'temperature': float(temps[h]) if h < len(temps) else 70.0,
                        'wind_speed': float(winds[h]) if h < len(winds) else 10.0,
                        'precipitation': float(precips[h]) if h < len(precips) else 0.0,
                    })
                
                eta_idx = hours_ahead if hours_ahead < len(times) else 0
                weather = {
                    'temperature': float(temps[eta_idx]) if eta_idx < len(temps) else 70.0,
                    'wind_speed': float(winds[eta_idx]) if eta_idx < len(winds) else 10.0,
                    'precipitation': float(precips[eta_idx]) if eta_idx < len(precips) else 0.0,
                    'time': times[eta_idx] if eta_idx < len(times) else eta.isoformat(),
                    'source': 'api',
                    'hourly': hourly_list
                }
                return weather
            except requests.RequestException as e:
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) * 1  # Exponential backoff
                    logger.warning(f"[WEATHER_SERVICE] Attempt {attempt + 1} failed: {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"[WEATHER_SERVICE] Weather API unavailable after {self.max_retries} retries. Using default data for coords ({lat}, {lon})")
        
        # Return default weather data if API fails after all retries
        logger.warning(f"[WEATHER_SERVICE] Using default weather data for coords ({lat}, {lon})")
        default_hourly = [
            {
                'hour': h,
                'time': eta.isoformat(),
                'temperature': 70.0,
                'wind_speed': 10.0,
                'precipitation': 0.0,
            }
            for h in range(48)
        ]
        return {
            'temperature': 70.0,
            'wind_speed': 10.0,
            'precipitation': 0.0,
            'time': eta.isoformat(),
            'source': 'default',
            'hourly': default_hourly
        }
