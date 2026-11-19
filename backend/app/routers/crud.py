"""Generic list/create/update/delete endpoints for the setup tables.

Keeps the code small: every setup table gets the same 4 endpoints. The operations manager can
change employees, brands, rules and assignments without touching code.
"""
from datetime import date
from typing import Callable

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import Date, delete, select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Assignment, Brand, BrandProcess, Employee, Holiday, Leave, Pod, Process, RosterEntry,
)
from ..scheduler.calendar import PRESETS


def to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def clean_payload(model, payload: dict) -> dict:
    data = {}
    for col in model.__table__.columns:
        if col.name == "id" or col.name not in payload:
            continue
        value = payload[col.name]
        if isinstance(col.type, Date) and isinstance(value, str):
            value = date.fromisoformat(value)
        data[col.name] = value
    return data


def make_crud(model, path: str, before_save: Callable | None = None, on_delete: Callable | None = None):
    router = APIRouter(prefix=f"/api/{path}", tags=[path])

    @router.get("")
    def list_items(db: Session = Depends(get_db)):
        return [to_dict(o) for o in db.scalars(select(model).order_by(model.id))]

    @router.post("")
    def create_item(payload: dict = Body(...), db: Session = Depends(get_db)):
        obj = model(**clean_payload(model, payload))
        if before_save:
            before_save(obj)
        db.add(obj)
        try:
            db.commit()
        except Exception as exc:  # e.g. missing required field
            db.rollback()
            raise HTTPException(400, f"Could not save: {exc.__class__.__name__}") from exc
        return to_dict(obj)

    @router.put("/{item_id}")
    def update_item(item_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
        obj = db.get(model, item_id)
        if not obj:
            raise HTTPException(404, "Not found")
        for key, value in clean_payload(model, payload).items():
            setattr(obj, key, value)
        if before_save:
            before_save(obj)
        db.commit()
        return to_dict(obj)

    @router.delete("/{item_id}")
    def delete_item(item_id: int, db: Session = Depends(get_db)):
        obj = db.get(model, item_id)
        if not obj:
            raise HTTPException(404, "Not found")
        if on_delete:
            on_delete(db, item_id)
        db.delete(obj)
        db.commit()
        return {"deleted": item_id}

    return router


# ---- hooks ----

def apply_preset(bp: BrandProcess) -> None:
    """Presets fill in the operating days; CUSTOM keeps whatever weekdays were chosen."""
    if bp.calendar_preset in PRESETS:
        weekdays, on_holidays = PRESETS[bp.calendar_preset]
        bp.operating_weekdays = list(weekdays)
        bp.works_on_holidays = on_holidays
    bp.min_staff = max(int(bp.min_staff or 0), 0)


def delete_employee_refs(db: Session, emp_id: int) -> None:
    db.execute(delete(Assignment).where(Assignment.employee_id == emp_id))
    db.execute(delete(Leave).where(Leave.employee_id == emp_id))
    db.execute(delete(RosterEntry).where(RosterEntry.employee_id == emp_id))
    db.execute(update(Pod).where(Pod.lead_employee_id == emp_id).values(lead_employee_id=None))


def delete_bp_refs(db: Session, bp_id: int) -> None:
    db.execute(delete(Assignment).where(Assignment.brand_process_id == bp_id))


def delete_brand_refs(db: Session, brand_id: int) -> None:
    for bp in db.scalars(select(BrandProcess).where(BrandProcess.brand_id == brand_id)):
        delete_bp_refs(db, bp.id)
        db.delete(bp)


def delete_process_refs(db: Session, process_id: int) -> None:
    for bp in db.scalars(select(BrandProcess).where(BrandProcess.process_id == process_id)):
        delete_bp_refs(db, bp.id)
        db.delete(bp)


def delete_pod_refs(db: Session, pod_id: int) -> None:
    db.execute(update(Employee).where(Employee.pod_id == pod_id).values(pod_id=None))
    db.execute(update(Brand).where(Brand.pod_id == pod_id).values(pod_id=None))


routers = [
    make_crud(Pod, "pods", on_delete=delete_pod_refs),
    make_crud(Employee, "employees", on_delete=delete_employee_refs),
    make_crud(Process, "processes", on_delete=delete_process_refs),
    make_crud(Brand, "brands", on_delete=delete_brand_refs),
    make_crud(BrandProcess, "brand-processes", before_save=apply_preset, on_delete=delete_bp_refs),
    make_crud(Assignment, "assignments"),
    make_crud(Holiday, "holidays"),
    make_crud(Leave, "leaves"),
]
