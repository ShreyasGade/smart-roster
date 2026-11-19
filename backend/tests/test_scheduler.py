from datetime import date

from app.scheduler.generator import generate
from app.scheduler.suggestions import apply_changes, suggest
from app.scheduler.types import HOLIDAY, LEAVE, WEEKLY_OFF, WORK, LeaveIn
from app.scheduler.validator import diff_conflicts, validate
from helpers import bp, emp, make_input

HOL = {date(2026, 12, 25): "Christmas"}


def offs(entries, emp_id):
    return sorted(d for (e, d), x in entries.items() if e == emp_id and x.status == WEEKLY_OFF)


def hard(conflicts):
    return [c for c in conflicts if c.severity == "HARD"]


def test_single_resource_off_lands_on_closed_day():
    inp = make_input([emp(1, pref=2)], [bp(10, "A", preset="NO_SUN_NO_HOLIDAYS")], [(1, 10)])
    entries = generate(inp)
    assert all(d.weekday() == 6 for d in offs(entries, 1))  # Sundays, even though Wed preferred
    assert not hard(validate(inp, entries))


def test_shared_process_never_off_same_day():
    inp = make_input([emp(1, pref=6), emp(2, pref=6)], [bp(10, "A")], [(1, 10), (2, 10)])
    entries = generate(inp)
    assert not set(offs(entries, 1)) & set(offs(entries, 2))
    assert not hard(validate(inp, entries))


def test_preference_honoured_when_safe():
    inp = make_input([emp(1, pref=6), emp(2, pref=3)], [bp(10, "A")], [(1, 10), (2, 10)])
    entries = generate(inp)
    assert all(d.weekday() == 6 for d in offs(entries, 1))
    assert all(d.weekday() == 3 for d in offs(entries, 2))


def test_everyone_gets_weekly_off():
    inp = make_input([emp(1), emp(2), emp(3)], [bp(10, "A"), bp(11, "B", preset="NO_HOLIDAYS")],
                     [(1, 10), (2, 10), (3, 11)])
    entries = generate(inp)
    for e in (1, 2, 3):
        assert len(offs(entries, e)) == 4  # Dec 2026 has 4 weeks ending on a Sunday
    assert not [c for c in validate(inp, entries) if c.type == "MISSING_WEEKLY_OFF"]


def test_single_owner_of_7_day_process_creates_flagged_gap():
    inp = make_input([emp(1, pref=6)], [bp(10, "A")], [(1, 10)])
    entries = generate(inp)
    gaps = [c for c in validate(inp, entries) if c.type == "COVERAGE_GAP"]
    assert len(gaps) == 4 and all(c.day.weekday() == 6 for c in gaps)


def test_backup_fills_gap():
    inp = make_input([emp(1, pref=6), emp(2)], [bp(10, "A")], [(1, 10), (2, 10, "BACKUP")])
    entries = generate(inp)
    assert not hard(validate(inp, entries))
    assert entries[(2, date(2026, 12, 13))].bp_ids == [10]


def test_leave_and_holiday():
    inp = make_input([emp(1), emp(2)], [bp(10, "A", preset="NO_HOLIDAYS"), bp(11, "B")],
                     [(1, 10), (2, 11)], holidays=HOL, leaves=[LeaveIn(1, date(2026, 12, 9))])
    entries = generate(inp)
    assert entries[(1, date(2026, 12, 9))].status == LEAVE
    assert entries[(1, date(2026, 12, 25))].status == HOLIDAY
    assert entries[(2, date(2026, 12, 25))].status == WORK  # 365-day process, owed comp-off
    types = {c.type for c in validate(inp, entries)}
    assert "HOLIDAY_WORKED" in types


def test_shift_clash_and_leave_conflict_detected():
    inp = make_input([emp(1)], [bp(10, "A", shift="MORNING"), bp(11, "B", shift="EVENING")],
                     [(1, 10)], leaves=[LeaveIn(1, date(2026, 12, 2))])
    entries = generate(inp)
    entries = apply_changes(entries, [
        {"emp_id": 1, "day": "2026-12-01", "status": WORK, "bp_ids": [10, 11]},
        {"emp_id": 1, "day": "2026-12-02", "status": WORK, "bp_ids": [10]},
    ])
    types = {c.type for c in validate(inp, entries)}
    assert {"SHIFT_CLASH", "LEAVE_CONFLICT"} <= types


