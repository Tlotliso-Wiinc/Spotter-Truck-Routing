import logging
import requests
import threading
import time
from copy import deepcopy
from datetime import datetime
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Minimum seconds between Open-Meteo HTTP calls (free tier rate limit)
_MIN_REQUEST_INTERVAL = 0.25


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
        }

    @staticmethod
    def _cache_key(lat: float, lon: float) -> Tuple[float, float]:
        return (round(lat, 2), round(lon, 2))

    def prefetch_locations(self, coords_list: List[Dict]) -> None:
        """Fetch forecasts once per unique rounded location, sequentially."""
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
        for key in unique_keys:
            self._get_or_fetch_forecast(key[0], key[1])

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

    def _fetch_forecast_from_api(self, lat: float, lon: float) -> Dict:
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
                f"[WEATHER_SERVICE] API attempt {attempt + 1}/{self.max_retries} "
                f"for ({lat:.4f}, {lon:.4f})"
            )
            try:
                response = requests.get(self.base_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                self.stats['api_calls'] += 1
                hourly_list = self._parse_hourly(data)
                logger.debug(f"[WEATHER_SERVICE] Forecast received for ({lat:.4f}, {lon:.4f})")
                return {'source': 'api', 'hourly': hourly_list}
            except requests.RequestException as e:
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) * 1
                    logger.warning(
                        f"[WEATHER_SERVICE] Attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(
                        f"[WEATHER_SERVICE] Weather API unavailable after {self.max_retries} "
                        f"retries for ({lat}, {lon})"
                    )

        self.stats['fallback_locations'] += 1
        logger.warning(f"[WEATHER_SERVICE] Using default weather data for ({lat}, {lon})")
        return self._default_forecast()

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
