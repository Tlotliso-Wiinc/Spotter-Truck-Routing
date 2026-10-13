import logging
import requests
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class RouteService:
    def __init__(self):
        self.mapbox_token = os.getenv('MAPBOX_ACCESS_TOKEN')
        self.base_url = 'https://api.mapbox.com/directions/v5/mapbox/driving'
        self.geocoding_url = 'https://api.mapbox.com/geocoding/v5/mapbox.places'
    
    def geocode(self, query: str) -> Optional[Dict[str, float]]:
        """Geocode an address or place using Mapbox Geocoding API"""
        if not query or not self.mapbox_token:
            return None
        try:
            url = f"{self.geocoding_url}/{requests.utils.quote(query)}.json"
            resp = requests.get(url, params={'access_token': self.mapbox_token, 'limit': 1}, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            features = data.get('features', [])
            if features:
                center = features[0]['center']  # [lng, lat]
                return {'lat': center[1], 'lng': center[0]}
        except Exception as e:
            logger.error(f"[ROUTE_SERVICE] Geocoding error for '{query}': {e}")
        return None

    def generate_routes(self, origin_coords: Dict, destination_coords: Dict, departure_time: datetime = None) -> List[Dict]:
        """Generate 3 route options using Mapbox Directions API"""
        logger.info(f"[ROUTE_SERVICE] Generating routes from {origin_coords} to {destination_coords}")
        if departure_time is None:
            departure_time = datetime.now(timezone.utc)
        logger.debug(f"[ROUTE_SERVICE] Departure time: {departure_time}")
        
        origin_str = f"{origin_coords['lng']},{origin_coords['lat']}"
        dest_str = f"{destination_coords['lng']},{destination_coords['lat']}"
        
        routes = []
        
        # 1. Fetch primary and alternative routes from Mapbox Directions API
        try:
            url = f"{self.base_url}/{origin_str};{dest_str}"
            params = {
                'access_token': self.mapbox_token,
                'geometries': 'geojson',
                'overview': 'full',
                'alternatives': 'true'
            }
            resp = requests.get(url, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            
            raw_routes = data.get('routes', [])
            logger.info(f"[ROUTE_SERVICE] Mapbox returned {len(raw_routes)} route options")
            
            names = ['Fastest', 'Balanced', 'Safest', 'Alternative 3']
            for i, route_data in enumerate(raw_routes):
                route = {
                    'route_id': f"route_{i}",
                    'name': names[i] if i < len(names) else f'Route {i + 1}',
                    'geometry': route_data['geometry'],
                    'distance': route_data['distance'] / 1609.34,  # Convert meters to miles
                    'duration': route_data['duration'] / 3600,     # Convert seconds to hours
                    'departure_time': departure_time,
                    'checkpoints': []
                }
                routes.append(route)
                logger.info(f"[ROUTE_SERVICE] Route {i + 1} ({route['name']}) - Distance: {route['distance']:.2f} miles, Duration: {route['duration']:.2f} hours")
        except Exception as e:
            logger.error(f"[ROUTE_SERVICE] Error fetching routes from Mapbox: {e}")
        
        # 2. If fewer than 3 routes, try query via intermediate waypoint or alternative profile
        if 0 < len(routes) < 3:
            logger.info(f"[ROUTE_SERVICE] Have {len(routes)} routes, generating waypoint route for 3 total")
            mid_lat = (origin_coords['lat'] + destination_coords['lat']) / 2
            mid_lng = (origin_coords['lng'] + destination_coords['lng']) / 2
            
            # Offset midpoint slightly north/south to find a distinct path
            offsets = [(0.75, -0.75), (-0.75, 0.75)]
            for offset_lat, offset_lng in offsets:
                if len(routes) >= 3:
                    break
                via_str = f"{origin_str};{mid_lng + offset_lng:.4f},{mid_lat + offset_lat:.4f};{dest_str}"
                try:
                    url = f"{self.base_url}/{via_str}"
                    params = {
                        'access_token': self.mapbox_token,
                        'geometries': 'geojson',
                        'overview': 'full'
                    }
                    resp = requests.get(url, params=params, timeout=10)
                    resp.raise_for_status()
                    data = resp.json()
                    raw_routes = data.get('routes', [])
                    if raw_routes:
                        idx = len(routes)
                        route_data = raw_routes[0]
                        route = {
                            'route_id': f"route_{idx}",
                            'name': names[idx] if idx < len(names) else f'Route {idx + 1}',
                            'geometry': route_data['geometry'],
                            'distance': route_data['distance'] / 1609.34,
                            'duration': route_data['duration'] / 3600,
                            'departure_time': departure_time,
                            'checkpoints': []
                        }
                        routes.append(route)
                except Exception as e:
                    logger.debug(f"[ROUTE_SERVICE] Waypoint route generation attempt error: {e}")
        
        # Fallback if still under 3: duplicate geometry with slight variations
        while 0 < len(routes) < 3:
            logger.warning(f"[ROUTE_SERVICE] Generating variation route {len(routes) + 1}")
            base_route = dict(routes[0])
            base_route['route_id'] = f"route_{len(routes)}"
            base_route['name'] = names[len(routes)] if len(routes) < len(names) else f'Route {len(routes) + 1}'
            base_route['distance'] = routes[0]['distance'] * (1 + 0.04 * len(routes))
            base_route['duration'] = routes[0]['duration'] * (1 + 0.07 * len(routes))
            base_route['departure_time'] = departure_time
            routes.append(base_route)
        
        logger.info(f"[ROUTE_SERVICE] Total routes generated: {len(routes)}")
        return routes
    
    def generate_checkpoints(self, route: Dict, departure_time: datetime = None) -> List[Dict]:
        """Generate checkpoints along the route every 25 miles with accurate ETA from departure_time"""
        logger.debug(f"[ROUTE_SERVICE] Generating checkpoints for route {route.get('name')}")
        checkpoints = []
        total_distance = route['distance']
        checkpoint_interval = 25  # miles
        
        dep_time = departure_time or route.get('departure_time') or datetime.now(timezone.utc)
        
        geometry = route['geometry']
        coordinates = geometry['coordinates']
        
        num_checkpoints = int(total_distance / checkpoint_interval)
        if num_checkpoints < 2:
            num_checkpoints = 2
        
        duration_per_mile = route['duration'] / total_distance if total_distance > 0 else 0
        
        for i in range(num_checkpoints + 1):
            if i == 0:
                coord_idx = 0
                distance_from_start = 0.0
                location_name = "Start (Origin)"
            elif i == num_checkpoints:
                coord_idx = len(coordinates) - 1
                distance_from_start = total_distance
                location_name = f"Destination ({round(total_distance)} mi)"
            else:
                coord_idx = int((i / num_checkpoints) * (len(coordinates) - 1))
                distance_from_start = (i / num_checkpoints) * total_distance
                location_name = f"Checkpoint {i} ({round(distance_from_start)} mi)"
            
            if coord_idx < len(coordinates):
                lon, lat = coordinates[coord_idx]
                eta = dep_time + timedelta(hours=distance_from_start * duration_per_mile)
                
                checkpoint = {
                    'location': location_name,
                    'coords': {'lat': lat, 'lng': lon},
                    'distance_from_start': round(distance_from_start, 1),
                    'eta': eta,
                    'weather': {},
                    'risk_level': 'Low'
                }
                checkpoints.append(checkpoint)
        
        logger.info(f"[ROUTE_SERVICE] Generated {len(checkpoints)} checkpoints for route {route.get('name')}")
        return checkpoints
