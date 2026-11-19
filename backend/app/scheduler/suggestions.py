"""Suggest fixes for coverage gaps. Suggestions are never auto-applied - the manager decides."""
import copy
from datetime import date

from .calendar import weeks_of_month
from .generator import operating_bps, shift_clash
from .types import HARD, IDLE, WEEKLY_OFF, WORK, Conflict, Entries, Entry, SchedInput, Suggestion
from .validator import fmt, validate

MAX_SUGGESTIONS = 3


def apply_changes(entries: Entries, changes: list[dict]) -> Entries:
    new = copy.copy(entries)
    for ch in changes:
        day = ch["day"] if isinstance(ch["day"], date) else date.fromisoformat(ch["day"])
        new[(ch["emp_id"], day)] = Entry(ch["emp_id"], day, ch["status"], list(ch["bp_ids"]),
                                         manual=True, note=ch.get("note", ""))
    return new


def hard_keys(inp: SchedInput, entries: Entries) -> set[str]:
    return {c.key for c in validate(inp, entries) if c.severity == HARD}


def is_safe(inp: SchedInput, entries: Entries, changes: list[dict], target: Conflict, before: set[str]) -> bool:
    """A fix is safe if it removes the target gap and creates no new HARD conflict."""
    after = hard_keys(inp, apply_changes(entries, changes))
    return target.key not in after and not (after - before)


def suggest(inp: SchedInput, entries: Entries, conflict: Conflict) -> list[Suggestion]:
    if conflict.type not in ("COVERAGE_GAP", "UNDERSTAFFED") or conflict.bp_id is None:
        return []
    bp = inp.bps[conflict.bp_id]
    d = conflict.day
    before = hard_keys(inp, entries)
    out: list[Suggestion] = []

    # Option 1: someone on this process is on weekly off -> move their off to another day this week
    week = next(w for w in weeks_of_month(inp.month) if d in w)
    for emp_id in inp.primary_staff(bp.id):
        e = entries.get((emp_id, d))
        if not e or e.status != WEEKLY_OFF:
            continue
        for d2 in week:
            e2 = entries.get((emp_id, d2))
            if d2 == d or not e2 or e2.status not in (WORK, IDLE) or e2.locked:
                continue
            changes = [
                {"emp_id": emp_id, "day": d, "status": WORK, "bp_ids": operating_bps(inp, emp_id, d)},
                {"emp_id": emp_id, "day": d2, "status": WEEKLY_OFF, "bp_ids": []},
            ]
            if is_safe(inp, entries, changes, conflict, before):
                out.append(Suggestion(
                    f"Move {inp.emps[emp_id].name}'s weekly off from {fmt(d)} to {fmt(d2)}.", changes))
                break
        if len(out) >= MAX_SUGGESTIONS:
            return out

    # Option 2: a backup / skilled colleague who is already working (or idle) that day covers it
    candidates = []
    for emp_id, emp in inp.emps.items():
        e = entries.get((emp_id, d))
        if not e or e.status not in (WORK, IDLE) or bp.id in e.bp_ids:
            continue
        is_backup = emp_id in inp.backup_staff(bp.id)
        if not is_backup and bp.process_id not in emp.skills:
            continue
        if len(e.bp_ids) >= emp.max_parallel:
            continue
        if shift_clash([inp.bps[b].shift for b in e.bp_ids] + [bp.shift]):
            continue
        same_pod = emp.pod_id == bp.brand_pod_id
        # rank: configured backup, same pod, least busy
        candidates.append(((0 if is_backup else 1, 0 if same_pod else 1, len(e.bp_ids)), emp_id, e))

    for _, emp_id, e in sorted(candidates, key=lambda x: x[0]):
        if len(out) >= MAX_SUGGESTIONS:
            break
        changes = [{"emp_id": emp_id, "day": d, "status": WORK, "bp_ids": e.bp_ids + [bp.id],
                    "note": f"Covering {bp.label}"}]
        if is_safe(inp, entries, changes, conflict, before):
            emp = inp.emps[emp_id]
            why = "configured backup" if emp_id in inp.backup_staff(bp.id) else "has the skill"
            pod = "same pod" if emp.pod_id == bp.brand_pod_id else "other pod"
            load = f"already on {len(e.bp_ids)} process(es)" if e.bp_ids else "free that day"
            out.append(Suggestion(f"{emp.name} covers {bp.label} on {fmt(d)} ({why}, {pod}, {load}).", changes))

    if not out:
        out.append(Suggestion(
            f"No safe automatic fix for {bp.label} on {fmt(d)}. Manual decision needed: "
            "cancel a weekly off/leave, add a skilled backup, or agree reduced coverage with the client.", []))
    return out
