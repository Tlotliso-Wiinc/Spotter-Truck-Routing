from rest_framework import viewsets, status
from rest_framework.response import Response
from .serializers import RouteRequestSerializer, RoutePlanSerializer
from ..services.route_service import RouteService
from ..services.weather_service import WeatherService
from ..services.risk_engine import RiskEngine
from ..services.recommendation_engine import RecommendationEngine


class RoutePlanViewSet(viewsets.ViewSet):
    def create(self, request):
        serializer = RouteRequestSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            # Initialize services
            route_service = RouteService()
            weather_service = WeatherService()
            risk_engine = RiskEngine()
            recommendation_engine = RecommendationEngine()
            
            # Generate routes
            routes = route_service.generate_routes(
                origin_coords=data['origin_coords'],
                destination_coords=data['destination_coords'],
                departure_time=data.get('departure_time')
            )
            
            # Add weather data and risk assessment to each route
            for route in routes:
                checkpoints = route_service.generate_checkpoints(route)
                for checkpoint in checkpoints:
                    weather = weather_service.get_weather_at_checkpoint(
                        checkpoint['coords'],
                        checkpoint['eta']
                    )
                    checkpoint['weather'] = weather
                    checkpoint['risk_level'] = risk_engine.assess_risk(
                        weather,
                        data.get('load_weight')
                    )
                route['checkpoints'] = checkpoints
                route['risk_summary'] = risk_engine.calculate_route_risk_summary(
                    checkpoints,
                    data.get('load_weight')
                )
            
            # Recommend best route
            recommended_route = recommendation_engine.recommend_route(routes)
            
            response_data = {
                'routes': routes,
                'recommended_route_id': recommended_route['route_id']
            }
            
            response_serializer = RoutePlanSerializer(response_data)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
