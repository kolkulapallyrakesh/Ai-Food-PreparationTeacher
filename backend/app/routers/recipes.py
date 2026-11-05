import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..llm import ProviderError, RecipeError, generate_recipe
from ..models import Favorite, Recipe, User
from ..schemas import NAME_PATTERN, NameIn, RecipeOut
from ..security import current_user, current_user_optional

log = logging.getLogger("cookguide")
router = APIRouter(prefix="/api", tags=["recipes"])


def slugify(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


async def fav_ids(db: AsyncSession, user: User | None) -> set[int]:
    if not user:
        return set()
    rows = await db.scalars(select(Favorite.recipe_id).where(Favorite.user_id == user.id))
    return set(rows)


def out(r: Recipe, favs: set[int]) -> RecipeOut:
    return RecipeOut(**r.data, id=r.id, slug=r.slug, favorited=r.id in favs)


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/recipes", response_model=RecipeOut)
@limiter.limit("60/minute")
async def get_cached(
    request: Request,
    name: str = Query(min_length=2, max_length=80, pattern=NAME_PATTERN),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(current_user_optional),
):
    recipe = await db.scalar(select(Recipe).where(Recipe.slug == slugify(name)))
    if not recipe:
        raise HTTPException(404, "Not generated yet")
    await db.execute(update(Recipe).where(Recipe.id == recipe.id).values(hits=Recipe.hits + 1))
    await db.commit()
    return out(recipe, await fav_ids(db, user))


@router.post("/recipes", response_model=RecipeOut)
@limiter.limit(settings.generate_rate)
async def create(
    request: Request,
    body: NameIn,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(current_user_optional),
):
    slug = slugify(body.name)
    recipe = await db.scalar(select(Recipe).where(Recipe.slug == slug))
    if not recipe:
        try:
            data = await generate_recipe(body.name)
        except RecipeError as e:
            raise HTTPException(422, str(e))
        except ProviderError:
            log.exception("LLM provider error")
            raise HTTPException(503, "Recipe service is busy, please retry shortly")
        recipe = Recipe(slug=slug, title=data.title, data=data.model_dump())
        db.add(recipe)
        try:
            await db.commit()
        except IntegrityError:  # another request created it first
            await db.rollback()
            recipe = await db.scalar(select(Recipe).where(Recipe.slug == slug))
    return out(recipe, await fav_ids(db, user))


@router.get("/recipes/popular")
async def popular(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Recipe.title).order_by(Recipe.hits.desc()).limit(8))
    return [t for (t,) in rows]


@router.get("/favorites", response_model=list[RecipeOut])
async def favorites(db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    rows = await db.scalars(
        select(Recipe).join(Favorite, Favorite.recipe_id == Recipe.id).where(Favorite.user_id == user.id)
    )
    return [out(r, {r.id}) for r in rows]


@router.put("/favorites/{recipe_id}", status_code=204)
async def add_fav(recipe_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    if not await db.get(Recipe, recipe_id):
        raise HTTPException(404, "Recipe not found")
    db.add(Favorite(user_id=user.id, recipe_id=recipe_id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # already a favorite: idempotent


@router.delete("/favorites/{recipe_id}", status_code=204)
async def del_fav(recipe_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    fav = await db.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.recipe_id == recipe_id))
    if fav:
        await db.delete(fav)
        await db.commit()
