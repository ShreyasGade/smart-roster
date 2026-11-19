"""Sample data: 34 employees, 5 pods, 22 brands (18 single-resource, 4 multi-resource).
Brand names are well-known Indian D2C brands used for illustration only. All staffing data is made up.

Format of a brand process: (process_code, preset, min_staff, overrides, shift, primary_staff, backup_staff)
Presets: ALL_DAYS (365 days), NO_HOLIDAYS, NO_SUN_NO_HOLIDAYS, or a list of weekdays for CUSTOM.
"""

PROCESSES = [
    ("CS", "Customer Support"),
    ("ACC", "Abandoned Cart Conversion"),
    ("NDR", "Non-Delivery Report Mgmt"),
    ("RET", "Retention"),
    ("CHAT", "Social / Chat"),
]

PODS = ["Alpha", "Bravo", "Comet", "Delta", "Echo"]

# name, pod, preferred_off_day (0=Mon..6=Sun or None), extra skills, is_pod_lead
EMPLOYEES = [
    # Pod leads (oversee the pod, act as backups)
    ("Shreyas Gade", "Alpha", None, ["CS", "ACC", "RET"], True),
    ("Shantil Khadatkar", "Bravo", None, ["CS", "ACC", "CHAT"], True),
    ("Harshal Bhosale", "Comet", 5, ["CS", "NDR"], True),
    ("Pratham Pagare", "Delta", 6, ["CS", "RET"], True),
    ("Tejas Nagpure", "Echo", 0, ["CS", "CHAT"], True),
    # Floaters (no own brand, cover across brands)
    ("Vikram Nair", "Comet", 2, ["CS", "NDR", "ACC"], False),
    ("Meera Pillai", "Echo", 3, ["CS", "NDR", "ACC"], False),
    # Multi-resource brand staff
    ("Riya Shrivastava", "Alpha", 2, ["CHAT"], False),
    ("Aman Gupta", "Alpha", 6, ["CS"], False),
    ("Pooja Rao", "Alpha", 6, ["ACC"], False),
    ("Ishaan Verma", "Bravo", 1, ["RET"], False),
    ("Tanvi Joshi", "Bravo", 6, [], False),
    ("Aditya Kulkarni", "Comet", 6, ["ACC"], False),
    ("Sneha Reddy", "Comet", 6, ["NDR"], False),
    ("Farhan Ali", "Comet", 6, ["CS"], False),
    ("Nikhil Bose", "Delta", 1, ["ACC"], False),
    ("Anjali Menon", "Delta", None, [], False),
    # Single-resource brand owners
    ("Kabir Singh", "Alpha", 6, ["RET"], False),
    ("Shreshtha Pandey", "Alpha", 6, ["ACC"], False),
    ("Rahul Jain", "Alpha", 6, ["RET"], False),
    ("Janhavi Ambre", "Alpha", 6, ["ACC"], False),
    ("Simran Kaur", "Bravo", 6, ["NDR"], False),
    ("Manav Shah", "Bravo", None, ["ACC"], False),
    ("Priya Das", "Bravo", 6, ["ACC"], False),
    ("Yash Patil", "Bravo", 6, ["RET"], False),
    ("Aarav Khanna", "Comet", 6, ["ACC"], False),
    ("Ritu Sharma", "Comet", 6, ["NDR"], False),
    ("Dev Chopra", "Comet", 6, ["CS"], False),
    ("Lakshmi Iyer", "Delta", 6, ["ACC"], False),
    ("Omkar Joshi", "Delta", None, ["RET"], False),
    ("Zoya Khan", "Delta", 6, ["NDR"], False),
    ("Gaurav Sethi", "Echo", 6, ["ACC"], False),
    ("Nisha Bhat", "Echo", 6, ["RET"], False),
    ("Tarun Rao", "Echo", 6, ["NDR"], False),
]

NS = "NO_SUN_NO_HOLIDAYS"
MON_FRI = [0, 1, 2, 3, 4]

