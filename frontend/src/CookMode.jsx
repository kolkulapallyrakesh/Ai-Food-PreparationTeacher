import { useEffect, useRef, useState } from "react";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach((d) => {
      const o = c.createOscillator();
      o.connect(c.destination); o.frequency.value = 880;
      o.start(c.currentTime + d); o.stop(c.currentTime + d + 0.2);
    });
  } catch { /* audio unavailable */ }
}
function say(t) {
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } catch { /* no TTS */ }
}

export default function CookMode({ recipe, ingredients, onExit }) {
  const steps = recipe.steps;
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [mic, setMic] = useState(false);
  const [showIng, setShowIng] = useState(false);
  const step = steps[i];
  const act = useRef({});

  const next = () => (i < steps.length - 1 ? setI(i + 1) : (say("Enjoy your meal!"), onExit()));
  const prev = () => i > 0 && setI(i - 1);
  const toggle = () => left > 0 && setRunning((r) => !r);
  act.current = { next, prev, toggle, repeat: () => say(step.text), ing: () => setShowIng((s) => !s) };

  useEffect(() => { setRunning(false); setLeft(Math.round((step.minutes || 0) * 60)); }, [i]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (running && left <= 0) { setRunning(false); beep(); say("Timer done"); }
  }, [left, running]);

  // keep the screen awake while cooking
  useEffect(() => {
    let lock;
    const get = async () => { try { lock = await navigator.wakeLock?.request("screen"); } catch { /* denied */ } };
    get();
    const vis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); lock?.release?.(); speechSynthesis?.cancel(); };
  }, []);

  useEffect(() => {
    const key = (e) => {
      if (e.key === "ArrowRight") act.current.next();
      if (e.key === "ArrowLeft") act.current.prev();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    if (!mic || !SR) return;
    const rec = new SR();
    rec.continuous = true; rec.lang = "en-US";
    rec.onresult = (e) => {
      const t = e.results[e.results.length - 1][0].transcript.toLowerCase();
      if (/next|continue/.test(t)) act.current.next();
      else if (/back|previous/.test(t)) act.current.prev();
      else if (/repeat|again|read/.test(t)) act.current.repeat();
      else if (/timer|start|pause|stop/.test(t)) act.current.toggle();
      else if (/ingredient/.test(t)) act.current.ing();
    };
    rec.onend = () => { try { rec.start(); } catch { /* already running */ } };
    rec.onerror = (e) => e.error === "not-allowed" && setMic(false);
    try { rec.start(); } catch { /* ignore */ }
    return () => { rec.onend = null; rec.stop(); };
  }, [mic]);

  const mm = String(Math.floor(Math.max(left, 0) / 60)).padStart(2, "0");
  const ss = String(Math.max(left, 0) % 60).padStart(2, "0");

  return (
    <section>
      <div className="top">
        <button className="ghost" onClick={onExit}>✕ Exit</button>
        <span className="sub">Step {i + 1} of {steps.length}</span>
      </div>
      <div className="bar"><i style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
      <p className="step" aria-live="polite">{step.text}</p>
      {step.tip && <div className="tip">💡 {step.tip}</div>}
      {step.minutes > 0 && (
        <div className="card">
          <div className="timer">{mm}:{ss}</div>
          <div className="row center">
            <button onClick={toggle}>{running ? "Pause" : "Start timer"}</button>
            <button className="ghost" onClick={() => { setRunning(false); setLeft(Math.round(step.minutes * 60)); }}>Reset</button>
          </div>
        </div>
      )}
      <div className="nav">
        <button className="ghost" onClick={prev} disabled={i === 0}>← Back</button>
        <button onClick={next}>{i === steps.length - 1 ? "Finish ✓" : "Next →"}</button>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="ghost" onClick={() => say(step.text)}>🔊 Read aloud</button>
        {SR && <button className="ghost" onClick={() => setMic(!mic)}>🎤 Voice: {mic ? "on" : "off"}</button>}
        <button className="ghost" onClick={() => setShowIng(!showIng)}>Ingredients</button>
      </div>
      {mic && <p className="note">Say “next”, “back”, “repeat”, “timer” or “ingredients”.</p>}
      {showIng && <div className="card">{ingredients.map((x, n) => <div className="ing" key={n}>{x}</div>)}</div>}
    </section>
  );
}
