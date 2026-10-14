import logging
import os
import requests
import threading
import time
from copy import deepcopy
from datetime import datetime
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Minimum seconds between Open-Meteo HTTP calls (free tier rate limit)
_MIN_REQUEST_INTERVAL = 0.25

# Visual Crossing API configuration
VISUAL_CROSSING_BASE_URL = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'
VISUAL_CROSSING_API_KEY = os.getenv('VISUAL_CROSSING_API_KEY', '')


class WeatherService:
    def __init__(self):
        self.base_url = 'https://api.open-meteo.com/v1/forecast'
        self.max_retries = 3
        self._forecast_cache: Dict[Tuple[float, float], Dict] = {}
        self._cache_lock = threading.Lock()
        self._fetch_lock = threading.Lock()
        self._last_request_at = 0.0
        self.stats = {
            'api_calls': 0,
            'cache_hits': 0,
            'fallback_locations': 0,
            'visual_crossing_calls': 0,
        }

    @staticmethod
    def _cache_key(lat: float, lon: float) -> Tuple[float, float]:
        return (round(lat, 2), round(lon, 2))

    def prefetch_locations(self, coords_list: List[Dict]) -> None:
        """Fetch forecasts once per unique rounded location using batch API."""
        seen = set()
        unique_keys: List[Tuple[float, float]] = []
        for coords in coords_list:
            key = self._cache_key(coords['lat'], coords['lng'])
            if key not in seen:
                seen.add(key)
                unique_keys.append(key)

        logger.info(
            f"[WEATHER_SERVICE] Prefetching {len(unique_keys)} unique locations "
            f"({len(coords_list)} checkpoints)"
        )
        
        # Filter out already cached locations
        uncached_keys = []
        with self._cache_lock:
            for key in unique_keys:
                if key not in self._forecast_cache:
                    uncached_keys.append(key)
        
        if not uncached_keys:
            logger.info("[WEATHER_SERVICE] All locations already cached")
            return
        
        # Use batch API for uncached locations
        self._fetch_batch_forecasts(uncached_keys)

    def get_weather_at_checkpoint(self, coords: Dict, eta: datetime) -> Dict:
        """Weather at checkpoint ETA, reusing cached 48h forecast for the location."""
        lat = coords['lat']
        lon = coords['lng']
        logger.debug(f"[WEATHER_SERVICE] Weather for coords ({lat:.4f}, {lon:.4f}) at ETA {eta}")

        forecast = self._get_or_fetch_forecast(lat, lon)
        return self._weather_for_eta(forecast, eta)

    def _get_or_fetch_forecast(self, lat: float, lon: float) -> Dict:
        key = self._cache_key(lat, lon)
        with self._cache_lock:
            if key in self._forecast_cache:
                self.stats['cache_hits'] += 1
                return self._forecast_cache[key]

        with self._fetch_lock:
            with self._cache_lock:
                if key in self._forecast_cache:
                    self.stats['cache_hits'] += 1
                    return self._forecast_cache[key]

            forecast = self._fetch_forecast_from_api(lat, lon)
            with self._cache_lock:
                self._forecast_cache[key] = forecast
            return forecast

    def _throttle_before_request(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < _MIN_REQUEST_INTERVAL:
            time.sleep(_MIN_REQUEST_INTERVAL - elapsed)
        self._last_request_at = time.monotonic()

    def _fetch_batch_forecasts(self, keys: List[Tuple[float, float]]) -> None:
        """Fetch forecasts for multiple locations using Open-Meteo batch API."""
        # Open-Meteo allows up to 1000 locations per batch request
        # Split into batches if needed
        batch_size = 500
        for i in range(0, len(keys), batch_size):
            batch = keys[i:i + batch_size]
            self._fetch_single_batch(batch)

    def _fetch_single_batch(self, keys: List[Tuple[float, float]]) -> None:
        """Fetch a single batch of forecasts."""
        lats = [key[0] for key in keys]
        lons = [key[1] for key in keys]
        
        params = {
            'latitude': ','.join(str(lat) for lat in lats),
            'longitude': ','.join(str(lon) for lon in lons),
            'hourly': 'temperature_2m,windspeed_10m,precipitation',
            'forecast_hours': 48,
            'wind_speed_unit': 'mph',
            'precipitation_unit': 'inch',
            'temperature_unit': 'fahrenheit',
        }

        for attempt in range(self.max_retries):
            self._throttle_before_request()
            logger.debug(
                f"[WEATHER_SERVICE] Batch API attempt {attempt + 1}/{self.max_retries} "
                f"for {len(keys)} locations"
            )
            try:
                response = requests.get(self.base_url, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()
                self.stats['api_calls'] += 1
                
                # Parse batch response
                if isinstance(data, list):
                    # Batch response returns list of forecasts
                    for idx, location_data in enumerate(data):
                        if idx < len(keys):
                            key = keys[idx]
                            hourly_list = self._parse_hourly(location_data)
                            with self._cache_lock:
                                self._forecast_cache[key] = {
                                    'source': 'api',
                                    'hourly': hourly_list
                                }
                    logger.debug(
                        f"[WEATHER_SERVICE] Batch forecast received for {len(keys)} locations"
                    )
                else:
                    # Single location response (fallback)
                    hourly_list = self._parse_hourly(data)
                    key = keys[0]
                    with self._cache_lock:
                        self._forecast_cache[key] = {
                            'source': 'api',
                            'hourly': hourly_list
                        }
                    logger.debug(f"[WEATHER_SERVICE] Forecast received for {key}")
                return
            except requests.RequestException as e:
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) * 1
                    logger.warning(
                        f"[WEATHER_SERVICE] Batch attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(
                        f"[WEATHER_SERVICE] Batch weather API unavailable after "
                        f"{self.max_retries} retries for {len(keys)} locations"
                    )
                    # Fall back to individual requests for this batch
                    logger.warning(
                        f"[WEATHER_SERVICE] Falling back to individual requests for "
                        f"{len(keys)} locations"
                    )
                    for key in keys:
                        forecast = self._fetch_forecast_from_api(key[0], key[1])
                        with self._cache_lock:
                            self._forecast_cache[key] = forecast

    def _fetch_forecast_from_api(self, lat: float, lon: float) -> Dict:
        # Try Open-Meteo first
        forecast = self._fetch_from_open_meteo(lat, lon)
        if forecast['source'] != 'default':
            return forecast
        
        # Fall back to Visual Crossing if Open-Meteo failed
        logger.info(f"[WEATHER_SERVICE] Falling back to Visual Crossing API for ({lat:.4f}, {lon:.4f})")
        forecast = self._fetch_from_visual_crossing(lat, lon)
        if forecast['source'] != 'default':
            return forecast
        
        # Final fallback to default data
        self.stats['fallback_locations'] += 1
        logger.warning(f"[WEATHER_SERVICE] Using default weather data for ({lat}, {lon})")
        return self._default_forecast()

    def _fetch_from_open_meteo(self, lat: float, lon: float) -> Dict:
        """Fetch forecast from Open-Meteo API."""
        params = {
            'latitude': lat,
            'longitude': lon,
            'hourly': 'temperature_2m,windspeed_10m,precipitation',
            'forecast_hours': 48,
            'wind_speed_unit': 'mph',
            'precipitation_unit': 'inch',
            'temperature_unit': 'fahrenheit',
        }

        for attempt in range(self.max_retries):
            self._throttle_before_request()
            logger.debug(
                f"[WEATHER_SERVICE] Open-Meteo attempt {attempt + 1}/{self.max_retries} "
                f"for ({lat:.4f}, {lon:.4f})"
            )
            try:
                response = requests.get(self.base_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                self.stats['api_calls'] += 1
                hourly_list = self._parse_hourly(data)
                logger.debug(f"[WEATHER_SERVICE] Open-Meteo forecast received for ({lat:.4f}, {lon:.4f})")
                return {'source': 'api', 'hourly': hourly_list}
            except requests.RequestException as e:
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) * 1
                    logger.warning(
                        f"[WEATHER_SERVICE] Open-Meteo attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(
                        f"[WEATHER_SERVICE] Open-Meteo unavailable after {self.max_retries} "
                        f"retries for ({lat}, {lon})"
                    )
        
        return self._default_forecast()

    def _fetch_from_visual_crossing(self, lat: float, lon: float) -> Dict:
        """Fetch forecast from Visual Crossing API as fallback."""
        if not VISUAL_CROSSING_API_KEY:
            logger.warning("[WEATHER_SERVICE] Visual Crossing API key not configured")
            return self._default_forecast()
        
        location = f"{lat},{lon}"
        params = {
            'key': VISUAL_CROSSING_API_KEY,
            'contentType': 'json',
            'include': 'hours',
            'unitGroup': 'us',  # Fahrenheit, mph, inches
        }
        
        url = f"{VISUAL_CROSSING_BASE_URL}/{location}"
        
        for attempt in range(self.max_retries):
            self._throttle_before_request()
            logger.debug(
                f"[WEATHER_SERVICE] Visual Crossing attempt {attempt + 1}/{self.max_retries} "
                f"for ({lat:.4f}, {lon:.4f})"
            )
            try:
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                self.stats['api_calls'] += 1
                self.stats['visual_crossing_calls'] += 1
                hourly_list = self._parse_visual_crossing_hourly(data)
                logger.debug(f"[WEATHER_SERVICE] Visual Crossing forecast received for ({lat:.4f}, {lon:.4f})")
                return {'source': 'visual_crossing', 'hourly': hourly_list}
            except requests.RequestException as e:
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) * 1
                    logger.warning(
                        f"[WEATHER_SERVICE] Visual Crossing attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(
                        f"[WEATHER_SERVICE] Visual Crossing unavailable after {self.max_retries} "
                        f"retries for ({lat}, {lon})"
                    )
        
        return self._default_forecast()

    @staticmethod
    def _parse_visual_crossing_hourly(data: Dict) -> List[Dict]:
        """Parse Visual Crossing API response to match our hourly format."""
        hourly_list = []
        days = data.get('days', [])
        
        hour_count = 0
        for day in days:
            hours = day.get('hours', [])
            for hour_data in hours:
                if hour_count >= 48:
                    break
                hourly_list.append({
                    'hour': hour_count,
                    'time': hour_data.get('datetime', ''),
                    'temperature': float(hour_data.get('temp', 70.0)),
                    'wind_speed': float(hour_data.get('windspeed', 10.0)),
                    'precipitation': float(hour_data.get('precip', 0.0)),
                })
                hour_count += 1
            if hour_count >= 48:
                break
        
        # Fill remaining hours with defaults if less than 48
        while len(hourly_list) < 48:
            hourly_list.append({
                'hour': len(hourly_list),
                'time': '',
                'temperature': 70.0,
                'wind_speed': 10.0,
                'precipitation': 0.0,
            })
        
        return hourly_list

    @staticmethod
    def _parse_hourly(data: Dict) -> List[Dict]:
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
        return hourly_list

    @staticmethod
    def _default_forecast() -> Dict:
        hourly_list = [
            {
                'hour': h,
                'time': '',
                'temperature': 70.0,
                'wind_speed': 10.0,
                'precipitation': 0.0,
            }
            for h in range(48)
        ]
        return {'source': 'default', 'hourly': hourly_list}

    def _weather_for_eta(self, forecast: Dict, eta: datetime) -> Dict:
        if eta.tzinfo is not None:
            now = datetime.now(eta.tzinfo)
        else:
            now = datetime.now()

        hours_ahead = int((eta - now).total_seconds() / 3600)
        if hours_ahead < 0:
            hours_ahead = 0
        if hours_ahead > 47:
            hours_ahead = 47

        hourly_list = deepcopy(forecast['hourly'])
        source = forecast['source']
        eta_idx = hours_ahead if hours_ahead < len(hourly_list) else 0
        point = hourly_list[eta_idx] if hourly_list else {
            'temperature': 70.0,
            'wind_speed': 10.0,
            'precipitation': 0.0,
            'time': eta.isoformat(),
        }

        return {
            'temperature': point['temperature'],
            'wind_speed': point['wind_speed'],
            'precipitation': point['precipitation'],
            'time': point.get('time') or eta.isoformat(),
            'source': source,
            'hourly': hourly_list,
        }
