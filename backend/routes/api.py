"""
API 路由 — /api/save 和 /api/load
"""
from fastapi import APIRouter
from pydantic import BaseModel
from backend.database import get_all, set_all


class SaveBody(BaseModel):
    deliveries: list = []
    calendarEvents: list = []
    onlineResumes: list = []
    customResumes: list = []

router = APIRouter(prefix="/api")


@router.post("/save")
def save(body: SaveBody):
    set_all("deliveries", body.deliveries)
    set_all("calendar_events", body.calendarEvents)
    set_all("online_resumes", body.onlineResumes)
    set_all("custom_resumes", body.customResumes)
    return {"ok": True}


@router.get("/load")
def load():
    return {
        "deliveries": get_all("deliveries"),
        "calendarEvents": get_all("calendar_events"),
        "onlineResumes": get_all("online_resumes"),
        "customResumes": get_all("custom_resumes"),
    }
