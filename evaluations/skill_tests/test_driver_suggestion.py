from skills.driver_suggestion.skill import DriverSuggestionSkill

ORDER = {"order_lat": 4.4389, "order_lng": -75.2322}


def test_suggests_nearest_available_driver():
    drivers = [
        {"id": "far", "status": "available", "lat": 4.4600, "lng": -75.2322},
        {"id": "near", "status": "available", "lat": 4.4395, "lng": -75.2322},
        {"id": "busy", "status": "on_route", "lat": 4.4389, "lng": -75.2322},
        {"id": "no-gps", "status": "available", "lat": None, "lng": None},
    ]
    result = DriverSuggestionSkill().run({**ORDER, "drivers": drivers})
    assert result["suggested_driver_id"] == "near"
    assert [candidate["id"] for candidate in result["candidates"]] == ["near", "far"]


def test_no_available_drivers():
    result = DriverSuggestionSkill().run({**ORDER, "drivers": [{"id": "a", "status": "unavailable", "lat": 4.4, "lng": -75.2}]})
    assert result == {"suggested_driver_id": None, "candidates": []}
