import pytest

from skills.trial_status.skill import TrialStatusSkill


def run(today):
    return TrialStatusSkill().run({"renewal_date": "2026-11-08", "today": today})


def test_active_trial():
    assert run("2026-11-01") == {"days_remaining": 7, "expired": False, "notify_expiration": False}


def test_two_day_notice():
    assert run("2026-11-06")["notify_expiration"] is True


def test_expired_trial():
    assert run("2026-11-08") == {"days_remaining": 0, "expired": True, "notify_expiration": False}


def test_rejects_invalid_date():
    with pytest.raises(ValueError):
        TrialStatusSkill().run({"renewal_date": "08/11/2026", "today": "2026-11-01"})
