from rest_framework import serializers


class RouteRequestSerializer(serializers.Serializer):
    origin = serializers.CharField(max_length=255)
    destination = serializers.CharField(max_length=255)
    origin_coords = serializers.DictField()
    destination_coords = serializers.DictField()
    departure_time = serializers.DateTimeField(required=False)
    load_weight = serializers.IntegerField(required=False, allow_null=True)


class CheckpointSerializer(serializers.Serializer):
    location = serializers.CharField()
    coords = serializers.DictField()
    distance_from_start = serializers.FloatField()
    eta = serializers.DateTimeField()
    weather = serializers.DictField()
    risk_level = serializers.CharField()


class RouteSerializer(serializers.Serializer):
    route_id = serializers.CharField()
    name = serializers.CharField()
    geometry = serializers.DictField()
    distance = serializers.FloatField()
    duration = serializers.FloatField()
    checkpoints = CheckpointSerializer(many=True)
    risk_summary = serializers.DictField()
    is_recommended = serializers.BooleanField()


class RoutePlanSerializer(serializers.Serializer):
    routes = RouteSerializer(many=True)
    recommended_route_id = serializers.CharField()
