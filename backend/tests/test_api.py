import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import httpx
import pytest

from app.db import Base, engine
from app.main import app
from app.routers import recipes
from app.schemas import RecipeData

SAMPLE = RecipeData(
    title="Toast", description="Bread, heated.", servings=2, prepMinutes=1, cookMinutes=3,
    difficulty="Easy", ingredients=[{"qty": 2, "unit": "slices", "name": "bread"}],
    steps=[{"text": "Slice bread.", "minutes": 0}, {"text": "Toast it.", "minutes": 3}],
)


@pytest.fixture(autouse=True)
async def db():
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.drop_all)
        await c.run_sync(Base.metadata.create_all)


@pytest.fixture
async def client(monkeypatch):
    async def fake(name):
        return SAMPLE

    monkeypatch.setattr(recipes, "generate_recipe", fake)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


async def test_generate_then_cache(client):
    assert (await client.post("/api/recipes", json={"name": "Toast"})).status_code == 200
    g = await client.get("/api/recipes", params={"name": "  toast "})
    assert g.json()["title"] == "Toast"


async def test_rejects_bad_name(client):
    assert (await client.post("/api/recipes", json={"name": "<script>"})).status_code == 422


async def test_favorites_flow(client):
    r = await client.post("/api/auth/register", json={"email": "a@b.com", "password": "password123"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    rid = (await client.post("/api/recipes", json={"name": "Toast"})).json()["id"]
    assert (await client.put(f"/api/favorites/{rid}", headers=h)).status_code == 204
    assert len((await client.get("/api/favorites", headers=h)).json()) == 1
    assert (await client.get("/api/favorites")).status_code == 401
