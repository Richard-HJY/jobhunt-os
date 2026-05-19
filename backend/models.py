"""
Pydantic 模型定义
"""
from pydantic import BaseModel


class SaveBody(BaseModel):
    deliveries: list = []
    calendarEvents: list = []
    onlineResumes: list = []
    customResumes: list = []
