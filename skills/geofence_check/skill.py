"""Skill: geofence arrival detection for a route stop (RF14, HU-15 CA04)."""

import math

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in meters between two coordinates."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def validate_coordinates(lat, lng) -> None:
    if not isinstance(lat, (int, float)) or not -90 <= lat <= 90:
        raise ValueError("Latitude must be a number between -90 and 90")
    if not isinstance(lng, (int, float)) or not -180 <= lng <= 180:
        raise ValueError("Longitude must be a number between -180 and 180")


@register_skill
class GeofenceCheckSkill(BaseSkill):
    name = "geofence_check"

    def run(self, params: dict) -> dict:
        validate_coordinates(params.get("stop_lat"), params.get("stop_lng"))
        validate_coordinates(params.get("device_lat"), params.get("device_lng"))
        radius = params.get("radius_m")
        # The geofence radius is a platform parameter (TO BE DEFINED), so it is always an input.
        if not isinstance(radius, (int, float)) or radius <= 0:
            raise ValueError("'radius_m' must be a positive number")

        distance = haversine_m(params["stop_lat"], params["stop_lng"], params["device_lat"], params["device_lng"])
        return {"inside": distance <= radius, "distance_m": round(distance, 1)}
