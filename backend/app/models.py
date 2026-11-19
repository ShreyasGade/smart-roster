"""Database tables."""
from datetime import date, datetime, timezone

from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Pod(Base):
    __tablename__ = "pods"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    lead_employee_id: Mapped[int | None] = mapped_column(default=None)


class Employee(Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), default="")
    pod_id: Mapped[int | None] = mapped_column(ForeignKey("pods.id"), default=None)
    is_pod_lead: Mapped[bool] = mapped_column(default=False)
    weekly_offs_per_week: Mapped[int] = mapped_column(default=1)
    preferred_off_day: Mapped[int | None] = mapped_column(default=None)  # 0=Mon .. 6=Sun
    max_parallel_processes: Mapped[int] = mapped_column(default=4)
    skill_process_ids: Mapped[list] = mapped_column(JSON, default=list)  # extra processes they can cover
    active: Mapped[bool] = mapped_column(default=True)


class Process(Base):
    __tablename__ = "processes"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(100))


class Brand(Base):
    __tablename__ = "brands"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    pod_id: Mapped[int | None] = mapped_column(ForeignKey("pods.id"), default=None)


class BrandProcess(Base):
    """A brand running a process, with its own operating calendar and coverage rule."""
    __tablename__ = "brand_processes"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    process_id: Mapped[int] = mapped_column(ForeignKey("processes.id"))
    calendar_preset: Mapped[str] = mapped_column(String(30), default="ALL_DAYS")
    operating_weekdays: Mapped[list] = mapped_column(JSON, default=lambda: [0, 1, 2, 3, 4, 5, 6])
    works_on_holidays: Mapped[bool] = mapped_column(default=True)
    min_staff: Mapped[int] = mapped_column(default=1)
    min_staff_overrides: Mapped[dict] = mapped_column(JSON, default=dict)
    shift: Mapped[str] = mapped_column(String(20), default="GENERAL")


class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    brand_process_id: Mapped[int] = mapped_column(ForeignKey("brand_processes.id"))
    role: Mapped[str] = mapped_column(String(20), default="PRIMARY")  # PRIMARY / BACKUP


class Holiday(Base):
    __tablename__ = "holidays"
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date]
    name: Mapped[str] = mapped_column(String(100))


class Leave(Base):
    __tablename__ = "leaves"
    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    date: Mapped[date]
    type: Mapped[str] = mapped_column(String(20), default="LEAVE")  # LEAVE / COMP_OFF / UNAVAILABLE
    status: Mapped[str] = mapped_column(String(20), default="APPROVED")  # APPROVED / PENDING
    note: Mapped[str] = mapped_column(String(200), default="")


class Roster(Base):
    __tablename__ = "rosters"
    id: Mapped[int] = mapped_column(primary_key=True)
    month: Mapped[str] = mapped_column(String(7), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT / PUBLISHED
    generated_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    version: Mapped[int] = mapped_column(default=1)


class RosterEntry(Base):
    __tablename__ = "roster_entries"
    __table_args__ = (UniqueConstraint("roster_id", "employee_id", "date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    roster_id: Mapped[int] = mapped_column(ForeignKey("rosters.id"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    date: Mapped[date]
    status: Mapped[str] = mapped_column(String(20))
    bp_ids: Mapped[list] = mapped_column(JSON, default=list)
    is_locked: Mapped[bool] = mapped_column(default=False)
    is_manual: Mapped[bool] = mapped_column(default=False)
    note: Mapped[str] = mapped_column(String(300), default="")


class ChangeLog(Base):
    __tablename__ = "change_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    roster_id: Mapped[int] = mapped_column(ForeignKey("rosters.id"))
    at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    description: Mapped[str] = mapped_column(String(500))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
