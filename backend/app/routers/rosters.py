"""Roster endpoints: generate, view, edit, simulate changes, publish, export."""
import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import PatternFill
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..scheduler.calendar import month_days
from ..services import roster_service as svc
from ..services.loader import load_input

router = APIRouter(prefix="/api/rosters", tags=["rosters"])


class GenerateIn(BaseModel):
    from_date: str | None = None
    keep_manual: bool = True


class Change(BaseModel):
    emp_id: int
    day: str
    status: str
    bp_ids: list[int] = []
    note: str = ""


class ChangesIn(BaseModel):
    changes: list[Change]
    apply: bool = False
    description: str = "Manual edit"


class UnavailableIn(BaseModel):
    emp_id: int
    dates: list[str]
    type: str = "UNAVAILABLE"
    apply: bool = False


@router.post("/{month}/generate")
def generate(month: str, body: GenerateIn, db: Session = Depends(get_db)):
    return svc.generate(db, month, body.from_date, body.keep_manual)


@router.get("/{month}")
def get_roster(month: str, db: Session = Depends(get_db)):
    return svc.report(db, month)


@router.post("/{month}/changes")
def changes(month: str, body: ChangesIn, db: Session = Depends(get_db)):
    """Preview (apply=false) or save (apply=true) manual edits / suggestions."""
    return svc.preview_or_apply(db, month, [c.model_dump() for c in body.changes], body.apply, body.description)


@router.post("/{month}/unavailable")
def unavailable(month: str, body: UnavailableIn, db: Session = Depends(get_db)):
    return svc.mark_unavailable(db, month, body.emp_id, body.dates, body.type, body.apply)


@router.post("/{month}/publish")
def publish(month: str, force: bool = False, db: Session = Depends(get_db)):
    return svc.publish(db, month, force)


@router.get("/{month}/log")
def change_log(month: str, db: Session = Depends(get_db)):
    return svc.change_log(db, month)


# ---------- export ----------

def export_rows(db: Session, month: str) -> list[list[str]]:
    roster = svc.require_roster(db, month)
    inp = load_input(db, month)
    entries = svc.load_entries(db, roster)
    days = month_days(month)
    rows = [["Employee"] + [d.strftime("%d %a") for d in days]]
    for emp in sorted(inp.emps.values(), key=lambda e: (e.pod_id or 0, e.name)):
        row = [emp.name]
        for d in days:
            e = entries.get((emp.id, d))
            if not e:
                row.append("")
            elif e.status == "WORK":
                row.append(", ".join(inp.bps[b].label for b in e.bp_ids if b in inp.bps))
            else:
                row.append(e.status)
        rows.append(row)
    return rows


@router.get("/{month}/export.csv")
def export_csv(month: str, db: Session = Depends(get_db)):
    buf = io.StringIO()
    csv.writer(buf).writerows(export_rows(db, month))
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=roster-{month}.csv"})


COLORS = {"WEEKLY_OFF": "D9D9D9", "LEAVE": "F8CBAD", "COMP_OFF": "D9C3E9", "HOLIDAY": "BDD7EE", "IDLE": "FFFFFF"}


@router.get("/{month}/export.xlsx")
def export_xlsx(month: str, db: Session = Depends(get_db)):
    wb = Workbook()
    ws = wb.active
    ws.title = month
    for row in export_rows(db, month):
        ws.append(row)
    for row in ws.iter_rows(min_row=2, min_col=2):
        for cell in row:
            color = COLORS.get(cell.value, "C6EFCE")
            cell.fill = PatternFill("solid", fgColor=color)
    ws.column_dimensions["A"].width = 20
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename=roster-{month}.xlsx"})
