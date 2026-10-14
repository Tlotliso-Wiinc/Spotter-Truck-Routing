import logging
from concurrent.futures import ThreadPoolExecutor
from rest_framework import viewsets, status
from rest_framework.response import Response
from .serializers import RouteRequestSerializer, RoutePlanSerializer
from ..services.route_service import RouteService
from ..services.weather_service import WeatherService
from ..services.risk_engine import RiskEngine
from ..services.recommendation_engine import RecommendationEngine

logger = logging.getLogger(__name__)


class RoutePlanViewSet(viewsets.ViewSet):
    def create(self, request):
        logger.info("[ROUTE_PLAN] Starting route plan request")
        serializer = RouteRequestSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            origin_coords = data.get('origin_coords')
            destination_coords = data.get('destination_coords')
            departure_time = data.get('departure_time')
            load_weight = data.get('load_weight')
            
            logger.info(f"[ROUTE_PLAN] Request validated - Origin: {data.get('origin')}, Destination: {data.get('destination')}, Departure: {departure_time}, Load: {load_weight} lbs")
            
            # Initialize services
            route_service = RouteService()
            weather_service = WeatherService()
            risk_engine = RiskEngine()
            recommendation_engine = RecommendationEngine()
            
            # Geocode if coords not provided
            if not origin_coords or not origin_coords.get('lat'):
                origin_coords = route_service.geocode(data.get('origin'))
            if not destination_coords or not destination_coords.get('lat'):
                destination_coords = route_service.geocode(data.get('destination'))
            
            if not origin_coords or not destination_coords:
                logger.error("[ROUTE_PLAN] Could not resolve coordinates for origin or destination")
                return Response(
                    {'error': 'Could not resolve geographic coordinates for the given origin or destination.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate routes
            logger.info("[ROUTE_PLAN] Generating routes via RouteService")
            routes = route_service.generate_routes(
                origin_coords=origin_coords,
                destination_coords=destination_coords,
                departure_time=departure_time
            )
            
            if not routes:
                logger.error("[ROUTE_PLAN] No routes could be generated")
                return Response(
                    {'error': 'No routes could be found between the specified locations.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            all_coords = []
            route_checkpoints = []
            for route in routes:
                checkpoints = route_service.generate_checkpoints(
                    route, departure_time=departure_time
                )
                route_checkpoints.append(checkpoints)
                all_coords.extend(cp['coords'] for cp in checkpoints)

            weather_service.prefetch_locations(all_coords)

            def process_checkpoint(checkpoint):
                weather = weather_service.get_weather_at_checkpoint(
                    checkpoint['coords'],
                    checkpoint['eta']
                )
                hourly_list = weather.pop('hourly', [])
                checkpoint['weather'] = weather
                checkpoint['risk_level'] = risk_engine.assess_risk(
                    weather,
                    load_weight
                )

                hourly_forecast = []
                for item in hourly_list:
                    h_risk = risk_engine.assess_risk(item, load_weight)
                    hourly_forecast.append({
                        'hour': item['hour'],
                        'time': item['time'],
                        'temperature': item['temperature'],
                        'wind_speed': item['wind_speed'],
                        'precipitation': item['precipitation'],
                        'risk_level': h_risk
                    })
                checkpoint['hourly_forecast'] = hourly_forecast
                return checkpoint

            logger.info(
                f"[ROUTE_PLAN] Processing risk for {len(routes)} routes "
                f"(weather stats: {weather_service.stats})"
            )
            with ThreadPoolExecutor(max_workers=8) as executor:
                for idx, route in enumerate(routes):
                    checkpoints = route_checkpoints[idx]
                    list(executor.map(process_checkpoint, checkpoints))
                    route['checkpoints'] = checkpoints
                    route['risk_summary'] = risk_engine.calculate_route_risk_summary(
                        checkpoints,
                        load_weight
                    )
                    logger.info(
                        f"[ROUTE_PLAN] Route {route.get('name')} risk summary: "
                        f"{route['risk_summary']['overall_risk']}"
                    )
            
            # Recommend best route
            recommended_route = recommendation_engine.recommend_route(routes)
            
            weather_degraded = weather_service.stats['fallback_locations'] > 0
            response_data = {
                'routes': routes,
                'recommended_route_id': recommended_route['route_id'] if recommended_route else (routes[0]['route_id'] if routes else None),
                'weather_data_degraded': weather_degraded,
                'weather_stats': dict(weather_service.stats),
            }
            
            logger.info("[ROUTE_PLAN] Route plan completed successfully")
            response_serializer = RoutePlanSerializer(response_data)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        
        logger.error(f"[ROUTE_PLAN] Validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
