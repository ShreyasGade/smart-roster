"""Calendar helpers: which days exist, when a brand-process operates, how many staff it needs."""
import calendar as _cal
from datetime import date

from .types import BP

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Calendar presets -> (operating weekdays, works on public holidays)
PRESETS = {
    "ALL_DAYS": ([0, 1, 2, 3, 4, 5, 6], True),            # 365-day operations
    "NO_HOLIDAYS": ([0, 1, 2, 3, 4, 5, 6], False),        # every day except public holidays
    "NO_SUN_NO_HOLIDAYS": ([0, 1, 2, 3, 4, 5], False),    # Sundays and public holidays off
}


def month_days(month: str) -> list[date]:
    year, mon = map(int, month.split("-"))
    count = _cal.monthrange(year, mon)[1]
    return [date(year, mon, d) for d in range(1, count + 1)]


def weeks_of_month(month: str) -> list[list[date]]:
    """Group the month's days into Mon-Sun weeks. First/last weeks may be partial."""
    weeks: list[list[date]] = []
    for d in month_days(month):
        if not weeks or d.weekday() == 0:
            weeks.append([])
        weeks[-1].append(d)
    return weeks


def offs_needed(offs_per_week: int, week: list[date]) -> int:
    """Weekly offs owed in a Mon-Sun week of this month.

    A week "belongs" to the month that contains its Sunday. So the partial week at the
    end of a month (e.g. Mon 28 - Thu 31) owes no off here; it is counted next month.
    """
    if week[-1].weekday() != 6:
        return 0
    return min(offs_per_week, len(week))


def bp_operates(bp: BP, d: date, holidays: dict) -> bool:
    if d.weekday() not in bp.weekdays:
        return False
    if d in holidays and not bp.works_on_holidays:
        return False
    return True


def required_staff(bp: BP, d: date, holidays: dict) -> int:
    """Minimum people needed. Date override > weekday override > default."""
    if not bp_operates(bp, d, holidays):
        return 0
    date_key = f"date:{d.isoformat()}"
    weekday_key = f"weekday:{d.weekday()}"
    if date_key in bp.overrides:
        return int(bp.overrides[date_key])
    if weekday_key in bp.overrides:
        return int(bp.overrides[weekday_key])
    return bp.min_staff
