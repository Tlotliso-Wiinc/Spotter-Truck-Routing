from django.db import models
from django.utils import timezone


class Trip(models.Model):
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    origin_coords = models.JSONField()
    destination_coords = models.JSONField()
    departure_time = models.DateTimeField()
    load_weight = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.origin} to {self.destination}"