# brand name, pod, [processes]
BRANDS = [
    # ---- Multi-resource brands ----
    # 3 people, separate processes. Aman is a backup on CS.
    ("The Souled Store", "Alpha", [
        ("CS", "ALL_DAYS", 1, {}, "GENERAL", ["Riya Shrivastava"], ["Aman Gupta"]),
        ("ACC", NS, 1, {}, "GENERAL", ["Aman Gupta"], []),
        ("NDR", NS, 1, {}, "GENERAL", ["Pooja Rao"], []),
    ]),
    # 2 people share CS (Mondays need 2), one also does ACC
    ("Mamaearth", "Bravo", [
        ("CS", "ALL_DAYS", 1, {"weekday:0": 2}, "GENERAL", ["Ishaan Verma", "Tanvi Joshi"], []),
        ("ACC", NS, 1, {}, "GENERAL", ["Tanvi Joshi"], []),
    ]),
    # 3 people: two share 365-day CS, one handles NDR
    ("Sleepy Owl", "Comet", [
        ("CS", "ALL_DAYS", 1, {}, "GENERAL", ["Aditya Kulkarni", "Sneha Reddy"], []),
        ("NDR", NS, 1, {}, "GENERAL", ["Farhan Ali"], []),
    ]),
    # 2 people share CS (Saturdays need 2), Retention runs Mon-Fri only
    ("FirstCry", "Delta", [
        ("CS", "NO_HOLIDAYS", 1, {"weekday:5": 2}, "GENERAL", ["Nikhil Bose", "Anjali Menon"], []),
        ("RET", MON_FRI, 1, {}, "GENERAL", ["Anjali Menon"], []),
    ]),
    # ---- Single-resource brands (one person runs every process) ----
    ("Heads Up For Tails", "Alpha", [
        ("CS", "ALL_DAYS", 1, {}, "MORNING", ["Kabir Singh"], ["Shreyas Gade"]),
        ("ACC", NS, 1, {}, "GENERAL", ["Kabir Singh"], []),
    ]),
    ("The Whole Truth", "Alpha", [  # 365-day CS with NO backup configured -> gaps will be flagged
        ("CS", "ALL_DAYS", 1, {}, "GENERAL", ["Shreshtha Pandey"], []),
        ("RET", NS, 1, {}, "GENERAL", ["Shreshtha Pandey"], []),
    ]),
    ("Plum", "Alpha", [
        ("CS", NS, 1, {}, "GENERAL", ["Rahul Jain"], []),
        ("ACC", NS, 1, {}, "GENERAL", ["Rahul Jain"], []),
        ("NDR", NS, 1, {}, "GENERAL", ["Rahul Jain"], []),
    ]),
    ("Licious", "Alpha", [
        ("CS", NS, 1, {}, "GENERAL", ["Janhavi Ambre"], []),
        ("NDR", NS, 1, {}, "GENERAL", ["Janhavi Ambre"], []),
    ]),
    ("Minimalist", "Alpha", [
        ("CS", NS, 1, {}, "GENERAL", ["Janhavi Ambre"], []),
    ]),
    ("Wakefit", "Bravo", [
        ("CS", NS, 1, {}, "GENERAL", ["Simran Kaur"], []),
        ("ACC", NS, 1, {}, "GENERAL", ["Simran Kaur"], []),
    ]),
    ("Rage Coffee", "Bravo", [
        ("CS", NS, 1, {}, "GENERAL", ["Manav Shah"], []),
        ("RET", NS, 1, {}, "GENERAL", ["Manav Shah"], []),
    ]),
    ("boAt", "Bravo", [
        ("CS", "ALL_DAYS", 1, {}, "EVENING", ["Priya Das"], ["Shantil Khadatkar"]),
        ("CHAT", NS, 1, {}, "GENERAL", ["Priya Das"], []),
    ]),
    ("SUGAR Cosmetics", "Bravo", [
        ("CS", NS, 1, {}, "GENERAL", ["Yash Patil"], []),
        ("ACC", NS, 1, {}, "GENERAL", ["Yash Patil"], []),
        ("NDR", NS, 1, {}, "GENERAL", ["Yash Patil"], []),
    ]),
    ("Lenskart", "Comet", [
        ("CS", "ALL_DAYS", 1, {}, "GENERAL", ["Aarav Khanna"], ["Vikram Nair"]),
        ("NDR", NS, 1, {}, "GENERAL", ["Aarav Khanna"], []),
    ]),
    ("Epigamia", "Comet", [
        ("CS", NS, 1, {}, "GENERAL", ["Ritu Sharma"], []),
        ("ACC", NS, 1, {}, "GENERAL", ["Ritu Sharma"], []),
    ]),
    ("Pilgrim", "Comet", [
        ("CS", MON_FRI, 1, {}, "GENERAL", ["Dev Chopra"], []),
        ("ACC", MON_FRI, 1, {}, "GENERAL", ["Dev Chopra"], []),
    ]),
    ("Supertails", "Delta", [
        ("CS", NS, 1, {}, "GENERAL", ["Lakshmi Iyer"], []),
        ("RET", NS, 1, {}, "GENERAL", ["Lakshmi Iyer"], []),
    ]),
    ("Noise", "Delta", [
        ("CS", NS, 1, {}, "GENERAL", ["Omkar Joshi"], []),
        ("ACC", NS, 1, {}, "GENERAL", ["Omkar Joshi"], []),
        ("NDR", NS, 1, {}, "GENERAL", ["Omkar Joshi"], []),
    ]),
    ("mCaffeine", "Delta", [
        ("CS", NS, 1, {}, "GENERAL", ["Zoya Khan"], []),
        ("CHAT", NS, 1, {}, "GENERAL", ["Zoya Khan"], []),
    ]),
    ("Bombay Shaving Company", "Echo", [
        ("CS", "NO_HOLIDAYS", 1, {}, "GENERAL", ["Gaurav Sethi"], ["Tejas Nagpure"]),
        ("ACC", NS, 1, {}, "GENERAL", ["Gaurav Sethi"], []),
    ]),
    ("Snitch", "Echo", [
        ("CS", "NO_HOLIDAYS", 1, {}, "GENERAL", ["Nisha Bhat"], ["Meera Pillai"]),
        ("NDR", NS, 1, {}, "GENERAL", ["Nisha Bhat"], []),
    ]),
    ("Bewakoof", "Echo", [
        ("CS", MON_FRI, 1, {}, "GENERAL", ["Tarun Rao"], []),
        ("CHAT", MON_FRI, 1, {}, "GENERAL", ["Tarun Rao"], []),
    ]),
]

