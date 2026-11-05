from typing import Literal

from pydantic import BaseModel, EmailStr, Field

NAME_PATTERN = r"^[\w\s'’&,().-]+$"


class Ingredient(BaseModel):
    qty: float = Field(ge=0, le=10000)
    unit: str = Field("", max_length=30)
    name: str = Field(max_length=120)


class Step(BaseModel):
    text: str = Field(max_length=500)
    minutes: float = Field(0, ge=0, le=1440)
    tip: str | None = Field(None, max_length=300)


class RecipeData(BaseModel):
    title: str = Field(max_length=200)
    description: str = Field("", max_length=400)
    servings: int = Field(ge=1, le=50)
    prepMinutes: int = Field(0, ge=0, le=1440)
    cookMinutes: int = Field(0, ge=0, le=1440)
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    ingredients: list[Ingredient] = Field(min_length=1, max_length=60)
    steps: list[Step] = Field(min_length=2, max_length=30)
    tips: list[str] = Field(default_factory=list, max_length=10)


class RecipeOut(RecipeData):
    id: int
    slug: str
    favorited: bool = False


class NameIn(BaseModel):
    name: str = Field(min_length=2, max_length=80, pattern=NAME_PATTERN)


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt limit


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
