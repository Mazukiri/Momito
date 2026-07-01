from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
from app.models import Profile, Score, Job, DSAProblem  # ensure models registered
from app.routers import profile, score, jobs, dsa


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Momito API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def bearer_auth(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in ("/", "/health"):
        return await call_next(request)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != settings.api_bearer_token:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Unauthorized"})
    return await call_next(request)


app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(score.router, prefix="/api/score", tags=["score"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(dsa.router, prefix="/api/dsa", tags=["dsa"])


@app.get("/health")
def health():
    return {"status": "ok"}