def test_one_of_three_unavailable_others_cover():
    # Two people share CS with min 1; third does NDR. One CS person goes on leave -> still covered.
    inp = make_input([emp(1), emp(2), emp(3)], [bp(10, "A"), bp(11, "A", code="NDR", preset="NO_SUN_NO_HOLIDAYS")],
                     [(1, 10), (2, 10), (3, 11)])
    entries = generate(inp)
    before = validate(inp, entries)
    day = next(d for (e, d), x in entries.items() if e == 1 and x.status == WORK
               and entries[(2, d)].status == WORK)
    after_entries = apply_changes(entries, [{"emp_id": 1, "day": day, "status": LEAVE, "bp_ids": []}])
    assert not diff_conflicts(before, validate(inp, after_entries))["new"]


def test_single_owner_unavailable_gets_suggestions():
    inp = make_input([emp(1, pod=1), emp(2, pod=1, skills=[1]), emp(3, pod=2, skills=[1])],
                     [bp(10, "A", preset="NO_SUN_NO_HOLIDAYS"), bp(11, "B", preset="NO_SUN_NO_HOLIDAYS")],
                     [(1, 10), (2, 11)])
    entries = generate(inp)
    entries = apply_changes(entries, [{"emp_id": 1, "day": "2026-12-09", "status": LEAVE, "bp_ids": []}])
    gap = next(c for c in validate(inp, entries) if c.type == "COVERAGE_GAP")
    sugs = suggest(inp, entries, gap)
    assert sugs and sugs[0].changes
    assert sugs[0].changes[0]["emp_id"] == 2  # same pod ranked first
    fixed = apply_changes(entries, sugs[0].changes)
    assert not hard(validate(inp, fixed))


def test_sunday_needing_two_moves_offs_away():
    inp = make_input([emp(1, pref=6), emp(2, pref=6)], [bp(10, "A", overrides={"weekday:6": 2})],
                     [(1, 10), (2, 10)])
    entries = generate(inp)
    assert not hard(validate(inp, entries))  # coverage beats the Sunday preference
    assert not [d for d in offs(entries, 1) + offs(entries, 2) if d.weekday() == 6]


def test_swap_off_suggestion():
    inp = make_input([emp(1), emp(2)], [bp(10, "A")], [(1, 10), (2, 10)])
    entries = generate(inp)
    d1 = offs(entries, 1)[1]
    d2 = next(d for d in offs(entries, 2) if abs((d - d1).days) < 7 and d.isocalendar()[1] == d1.isocalendar()[1])
    # manager manually puts both people off on the same day -> gap
    entries = apply_changes(entries, [{"emp_id": 2, "day": d1, "status": WEEKLY_OFF, "bp_ids": []},
                                      {"emp_id": 2, "day": d2, "status": WORK, "bp_ids": [10]}])
    gap = hard(validate(inp, entries))[0]
    sugs = suggest(inp, entries, gap)
    assert "weekly off" in sugs[0].description
    assert not hard(validate(inp, apply_changes(entries, sugs[0].changes)))


def test_regenerate_keeps_locked_and_past_days():
    inp = make_input([emp(1), emp(2)], [bp(10, "A")], [(1, 10), (2, 10)])
    first = generate(inp)
    first[(1, date(2026, 12, 20))].locked = True
    second = generate(inp, keep=first, from_date=date(2026, 12, 15))
    for d in range(1, 15):
        assert second[(1, date(2026, 12, d))].status == first[(1, date(2026, 12, d))].status
    assert second[(1, date(2026, 12, 20))] is first[(1, date(2026, 12, 20))]


def test_sunday_offs_shared_fairly():
    inp = make_input([emp(1, pref=6), emp(2, pref=6)], [bp(10, "A")], [(1, 10), (2, 10)])
    entries = generate(inp)
    s1 = sum(1 for d in offs(entries, 1) if d.weekday() == 6)
    s2 = sum(1 for d in offs(entries, 2) if d.weekday() == 6)
    assert s1 == s2 == 2
