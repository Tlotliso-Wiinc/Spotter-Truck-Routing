import logging
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
            logger.info(f"[ROUTE_PLAN] Request validated - Origin: {data['origin_coords']}, Destination: {data['destination_coords']}, Load Weight: {data.get('load_weight')}")
            
            # Initialize services
            logger.info("[ROUTE_PLAN] Initializing services")
            route_service = RouteService()
            weather_service = WeatherService()
            risk_engine = RiskEngine()
            recommendation_engine = RecommendationEngine()
            
            # Generate routes
            logger.info("[ROUTE_PLAN] Generating routes via RouteService")
            routes = route_service.generate_routes(
                origin_coords=data['origin_coords'],
                destination_coords=data['destination_coords'],
                departure_time=data.get('departure_time')
            )
            logger.info(f"[ROUTE_PLAN] Generated {len(routes)} routes")
            
            # Add weather data and risk assessment to each route
            logger.info("[ROUTE_PLAN] Processing weather and risk for each route")
            for idx, route in enumerate(routes):
                logger.info(f"[ROUTE_PLAN] Processing route {idx + 1}/{len(routes)}: {route['name']}")
                checkpoints = route_service.generate_checkpoints(route)
                logger.info(f"[ROUTE_PLAN] Generated {len(checkpoints)} checkpoints for route {route['name']}")
                for checkpoint in checkpoints:
                    logger.debug(f"[ROUTE_PLAN] Fetching weather for checkpoint at {checkpoint['coords']}")
                    weather = weather_service.get_weather_at_checkpoint(
                        checkpoint['coords'],
                        checkpoint['eta']
                    )
                    checkpoint['weather'] = weather
                    logger.debug(f"[ROUTE_PLAN] Weather data received - Temp: {weather.get('temperature')}, Wind: {weather.get('wind_speed')}, Precip: {weather.get('precipitation')}")
                    checkpoint['risk_level'] = risk_engine.assess_risk(
                        weather,
                        data.get('load_weight')
                    )
                    logger.debug(f"[ROUTE_PLAN] Risk level assessed: {checkpoint['risk_level']}")
                route['checkpoints'] = checkpoints
                route['risk_summary'] = risk_engine.calculate_route_risk_summary(
                    checkpoints,
                    data.get('load_weight')
                )
                logger.info(f"[ROUTE_PLAN] Route {route['name']} risk summary - Overall: {route['risk_summary']['overall_risk']}, Avg Score: {route['risk_summary']['average_risk_score']:.2f}")
            
            # Recommend best route
            logger.info("[ROUTE_PLAN] Recommending best route via RecommendationEngine")
            recommended_route = recommendation_engine.recommend_route(routes)
            logger.info(f"[ROUTE_PLAN] Recommended route: {recommended_route['name'] if recommended_route else 'None'}")
            
            response_data = {
                'routes': routes,
                'recommended_route_id': recommended_route['route_id'] if recommended_route else None
            }
            
            logger.info("[ROUTE_PLAN] Route plan completed successfully")
            response_serializer = RoutePlanSerializer(response_data)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        
        logger.error(f"[ROUTE_PLAN] Validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
