"""Plain data classes used by the scheduler. No database code here."""
from dataclasses import dataclass, field
from datetime import date

# Entry statuses
WORK = "WORK"
WEEKLY_OFF = "WEEKLY_OFF"
LEAVE = "LEAVE"
COMP_OFF = "COMP_OFF"
HOLIDAY = "HOLIDAY"
IDLE = "IDLE"  # none of the employee's processes operate that day

OFF_STATUSES = {WEEKLY_OFF, LEAVE, COMP_OFF, HOLIDAY}

HARD = "HARD"
SOFT = "SOFT"
INFO = "INFO"


@dataclass
class Emp:
    id: int
    name: str
    pod_id: int | None
    weekly_offs_per_week: int = 1
    preferred_off_day: int | None = None  # 0=Mon ... 6=Sun
    max_parallel: int = 4
    skills: set[int] = field(default_factory=set)  # process ids this person can cover


@dataclass
class BP:
    """A brand running one process, e.g. 'Mamaearth - CS'. Holds the operating rules."""
    id: int
    brand_id: int
    brand_name: str
    brand_pod_id: int | None
    process_id: int
    process_code: str
    weekdays: list[int]
    works_on_holidays: bool
    min_staff: int = 1
    overrides: dict[str, int] = field(default_factory=dict)  # {"weekday:5": 2, "date:2026-12-24": 2}
    shift: str = "GENERAL"

    @property
    def label(self) -> str:
        return f"{self.brand_name} - {self.process_code}"


@dataclass
class Assign:
    emp_id: int
    bp_id: int
    role: str = "PRIMARY"  # PRIMARY or BACKUP


@dataclass
class LeaveIn:
    emp_id: int
    day: date
    type: str = "LEAVE"  # LEAVE, COMP_OFF, UNAVAILABLE


@dataclass
class Entry:
    emp_id: int
    day: date
    status: str
    bp_ids: list[int] = field(default_factory=list)
    locked: bool = False
    manual: bool = False
    note: str = ""


@dataclass
class Suggestion:
    description: str
    changes: list[dict]  # [{"emp_id", "day", "status", "bp_ids"}]


@dataclass
class Conflict:
    type: str
    severity: str
    day: date
    message: str
    bp_id: int | None = None
    emp_id: int | None = None
    suggestions: list[Suggestion] = field(default_factory=list)

    @property
    def key(self) -> str:
        return f"{self.type}|{self.day}|{self.bp_id}|{self.emp_id}"


@dataclass
class SchedInput:
    month: str  # "YYYY-MM"
    emps: dict[int, Emp]
    bps: dict[int, BP]
    assignments: list[Assign]
    holidays: dict[date, str] = field(default_factory=dict)
    leaves: list[LeaveIn] = field(default_factory=list)

    def primary_bps(self, emp_id: int) -> list[int]:
        return [a.bp_id for a in self.assignments if a.emp_id == emp_id and a.role == "PRIMARY"]

    def backup_bps(self, emp_id: int) -> list[int]:
        return [a.bp_id for a in self.assignments if a.emp_id == emp_id and a.role == "BACKUP"]

    def primary_staff(self, bp_id: int) -> list[int]:
        return [a.emp_id for a in self.assignments if a.bp_id == bp_id and a.role == "PRIMARY"]

    def backup_staff(self, bp_id: int) -> list[int]:
        return [a.emp_id for a in self.assignments if a.bp_id == bp_id and a.role == "BACKUP"]


# Entries are stored in a dict keyed by (emp_id, day)
Entries = dict[tuple[int, date], Entry]
