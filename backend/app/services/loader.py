"""Turns database rows into the plain scheduler input."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Assignment, Brand, BrandProcess, Employee, Holiday, Leave, Process
from ..scheduler.calendar import month_days
from ..scheduler.types import BP, Assign, Emp, LeaveIn, SchedInput


def load_input(db: Session, month: str) -> SchedInput:
    days = month_days(month)
    first, last = days[0], days[-1]

    brands = {b.id: b for b in db.scalars(select(Brand))}
    processes = {p.id: p for p in db.scalars(select(Process))}
    bps = {}
    for r in db.scalars(select(BrandProcess)):
        brand, proc = brands.get(r.brand_id), processes.get(r.process_id)
        if not brand or not proc:
            continue
        bps[r.id] = BP(r.id, brand.id, brand.name, brand.pod_id, proc.id, proc.code,
                       list(r.operating_weekdays or []), r.works_on_holidays, r.min_staff,
                       dict(r.min_staff_overrides or {}), r.shift or "GENERAL")

    employees = list(db.scalars(select(Employee).where(Employee.active)))
    assignments = [Assign(a.employee_id, a.brand_process_id, a.role)
                   for a in db.scalars(select(Assignment)) if a.brand_process_id in bps]
    emps = {}
    for e in employees:
        assigned_procs = {bps[a.bp_id].process_id for a in assignments if a.emp_id == e.id}
        emps[e.id] = Emp(e.id, e.name, e.pod_id, e.weekly_offs_per_week, e.preferred_off_day,
                         e.max_parallel_processes, set(e.skill_process_ids or []) | assigned_procs)
    assignments = [a for a in assignments if a.emp_id in emps]

    holidays = {h.date: h.name for h in db.scalars(select(Holiday)) if first <= h.date <= last}
    leaves = [LeaveIn(lv.employee_id, lv.date, lv.type)
              for lv in db.scalars(select(Leave).where(Leave.status == "APPROVED"))
              if first <= lv.date <= last]
    return SchedInput(month, emps, bps, assignments, holidays, leaves)


def pending_leaves(db: Session, month: str) -> list[Leave]:
    days = month_days(month)
    return [lv for lv in db.scalars(select(Leave).where(Leave.status == "PENDING"))
            if days[0] <= lv.date <= days[-1]]


def as_date(value) -> date:
    return value if isinstance(value, date) else date.fromisoformat(value)
