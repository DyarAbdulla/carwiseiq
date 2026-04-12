"""Unit tests for push notification prefs and admin_send validation."""
from __future__ import annotations

import pytest

from app.services import push_notifications as push


def test_merge_push_prefs_defaults_when_empty_or_partial():
    d = push.merge_push_prefs({"locale": "en", "priceMin": None, "priceMax": None})
    assert d["newListing"] is True
    assert d["priceDrop"] is True
    assert d["marketTrend"] is True


def test_merge_push_prefs_snake_case_aliases():
    d = push.merge_push_prefs(
        {
            "new_listing": False,
            "price_drop": True,
            "market_trend": False,
        }
    )
    assert d["newListing"] is False
    assert d["priceDrop"] is True
    assert d["marketTrend"] is False


def test_merge_push_prefs_camel_case_overrides_snake():
    d = push.merge_push_prefs({"new_listing": False, "newListing": True})
    assert d["newListing"] is True


def _patch_admin_send_guards(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NOTIFICATIONS_CRON_SECRET", "secret")
    monkeypatch.setattr(push, "vapid_configured", lambda: True)
    monkeypatch.setattr(push, "supabase_rest_ready", lambda: True)
    monkeypatch.setattr(push, "is_iraq_sending_window", lambda now=None: True)


def test_admin_send_requires_market_trend_fields(monkeypatch):
    _patch_admin_send_guards(monkeypatch)
    r = push.admin_send({"type": "market_trend"}, "secret")
    assert r.get("status") == 400
    assert "make" in (r.get("error") or "").lower()


def test_admin_send_requires_new_price_for_price_drop(monkeypatch):
    _patch_admin_send_guards(monkeypatch)
    r = push.admin_send({"type": "price_drop"}, "secret")
    assert r.get("status") == 400
    assert "newprice" in (r.get("error") or "").lower()
