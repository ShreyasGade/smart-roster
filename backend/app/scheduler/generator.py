"""Roster generator.

Steps (in order):
  1. Keep locked / manual entries (and entries before `from_date` when partially regenerating).
  2. Approved leaves and comp-offs (hard, never overridden).
  3. Everyone else starts as WORK on the processes that operate that day (or IDLE if none do).
  4. Public holidays: give the day off unless that would break minimum coverage
     (then they work and are owed a comp-off).
  5. Weekly offs: pick the least harmful day per week (coverage first, then preference, fairness).
  6. Backup fill: where coverage is still short, use employees configured as BACKUP for that process.
"""
from datetime import date

from .calendar import bp_operates, month_days, offs_needed, required_staff, weeks_of_month
from .types import (
    COMP_OFF, HOLIDAY, IDLE, LEAVE, WEEKLY_OFF, WORK, Entries, Entry, SchedInput,
)


def staffed(inp: SchedInput, entries: Entries, bp_id: int, d: date) -> int:
    """How many people are working on this brand-process on this day."""
    count = 0
    for emp_id in inp.emps:
        e = entries.get((emp_id, d))
        if e and e.status == WORK and bp_id in e.bp_ids:
            count += 1
    return count


def operating_bps(inp: SchedInput, emp_id: int, d: date) -> list[int]:
    return [b for b in inp.primary_bps(emp_id) if bp_operates(inp.bps[b], d, inp.holidays)]


def work_entry(inp: SchedInput, emp_id: int, d: date) -> Entry:
    bps = operating_bps(inp, emp_id, d)
    return Entry(emp_id, d, WORK if bps else IDLE, bps)


def can_take_off(inp: SchedInput, entries: Entries, emp_id: int, d: date) -> bool:
    """True if this employee can be off on day d without any process dropping below minimum."""
    e = entries[(emp_id, d)]
    if e.status != WORK:
        return True
    return all(staffed(inp, entries, b, d) - 1 >= required_staff(inp.bps[b], d, inp.holidays)
               for b in e.bp_ids)


def flexibility(inp: SchedInput, emp_id: int) -> tuple:
    """Sort key: least flexible people first (single-resource owners), people with no processes last."""
    bps = inp.primary_bps(emp_id)
    if not bps:
        return (99, emp_id)
    return (min(len(inp.primary_staff(b)) for b in bps), emp_id)


def generate(inp: SchedInput, keep: Entries | None = None, from_date: date | None = None) -> Entries:
    keep = keep or {}
    days = month_days(inp.month)
    emp_ids = sorted(inp.emps, key=lambda e: flexibility(inp, e))
    entries: Entries = {}
    fixed: set[tuple[int, date]] = set()

    # 1. keep locked/manual entries, and everything before from_date
    for key, e in keep.items():
        if e.locked or e.manual or (from_date and e.day < from_date):
            entries[key] = e
            fixed.add(key)

    # 2. approved leaves
    for lv in inp.leaves:
        key = (lv.emp_id, lv.day)
        if lv.emp_id in inp.emps and lv.day in days and key not in fixed:
            status = COMP_OFF if lv.type == "COMP_OFF" else LEAVE
            note = "Unavailable" if lv.type == "UNAVAILABLE" else ""
            entries[key] = Entry(lv.emp_id, lv.day, status, [], note=note)
            fixed.add(key)

    # 3. default: work
    for emp_id in emp_ids:
        for d in days:
            if (emp_id, d) not in entries:
                entries[(emp_id, d)] = work_entry(inp, emp_id, d)

    # 4. public holidays
    for d in days:
        if d not in inp.holidays:
            continue
        for emp_id in emp_ids:
            key = (emp_id, d)
            if key in fixed:
                continue
            if can_take_off(inp, entries, emp_id, d):
                entries[key] = Entry(emp_id, d, HOLIDAY, [], note=inp.holidays[d])
            else:
                entries[key].note = f"Works on {inp.holidays[d]} - comp-off owed"

    # 5. weekly offs
    sunday_offs = {e: 0 for e in emp_ids}
    for week in weeks_of_month(inp.month):
        for emp_id in emp_ids:
            emp = inp.emps[emp_id]
            # days before from_date / fixed days already count if they are weekly offs
            already = sum(1 for d in week if entries[(emp_id, d)].status == WEEKLY_OFF)
            need = offs_needed(emp.weekly_offs_per_week, week) - already
            for _ in range(max(need, 0)):
                candidates = [d for d in week if (emp_id, d) not in fixed
                              and entries[(emp_id, d)].status in (WORK, IDLE)]
                if not candidates:
                    break
                best = min(candidates, key=lambda d: (off_score(inp, entries, emp_id, d, sunday_offs), d))
                entries[(emp_id, best)] = Entry(emp_id, best, WEEKLY_OFF, [])
                if best.weekday() == 6:
                    sunday_offs[emp_id] += 1

    # 6. backups fill remaining gaps
    fill_with_backups(inp, entries, fixed, days)
    return entries


