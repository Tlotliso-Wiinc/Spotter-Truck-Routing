import requests
import os
from datetime import datetime, timedelta
from typing import List, Dict


class RouteService:
    def __init__(self):
        self.mapbox_token = os.getenv('MAPBOX_ACCESS_TOKEN')
        self.base_url = 'https://api.mapbox.com/directions/v5/mapbox/driving'
    
    def generate_routes(self, origin_coords: Dict, destination_coords: Dict, departure_time: datetime = None) -> List[Dict]:
        """Generate 3 route options using Mapbox Directions API"""
        if departure_time is None:
            departure_time = datetime.now()
        
        origin_str = f"{origin_coords['lng']},{origin_coords['lat']}"
        dest_str = f"{destination_coords['lng']},{destination_coords['lat']}"
        
        routes = []
        profiles = ['driving', 'driving-traffic', 'driving']
        
        for i, profile in enumerate(profiles):
            url = f"{self.base_url}/{origin_str};{dest_str}"
            params = {
                'access_token': self.mapbox_token,
                'geometries': 'geojson',
                'overview': 'full',
                'alternatives': 'true' if i == 0 else 'false'
            }
            
            try:
                response = requests.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                if data.get('routes'):
                    route_data = data['routes'][0]
                    route = {
                        'route_id': f"route_{i}",
                        'name': self._get_route_name(i),
                        'geometry': route_data['geometry'],
                        'distance': route_data['distance'] / 1609.34,  # Convert meters to miles
                        'duration': route_data['duration'] / 3600,  # Convert seconds to hours
                        'checkpoints': []
                    }
                    routes.append(route)
            except requests.RequestException as e:
                print(f"Error fetching route: {e}")
                continue
        
        # Ensure we have at least 3 routes by adding variations if needed
        while len(routes) < 3 and len(routes) > 0:
            base_route = routes[0].copy()
            base_route['route_id'] = f"route_{len(routes)}"
            base_route['name'] = self._get_route_name(len(routes))
            base_route['distance'] *= (1 + 0.05 * len(routes))
            base_route['duration'] *= (1 + 0.08 * len(routes))
            routes.append(base_route)
        
        return routes
    
    def _get_route_name(self, index: int) -> str:
        names = ['Fastest', 'Balanced', 'Safest']
        return names[index] if index < len(names) else f'Route {index + 1}'
    
    def generate_checkpoints(self, route: Dict) -> List[Dict]:
        """Generate checkpoints along the route every 25 miles"""
        checkpoints = []
        total_distance = route['distance']
        checkpoint_interval = 25  # miles
        
        geometry = route['geometry']
        coordinates = geometry['coordinates']
        
        num_checkpoints = int(total_distance / checkpoint_interval)
        if num_checkpoints < 2:
            num_checkpoints = 2
        
        for i in range(num_checkpoints + 1):
            if i == num_checkpoints:
                # Last checkpoint is the destination
                coord_idx = len(coordinates) - 1
                distance_from_start = total_distance
            else:
                coord_idx = int((i / num_checkpoints) * (len(coordinates) - 1))
                distance_from_start = (i / num_checkpoints) * total_distance
            
            if coord_idx < len(coordinates):
                lon, lat = coordinates[coord_idx]
                duration_per_mile = route['duration'] / total_distance
                eta = datetime.now() + timedelta(hours=distance_from_start * duration_per_mile)
                
                checkpoint = {
                    'location': f"Checkpoint {i + 1}",
                    'coords': {'lat': lat, 'lng': lon},
                    'distance_from_start': distance_from_start,
                    'eta': eta,
                    'weather': {},
                    'risk_level': 'Low'
                }
                checkpoints.append(checkpoint)
        
        return checkpoints
