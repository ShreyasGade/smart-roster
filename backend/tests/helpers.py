"""Small builders for scheduler tests."""
from app.scheduler.calendar import PRESETS
from app.scheduler.types import BP, Assign, Emp, SchedInput

PROC = {"CS": 1, "ACC": 2, "NDR": 3}


def bp(id, brand, code="CS", preset="ALL_DAYS", min_staff=1, overrides=None, shift="GENERAL", pod=1):
    weekdays, hol = PRESETS[preset]
    return BP(id, id, brand, pod, PROC[code], code, list(weekdays), hol, min_staff, overrides or {}, shift)


def emp(id, pref=None, pod=1, skills=()):
    return Emp(id, f"E{id}", pod, preferred_off_day=pref, skills=set(skills))


def make_input(emps, bps, assigns, month="2026-12", holidays=None, leaves=None):
    return SchedInput(month, {e.id: e for e in emps}, {b.id: b for b in bps},
                      [Assign(*a) for a in assigns], holidays or {}, leaves or [])
