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
        """Get weather forecast for a checkpoint at the estimated arrival time"""
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
        if hours_ahead > 48:
            hours_ahead = 48
        logger.debug(f"[WEATHER_SERVICE] Forecast hours ahead: {hours_ahead}")
        
        params = {
            'latitude': lat,
            'longitude': lon,
            'hourly': 'temperature_2m,windspeed_10m,precipitation',
            'forecast_hours': max(hours_ahead + 1, 24),
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
                if times and hours_ahead < len(times):
                    weather = {
                        'temperature': float(hourly_data.get('temperature_2m', [70])[hours_ahead]),
                        'wind_speed': float(hourly_data.get('windspeed_10m', [10])[hours_ahead]),
                        'precipitation': float(hourly_data.get('precipitation', [0.0])[hours_ahead]),
                        'time': times[hours_ahead],
                        'source': 'api'
                    }
                    logger.info(f"[WEATHER_SERVICE] Weather data from API - Temp: {weather['temperature']}°F, Wind: {weather['wind_speed']} mph, Precip: {weather['precipitation']} in")
                    return weather
            except requests.RequestException as e:
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) * 1  # Exponential backoff: 1s, 2s, 4s
                    logger.warning(f"[WEATHER_SERVICE] Attempt {attempt + 1} failed: {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"[WEATHER_SERVICE] Weather API unavailable after {self.max_retries} retries. Using default data for coords ({lat}, {lon})")
        
        # Return default weather data if API fails after all retries
        logger.warning(f"[WEATHER_SERVICE] Using default weather data for coords ({lat}, {lon})")
        return {
            'temperature': 70.0,
            'wind_speed': 10.0,
            'precipitation': 0.0,
            'time': eta.isoformat(),
            'source': 'default'
        }
