"""Roster use-cases: generate, read (always re-validated), edit, simulate a change, publish."""
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import ChangeLog, Employee, Leave, Roster, RosterEntry
from ..scheduler import generator
from ..scheduler.suggestions import apply_changes, suggest
from ..scheduler.types import HARD, INFO, Conflict, Entries, Entry, SchedInput
from ..scheduler.validator import coverage, diff_conflicts, fmt, validate
from .loader import as_date, load_input, pending_leaves


# ---------- storage helpers ----------

def get_roster(db: Session, month: str) -> Roster | None:
    return db.scalar(select(Roster).where(Roster.month == month))


def require_roster(db: Session, month: str) -> Roster:
    roster = get_roster(db, month)
    if not roster:
        raise HTTPException(404, f"No roster for {month}. Generate it first.")
    return roster


def load_entries(db: Session, roster: Roster) -> Entries:
    rows = db.scalars(select(RosterEntry).where(RosterEntry.roster_id == roster.id))
    return {(r.employee_id, r.date): Entry(r.employee_id, r.date, r.status, list(r.bp_ids or []),
                                           r.is_locked, r.is_manual, r.note or "") for r in rows}


def save_entries(db: Session, roster: Roster, entries: Entries) -> None:
    db.execute(delete(RosterEntry).where(RosterEntry.roster_id == roster.id))
    for e in entries.values():
        db.add(RosterEntry(roster_id=roster.id, employee_id=e.emp_id, date=e.day, status=e.status,
                           bp_ids=e.bp_ids, is_locked=e.locked, is_manual=e.manual, note=e.note))


def log(db: Session, roster: Roster, description: str, details: dict | None = None) -> None:
    db.add(ChangeLog(roster_id=roster.id, description=description, details=details or {}))


# ---------- serialisation ----------

def entry_dict(e: Entry) -> dict:
    return {"emp_id": e.emp_id, "date": e.day.isoformat(), "status": e.status, "bp_ids": e.bp_ids,
            "locked": e.locked, "manual": e.manual, "note": e.note}


def conflict_dict(c: Conflict) -> dict:
    return {"key": c.key, "type": c.type, "severity": c.severity, "date": c.day.isoformat(),
            "message": c.message, "bp_id": c.bp_id, "emp_id": c.emp_id,
            "suggestions": [{"description": s.description,
                             "changes": [{**ch, "day": str(ch["day"])} for ch in s.changes]}
                            for s in c.suggestions]}


def check(db: Session, inp: SchedInput, entries: Entries, with_suggestions=True) -> list[Conflict]:
    conflicts = validate(inp, entries)
    if with_suggestions:
        for c in conflicts:
            if c.severity == HARD:
                c.suggestions = suggest(inp, entries, c)
    for lv in pending_leaves(db, inp.month):
        emp = inp.emps.get(lv.employee_id)
        if emp:
            conflicts.append(Conflict("PENDING_LEAVE", INFO, lv.date,
                f"{emp.name} has a PENDING leave request for {fmt(lv.date)}. Approve it to include it.",
                emp_id=emp.id))
    return conflicts


# ---------- use-cases ----------

def generate(db: Session, month: str, from_date: str | None = None, keep_manual: bool = True) -> dict:
    inp = load_input(db, month)
    roster = get_roster(db, month)
    keep = {}
    if roster:
        keep = load_entries(db, roster)
        if not keep_manual:
            keep = {k: e for k, e in keep.items() if e.locked}
        roster.version += 1
        roster.status = "DRAFT"
        roster.generated_at = datetime.now(timezone.utc)
    else:
        roster = Roster(month=month)
        db.add(roster)
        db.flush()
    entries = generator.generate(inp, keep, as_date(from_date) if from_date else None)
    save_entries(db, roster, entries)
    log(db, roster, f"Roster generated (v{roster.version})" + (f" from {from_date}" if from_date else ""))
    db.commit()
    return report(db, month)


