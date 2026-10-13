import requests
from datetime import datetime
from typing import Dict
import time


class WeatherService:
    def __init__(self):
        self.base_url = 'https://api.open-meteo.com/v1/forecast'
        self.max_retries = 3
    
    def get_weather_at_checkpoint(self, coords: Dict, eta: datetime) -> Dict:
        """Get weather forecast for a checkpoint at the estimated arrival time"""
        lat = coords['lat']
        lon = coords['lng']
        
        # Calculate hours from now for the forecast
        hours_ahead = int((eta - datetime.now()).total_seconds() / 3600)
        if hours_ahead < 0:
            hours_ahead = 0
        if hours_ahead > 48:
            hours_ahead = 48
        
        params = {
            'latitude': lat,
            'longitude': lon,
            'hourly': 'temperature_2m,windspeed_10m,precipitation',
            'forecast_hours': hours_ahead + 1
        }
        
        # Retry logic with exponential backoff
        for attempt in range(self.max_retries):
            try:
                response = requests.get(self.base_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                hourly_data = data.get('hourly', {})
                if hours_ahead < len(hourly_data.get('time', [])):
                    weather = {
                        'temperature': hourly_data.get('temperature_2m', [])[hours_ahead],
                        'wind_speed': hourly_data.get('windspeed_10m', [])[hours_ahead],
                        'precipitation': hourly_data.get('precipitation', [])[hours_ahead],
                        'time': hourly_data.get('time', [])[hours_ahead],
                        'source': 'api'
                    }
                    return weather
            except requests.RequestException as e:
                if attempt < self.max_retries - 1:
                    wait_time = (2 ** attempt) * 1  # Exponential backoff: 1s, 2s, 4s
                    time.sleep(wait_time)
                else:
                    # Log only on final failure
                    print(f"Weather API unavailable after {self.max_retries} retries. Using default data for coords ({lat}, {lon})")
        
        # Return default weather data if API fails after all retries
        return {
            'temperature': 70,
            'wind_speed': 10,
            'precipitation': 0,
            'time': eta.isoformat(),
            'source': 'default'
        }
