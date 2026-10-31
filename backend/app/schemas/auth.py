from uuid import UUID
from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class CurrentUserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    organization_id: UUID
    organization_name: str
    organization_slug: str

    class Config:
        from_attributes = True
