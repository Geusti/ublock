from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    slug: str
    is_demo: bool
    created_at: datetime

    class Config:
        from_attributes = True
