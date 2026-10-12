from django.contrib import admin
from .models.Trip import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['id', 'origin', 'destination', 'created_at']
    list_filter = ['created_at']
    search_fields = ['origin', 'destination']
