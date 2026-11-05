import { useEffect, useState } from "react";
import { api, hasToken, setToken } from "./api.js";
import CookMode from "./CookMode.jsx";
import { ingLine } from "./util.js";

const IDEAS = ["Masala dosa", "Spaghetti carbonara", "Paneer butter masala", "Veg fried rice", "Pancakes"];

function Chips({ items, onPick }) {
  return (
    <div className="chips">
      {items.map((t) => <button key={t} className="chip" onClick={() => onPick(t)}>{t}</button>)}
    </div>
  );
}

function Auth({ onDone, onCancel }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const t = await (mode === "login" ? api.login : api.register)(email, pw);
      setToken(t.access_token);
      onDone();
    } catch (x) {
      setErr(x.status === 422 ? "Enter a valid email and a password of 8-72 characters." : x.message);
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>{mode === "login" ? "Log in" : "Create account"}</h2>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input type="password" placeholder="Password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      {err && <p className="err">{err}</p>}
      <div className="row">
        <button type="submit">{mode === "login" ? "Log in" : "Sign up"}</button>
        <button type="button" className="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here?" : "Have an account?"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Overview({ recipe, setRecipe, onBack, onStart, onNeedAuth }) {
  const [servings, setServings] = useState(recipe.servings);
  const [done, setDone] = useState(new Set());
  const lines = recipe.ingredients.map((i) => ingLine(i, servings, recipe.servings));
  async function toggleFav() {
    if (!hasToken()) return onNeedAuth();
    try {
      await api.setFav(recipe.id, !recipe.favorited);
      setRecipe({ ...recipe, favorited: !recipe.favorited });
    } catch (e) { if (e.status === 401) { setToken(null); onNeedAuth(); } }
  }
  const tick = (n) => setDone((s) => { const c = new Set(s); c.has(n) ? c.delete(n) : c.add(n); return c; });
  return (
    <section>
      <div className="top">
        <button className="ghost" onClick={onBack}>← Back</button>
        <button className="ghost" onClick={toggleFav}>{recipe.favorited ? "★ Saved" : "☆ Save"}</button>
      </div>
      <h2>{recipe.title}</h2>
      <p className="sub">{recipe.description}</p>
      <div className="meta"><span>⏱ Prep {recipe.prepMinutes} min</span><span>🔥 Cook {recipe.cookMinutes} min</span><span>📈 {recipe.difficulty}</span></div>
      <div className="card scaler">
        <b>Servings</b>
        <button aria-label="Fewer servings" onClick={() => setServings(Math.max(1, servings - 1))}>−</button>
        <b>{servings}</b>
        <button aria-label="More servings" onClick={() => setServings(Math.min(24, servings + 1))}>+</button>
      </div>
      <div className="card">
        <b>Ingredients</b>
        {lines.map((l, n) => (
          <label key={n} className={"ing" + (done.has(n) ? " done" : "")}>
            <input type="checkbox" checked={done.has(n)} onChange={() => tick(n)} /><span>{l}</span>
          </label>
        ))}
      </div>
      {recipe.tips?.length > 0 && <div className="card"><b>Chef’s tips</b><ul>{recipe.tips.map((t, n) => <li key={n}>{t}</li>)}</ul></div>}
      <button className="wide" onClick={() => onStart(lines)}>Start cooking →</button>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [recipe, setRecipe] = useState(null);
  const [lines, setLines] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [popular, setPopular] = useState([]);
  const [favs, setFavs] = useState([]);

  useEffect(() => { api.popular().then(setPopular).catch(() => {}); }, []);

  async function find(name) {
    name = name.trim();
    if (name.length < 2) return;
    setBusy(true); setErr("");
    try {
      setRecipe(await api.getRecipe(name));
      setView("recipe");
    } catch (e) {
      setErr(
        e.status === 429 ? "Too many requests. Please wait a minute and try again."
        : e.status === 422 ? e.message.includes("recipe") ? e.message : "Please enter a valid dish name."
        : e.status === 503 ? e.message
        : "Couldn't reach the server. Check your connection and try again."
      );
    } finally { setBusy(false); }
  }

  async function openFavs() {
    if (!hasToken()) return setView("auth");
    try { setFavs(await api.favorites()); setView("favs"); }
    catch (e) { if (e.status === 401) { setToken(null); setView("auth"); } }
  }

  return (
    <main>
      <header className="top">
        <h1 onClick={() => setView("home")} style={{ cursor: "pointer" }}>🍳 CookGuide</h1>
        <div className="row">
          <button className="ghost" onClick={openFavs}>★ Saved</button>
          {hasToken() && <button className="ghost" onClick={() => { setToken(null); setView("home"); }}>Log out</button>}
        </div>
      </header>

      {view === "home" && (
        <section>
          <p className="sub">Type any dish. Cook it one step at a time.</p>
          <form className="row" onSubmit={(e) => { e.preventDefault(); find(q); }}>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. hyderabadi chicken biryani" maxLength={80} aria-label="Recipe name" />
            <button disabled={busy}>{busy ? "Writing recipe…" : "Get recipe"}</button>
          </form>
          {err && <p className="err">{err}</p>}
          <Chips items={IDEAS} onPick={(t) => { setQ(t); find(t); }} />
          {popular.length > 0 && <><h2>Popular</h2><Chips items={popular} onPick={(t) => { setQ(t); find(t); }} /></>}
        </section>
      )}
      {view === "recipe" && <Overview key={recipe.id} recipe={recipe} setRecipe={setRecipe} onBack={() => setView("home")} onStart={(l) => { setLines(l); setView("cook"); }} onNeedAuth={() => setView("auth")} />}
      {view === "cook" && <CookMode recipe={recipe} ingredients={lines} onExit={() => setView("recipe")} />}
      {view === "auth" && <Auth onDone={openFavs} onCancel={() => setView("home")} />}
      {view === "favs" && (
        <section>
          <h2>Saved recipes</h2>
          {favs.length === 0 ? <p className="sub">Nothing saved yet.</p> : <Chips items={favs.map((f) => f.title)} onPick={(t) => setRecipe(favs.find((f) => f.title === t)) || setView("recipe")} />}
        </section>
      )}
      <p className="note">Recipes are AI-generated. Check allergens and cook meat, poultry and eggs thoroughly (poultry to 74 °C / 165 °F).</p>
    </main>
  );
}
