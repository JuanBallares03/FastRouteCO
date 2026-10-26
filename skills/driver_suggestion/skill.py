"""Skill: suggests the most suitable driver for an order (RF05, HU-29 CA01 and R02)."""

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill
from skills.geofence_check.skill import haversine_m, validate_coordinates


@register_skill
class DriverSuggestionSkill(BaseSkill):
    name = "driver_suggestion"

    def run(self, params: dict) -> dict:
        order_lat, order_lng = params.get("order_lat"), params.get("order_lng")
        validate_coordinates(order_lat, order_lng)
        drivers = params.get("drivers")
        if not isinstance(drivers, list):
            raise ValueError("'drivers' must be a list")

        candidates = []
        for driver in drivers:
            # HU-29 R02: only available drivers can be assigned; drivers without a known position are skipped.
            if driver.get("status") != "available" or driver.get("lat") is None or driver.get("lng") is None:
                continue
            distance = haversine_m(order_lat, order_lng, driver["lat"], driver["lng"])
            candidates.append({"id": driver["id"], "distance_m": round(distance, 1)})

        candidates.sort(key=lambda candidate: candidate["distance_m"])
        return {
            "suggested_driver_id": candidates[0]["id"] if candidates else None,
            "candidates": candidates,
        }
