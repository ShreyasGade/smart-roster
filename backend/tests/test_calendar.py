from datetime import date

from app.scheduler.calendar import bp_operates, month_days, offs_needed, required_staff, weeks_of_month
from helpers import bp

HOL = {date(2026, 12, 25): "Christmas"}


def test_month_days():
    assert len(month_days("2026-12")) == 31
    assert len(month_days("2027-02")) == 28


def test_weeks_are_mon_to_sun():
    weeks = weeks_of_month("2026-12")  # Dec 1 2026 is a Tuesday
    assert weeks[0][0] == date(2026, 12, 1) and len(weeks[0]) == 6
    assert all(w[0].weekday() == 0 for w in weeks[1:])
    assert sum(len(w) for w in weeks) == 31


def test_offs_owed_by_week_containing_sunday():
    weeks = weeks_of_month("2026-12")
    assert offs_needed(1, weeks[0]) == 1   # Tue 1 - Sun 6
    assert offs_needed(1, weeks[-1]) == 0  # Mon 28 - Thu 31, counted in January
    assert offs_needed(2, [date(2026, 11, 1)]) == 1  # a 1-day week can only hold 1 off


def test_all_days_works_sunday_and_holiday():
    b = bp(1, "A", preset="ALL_DAYS")
    assert bp_operates(b, date(2026, 12, 13), HOL)  # Sunday
    assert bp_operates(b, date(2026, 12, 25), HOL)


def test_no_holidays_preset():
    b = bp(1, "A", preset="NO_HOLIDAYS")
    assert bp_operates(b, date(2026, 12, 13), HOL)
    assert not bp_operates(b, date(2026, 12, 25), HOL)


def test_no_sunday_preset():
    b = bp(1, "A", preset="NO_SUN_NO_HOLIDAYS")
    assert not bp_operates(b, date(2026, 12, 13), HOL)
    assert bp_operates(b, date(2026, 12, 14), HOL)


def test_overrides():
    b = bp(1, "A", min_staff=1, overrides={"weekday:0": 2, "date:2026-12-14": 3})
    assert required_staff(b, date(2026, 12, 7), HOL) == 2   # Monday
    assert required_staff(b, date(2026, 12, 14), HOL) == 3  # date beats weekday
    assert required_staff(b, date(2026, 12, 8), HOL) == 1


def test_not_operating_needs_zero():
    b = bp(1, "A", preset="NO_SUN_NO_HOLIDAYS", min_staff=2)
    assert required_staff(b, date(2026, 12, 13), HOL) == 0
