import pytest

from skills.geofence_check.skill import GeofenceCheckSkill

STOP = {"stop_lat": 4.4389, "stop_lng": -75.2322}  # Ibagué


def test_inside_geofence():
    result = GeofenceCheckSkill().run({**STOP, "device_lat": 4.4391, "device_lng": -75.2322, "radius_m": 50})
    assert result["inside"] is True
    assert 20 < result["distance_m"] < 25


def test_outside_geofence():
    result = GeofenceCheckSkill().run({**STOP, "device_lat": 4.4420, "device_lng": -75.2322, "radius_m": 50})
    assert result["inside"] is False


def test_rejects_invalid_radius_and_coordinates():
    with pytest.raises(ValueError):
        GeofenceCheckSkill().run({**STOP, "device_lat": 4.44, "device_lng": -75.23, "radius_m": 0})
    with pytest.raises(ValueError):
        GeofenceCheckSkill().run({**STOP, "device_lat": 95, "device_lng": -75.23, "radius_m": 50})
