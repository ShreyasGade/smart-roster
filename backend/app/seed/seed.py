"""Insert the sample data when the database is empty."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Assignment, Brand, BrandProcess, Employee, Holiday, Leave, Pod, Process
from ..scheduler.calendar import PRESETS
from . import seed_data as data


def seed_if_empty(db: Session) -> bool:
    if db.scalar(select(Employee.id).limit(1)):
        return False

    procs = {}
    for code, name in data.PROCESSES:
        procs[code] = Process(code=code, name=name)
        db.add(procs[code])
    pods = {}
    for name in data.PODS:
        pods[name] = Pod(name=name)
        db.add(pods[name])
    db.flush()

    emps = {}
    for i, (name, pod, pref, skills, is_lead) in enumerate(data.EMPLOYEES):
        email = name.lower().replace(" ", ".") + "@example.com"
        e = Employee(name=name, email=email, pod_id=pods[pod].id, is_pod_lead=is_lead,
                     preferred_off_day=pref, skill_process_ids=[procs[s].id for s in skills])
        db.add(e)
        emps[name] = e
    db.flush()
    for name, pod, _, _, is_lead in data.EMPLOYEES:
        if is_lead:
            pods[pod].lead_employee_id = emps[name].id

    for brand_name, pod, processes in data.BRANDS:
        brand = Brand(name=brand_name, pod_id=pods[pod].id)
        db.add(brand)
        db.flush()
        for code, preset, min_staff, overrides, shift, primaries, backups in processes:
            if isinstance(preset, list):
                weekdays, on_holidays, preset_name = preset, False, "CUSTOM"
            else:
                weekdays, on_holidays = PRESETS[preset]
                preset_name = preset
            bp = BrandProcess(brand_id=brand.id, process_id=procs[code].id, calendar_preset=preset_name,
                              operating_weekdays=list(weekdays), works_on_holidays=on_holidays,
                              min_staff=min_staff, min_staff_overrides=overrides, shift=shift)
            db.add(bp)
            db.flush()
            for name in primaries:
                db.add(Assignment(employee_id=emps[name].id, brand_process_id=bp.id, role="PRIMARY"))
            for name in backups:
                db.add(Assignment(employee_id=emps[name].id, brand_process_id=bp.id, role="BACKUP"))

    for d, name in data.HOLIDAYS:
        db.add(Holiday(date=date.fromisoformat(d), name=name))
    for name, d, typ, status, note in data.LEAVES:
        db.add(Leave(employee_id=emps[name].id, date=date.fromisoformat(d), type=typ, status=status, note=note))

    db.commit()
    single = sum(1 for _, _, ps in data.BRANDS if len({n for p in ps for n in p[5]}) == 1)
    print(f"Seeded {len(data.EMPLOYEES)} employees, {len(data.BRANDS)} brands "
          f"({single} single-resource, {len(data.BRANDS) - single} multi-resource).")
    return True