def off_score(inp: SchedInput, entries: Entries, emp_id: int, d: date, sunday_offs: dict) -> int:
    """Lower is better. Coverage (hard) dominates, then preference and fairness (soft)."""
    emp = inp.emps[emp_id]
    e = entries[(emp_id, d)]
    score = 0
    # HARD: would this break minimum coverage?
    if e.status == WORK:
        for b in e.bp_ids:
            if staffed(inp, entries, b, d) - 1 < required_staff(inp.bps[b], d, inp.holidays):
                score += 1000
    else:
        score -= 50  # none of their processes run that day: a "free" off
    # Avoid days when this person is needed as a backup
    for b in inp.backup_bps(emp_id):
        if staffed(inp, entries, b, d) < required_staff(inp.bps[b], d, inp.holidays):
            score += 100
    # SOFT: don't "waste" a weekly off on a public holiday
    if d in inp.holidays:
        score += 30
    # SOFT: preference
    if emp.preferred_off_day == d.weekday():
        score -= 20
    # SOFT: fairness - share Sunday offs among co-workers who also want Sundays
    if d.weekday() == 6:
        team = {o for b in inp.primary_bps(emp_id) for o in inp.primary_staff(b)
                if inp.emps[o].preferred_off_day == 6} | {emp_id}
        score += 25 * (sunday_offs[emp_id] - min(sunday_offs[o] for o in team))
    # SOFT: spread offs among people sharing a process
    for b in inp.primary_bps(emp_id):
        for other in inp.primary_staff(b):
            if other != emp_id and entries[(other, d)].status == WEEKLY_OFF:
                score += 5
    return score


def fill_with_backups(inp: SchedInput, entries: Entries, fixed: set, days: list[date]) -> None:
    for d in days:
        for b, bp in inp.bps.items():
            need = required_staff(bp, d, inp.holidays) - staffed(inp, entries, b, d)
            for emp_id in inp.backup_staff(b):
                if need <= 0:
                    break
                e = entries.get((emp_id, d))
                # backups can be called in on a public holiday (they then earn a comp-off)
                if not e or (emp_id, d) in fixed or e.status not in (WORK, IDLE, HOLIDAY) or b in e.bp_ids:
                    continue
                if len(e.bp_ids) >= inp.emps[emp_id].max_parallel:
                    continue
                if shift_clash([inp.bps[x].shift for x in e.bp_ids] + [bp.shift]):
                    continue
                if e.status == HOLIDAY:
                    e.note = f"Works on {inp.holidays[d]} - comp-off owed"
                e.status = WORK
                e.bp_ids = e.bp_ids + [b]
                e.note = (e.note + "; " if e.note else "") + f"Backup for {bp.label}"
                need -= 1


def shift_clash(shifts: list[str]) -> bool:
    return "MORNING" in shifts and "EVENING" in shifts
