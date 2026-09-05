from fastapi import APIRouter
from ..db import votes

router = APIRouter()

@router.get("/summary")
def summary():
    total = votes.count_documents({})
    regions = votes.distinct("region")
    age_groups = votes.distinct("age_group")
    return {"total_votes": total, "regions": regions, "age_groups": age_groups}

@router.get("/export")
def export_data():
    return list(votes.find({}, {"_id": 0}))
