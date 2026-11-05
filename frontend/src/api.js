import { store } from "./util.js";

const BASE = import.meta.env.VITE_API_URL || "";
let token = store.get("token");

export const setToken = (t) => { token = t; store.set("token", t); };
export const hasToken = () => !!token;

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(typeof body.detail === "string" ? body.detail : "Request failed");
    e.status = res.status;
    throw e;
  }
  return body;
}

const post = (path, data) => req(path, { method: "POST", body: JSON.stringify(data) });

export const api = {
  async getRecipe(name) {
    const key = "recipe:" + name.trim().toLowerCase();
    try {
      let r;
      try { r = await req("/recipes?name=" + encodeURIComponent(name)); }
      catch (e) { if (e.status !== 404) throw e; r = await post("/recipes", { name }); }
      store.set(key, r); // offline copy for the PWA
      return r;
    } catch (e) {
      const cached = store.get(key);
      if (cached && !e.status) return cached; // network failure only
      throw e;
    }
  },
  popular: () => req("/recipes/popular"),
  register: (email, password) => post("/auth/register", { email, password }),
  login: (email, password) => post("/auth/login", { email, password }),
  favorites: () => req("/favorites"),
  setFav: (id, on) => req(`/favorites/${id}`, { method: on ? "PUT" : "DELETE" }),
};