HOLIDAYS = [
    ("2026-11-08", "Diwali"),
    ("2026-12-25", "Christmas"),
    ("2027-01-01", "New Year's Day"),
    ("2027-01-14", "Makar Sankranti"),
    ("2027-01-26", "Republic Day"),
]

# employee, date, type, status, note
LEAVES = [
    ("Shreshtha Pandey", "2026-12-09", "LEAVE", "APPROVED", "Single owner of The Whole Truth away on a working day"),
    ("Janhavi Ambre", "2026-12-17", "LEAVE", "APPROVED", "Owns two brands - gaps in both"),
    ("Ishaan Verma", "2026-12-14", "LEAVE", "APPROVED", "Mamaearth needs 2 on Mondays"),
    ("Aditya Kulkarni", "2026-12-21", "LEAVE", "APPROVED", "Sneha can cover Sleepy Owl CS"),
    ("Aditya Kulkarni", "2026-12-22", "LEAVE", "APPROVED", "Sneha can cover Sleepy Owl CS"),
    ("Nikhil Bose", "2026-12-19", "LEAVE", "APPROVED", "FirstCry needs 2 on Saturdays"),
    ("Pooja Rao", "2026-12-10", "LEAVE", "APPROVED", ""),
    ("Rahul Jain", "2026-12-30", "LEAVE", "APPROVED", "Year-end trip"),
    ("Rahul Jain", "2026-12-31", "LEAVE", "APPROVED", "Year-end trip"),
    ("Tarun Rao", "2026-12-23", "LEAVE", "APPROVED", ""),
    ("Shreyas Gade", "2026-12-24", "LEAVE", "APPROVED", "Pod lead away"),
    ("Simran Kaur", "2026-12-26", "COMP_OFF", "APPROVED", "Comp-off for Diwali"),
    ("Lakshmi Iyer", "2026-12-04", "COMP_OFF", "APPROVED", "Comp-off for Diwali"),
    ("Zoya Khan", "2026-12-28", "LEAVE", "PENDING", "Awaiting approval - not rostered yet"),
    ("Gaurav Sethi", "2027-01-05", "LEAVE", "APPROVED", ""),
]
