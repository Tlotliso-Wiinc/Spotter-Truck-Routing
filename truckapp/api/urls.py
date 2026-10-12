from django.urls import path
from .views import RoutePlanViewSet

urlpatterns = [
    path('routes/', RoutePlanViewSet.as_view({'post': 'create'}), name='route-plan'),
]