def report(db: Session, month: str) -> dict:
    """Full roster: entries, coverage per brand-process per day, and current conflicts."""
    roster = require_roster(db, month)
    inp = load_input(db, month)
    entries = load_entries(db, roster)
    conflicts = check(db, inp, entries)
    cov = coverage(inp, entries)
    hard = sum(1 for c in conflicts if c.severity == HARD)
    required_slots = sum(1 for (have, need) in cov.values() if need > 0)
    covered_slots = sum(1 for (have, need) in cov.values() if need > 0 and have >= need)
    return {
        "roster": {"id": roster.id, "month": roster.month, "status": roster.status,
                   "version": roster.version, "generated_at": roster.generated_at.isoformat()},
        "entries": [entry_dict(e) for e in sorted(entries.values(), key=lambda e: (e.emp_id, e.day))],
        "coverage": [{"bp_id": b, "date": d.isoformat(), "staffed": have, "required": need}
                     for (b, d), (have, need) in cov.items()],
        "conflicts": [conflict_dict(c) for c in conflicts],
        "summary": {"hard": hard, "soft": sum(1 for c in conflicts if c.severity == "SOFT"),
                    "info": sum(1 for c in conflicts if c.severity == INFO),
                    "coverage_pct": round(100 * covered_slots / required_slots, 1) if required_slots else 100,
                    "required_slots": required_slots, "covered_slots": covered_slots},
        "holidays": {d.isoformat(): n for d, n in inp.holidays.items()},
    }


def preview_or_apply(db: Session, month: str, changes: list[dict], apply: bool, description: str) -> dict:
    """Validate the impact of changes. If apply=True, save them (marked as manual)."""
    roster = require_roster(db, month)
    inp = load_input(db, month)
    entries = load_entries(db, roster)
    for ch in changes:
        if ch["emp_id"] not in inp.emps:
            raise HTTPException(400, f"Unknown employee {ch['emp_id']}")
    before = validate(inp, entries)
    new_entries = apply_changes(entries, changes)
    after = validate(inp, new_entries)
    diff = diff_conflicts(before, after)
    for c in diff["new"]:
        if c.severity == HARD:
            c.suggestions = suggest(inp, new_entries, c)
    if apply:
        save_entries(db, roster, new_entries)
        if roster.status == "PUBLISHED":
            roster.status = "DRAFT"
            description += " (published roster changed - back to DRAFT)"
        log(db, roster, description, {"changes": [{**c, "day": str(c["day"])} for c in changes]})
        db.commit()
    return {"applied": apply, "description": description,
            "new_conflicts": [conflict_dict(c) for c in diff["new"]],
            "resolved_conflicts": [conflict_dict(c) for c in diff["resolved"]]}


def mark_unavailable(db: Session, month: str, emp_id: int, dates: list[str], leave_type: str,
                     apply: bool) -> dict:
    """Change handling: someone becomes unavailable after the roster was generated."""
    emp = db.get(Employee, emp_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    status = "COMP_OFF" if leave_type == "COMP_OFF" else "LEAVE"
    changes = [{"emp_id": emp_id, "day": d, "status": status, "bp_ids": [], "note": "Marked unavailable"}
               for d in dates]
    result = preview_or_apply(db, month, changes, apply, f"{emp.name} unavailable on {', '.join(dates)}")
    if apply:
        for d in dates:
            db.add(Leave(employee_id=emp_id, date=as_date(d), type=leave_type, status="APPROVED",
                         note="Added via change simulator"))
        db.commit()
    return result


def publish(db: Session, month: str, force: bool) -> dict:
    roster = require_roster(db, month)
    inp = load_input(db, month)
    hard = [c for c in validate(inp, load_entries(db, roster)) if c.severity == HARD]
    if hard and not force:
        raise HTTPException(400, f"{len(hard)} HARD conflict(s) must be resolved first (or publish with force).")
    roster.status = "PUBLISHED"
    log(db, roster, "Roster published" + (f" with {len(hard)} known HARD conflict(s)" if hard else ""))
    db.commit()
    return {"status": roster.status, "hard_conflicts": len(hard)}


def change_log(db: Session, month: str) -> list[dict]:
    roster = require_roster(db, month)
    rows = db.scalars(select(ChangeLog).where(ChangeLog.roster_id == roster.id).order_by(ChangeLog.id.desc()))
    return [{"at": r.at.isoformat(), "description": r.description} for r in rows]

