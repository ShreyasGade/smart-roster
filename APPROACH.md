# Approach Note: Smart Roster Management System

## In short

I treated rostering as a **constraint problem, not a calendar**. A deterministic scheduler builds the
month by placing weekly offs where they hurt client coverage least. A separate validator then checks
every brand-process on every day and explains each problem in plain English. Where coverage breaks,
the system proposes fixes it has already tested, and the operations manager decides whether to apply
them.

## 1. How I framed the problem

The hard part is not drawing a calendar. It is answering one question for every brand, process and day:

> *Does this brand-process have enough people working today? If not, why not, and who could fix it?*

That led to three ideas that shape the whole design:

1. **A brand's operating calendar is separate from a person's schedule.** Rules (365 days, Sundays
   off, minimum staff) belong to the brand-process. Statuses (working, weekly off, leave) belong to
   the employee-day. Coverage is what you get when you compare the two.
2. **Hard vs soft constraints.** Client coverage and approved leave are hard. Preferred off days and
   fairness are soft. When they conflict, hard wins and the soft violation is reported, not hidden.
3. **Never silently produce an invalid roster.** Anything that cannot be satisfied becomes a visible
   conflict with a reason and suggested fixes.

## 2. Data model

```
Pod ──< Employee >── Assignment (PRIMARY | BACKUP) ──< BrandProcess >── Brand
                                                          │
                                   operating weekdays, works on holidays,
                                   min staff, per-day overrides, shift
```

- **BrandProcess** (e.g. "Mamaearth - CS") holds the rules. A single brand can run CS 365 days and NDR
  with Sundays off.
- **Assignment** is a single many-to-many table. It covers single-resource brands, people working
  across brands, and several people sharing one process.
- **Skills** on an employee mark which processes they *could* cover. These are used for backup
  suggestions.
- **RosterEntry** is one row per employee per day: a status plus the brand-processes they work.

## 3. Architecture

```
React UI  ──HTTP──▶  FastAPI  ──▶  roster_service  ──▶  scheduler (pure Python, no DB)
(5 views,            (CRUD +         (load DB →           generator.py   builds the month
 conflicts,           roster          scheduler input,     validator.py   finds every conflict
 simulator,           endpoints)      save results)        suggestions.py tested fixes
 setup)                    │
                        SQLite
```

The scheduler has **no database or web code**. It takes plain data in and returns plain data out, so
it is fully unit tested (22 scheduler tests plus 2 API tests). FastAPI serves both the API and the
built React app, so it deploys as a single service.

## 4. How a roster is generated

Steps, in order:

1. **Keep** locked or manual edits, and any days before a "regenerate from" date.
2. **Approved leaves and comp-offs.** These are fixed and never overridden.
3. **Default:** everyone works on the processes that operate that day.
4. **Public holidays:** the day off is given if coverage allows. Otherwise the person works and is
   owed a comp-off.
5. **Weekly offs.** The least flexible people (single-resource owners) go first. For each week, every
   candidate day gets a score and the lowest wins:

   | Factor | Score |
   |---|---|
   | Would leave a process below minimum coverage | +1000 per process |
   | Person is needed as a backup that day | +100 |
   | Day is a public holiday | +30 |
   | None of their processes run that day (a "free" off) | −50 |
   | Their preferred off day | −20 |
   | They already had more Sunday offs than co-workers | +25 each |
   | A co-worker on the same process is already off | +5 |

6. **Backups fill gaps.** People assigned as BACKUP cover any process that is still short.

The **validator** then counts *working vs required* for every brand-process and day. It flags:
- **HARD:** coverage gap, understaffing, working on approved leave, shift clash.
- **SOFT:** preference ignored, missing weekly off, overload, holiday worked.
- **INFO:** one absence hitting several brands, pending leave.

Validation runs again on every read, so editing a rule or a leave shows its impact immediately.

## 5. Handling changes

When someone becomes unavailable after the roster is generated, the **Change simulator** does this:

1. Validates the roster before and after the change and shows only the **new** conflicts, across
   every brand that person touches.
2. For each gap, suggests fixes in this order: move a co-worker's weekly off, use the configured
   backup, use a skilled colleague (same pod first, least busy first).
3. **Simulates every suggestion** and drops any that would create a new hard conflict.
4. Applies nothing until the manager clicks Apply. You can also regenerate from that date while
   keeping manual edits.

Single-resource vs multi-resource brands need no special code. With one owner, an absence becomes a
gap with backup suggestions. With three people, the system checks whether the other two still meet
the minimum, and often no conflict appears at all.

## 6. Key decisions and trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| Greedy scoring instead of an optimisation solver | Deterministic, fast (about 1 s for a month), and easy to explain for each decision | Not guaranteed to be the global optimum. For a larger team I would add OR-Tools CP-SAT. |
| A week belongs to the month that contains its Sunday | Stops fake gaps in partial weeks at month end | Needs explaining to users |
| BACKUP assignments are automatic; other cover is only suggested | Pre-approved cover is safe to automate; cross-brand moves are a human call | Some gaps need a click to resolve |
| Weekly offs are always given, even if that leaves a gap | Labour rule. The gap is flagged rather than the off quietly removed. | More visible conflicts, but honest |
| Conflicts are recalculated, not stored | Always in sync with the latest rules and leaves | Recomputed on each page load |
| SQLite plus seeding on startup | No setup needed. A free deployment always has demo data. | Not for production. I would use Postgres. |

## 7. Scope for the time budget (about 1.5 days)

I spent most of the time on the parts the brief says matter most: correct scheduling, accurate
coverage and clear conflict detection. The UI is deliberately plain.

**Done:**
- Setup for every entity, without code changes
- Configurable brand rules
- Generation and partial regeneration
- 5 views (company, pod, brand, process, employee)
- Cell editing with impact preview
- Conflict list with tested fixes
- Change simulator
- Publish gate (blocked while hard conflicts remain)
- Change log
- CSV and Excel export
- Fair Sunday offs and preferred off days

**Left out on purpose:**
- Approval workflow and roles
- Notifications
- Comparing alternative plans
- AI-written explanations

The deterministic messages already explain each conflict. These items would be next with more time.

## 8. Sample data

There are 34 employees in 5 pods and 22 brands: 18 single-resource brands (82%) and 4 brands with 2–3
people. The multi-person brands include both separate and shared processes, plus "needs 2 on
Mondays/Saturdays" rules.

Some scenarios are included on purpose:
- a 365-day brand with no backup
- a person who owns two brands going on leave
- one of three Sleepy Owl employees on leave, with the others covering

These show both the conflicts being caught and the fixes working.

---

### 2–3 sentence version for the email

> I built a FastAPI + React roster tool. A deterministic scheduler places weekly offs by scoring each
> day, with client coverage first and then preferences and fairness. A separate validator checks
> every brand-process on every day and explains any gap in plain English. When something changes, the
> app shows the exact impact across all affected brands and offers ranked fixes it has already
> tested, and the operations manager decides whether to apply them.
