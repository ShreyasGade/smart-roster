import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_full_flow():
    with TestClient(app) as client:
        assert client.get("/api/health").json()["ok"]
        assert len(client.get("/api/employees").json()) == 34

        data = client.get("/api/rosters/2026-12").json()
        assert len(data["entries"]) == 34 * 31
        hard = [c for c in data["conflicts"] if c["severity"] == "HARD"]
        assert hard and all(c["suggestions"] for c in hard)

        # The Whole Truth owner (Shreshtha) is on approved leave on 9 Dec -> gap with a suggested fix
        gap = next(c for c in hard if c["date"] == "2026-12-09" and "The Whole Truth - CS" in c["message"])
        fix = gap["suggestions"][0]
        assert fix["changes"]
        res = client.post("/api/rosters/2026-12/changes",
                          json={"changes": fix["changes"], "apply": True, "description": fix["description"]}).json()
        assert any(c["key"] == gap["key"] for c in res["resolved_conflicts"])

        # Change handling: preview someone becoming unavailable (not saved)
        emps = {e["name"]: e["id"] for e in client.get("/api/employees").json()}
        sim = client.post("/api/rosters/2026-12/unavailable",
                          json={"emp_id": emps["Rahul Jain"], "dates": ["2026-12-15"]}).json()
        assert not sim["applied"] and sim["new_conflicts"]

        # Publishing is blocked while HARD conflicts exist
        assert client.post("/api/rosters/2026-12/publish").status_code == 400
        assert client.post("/api/rosters/2026-12/publish?force=true").json()["status"] == "PUBLISHED"

        assert client.get("/api/rosters/2026-12/export.csv").status_code == 200
        assert client.get("/api/rosters/2026-12/export.xlsx").status_code == 200


def test_crud_brand_process_preset():
    with TestClient(app) as client:
        brand = client.post("/api/brands", json={"name": "NewBrand", "pod_id": 1}).json()
        bp = client.post("/api/brand-processes", json={"brand_id": brand["id"], "process_id": 1,
                                                       "calendar_preset": "NO_SUN_NO_HOLIDAYS"}).json()
        assert bp["operating_weekdays"] == [0, 1, 2, 3, 4, 5] and bp["works_on_holidays"] is False
        assert client.delete(f"/api/brands/{brand['id']}").status_code == 200
