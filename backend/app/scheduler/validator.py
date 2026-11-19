"""Checks a roster and returns a list of conflicts with plain-English messages."""
from collections import defaultdict
from datetime import date

from .calendar import DAY_NAMES, month_days, offs_needed, required_staff, weeks_of_month
from .generator import shift_clash
from .types import (
    HARD, HOLIDAY, INFO, SOFT, WEEKLY_OFF, WORK, Conflict, Entries, SchedInput,
)


def fmt(d: date) -> str:
    return f"{DAY_NAMES[d.weekday()]} {d.day} {d.strftime('%b')}"


def coverage(inp: SchedInput, entries: Entries) -> dict[tuple[int, date], tuple[int, int]]:
    """(bp_id, day) -> (staffed, required) for every brand-process and day of the month."""
    counts: dict[tuple[int, date], int] = defaultdict(int)
    for e in entries.values():
        if e.status == WORK:
            for b in e.bp_ids:
                counts[(b, e.day)] += 1
    result = {}
    for d in month_days(inp.month):
        for b, bp in inp.bps.items():
            result[(b, d)] = (counts[(b, d)], required_staff(bp, d, inp.holidays))
    return result


def describe_status(inp: SchedInput, entries: Entries, emp_id: int, d: date) -> str:
    e = entries.get((emp_id, d))
    name = inp.emps[emp_id].name
    if not e:
        return f"{name}: no entry"
    label = e.status.replace("_", " ").lower()
    return f"{name}: {label}" + (f" ({e.note})" if e.note and e.status != WORK else "")


def validate(inp: SchedInput, entries: Entries) -> list[Conflict]:
    conflicts: list[Conflict] = []
    cov = coverage(inp, entries)
    leave_days = {(lv.emp_id, lv.day) for lv in inp.leaves}

    # 1. Coverage gaps / understaffing (HARD)
    gaps_by_day: dict[date, set[int]] = defaultdict(set)
    for (b, d), (have, need) in sorted(cov.items(), key=lambda x: (x[0][1], x[0][0])):
        if have >= need:
            continue
        bp = inp.bps[b]
        gaps_by_day[d].add(b)
        people = inp.primary_staff(b)
        reasons = "; ".join(describe_status(inp, entries, p, d) for p in people) or "nobody is assigned"
        if have == 0:
            msg = f"{bp.label} needs {need} on {fmt(d)} but nobody is working it. ({reasons})"
            ctype = "COVERAGE_GAP"
        else:
            msg = f"{bp.label} needs {need} on {fmt(d)} but only {have} working. ({reasons})"
            ctype = "UNDERSTAFFED"
        conflicts.append(Conflict(ctype, HARD, d, msg, bp_id=b))

    for (emp_id, d), e in entries.items():
        emp = inp.emps.get(emp_id)
        if not emp:
            continue
        # 2. Working on an approved leave day (HARD)
        if e.status == WORK and (emp_id, d) in leave_days:
            conflicts.append(Conflict("LEAVE_CONFLICT", HARD, d,
                f"{emp.name} is rostered to work on {fmt(d)} but has approved leave.", emp_id=emp_id))
        if e.status != WORK:
            continue
        shifts = [inp.bps[b].shift for b in e.bp_ids if b in inp.bps]
        # 3. Incompatible shifts (HARD)
        if shift_clash(shifts):
            conflicts.append(Conflict("SHIFT_CLASH", HARD, d,
                f"{emp.name} has both MORNING and EVENING shift processes on {fmt(d)}.", emp_id=emp_id))
        # 4. Too many processes at once (SOFT)
        if len(e.bp_ids) > emp.max_parallel:
            conflicts.append(Conflict("OVERLOAD", SOFT, d,
                f"{emp.name} covers {len(e.bp_ids)} processes on {fmt(d)} (limit {emp.max_parallel}).",
                emp_id=emp_id))
        # 5. Working a public holiday (SOFT)
        if d in inp.holidays:
            conflicts.append(Conflict("HOLIDAY_WORKED", SOFT, d,
                f"{emp.name} works on {inp.holidays[d]} ({fmt(d)}) - a comp-off is owed.", emp_id=emp_id))

    # 6. Weekly offs and preferences, per week (SOFT)
    for week in weeks_of_month(inp.month):
        for emp_id, emp in inp.emps.items():
            offs = [d for d in week if entries.get((emp_id, d)) and entries[(emp_id, d)].status == WEEKLY_OFF]
            need = offs_needed(emp.weekly_offs_per_week, week)
            if len(offs) < need:
                conflicts.append(Conflict("MISSING_WEEKLY_OFF", SOFT, week[0],
                    f"{emp.name} gets {len(offs)} weekly off(s) in the week of {fmt(week[0])}, entitled to {need}.",
                    emp_id=emp_id))
            pref = emp.preferred_off_day
            pref_days = [d for d in week if d.weekday() == pref]
            if offs and pref_days and not any(d.weekday() == pref for d in offs):
                pref_entry = entries.get((emp_id, pref_days[0]))
                if pref_entry and pref_entry.status not in (HOLIDAY,):
                    conflicts.append(Conflict("PREFERENCE_IGNORED", SOFT, week[0],
                        f"{emp.name} prefers {DAY_NAMES[pref]} off, but got {fmt(offs[0])} "
                        f"(week of {fmt(week[0])}) to keep coverage.", emp_id=emp_id))

    # 7. One absent person causing gaps in 2+ brands (INFO, groups the impact)
    for d, gap_bps in gaps_by_day.items():
        for emp_id, emp in inp.emps.items():
            e = entries.get((emp_id, d))
            if not e or e.status == WORK:
                continue
            brands = {inp.bps[b].brand_name for b in inp.primary_bps(emp_id) if b in gap_bps}
            if len(brands) >= 2:
                conflicts.append(Conflict("MULTI_BRAND_IMPACT", INFO, d,
                    f"{emp.name} being off on {fmt(d)} leaves gaps in {len(brands)} brands: "
                    f"{', '.join(sorted(brands))}.", emp_id=emp_id))

    order = {HARD: 0, SOFT: 1, INFO: 2}
    conflicts.sort(key=lambda c: (order[c.severity], c.day, c.type))
    return conflicts


def diff_conflicts(before: list[Conflict], after: list[Conflict]) -> dict:
    """Compare two validation runs (used when something changes)."""
    b = {c.key: c for c in before}
    a = {c.key: c for c in after}
    return {
        "new": [a[k] for k in a if k not in b],
        "resolved": [b[k] for k in b if k not in a],
    }
