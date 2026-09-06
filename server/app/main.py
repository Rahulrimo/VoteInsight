from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.auth import router as auth_router
from .routes.elections import router as elections_router
from .routes.analytics import router as analytics_router


app = FastAPI(
    title="VoteInsight API",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================
# ROUTES
# ============================================================

app.include_router(
    auth_router,
    prefix="/api/auth",
    tags=["Auth"]
)

app.include_router(
    elections_router,
    prefix="/api/elections",
    tags=["Elections"]
)

app.include_router(
    analytics_router,
    prefix="/api/analytics",
    tags=["Analytics"]
)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "VoteInsight API"
    }