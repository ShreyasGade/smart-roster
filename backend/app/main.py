from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import DEFAULT_MONTH, FRONTEND_DIST
from .database import Base, SessionLocal, engine
from .routers import crud, rosters
from .seed.seed import seed_if_empty
from .services import roster_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if seed_if_empty(db):
            roster_service.generate(db, DEFAULT_MONTH)  # demo roster ready on first visit
    yield


app = FastAPI(title="Smart Roster Management System", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"ok": True, "default_month": DEFAULT_MONTH}


for r in crud.routers:
    app.include_router(r)
app.include_router(rosters.router)

# Serve the built React app (frontend/dist) for every non-API route
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = FRONTEND_DIST / path
        if path and file.is_file():
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
