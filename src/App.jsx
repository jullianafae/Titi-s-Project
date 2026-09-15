import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, CalendarDays, ListChecks, Brain, Moon, X, Sparkles, Send,
  ChevronLeft, ChevronRight, Check, AlertTriangle, TrendingUp, Info,
  Droplets, Bed, Smile, Activity, Loader2, PlusCircle, Map, Flame, LogOut, Upload,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import {
  fetchSessions, bulkInsertSessions, upsertSession,
  fetchRecovery, bulkInsertRecovery, upsertRecovery,
  fetchPhotos, uploadPhoto, deletePhoto,
} from "./db";

/* =========================================================================
   IRONMAN COMMAND CENTER
   Camada de organização, registro e análise sobre um plano de treino
   já existente. A IA nunca altera a estrutura-base do plano.
   ========================================================================= */

/* ---------------------------- Design tokens ---------------------------- */

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Space+Grotesk:wght@400;500;600;700&display=swap');

    .icc-root {
      --ink: #0A0D0F;
      --surface: #14181B;
      --surface-2: #1B2126;
      --surface-3: #222932;
      --line: #262D33;
      --line-soft: #1D2328;
      --text: #ECEEEF;
      --text-muted: #8E969D;
      --text-faint: #5A6268;
      --gold: #C99A44;
      --gold-soft: rgba(201,154,68,0.14);
      --swim: #4C86B8;
      --bike: #C2582F;
      --run: #4F8A63;
      --strength: #97826A;
      --green: #4F8A63;
      --amber: #C99A44;
      --red: #B85450;
      --blue: #4C86B8;
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      background: var(--ink);
      color: var(--text);
      min-height: 100vh;
    }
    .icc-root * { box-sizing: border-box; }
    .icc-display { font-family: 'Fraunces', serif; }
    .icc-num { font-variant-numeric: tabular-nums; }

    .icc-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 4px;
    }
    .icc-card-soft {
      background: var(--surface-2);
      border: 1px solid var(--line-soft);
      border-radius: 4px;
    }
    .icc-btn {
      font-family: 'Space Grotesk', sans-serif;
      border-radius: 3px;
      border: 1px solid var(--line);
      background: var(--surface-2);
      color: var(--text);
      padding: 10px 16px;
      font-size: 13px;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .icc-btn:hover { background: var(--surface-3); border-color: #333c44; }
    .icc-btn-gold {
      background: var(--gold);
      border-color: var(--gold);
      color: #16130B;
      font-weight: 600;
    }
    .icc-btn-gold:hover { background: #d9ab55; }
    .icc-btn:disabled { opacity: 0.5; cursor: default; }

    .icc-input, .icc-select, .icc-textarea {
      background: var(--surface-2);
      border: 1px solid var(--line);
      color: var(--text);
      border-radius: 3px;
      padding: 9px 11px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13.5px;
      width: 100%;
    }
    .icc-input:focus, .icc-select:focus, .icc-textarea:focus {
      outline: none; border-color: var(--gold);
    }
    .icc-label {
      font-size: 11px; color: var(--text-muted); letter-spacing: 0.04em;
      margin-bottom: 6px; display: block;
    }
    .icc-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .icc-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 3px; }

    .icc-nav-item {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 14px; border-radius: 3px; color: var(--text-muted);
      cursor: pointer; font-size: 13.5px; transition: all 0.15s ease;
    }
    .icc-nav-item:hover { color: var(--text); background: var(--surface-2); }
    .icc-nav-item.active { color: var(--gold); background: var(--gold-soft); }

    @media (min-width: 900px) {
      .icc-sidebar { display: flex !important; }
      .icc-tabbar { display: none !important; }
      .icc-main { margin-left: 232px; }
    }
    @media (max-width: 899px) {
      .icc-sidebar { display: none !important; }
      .icc-tabbar { display: flex !important; }
      .icc-main { padding-bottom: 78px; }
    }
    .icc-fade { animation: iccfade 0.35s ease; }
    @keyframes iccfade { from { opacity: 0; transform: translateY(4px);} to { opacity:1; transform: translateY(0);} }
  `}</style>
);

/* ------------------------------ Constants ------------------------------ */

const DAY_LABELS = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
const DAY_SHORT  = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];

const DISCIPLINES = {
  swim:     { label: "Natação",     icon: "🏊", color: "var(--swim)" },
  bike:     { label: "Bike",        icon: "🚴", color: "var(--bike)" },
  run:      { label: "Corrida",     icon: "🏃", color: "var(--run)" },
  strength: { label: "Musculação",  icon: "🏋️", color: "var(--strength)" },
};

// Estrutura-base fornecida pelo usuário (dia / horário / modalidade preservados
// exatamente). Duração, distância e zona são placeholders de demonstração —
// serão substituídos ao importar a planilha real.
const BASE_WEEK = [
  { id: "mon-swim",     day: 0, time: "06:00", discipline: "swim",     durationMin: 60,  distanceKm: 2.0, zone: "Z2", desc: "Técnica + aeróbico" },
  { id: "mon-bike",     day: 0, time: "19:00", discipline: "bike",     durationMin: 75,  distanceKm: 30,  zone: "Z2", desc: "Endurance" },
  { id: "tue-run",      day: 1, time: "05:30", discipline: "run",      durationMin: 50,  distanceKm: 8,   zone: "Z2", desc: "Ritmo controlado" },
  { id: "tue-strength", day: 1, time: "19:00", discipline: "strength", durationMin: 45,  distanceKm: null, zone: null, desc: "Força geral" },
  { id: "wed-swim",     day: 2, time: "06:00", discipline: "swim",     durationMin: 60,  distanceKm: 2.0, zone: "Z2", desc: "Técnica + aeróbico" },
  { id: "wed-bike",     day: 2, time: "19:00", discipline: "bike",     durationMin: 75,  distanceKm: 30,  zone: "Z2", desc: "Endurance" },
  { id: "thu-run",      day: 3, time: "05:30", discipline: "run",      durationMin: 50,  distanceKm: 8,   zone: "Z2", desc: "Ritmo controlado" },
  { id: "thu-strength", day: 3, time: "19:00", discipline: "strength", durationMin: 45,  distanceKm: null, zone: null, desc: "Força geral" },
  { id: "fri-swim",     day: 4, time: "19:00", discipline: "swim",     durationMin: 60,  distanceKm: 2.5, zone: "Z2", desc: "Técnica + resistência" },
  { id: "sat-bike",     day: 5, time: "08:00", discipline: "bike",     durationMin: 180, distanceKm: 80,  zone: "Z2", desc: "Longão" },
  { id: "sun-run",      day: 6, time: "09:00", discipline: "run",      durationMin: 90,  distanceKm: 16,  zone: "Z2", desc: "Longão" },
];

const MISSED_REASONS = ["Falta de tempo","Cansaço","Sono","Trabalho","Dor/desconforto","Clima","Viagem","Imprevisto","Outro"];
const SENSATIONS = ["Muito ruim","Ruim","Regular","Bom","Muito bom"];

// IRONMAN 70.3 Curitiba-Paraná — Nubank Ultravioleta, 21 de março de 2027,
// Represa do Passaúna (natação) + Parque Barigui (T2 / chegada).
const RACE = {
  name: "Ironman 70.3 Curitiba",
  series: "Nubank Ultravioleta",
  location: "Passaúna · Parque Barigui — Curitiba, PR",
  date: "2027-03-21",
  swimKm: 1.9, bikeKm: 90, runKm: 21.1,
};

const QUOTES = [
  { text: "A disciplina é a ponte entre metas e conquistas.", source: "Frase" },
  { text: "Posso todas as coisas naquele que me fortalece.", source: "Filipenses 4:13" },
  { text: "Corramos com perseverança a corrida que nos é proposta.", source: "Hebreus 12:1" },
  { text: "O corpo alcança o que a mente acredita.", source: "Frase" },
];

// Frases curtas de impacto para o hero — no mesmo espírito do universo endurance,
// escritas para este app (não são reproduções de campanhas de terceiros).
const HERO_TAGLINES = ["IT'S YOU VS YOU", "AGAIN. AGAIN. AGAIN.", "90% MENTAL", "STICK TO THE PLAN, NOT TO THE MOOD"];

const PHOTO_CATEGORIES = ["Preparação","Natação","Bike","Corrida","Musculação","Longões","Momentos importantes","Race week","Race day"];

/* ------------------------------- Helpers -------------------------------- */

function pad(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromISODate(s) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function getMonday(date) { const d = new Date(date); const wd = (d.getDay()+6)%7; return addDays(d, -wd); }
function formatDateLong(iso) {
  const d = fromISODate(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
function formatDateShort(iso) {
  const d = fromISODate(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
}
function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function formatPaceMinKm(durationMin, distanceKm) {
  if (!distanceKm) return null;
  const paceMin = durationMin / distanceKm;
  const m = Math.floor(paceMin);
  const s = Math.round((paceMin - m) * 60);
  return `${m}:${pad(s)}/km`;
}
function formatSwimPace(durationMin, distanceKm) {
  if (!distanceKm) return null;
  const totalSec = durationMin * 60;
  const per100 = totalSec / (distanceKm * 1000 / 100);
  const m = Math.floor(per100 / 60);
  const s = Math.round(per100 % 60);
  return `${m}:${pad(s)}/100m`;
}
function todayISO() { return toISODate(new Date()); }

// Downscale + compress an uploaded photo into a JPEG Blob before uploading to
// Supabase Storage (keeps the bucket small and uploads fast).
function compressImageToBlob(file, maxDim = 1400, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* -------------------------- Demo data generation ------------------------ */

function genActual(rng, tmpl, factor = 1) {
  const durationMin = Math.max(5, Math.round(tmpl.durationMin * factor * (1 + (rng() - 0.5) * 0.2)));
  let distanceKm = null;
  if (tmpl.distanceKm) distanceKm = +(tmpl.distanceKm * factor * (1 + (rng() - 0.5) * 0.12)).toFixed(2);

  let pace = null, speedKmh = null, hrAvg = null, power = null, cadence = null, elevationM = null;
  if (tmpl.discipline === "run") {
    pace = formatPaceMinKm(durationMin, distanceKm);
    hrAvg = Math.round(138 + rng() * 22);
    cadence = Math.round(164 + rng() * 10);
    elevationM = Math.round(20 + rng() * 120);
  } else if (tmpl.discipline === "bike") {
    speedKmh = distanceKm ? +(distanceKm / (durationMin / 60)).toFixed(1) : null;
    hrAvg = Math.round(128 + rng() * 20);
    power = Math.round(155 + rng() * 45);
    cadence = Math.round(80 + rng() * 12);
    elevationM = Math.round(80 + rng() * 400);
  } else if (tmpl.discipline === "swim") {
    pace = formatSwimPace(durationMin, distanceKm);
    hrAvg = Math.round(120 + rng() * 18);
  } else if (tmpl.discipline === "strength") {
    hrAvg = Math.round(95 + rng() * 15);
  }
  const rpe = Math.min(10, Math.max(4, Math.round(4 + rng() * 5)));
  const sensation = SENSATIONS[Math.min(4, Math.floor(rng() * 5))];
  return {
    durationMin, distanceKm, pace, speedKmh, hrAvg, power, cadence, elevationM,
    rpe, sensation, notes: "", nutrition: "", actualTime: tmpl.time, isDemo: true,
  };
}

function buildDemoLog() {
  const rng = mulberry32(20260914);
  const monday = getMonday(new Date());
  const today = todayISO();
  const sessions = [];

  for (let wo = -6; wo <= 1; wo++) {
    const weekStart = addDays(monday, wo * 7);
    for (const tmpl of BASE_WEEK) {
      const date = toISODate(addDays(weekStart, tmpl.day));
      const instanceId = `${wo}_${tmpl.id}`;
      let status = "planned", actual = null, missedReason = null, missedNote = "";

      const isPast = date < today;
      const isTodayEarlier = date === today && tmpl.time < "12:00";

      if (wo < 0 || isPast || isTodayEarlier) {
        const r = rng();
        if (r < 0.07) {
          status = "missed";
          missedReason = MISSED_REASONS[Math.floor(rng() * MISSED_REASONS.length)];
        } else if (r < 0.15) {
          status = "partial";
          actual = genActual(rng, tmpl, 0.55 + rng() * 0.2);
        } else {
          status = "completed";
          actual = genActual(rng, tmpl, 1);
        }
      }

      sessions.push({
        instanceId, templateId: tmpl.id, date, day: tmpl.day, time: tmpl.time,
        discipline: tmpl.discipline, durationMin: tmpl.durationMin, distanceKm: tmpl.distanceKm,
        zone: tmpl.zone, desc: tmpl.desc, status, actual, missedReason, missedNote,
      });
    }
  }
  return sessions;
}

function buildDemoRecovery() {
  const rng = mulberry32(77);
  const today = new Date();
  const logs = {};
  for (let i = 30; i >= 1; i--) {
    const date = toISODate(addDays(today, -i));
    if (rng() < 0.75) {
      logs[date] = {
        sleepHours: +(6 + rng() * 2.4).toFixed(1),
        sleepQuality: Math.round(2 + rng() * 3),
        energy: Math.round(2 + rng() * 3),
        fatigue: Math.round(2 + rng() * 3),
        mood: Math.round(2 + rng() * 3),
        soreness: Math.round(1 + rng() * 3),
        notes: "", isDemo: true,
      };
    }
  }
  return logs;
}

/* ------------------------------- Trimark emblem --------------------------- */
// Emblema autoral do app (arcos de natação/bike/corrida + "70.3"). Não é o logo
// oficial da IRONMAN — essa marca é registrada e não deve ser reproduzida.
function TriMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="19" stroke="var(--gold)" strokeWidth="1.2" opacity="0.5" />
      <path d="M8 24c3-6 6-6 9 0s6 6 9 0s6-6 6-6" stroke="var(--swim)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M9 15 L20 8 L31 15" stroke="var(--bike)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M13 31 L20 17 L27 31" stroke="var(--run)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/* --------------------------------- App ---------------------------------- */

const TABS = [
  { id: "home",     label: "Início",      icon: Home },
  { id: "today",    label: "Hoje",        icon: ListChecks },
  { id: "calendar", label: "Calendário",  icon: CalendarDays },
  { id: "course",   label: "Percurso",    icon: Map },
  { id: "progress", label: "Progresso",   icon: TrendingUp },
  { id: "ai",       label: "AI Lab",      icon: Brain },
  { id: "recovery", label: "Recovery",    icon: Moon },
  { id: "import",   label: "Importar",    icon: Upload },
];

function TrainingApp({ session, onSignOut }) {
  const [tab, setTab] = useState("home");
  const [sessions, setSessions] = useState([]);
  const [recovery, setRecovery] = useState({});
  const [photos, setPhotos] = useState([]);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [photoWarning, setPhotoWarning] = useState("");
  const [logModal, setLogModal] = useState(null); // session being logged
  const [analysisModal, setAnalysisModal] = useState(null); // session being analyzed

  // Load from Supabase on mount — seed demo data the very first time the
  // database is empty, so the app never opens blank.
  useEffect(() => {
    (async () => {
      try {
        let loadedSessions = await fetchSessions();
        if (loadedSessions.length === 0) {
          const demo = buildDemoLog();
          await bulkInsertSessions(demo);
          loadedSessions = demo;
        }
        setSessions(loadedSessions);

        let loadedRecovery = await fetchRecovery();
        if (Object.keys(loadedRecovery).length === 0) {
          const demo = buildDemoRecovery();
          await bulkInsertRecovery(demo);
          loadedRecovery = demo;
        }
        setRecovery(loadedRecovery);

        const loadedPhotos = await fetchPhotos();
        setPhotos(loadedPhotos);
      } catch (e) {
        console.error(e);
        setSyncError("Não foi possível conectar ao Supabase. Verifique as variáveis de ambiente e a conexão.");
        setSessions(buildDemoLog());
        setRecovery(buildDemoRecovery());
      }
      setReady(true);
    })();
  }, []);

  async function addPhotos(fileList, category) {
    const files = Array.from(fileList || []).slice(0, 8);
    for (const file of files) {
      try {
        const blob = await compressImageToBlob(file);
        const record = await uploadPhoto(blob, category);
        setPhotos(prev => [record, ...prev]);
        setPhotoWarning("");
      } catch (e) {
        console.error(e);
        setPhotoWarning("Não foi possível enviar uma das fotos. Tente novamente ou use um arquivo menor.");
      }
    }
  }

  async function removePhoto(id) {
    setPhotos(prev => prev.filter(p => p.id !== id));
    try { await deletePhoto(id); } catch (e) { console.error(e); }
  }

  function updateSession(instanceId, patch) {
    setSessions(prev => {
      const next = prev.map(s => s.instanceId === instanceId ? { ...s, ...patch } : s);
      const updated = next.find(s => s.instanceId === instanceId);
      if (updated) upsertSession(updated).catch(e => { console.error(e); setSyncError("Falha ao salvar no Supabase — a alteração pode não ter sido sincronizada."); });
      return next;
    });
  }

  function saveWorkoutLog(instanceId, data) {
    if (data.status === "missed") {
      updateSession(instanceId, { status: "missed", missedReason: data.missedReason, missedNote: data.missedNote, actual: null });
    } else {
      updateSession(instanceId, { status: data.status, actual: { ...data.actual, isDemo: false } });
    }
    setLogModal(null);
  }

  function updateRecovery(date, patch) {
    setRecovery(prev => {
      const merged = { ...(prev[date] || {}), ...patch, isDemo: false };
      upsertRecovery(date, merged).catch(e => { console.error(e); setSyncError("Falha ao salvar no Supabase — a alteração pode não ter sido sincronizada."); });
      return { ...prev, [date]: merged };
    });
  }

  // Recebe uma lista de sessões já resolvidas (vindas do Garmin CSV ou do
  // histórico de conversa) e grava cada uma — atualizando a sessão planejada
  // correspondente quando existe, ou criando uma sessão extra quando não há
  // treino planejado naquele dia/modalidade.
  async function importSessions(rows) {
    setSessions(prev => {
      const map = new Map(prev.map(s => [s.instanceId, s]));
      for (const row of rows) map.set(row.instanceId, { ...(map.get(row.instanceId) || {}), ...row });
      return Array.from(map.values());
    });
    for (const row of rows) {
      try { await upsertSession(row); } catch (e) { console.error(e); setSyncError("Falha ao salvar alguns itens importados no Supabase."); }
    }
  }

  if (!ready) {
    return (
      <div className="icc-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <GlobalStyle />
        <Loader2 size={22} className="icc-num" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className="icc-root">
      <GlobalStyle />

      {/* Sidebar (desktop) */}
      <div className="icc-sidebar" style={{
        display: "none", position: "fixed", top: 0, left: 0, bottom: 0, width: 232,
        borderRight: "1px solid var(--line)", flexDirection: "column", padding: "22px 14px", zIndex: 20,
        background: "var(--ink)",
      }}>
        <div style={{ padding: "0 10px 22px", display: "flex", alignItems: "center", gap: 10 }}>
          <TriMark size={26} />
          <div className="icc-display" style={{ fontSize: 14.5, letterSpacing: "0.02em", lineHeight: 1.3 }}>
            COMMAND CENTER<br/><span style={{ color: "var(--gold)", fontSize: 12 }}>IRONMAN 70.3 · CURITIBA</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(t => (
            <div key={t.id} className={`icc-nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <t.icon size={16} />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {syncError && (
            <div style={{ fontSize: 11, color: "var(--amber)", padding: "0 10px" }}>{syncError}</div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "0 10px" }}>{session?.user?.email}</div>
          <div className="icc-nav-item" onClick={onSignOut} style={{ color: "var(--text-muted)" }}>
            <LogOut size={16} /><span>Sair</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="icc-main">
        <div className="icc-fade" key={tab}>
          {tab === "home" && (
            <HomeView sessions={sessions} recovery={recovery} setTab={setTab} photos={photos} />
          )}
          {tab === "today" && <TodayView sessions={sessions} onLog={setLogModal} onAnalyze={setAnalysisModal} />}
          {tab === "calendar" && <CalendarView sessions={sessions} onLog={setLogModal} onAnalyze={setAnalysisModal} />}
          {tab === "course" && <CourseView />}
          {tab === "progress" && <ProgressView sessions={sessions} />}
          {tab === "ai" && <AILabView sessions={sessions} recovery={recovery} />}
          {tab === "recovery" && <RecoveryView recovery={recovery} onUpdate={updateRecovery} />}
          {tab === "import" && (
            <ImportView sessions={sessions} onImportSessions={importSessions}
              photos={photos} onAddPhotos={addPhotos} onRemovePhoto={removePhoto} photoWarning={photoWarning} />
          )}
        </div>
      </div>

      {/* Tab bar (mobile) */}
      <div className="icc-tabbar" style={{
        display: "none", position: "fixed", bottom: 0, left: 0, right: 0, height: 64,
        background: "var(--surface)", borderTop: "1px solid var(--line)", zIndex: 20,
        alignItems: "stretch", justifyContent: "space-around",
      }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 3, color: tab === t.id ? "var(--gold)" : "var(--text-faint)", fontSize: 9.5, cursor: "pointer",
          }}>
            <t.icon size={17} />
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      {logModal && (
        <WorkoutLogModal session={logModal} onClose={() => setLogModal(null)} onSave={saveWorkoutLog} />
      )}
      {analysisModal && (
        <AIAnalysisModal session={analysisModal} onClose={() => setAnalysisModal(null)} />
      )}
    </div>
  );
}

/* --------------------------------- Auth ----------------------------------- */
// Acesso restrito: só quem tiver uma conta criada no Supabase Auth entra.
// Depois de criar as duas contas (vocês dois), desative "Enable email signups"
// no painel do Supabase para que mais ninguém consiga se cadastrar sozinho.

function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="icc-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <GlobalStyle />
        <Loader2 size={22} />
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <TrainingApp session={session} onSignOut={() => supabase.auth.signOut()} />;
}

function LoginScreen() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(""); setInfo(""); setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Conta criada. Se a confirmação por e-mail estiver ativa no Supabase, confirme o e-mail antes de entrar.");
      }
    } catch (e) {
      setError(e.message || "Não foi possível autenticar.");
    }
    setLoading(false);
  }

  return (
    <div className="icc-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <GlobalStyle />
      <div className="icc-card" style={{ width: "100%", maxWidth: 360, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <TriMark size={26} />
          <div className="icc-display" style={{ fontSize: 15 }}>Command Center</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18 }}>
          {mode === "login" ? "Entre para acessar sua preparação." : "Criar uma conta (só na primeira vez)."}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="icc-label">E-mail</label>
            <input className="icc-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="icc-label">Senha</label>
            <input className="icc-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          {error && <div style={{ fontSize: 12, color: "var(--red)" }}>{error}</div>}
          {info && <div style={{ fontSize: 12, color: "var(--green)" }}>{info}</div>}
          <button className="icc-btn icc-btn-gold" onClick={submit} disabled={loading || !email || !password}>
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", cursor: "pointer" }}
            onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(""); setInfo(""); }}>
            {mode === "login" ? "Primeira vez? Criar conta" : "Já tenho conta — entrar"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthGate />;
}

/* ------------------------------ Status badge ----------------------------- */

function StatusBadge({ status }) {
  const map = {
    planned:   { label: "Planejado",     icon: "⬜", color: "var(--text-faint)" },
    partial:   { label: "Parcial",       icon: "🟡", color: "var(--amber)" },
    completed: { label: "Concluído",     icon: "✅", color: "var(--green)" },
    missed:    { label: "Não realizado", icon: "❌", color: "var(--red)" },
  };
  const s = map[status] || map.planned;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: s.color }}>
      <span>{s.icon}</span><span>{s.label}</span>
    </span>
  );
}

function DisciplinePill({ discipline }) {
  const d = DISCIPLINES[discipline];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "3px 9px",
      borderRadius: 20, background: "rgba(255,255,255,0.05)", border: `1px solid ${d.color}55`, color: d.color,
    }}>
      <span>{d.icon}</span><span>{d.label}</span>
    </span>
  );
}

function DemoTag() {
  return (
    <span style={{
      fontSize: 9.5, letterSpacing: "0.05em", color: "var(--text-faint)",
      border: "1px solid var(--line)", borderRadius: 3, padding: "1px 5px",
    }}>DEMO</span>
  );
}

/* --------------------------------- Home ---------------------------------- */

function computeAdherence(sessions, weeks) {
  const cutoff = toISODate(addDays(new Date(), -7 * weeks));
  const relevant = sessions.filter(s => s.date >= cutoff && s.date <= todayISO() && s.status !== "planned");
  if (relevant.length === 0) return null;
  const score = relevant.reduce((acc, s) => acc + (s.status === "completed" ? 1 : s.status === "partial" ? 0.5 : 0), 0);
  return Math.round((score / relevant.length) * 100);
}

// Faixas ajustadas para um bloco de 70.3 (meio Ironman) — mais curto que um bloco full.
function currentPhase(daysToRace) {
  if (daysToRace <= 0) return "RACE WEEK";
  if (daysToRace <= 10) return "TAPER";
  if (daysToRace <= 6 * 7) return "PEAK";
  if (daysToRace <= 16 * 7) return "BUILD";
  return "BASE";
}

function HomeView({ sessions, recovery, setTab, photos }) {
  const today = todayISO();
  const daysToRace = Math.ceil((fromISODate(RACE.date) - fromISODate(today)) / 86400000);
  const phase = currentPhase(daysToRace);
  const weekStart = toISODate(getMonday(new Date()));
  const weekEnd = toISODate(addDays(getMonday(new Date()), 6));
  const thisWeek = sessions.filter(s => s.date >= weekStart && s.date <= weekEnd);
  const doneThisWeek = thisWeek.filter(s => s.status === "completed" || s.status === "partial").length;
  const adherence = computeAdherence(sessions, 4);
  const quote = QUOTES[fromISODate(today).getDate() % QUOTES.length];

  return (
    <div>
      <HeroSection daysToRace={daysToRace} phase={phase} doneThisWeek={doneThisWeek} thisWeekLen={thisWeek.length}
        adherence={adherence} photos={photos} />

      <div style={{ padding: "28px 28px 60px", display: "grid", gap: 22, gridTemplateColumns: "1fr", maxWidth: 980 }}>
        <div className="icc-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="icc-label" style={{ margin: 0 }}>Motivação do dia</span>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{quote.source}</span>
          </div>
          <div className="icc-display" style={{ fontSize: 19, marginTop: 10, lineHeight: 1.45 }}>
            "{quote.text}"
          </div>
        </div>

        <div className="icc-card" style={{ padding: "18px 20px", cursor: "pointer" }} onClick={() => setTab("today")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="icc-label" style={{ margin: 0 }}>Próximo passo</div>
              <div style={{ fontSize: 15, marginTop: 6 }}>Ver o que está planejado para hoje</div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {Object.entries(DISCIPLINES).map(([key, d]) => {
            const total = sessions.filter(s => s.discipline === key && s.date <= today && s.date >= weekStart).length;
            const done = sessions.filter(s => s.discipline === key && s.date <= today && s.date >= weekStart && (s.status === "completed" || s.status === "partial")).length;
            return (
              <div key={key} className="icc-card-soft" style={{ padding: 16 }}>
                <DisciplinePill discipline={key} />
                <div className="icc-num" style={{ fontSize: 24, marginTop: 12 }}>{done}<span style={{ color: "var(--text-faint)", fontSize: 15 }}> / {total}</span></div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>sessões esta semana</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Hero section ------------------------------ */

function HeroSection({ daysToRace, phase, doneThisWeek, thisWeekLen, adherence, photos }) {
  const [idx, setIdx] = useState(0);
  const [taglineIdx, setTaglineIdx] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % photos.length), 6000);
    return () => clearInterval(t);
  }, [photos.length]);

  useEffect(() => {
    const t = setInterval(() => setTaglineIdx(i => (i + 1) % HERO_TAGLINES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const hasPhoto = photos.length > 0;
  const bgUrl = hasPhoto ? photos[idx % photos.length].dataUrl : null;

  return (
    <div style={{
      position: "relative", minHeight: 460, borderBottom: "1px solid var(--line)", overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
      backgroundColor: "#0A0D0F",
      backgroundImage: hasPhoto
        ? `linear-gradient(180deg, rgba(8,10,11,0.35) 0%, rgba(8,10,11,0.55) 45%, rgba(8,10,11,0.94) 100%), url(${bgUrl})`
        : `repeating-linear-gradient(115deg, rgba(201,154,68,0.10) 0px, rgba(201,154,68,0.10) 2px, transparent 2px, transparent 34px),
           radial-gradient(ellipse at 20% 10%, rgba(201,154,68,0.16), transparent 55%),
           radial-gradient(ellipse at 80% 90%, rgba(76,134,184,0.14), transparent 55%)`,
      backgroundSize: "cover", backgroundPosition: "center", transition: "background-image 0.8s ease",
    }}>
      {/* Rotating tagline, top */}
      <div key={taglineIdx} className="icc-fade" style={{
        position: "absolute", top: 40, left: 28, right: 28, textAlign: "left",
      }}>
        <div className="icc-display" style={{
          fontSize: "clamp(26px, 4.4vw, 42px)", fontWeight: 600, lineHeight: 1.05, color: "#F4F1EA",
          textShadow: "0 2px 24px rgba(0,0,0,0.5)", maxWidth: 560,
        }}>
          {HERO_TAGLINES[taglineIdx]}
        </div>
      </div>

      <div style={{ position: "absolute", top: 40, right: 28, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          background: "#F4F1EA", color: "#0A0D0F", borderRadius: 3, padding: "6px 12px",
          textAlign: "center", boxShadow: "0 4px 18px rgba(0,0,0,0.35)", lineHeight: 1.1,
        }}>
          <div className="icc-display" style={{ fontSize: 15, letterSpacing: "0.02em" }}>TIAGO</div>
        </div>
        <TriMark size={30} />
      </div>

      <div style={{ position: "relative", padding: "0 28px 40px", zIndex: 2 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "rgba(236,238,239,0.75)", marginBottom: 12 }}>
          {RACE.series.toUpperCase()} · {RACE.name.toUpperCase()} · {RACE.location.toUpperCase()}
        </div>
        <div className="icc-display" style={{ fontSize: "clamp(44px, 8vw, 74px)", lineHeight: 1, marginBottom: 8, color: "#F4F1EA" }}>
          {daysToRace} <span style={{ color: "var(--gold)" }}>dias</span>
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(236,238,239,0.65)", marginBottom: 24 }}>
          {formatDateLong(RACE.date)} · {RACE.swimKm}km natação · {RACE.bikeKm}km bike · {RACE.runKm}km corrida
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <HeroStat label="Fase atual" value={phase} />
          <HeroStat label="Treinos esta semana" value={`${doneThisWeek} / ${thisWeekLen}`} />
          <HeroStat label="Aderência (4 sem.)" value={adherence !== null ? `${adherence}%` : "—"} />
        </div>
      </div>

      {photos.length > 1 && (
        <div style={{ position: "absolute", bottom: 14, right: 20, display: "flex", gap: 5, zIndex: 2 }}>
          {photos.map((_, i) => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: 5, background: i === idx % photos.length ? "var(--gold)" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Photo gallery ------------------------------ */

function PhotoGallery({ photos, onAddPhotos, onRemovePhoto, warning }) {
  const [category, setCategory] = useState(PHOTO_CATEGORIES[0]);
  const [filter, setFilter] = useState("Todas");
  const inputRef = useRef(null);

  const visible = filter === "Todas" ? photos : photos.filter(p => p.category === filter);

  return (
    <div className="icc-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div className="icc-label" style={{ margin: 0 }}>GALERIA DA PREPARAÇÃO</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>Suas fotos alimentam o hero da página inicial.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="icc-select" style={{ width: "auto" }} value={category} onChange={e => setCategory(e.target.value)}>
            {PHOTO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="icc-btn icc-btn-gold" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => inputRef.current?.click()}>
            <PlusCircle size={14} /> Adicionar fotos
          </button>
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={e => { onAddPhotos(e.target.files, category); e.target.value = ""; }} />
        </div>
      </div>

      {warning && <div style={{ fontSize: 12, color: "var(--amber)", marginBottom: 12 }}>{warning}</div>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {["Todas", ...PHOTO_CATEGORIES].map(c => (
          <button key={c} className="icc-btn" style={{
            padding: "5px 11px", fontSize: 11.5,
            ...(filter === c ? { borderColor: "var(--gold)", color: "var(--gold)" } : {}),
          }} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "18px 0" }}>
          Nenhuma foto ainda{filter !== "Todas" ? ` em "${filter}"` : ""}. Adicione fotos suas de treino, preparação ou da prova — elas aparecem no topo do app.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
          {visible.map(p => (
            <div key={p.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)" }}>
              <img src={p.dataUrl} alt={p.category} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div onClick={() => onRemovePhoto(p.id)} style={{
                position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
                background: "rgba(10,13,15,0.75)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}><X size={11} color="#fff" /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: "0.05em", marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div className="icc-display icc-num" style={{ fontSize: 22, color: "var(--gold)" }}>{value}</div>
    </div>
  );
}

/* --------------------------------- Today ---------------------------------- */

function TodayView({ sessions, onLog, onAnalyze }) {
  const today = todayISO();
  const todays = sessions.filter(s => s.date === today).sort((a,b) => a.time.localeCompare(b.time));
  const dayIdx = fromISODate(today).getDay();
  const dayLabel = DAY_LABELS[(dayIdx + 6) % 7];

  return (
    <div style={{ padding: "36px 28px 60px", maxWidth: 760 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 6 }}>
        HOJE — {dayLabel.toUpperCase()}
      </div>
      <div className="icc-display" style={{ fontSize: 26, marginBottom: 30 }}>{formatDateLong(today)}</div>

      {todays.length === 0 && (
        <div className="icc-card" style={{ padding: 24, color: "var(--text-muted)" }}>
          Nenhuma sessão planejada para hoje na sua estrutura-base.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {todays.map(s => <SessionCard key={s.instanceId} session={s} onLog={onLog} onAnalyze={onAnalyze} expanded />)}
      </div>
    </div>
  );
}

function SessionCard({ session: s, onLog, onAnalyze, expanded }) {
  const d = DISCIPLINES[s.discipline];
  return (
    <div className="icc-card" style={{ padding: expanded ? 20 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div className="icc-num" style={{ fontSize: 15, color: "var(--text-muted)", minWidth: 44 }}>{s.time}</div>
          <div>
            <DisciplinePill discipline={s.discipline} />
            <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--text-muted)" }}>
              {s.durationMin} min{s.distanceKm ? ` · ${s.distanceKm} km` : ""}{s.zone ? ` · ${s.zone}` : ""}
              {" "}<DemoTag />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 3 }}>{s.desc}</div>
          </div>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {s.status !== "planned" && s.actual && (
        <ActualSummary discipline={s.discipline} actual={s.actual} />
      )}
      {s.status === "missed" && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
          Motivo: <span style={{ color: "var(--text)" }}>{s.missedReason}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        {s.status === "planned" && (
          <button className="icc-btn icc-btn-gold" onClick={() => onLog(s)}>Registrar treino</button>
        )}
        {s.status !== "planned" && (
          <button className="icc-btn" onClick={() => onLog(s)}>Editar registro</button>
        )}
        {(s.status === "completed" || s.status === "partial") && (
          <button className="icc-btn" onClick={() => onAnalyze(s)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={13} color="var(--gold)" /> Analisar com IA
          </button>
        )}
      </div>
    </div>
  );
}

function ActualSummary({ discipline, actual: a }) {
  const items = [];
  if (a.durationMin) items.push(`${a.durationMin} min`);
  if (a.distanceKm) items.push(`${a.distanceKm} km`);
  if (a.pace) items.push(a.pace);
  if (a.speedKmh) items.push(`${a.speedKmh} km/h`);
  if (a.hrAvg) items.push(`FC ${a.hrAvg} bpm`);
  if (a.power) items.push(`${a.power} W`);
  if (a.cadence) items.push(`cad. ${a.cadence}`);
  if (a.rpe) items.push(`RPE ${a.rpe}`);
  return (
    <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--text)", display: "flex", flexWrap: "wrap", gap: 10 }}>
      {items.map((it,i) => (
        <span key={i} style={{ padding: "3px 8px", background: "var(--surface-2)", borderRadius: 3, border: "1px solid var(--line)" }}>{it}</span>
      ))}
      {a.isDemo && <DemoTag />}
    </div>
  );
}

/* -------------------------------- Calendar --------------------------------- */

function CalendarView({ sessions, onLog, onAnalyze }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const monday = addDays(getMonday(new Date()), weekOffset * 7);
  const today = todayISO();

  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)));

  return (
    <div style={{ padding: "36px 28px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div className="icc-display" style={{ fontSize: 24 }}>Calendário</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="icc-btn" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft size={14} /></button>
          <div style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 130, textAlign: "center" }}>
            {formatDateShort(days[0])} – {formatDateShort(days[6])}
          </div>
          <button className="icc-btn" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight size={14} /></button>
          {weekOffset !== 0 && <button className="icc-btn" onClick={() => setWeekOffset(0)}>Hoje</button>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {days.map((date, i) => {
          const daySessions = sessions.filter(s => s.date === date).sort((a,b) => a.time.localeCompare(b.time));
          const isToday = date === today;
          return (
            <div key={date} className="icc-card" style={{
              padding: 12, borderColor: isToday ? "var(--gold)" : "var(--line)",
              display: "flex", flexDirection: "column", gap: 8, minHeight: 160,
            }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.05em", color: isToday ? "var(--gold)" : "var(--text-faint)" }}>{DAY_SHORT[i]}</div>
                <div className="icc-num" style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatDateShort(date)}</div>
              </div>
              {daySessions.length === 0 && <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>—</div>}
              {daySessions.map(s => {
                const d = DISCIPLINES[s.discipline];
                const badge = { planned: "⬜", partial: "🟡", completed: "✅", missed: "❌" }[s.status];
                return (
                  <div key={s.instanceId} onClick={() => onLog(s)} style={{
                    padding: "7px 9px", borderRadius: 3, background: "var(--surface-2)", cursor: "pointer",
                    border: `1px solid ${d.color}33`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                      <span>{d.icon} {s.time}</span><span>{badge}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 2 }}>{d.label}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- Course --------------------------------- */
// Percurso oficial do IRONMAN 70.3 Curitiba-Paraná — resumido a partir de
// informações públicas do evento. É um esquema ilustrativo, não um mapa GPS.

const COURSE = {
  swim: {
    title: "Natação — 1,9 km",
    place: "Represa do Passaúna",
    facts: ["Volta única (single loop)", "Largada na água ou em praia, conforme wave", "T1 na margem da represa"],
    color: "var(--swim)",
  },
  bike: {
    title: "Bike — 90 km",
    place: "Av. dos Pinheirais → PR-423 → Araucária → Curitiba",
    facts: [
      "Km 0–7,8: saída pela Av. dos Pinheirais até a PR-423",
      "Km 7,8–28,6: rodovia PR-423 até o primeiro retorno",
      "Km 28,6–42,5: retorno pelo mesmo trecho (via fechada para os atletas)",
      "Km 42,5–64,5: passagem por Araucária — trecho sem uso de guidão aero",
      "Km 64,5: nova passagem pela represa do Passaúna (T1)",
      "Km 70: entrada em Curitiba rumo ao Parque Barigui",
      "Ganho de elevação total: ≈1.119 m",
    ],
    color: "var(--bike)",
  },
  run: {
    title: "Corrida — 21,1 km",
    place: "Parque Barigui",
    facts: ["Percurso urbano/parque, com trechos entre a vegetação do Barigui", "T2 e chegada dentro do Parque Barigui"],
    color: "var(--run)",
  },
};

function CourseView() {
  const [seg, setSeg] = useState("swim");
  const c = COURSE[seg];

  return (
    <div style={{ padding: "36px 28px 60px", maxWidth: 900 }}>
      <div className="icc-display" style={{ fontSize: 24, marginBottom: 4 }}>Percurso</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 22 }}>
        IRONMAN 70.3 Curitiba-Paraná · Passaúna → Araucária → Parque Barigui
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {Object.entries(COURSE).map(([key, v]) => (
          <button key={key} className="icc-btn" onClick={() => setSeg(key)}
            style={{ display: "flex", alignItems: "center", gap: 7, ...(seg === key ? { borderColor: v.color, color: v.color } : {}) }}>
            <span>{DISCIPLINES[key].icon}</span> {DISCIPLINES[key].label}
          </button>
        ))}
        <a href="https://unlimitedsports.com.br/percursos-ironman-70-3-curitiba/" target="_blank" rel="noreferrer"
          className="icc-btn" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, textDecoration: "none", color: "var(--gold)", borderColor: "var(--gold)" }}>
          Ver mapas oficiais (Unlimited Sports) ↗
        </a>
      </div>

      <div className="icc-card" style={{ padding: 22, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div className="icc-display" style={{ fontSize: 19 }}>{c.title}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{c.place}</div>
        </div>

        <div style={{ marginTop: 18 }}>
          {seg === "bike" ? <ElevationSchematic /> : <RouteSchematic color={c.color} discipline={seg} />}
        </div>

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {c.facts.map((f, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--text)", display: "flex", gap: 8 }}>
              <span style={{ color: c.color }}>—</span><span>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-faint)" }}>
          Esquema ilustrativo baseado nas informações públicas do evento — para o mapa oficial com GPS e elevação exata, veja o link "Ver mapas oficiais" acima (organização Unlimited Sports).
        </div>
      </div>
    </div>
  );
}

function RouteSchematic({ color, discipline }) {
  // Stylized ribbon route with km markers — swim is a loop, run is a park path.
  const isLoop = discipline === "swim";
  return (
    <svg viewBox="0 0 720 200" style={{ width: "100%", height: "auto" }}>
      {isLoop ? (
        <>
          <ellipse cx="360" cy="100" rx="260" ry="72" fill="none" stroke={color} strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
          <circle cx="100" cy="100" r="6" fill={color} />
          <circle cx="360" cy="28" r="4" fill={color} opacity="0.6" />
          <circle cx="620" cy="100" r="4" fill={color} opacity="0.6" />
          <circle cx="360" cy="172" r="4" fill={color} opacity="0.6" />
          <text x="100" y="82" fontSize="11" fill="var(--text-muted)" fontFamily="Space Grotesk">T1 / Largada</text>
          <text x="330" y="196" fontSize="11" fill="var(--text-muted)" fontFamily="Space Grotesk">1,9 km — volta única</text>
        </>
      ) : (
        <>
          <path d="M40 150 C 160 40, 300 190, 420 90 S 640 40, 680 110" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
          {[40,180,320,460,600,680].map((x,i) => (
            <circle key={i} cx={x} cy={i===0?150:i===5?110:[40,190,90,40,110][i-1]||100} r="4" fill={color} />
          ))}
          <text x="30" y="172" fontSize="11" fill="var(--text-muted)" fontFamily="Space Grotesk">T2</text>
          <text x="640" y="130" fontSize="11" fill="var(--text-muted)" fontFamily="Space Grotesk">Chegada</text>
          <text x="260" y="20" fontSize="11" fill="var(--text-muted)" fontFamily="Space Grotesk">21,1 km — Parque Barigui</text>
        </>
      )}
    </svg>
  );
}

function ElevationSchematic() {
  // Illustrative elevation profile summing to roughly the course's total gain (~1,119 m).
  const pts = "0,150 60,140 120,110 180,120 240,80 300,95 360,60 420,75 480,50 540,65 600,90 660,70 720,100";
  return (
    <div>
      <svg viewBox="0 0 720 170" style={{ width: "100%", height: "auto" }}>
        <polyline points={pts} fill="none" stroke="var(--bike)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`0,170 ${pts} 720,170`} fill="var(--bike)" opacity="0.08" />
        <text x="0" y="164" fontSize="10.5" fill="var(--text-faint)" fontFamily="Space Grotesk">km 0 · Passaúna</text>
        <text x="290" y="30" fontSize="10.5" fill="var(--text-faint)" fontFamily="Space Grotesk">Araucária</text>
        <text x="600" y="164" fontSize="10.5" fill="var(--text-faint)" fontFamily="Space Grotesk">km 90 · Barigui</text>
      </svg>
      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Perfil ilustrativo — ganho de elevação total ≈1.119 m ao longo dos 90 km.</div>
    </div>
  );
}

/* -------------------------------- Progress --------------------------------- */

function statsForRange(sessions, start, end) {
  const rel = sessions.filter(s => s.date >= start && s.date <= end);
  const byDiscipline = {};
  for (const key of Object.keys(DISCIPLINES)) {
    const list = rel.filter(s => s.discipline === key);
    const planned = list.length;
    const done = list.filter(s => s.status === "completed").length;
    const partial = list.filter(s => s.status === "partial").length;
    const missed = list.filter(s => s.status === "missed").length;
    const hoursPlanned = list.reduce((a,s) => a + s.durationMin, 0) / 60;
    const hoursActual = list.reduce((a,s) => a + (s.actual?.durationMin || 0), 0) / 60;
    const kmPlanned = list.reduce((a,s) => a + (s.distanceKm || 0), 0);
    const kmActual = list.reduce((a,s) => a + (s.actual?.distanceKm || 0), 0);
    byDiscipline[key] = { planned, done, partial, missed, hoursPlanned, hoursActual, kmPlanned, kmActual };
  }
  return { byDiscipline, total: rel.length,
    totalDone: rel.filter(s=>s.status==="completed").length,
    totalPartial: rel.filter(s=>s.status==="partial").length,
    totalMissed: rel.filter(s=>s.status==="missed").length,
    rpeAvg: (() => {
      const rpes = rel.filter(s => s.actual?.rpe).map(s => s.actual.rpe);
      return rpes.length ? (rpes.reduce((a,b)=>a+b,0)/rpes.length).toFixed(1) : null;
    })(),
  };
}

/* ---------------------------- Athlete avatar (gamification) ---------------------------- */
// Nível calculado apenas a partir de sessões concluídas/parciais nas últimas 8 semanas —
// nunca é a IA quem decide isso, é uma contagem direta dos seus registros reais.

const AVATAR_LEVELS = [
  { min: 0,  label: "Recruta",     color: "var(--text-faint)" },
  { min: 15, label: "Em construção", color: "var(--strength)" },
  { min: 30, label: "Consistente", color: "var(--swim)" },
  { min: 45, label: "Forte",       color: "var(--bike)" },
  { min: 60, label: "Elite",       color: "var(--gold)" },
];

function computeAthleteXP(sessions) {
  const start = toISODate(addDays(new Date(), -8 * 7));
  const end = todayISO();
  const rel = sessions.filter(s => s.date >= start && s.date <= end);
  const completed = rel.filter(s => s.status === "completed").length;
  const partial = rel.filter(s => s.status === "partial").length;
  const points = completed + partial * 0.5;
  let levelIdx = 0;
  for (let i = 0; i < AVATAR_LEVELS.length; i++) if (points >= AVATAR_LEVELS[i].min) levelIdx = i;
  const cur = AVATAR_LEVELS[levelIdx];
  const next = AVATAR_LEVELS[levelIdx + 1];
  const pct = next ? Math.min(100, Math.round(((points - cur.min) / (next.min - cur.min)) * 100)) : 100;
  return { points: Math.round(points * 10) / 10, completed, partial, total: rel.length, levelIdx, cur, next, pct };
}

function AthleteAvatarCard({ sessions }) {
  const xp = computeAthleteXP(sessions);
  return (
    <div className="icc-card" style={{ padding: 22, marginBottom: 22, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <AthleteFigure level={xp.levelIdx} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="icc-label" style={{ margin: 0 }}>SEU ATLETA · ÚLTIMAS 8 SEMANAS</div>
        <div className="icc-display" style={{ fontSize: 22, marginTop: 6, color: xp.cur.color }}>{xp.cur.label}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6 }}>
          {xp.completed} treinos concluídos e {xp.partial} parciais em {xp.total} planejados nas últimas 8 semanas.
        </div>
        <div style={{ marginTop: 14, background: "var(--surface-2)", borderRadius: 20, height: 8, overflow: "hidden" }}>
          <div style={{ width: `${xp.pct}%`, height: "100%", background: xp.cur.color, transition: "width 0.6s ease" }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
          {xp.next ? `Faltam treinos concluídos para virar "${xp.next.label}"` : "Nível máximo — continue mantendo a consistência"}
        </div>
      </div>
    </div>
  );
}

function AthleteFigure({ level }) {
  // level 0..4 — o boneco fica maior, mais ereto e mais "dourado" a cada nível.
  const color = AVATAR_LEVELS[level].color;
  const scale = 0.78 + level * 0.055;
  const glow = 0.08 + level * 0.09;
  return (
    <svg width="88" height="112" viewBox="0 0 88 112" style={{ flexShrink: 0 }}>
      <ellipse cx="44" cy="100" rx={26 + level * 3} ry="7" fill={color} opacity={glow} />
      <g transform={`translate(44 58) scale(${scale}) translate(-44 -58)`}>
        <circle cx="44" cy="22" r="12" fill="none" stroke={color} strokeWidth="3" />
        <line x1="44" y1="34" x2="44" y2="70" stroke={color} strokeWidth={4 + level} strokeLinecap="round" />
        <line x1="44" y1="42" x2={26 - level} y2="60" stroke={color} strokeWidth="4" strokeLinecap="round" />
        <line x1="44" y1="42" x2={62 + level} y2="60" stroke={color} strokeWidth="4" strokeLinecap="round" />
        <line x1="44" y1="70" x2={30 - level*1.5} y2="102" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <line x1="44" y1="70" x2={58 + level*1.5} y2="102" stroke={color} strokeWidth="5" strokeLinecap="round" />
      </g>
      {Array.from({ length: 5 }).map((_, i) => (
        <circle key={i} cx={16 + i * 14} cy="8" r="3" fill={i <= level ? color : "var(--line)"} />
      ))}
    </svg>
  );
}

function ProgressView({ sessions }) {
  const [mode, setMode] = useState("week"); // week | block
  const today = new Date();
  const weekStart = toISODate(getMonday(today));
  const weekEnd = toISODate(addDays(getMonday(today), 6));
  const blockStart = toISODate(addDays(today, -8*7));
  const blockEnd = toISODate(today);

  const range = mode === "week" ? [weekStart, weekEnd] : [blockStart, blockEnd];
  const stats = statsForRange(sessions, range[0], range[1]);

  return (
    <div style={{ padding: "36px 28px 60px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div className="icc-display" style={{ fontSize: 24 }}>Planejado × Realizado</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="icc-btn" style={mode==="week" ? {borderColor:"var(--gold)", color:"var(--gold)"} : {}} onClick={() => setMode("week")}>Semana atual</button>
          <button className="icc-btn" style={mode==="block" ? {borderColor:"var(--gold)", color:"var(--gold)"} : {}} onClick={() => setMode("block")}>Últimas 8 semanas</button>
        </div>
      </div>

      <AthleteAvatarCard sessions={sessions} />

      <div className="icc-card" style={{ padding: 20, marginBottom: 22 }}>
        <div className="icc-label" style={{ margin: 0 }}>WEEKLY REVIEW · {mode === "week" ? "Semana atual" : "Bloco de 8 semanas"}</div>
        <div style={{ display: "flex", gap: 28, marginTop: 14, flexWrap: "wrap" }}>
          <MiniStat label="Sessões planejadas" value={stats.total} />
          <MiniStat label="Concluídas" value={stats.totalDone} color="var(--green)" />
          <MiniStat label="Parciais" value={stats.totalPartial} color="var(--amber)" />
          <MiniStat label="Não realizadas" value={stats.totalMissed} color="var(--red)" />
          <MiniStat label="Aderência" value={stats.total ? `${Math.round(((stats.totalDone + stats.totalPartial*0.5)/stats.total)*100)}%` : "—"} />
          <MiniStat label="RPE médio" value={stats.rpeAvg || "—"} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {Object.entries(DISCIPLINES).map(([key, d]) => {
          const s = stats.byDiscipline[key];
          const pct = s.planned ? Math.round(((s.done + s.partial*0.5) / s.planned) * 100) : null;
          return (
            <div key={key} className="icc-card-soft" style={{ padding: 16 }}>
              <DisciplinePill discipline={key} />
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                <span className="icc-display icc-num" style={{ fontSize: 26 }}>{s.done}</span>
                <span style={{ color: "var(--text-faint)", fontSize: 14 }}>/ {s.planned} realizados</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--gold)", marginTop: 2 }}>{pct !== null ? `${pct}%` : "—"}</div>
              <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                <span>Horas: {s.hoursActual.toFixed(1)}h realizadas / {s.hoursPlanned.toFixed(1)}h planejadas</span>
                {s.kmPlanned > 0 && <span>Km: {s.kmActual.toFixed(1)} / {s.kmPlanned.toFixed(1)} km</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)", letterSpacing: "0.04em" }}>{label.toUpperCase()}</div>
      <div className="icc-num" style={{ fontSize: 19, color: color || "var(--text)", marginTop: 3 }}>{value}</div>
    </div>
  );
}

/* -------------------------------- Recovery ---------------------------------- */

function RecoveryView({ recovery, onUpdate }) {
  const today = todayISO();
  const log = recovery[today] || {};
  const [form, setForm] = useState({
    sleepHours: log.sleepHours ?? "", sleepQuality: log.sleepQuality ?? 3,
    energy: log.energy ?? 3, fatigue: log.fatigue ?? 3, mood: log.mood ?? 3,
    soreness: log.soreness ?? 1, notes: log.notes ?? "",
  });

  const last14 = Array.from({ length: 14 }, (_, i) => toISODate(addDays(new Date(), -13+i)))
    .map(d => ({ date: d, log: recovery[d] }))
    .filter(x => x.log);

  const avgSleep = last14.length ? (last14.reduce((a,x) => a + (x.log.sleepHours||0), 0) / last14.length).toFixed(1) : null;

  function save() {
    onUpdate(today, { ...form, sleepHours: form.sleepHours === "" ? null : +form.sleepHours });
  }

  return (
    <div style={{ padding: "36px 28px 60px", maxWidth: 760 }}>
      <div className="icc-display" style={{ fontSize: 24, marginBottom: 6 }}>Recovery</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 26 }}>
        Sono, energia e sensação geral — sem diagnóstico, apenas registro.
      </div>

      <div className="icc-card" style={{ padding: 20, marginBottom: 22 }}>
        <div className="icc-label" style={{ margin: 0 }}>REGISTRO DE HOJE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginTop: 14 }}>
          <div>
            <label className="icc-label">Horas de sono</label>
            <input className="icc-input" type="number" step="0.1" value={form.sleepHours}
              onChange={e => setForm(f => ({ ...f, sleepHours: e.target.value }))} placeholder="ex: 7.5" />
          </div>
          <SliderField label="Qualidade do sono" value={form.sleepQuality} onChange={v => setForm(f=>({...f, sleepQuality:v}))} />
          <SliderField label="Energia" value={form.energy} onChange={v => setForm(f=>({...f, energy:v}))} />
          <SliderField label="Fadiga" value={form.fatigue} onChange={v => setForm(f=>({...f, fatigue:v}))} />
          <SliderField label="Humor" value={form.mood} onChange={v => setForm(f=>({...f, mood:v}))} />
          <SliderField label="Dor/desconforto" value={form.soreness} onChange={v => setForm(f=>({...f, soreness:v}))} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="icc-label">Observações</label>
          <textarea className="icc-textarea" rows={2} value={form.notes} onChange={e => setForm(f=>({...f, notes: e.target.value}))} />
        </div>
        <button className="icc-btn icc-btn-gold" style={{ marginTop: 16 }} onClick={save}>Salvar registro</button>
      </div>

      <div className="icc-card-soft" style={{ padding: 18 }}>
        <div className="icc-label" style={{ margin: 0 }}>ÚLTIMOS 14 DIAS</div>
        <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
          <MiniStat label="Sono médio" value={avgSleep ? `${avgSleep}h` : "—"} />
          <MiniStat label="Dias registrados" value={`${last14.length} / 14`} />
        </div>
        {last14.some(x => x.log.isDemo) && <div style={{ marginTop: 10 }}><DemoTag /> <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>parte destes dados é demonstrativa</span></div>}
      </div>
    </div>
  );
}

function SliderField({ label, value, onChange }) {
  return (
    <div>
      <label className="icc-label">{label} — {value}/5</label>
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(+e.target.value)} style={{ width: "100%", accentColor: "var(--gold)" }} />
    </div>
  );
}

/* --------------------------------- Import ---------------------------------- */
// Duas formas de trazer dados de fora sem a IA inventar nada: CSV exportado do
// Garmin Connect, e um histórico de conversa (texto colado) analisado pela IA
// — mas sempre com uma tela de revisão antes de qualquer coisa ser salva.

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || row.length > 0) { row.push(field); rows.push(row); row = []; field = ""; }
        if (c === "\r" && next === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.length > 1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
    return obj;
  });
}

function guessDiscipline(activityType) {
  const t = (activityType || "").toLowerCase();
  if (t.includes("nata") || t.includes("swim") || t.includes("pool")) return "swim";
  if (t.includes("ciclis") || t.includes("bike") || t.includes("cycl")) return "bike";
  if (t.includes("corrida") || t.includes("run")) return "run";
  if (t.includes("força") || t.includes("forca") || t.includes("strength") || t.includes("academia")) return "strength";
  return null;
}

function parseGarminNumber(str) {
  if (!str) return null;
  const n = parseFloat(String(str).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function parseGarminDuration(str) {
  // aceita "1:05:32" ou "45:12" ou "45min"
  if (!str) return null;
  const parts = String(str).split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
  if (parts.length === 2) return Math.round(parts[0] + parts[1] / 60);
  return null;
}

function ImportView({ sessions, onImportSessions, photos, onAddPhotos, onRemovePhoto, photoWarning }) {
  const [sub, setSub] = useState("garmin");
  return (
    <div style={{ padding: "36px 28px 60px", maxWidth: 900 }}>
      <div className="icc-display" style={{ fontSize: 24, marginBottom: 4 }}>Importar</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 22 }}>
        Traga dados de fora do app — sempre com revisão antes de salvar, nada entra sem você conferir.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        <button className="icc-btn" onClick={() => setSub("garmin")} style={sub==="garmin" ? {borderColor:"var(--gold)", color:"var(--gold)"} : {}}>Garmin (CSV)</button>
        <button className="icc-btn" onClick={() => setSub("history")} style={sub==="history" ? {borderColor:"var(--gold)", color:"var(--gold)"} : {}}>Histórico de conversa</button>
        <button className="icc-btn" onClick={() => setSub("photos")} style={sub==="photos" ? {borderColor:"var(--gold)", color:"var(--gold)"} : {}}>Fotos</button>
      </div>
      {sub === "garmin" && <GarminCsvImport sessions={sessions} onImportSessions={onImportSessions} />}
      {sub === "history" && <HistoryImport sessions={sessions} onImportSessions={onImportSessions} />}
      {sub === "photos" && <PhotoGallery photos={photos} onAddPhotos={onAddPhotos} onRemovePhoto={onRemovePhoto} warning={photoWarning} />}
    </div>
  );
}

function GarminCsvImport({ sessions, onImportSessions }) {
  const [rows, setRows] = useState([]); // review rows
  const [saved, setSaved] = useState(false);
  const inputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaved(false);
    const reader = new FileReader();
    reader.onload = () => {
      const records = parseCSV(String(reader.result));
      const built = records.map((r, i) => {
        const activityType = r["Tipo de atividade"] || r["Activity Type"] || "";
        const dateStr = r["Data"] || r["Date"] || "";
        const date = parseGarminDate(dateStr);
        const discipline = guessDiscipline(activityType) || "run";
        const durationMin = parseGarminDuration(r["Tempo"] || r["Time"] || r["Duração"]);
        const distanceKm = parseGarminNumber(r["Distância"] || r["Distance"]);
        const hrAvg = parseGarminNumber(r["FC média"] || r["Avg HR"]);
        const match = date ? sessions.find(s => s.date === date && s.discipline === discipline) : null;
        return {
          rowId: `g${i}`, include: !!date, date: date || "", discipline,
          durationMin: durationMin || "", distanceKm: distanceKm || "", hrAvg: hrAvg || "",
          matchInstanceId: match ? match.instanceId : null, activityType,
        };
      }).filter(r => r.date);
      setRows(built);
    };
    reader.readAsText(file, "utf-8");
  }

  function updateRow(rowId, patch) {
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r));
  }

  function save() {
    const toSave = rows.filter(r => r.include).map(r => {
      const durationMin = +r.durationMin || 0, distanceKm = r.distanceKm === "" ? null : +r.distanceKm;
      const pace = r.discipline === "run" ? formatPaceMinKm(durationMin, distanceKm) : r.discipline === "swim" ? formatSwimPace(durationMin, distanceKm) : null;
      const speedKmh = r.discipline === "bike" && distanceKm ? +(distanceKm / (durationMin / 60)).toFixed(1) : null;
      const day = (fromISODate(r.date).getDay() + 6) % 7;
      const instanceId = r.matchInstanceId || `garmin_${r.date}_${r.discipline}_${r.rowId}`;
      return {
        instanceId, templateId: null, date: r.date, day, time: "00:00", discipline: r.discipline,
        durationMin: durationMin, distanceKm, zone: null, desc: "Importado do Garmin",
        status: "completed",
        actual: { durationMin, distanceKm, pace, speedKmh, hrAvg: r.hrAvg === "" ? null : +r.hrAvg, power: null, cadence: null, elevationM: null, rpe: null, sensation: null, notes: `Importado do Garmin (${r.activityType})`, nutrition: "", isDemo: false },
        missedReason: null, missedNote: null,
      };
    });
    onImportSessions(toSave);
    setSaved(true);
  }

  return (
    <div>
      <div className="icc-card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="icc-label" style={{ margin: 0 }}>COMO EXPORTAR DO GARMIN CONNECT</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.6 }}>
          O Garmin não oferece uma sincronização automática de graça para apps pessoais — a API oficial deles é só para empresas aprovadas.
          O caminho que funciona: no site connect.garmin.com → "Atividades" → selecione as atividades → "Exportar CSV". Depois suba o
          arquivo aqui. Pode repetir isso periodicamente (ex: 1x por semana).
        </div>
        <button className="icc-btn icc-btn-gold" style={{ marginTop: 14 }} onClick={() => inputRef.current?.click()}>Selecionar arquivo CSV</button>
        <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
      </div>

      {rows.length > 0 && (
        <div className="icc-card" style={{ padding: 20 }}>
          <div className="icc-label" style={{ margin: 0 }}>REVISAR ANTES DE SALVAR ({rows.length} atividades encontradas)</div>
          <div className="icc-scroll" style={{ maxHeight: 420, overflowY: "auto", marginTop: 12 }}>
            {rows.map(r => (
              <div key={r.rowId} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <input type="checkbox" checked={r.include} onChange={e => updateRow(r.rowId, { include: e.target.checked })} />
                <div style={{ width: 90, fontSize: 12 }}>{r.date}</div>
                <select className="icc-select" style={{ width: 120 }} value={r.discipline} onChange={e => updateRow(r.rowId, { discipline: e.target.value })}>
                  {Object.keys(DISCIPLINES).map(k => <option key={k} value={k}>{DISCIPLINES[k].label}</option>)}
                </select>
                <input className="icc-input" style={{ width: 80 }} placeholder="min" value={r.durationMin} onChange={e => updateRow(r.rowId, { durationMin: e.target.value })} />
                <input className="icc-input" style={{ width: 80 }} placeholder="km" value={r.distanceKm} onChange={e => updateRow(r.rowId, { distanceKm: e.target.value })} />
                <input className="icc-input" style={{ width: 80 }} placeholder="FC" value={r.hrAvg} onChange={e => updateRow(r.rowId, { hrAvg: e.target.value })} />
                <div style={{ fontSize: 11, color: r.matchInstanceId ? "var(--green)" : "var(--text-faint)" }}>
                  {r.matchInstanceId ? "vincula a treino planejado" : "extra"}
                </div>
              </div>
            ))}
          </div>
          <button className="icc-btn icc-btn-gold" style={{ marginTop: 16 }} onClick={save}>Salvar selecionados</button>
          {saved && <span style={{ marginLeft: 12, fontSize: 12.5, color: "var(--green)" }}>Salvo!</span>}
        </div>
      )}
    </div>
  );
}

function parseGarminDate(str) {
  if (!str) return null;
  // formatos comuns: "2026-09-10 06:30:00", "10/09/2026 06:30", "2026-09-10"
  const m1 = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}

function HistoryImport({ sessions, onImportSessions }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function extract() {
    if (!text.trim()) return;
    setLoading(true); setError(""); setSaved(false);
    const prompt = `Este é um histórico de conversa entre um atleta e um assistente sobre os treinos dele. Extraia APENAS os treinos que
foram explicitamente mencionados com dados concretos (data ou dia da semana relativo, modalidade, e pelo menos duração ou distância).
NÃO invente nenhum valor que não esteja no texto — se um dado não aparecer, deixe null.

Responda SOMENTE com um array JSON, sem texto antes ou depois, no formato:
[{"date": "AAAA-MM-DD ou null se não souber", "discipline": "swim|bike|run|strength", "durationMin": numero ou null, "distanceKm": numero ou null, "rpe": numero ou null, "notes": "texto curto ou null"}]

Hoje é ${todayISO()}, use isso para resolver datas relativas tipo "ontem" ou "terça passada".

TEXTO:
${text.slice(0, 12000)}`;
    const result = await callClaude("Você extrai dados estruturados de texto sem nunca inventar valores ausentes.", prompt);
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
      setRows(parsed.map((p, i) => ({ rowId: `h${i}`, include: !!(p.date && p.discipline), ...p })));
      if (parsed.length === 0) setError("Não encontrei treinos com dados suficientes nesse texto.");
    } catch (e) {
      setError("Não consegui interpretar a resposta da IA. Tente colar um trecho menor ou mais específico.");
    }
    setLoading(false);
  }

  function updateRow(rowId, patch) {
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r));
  }

  function save() {
    const toSave = rows.filter(r => r.include && r.date && r.discipline).map(r => {
      const durationMin = +r.durationMin || 0, distanceKm = r.distanceKm ? +r.distanceKm : null;
      const day = (fromISODate(r.date).getDay() + 6) % 7;
      const match = sessions.find(s => s.date === r.date && s.discipline === r.discipline);
      const instanceId = match ? match.instanceId : `historico_${r.date}_${r.discipline}_${r.rowId}`;
      return {
        instanceId, templateId: null, date: r.date, day, time: "00:00", discipline: r.discipline,
        durationMin, distanceKm, zone: null, desc: "Importado do histórico de conversa",
        status: "completed",
        actual: { durationMin, distanceKm, pace: null, speedKmh: null, hrAvg: null, power: null, cadence: null, elevationM: null, rpe: r.rpe || null, sensation: null, notes: r.notes || "Importado do histórico de conversa", nutrition: "", isDemo: false },
        missedReason: null, missedNote: null,
      };
    });
    onImportSessions(toSave);
    setSaved(true);
  }

  return (
    <div>
      <div className="icc-card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="icc-label" style={{ margin: 0 }}>COLE O HISTÓRICO DA CONVERSA</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, marginBottom: 12 }}>
          Copie e cole os trechos onde ele comentou sobre os treinos (data, modalidade, tempo/distância, como se sentiu). A IA só extrai
          o que estiver escrito — nada é inventado, e nada é salvo até você revisar e clicar em "Salvar".
        </div>
        <textarea className="icc-textarea" rows={8} value={text} onChange={e => setText(e.target.value)} placeholder="Cole aqui..." />
        <button className="icc-btn icc-btn-gold" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }} onClick={extract} disabled={loading}>
          {loading ? <Loader2 size={14} /> : <Sparkles size={14} />} Extrair treinos com IA
        </button>
        {error && <div style={{ fontSize: 12.5, color: "var(--amber)", marginTop: 10 }}>{error}</div>}
      </div>

      {rows.length > 0 && (
        <div className="icc-card" style={{ padding: 20 }}>
          <div className="icc-label" style={{ margin: 0 }}>REVISAR ANTES DE SALVAR</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map(r => (
              <div key={r.rowId} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <input type="checkbox" checked={r.include} onChange={e => updateRow(r.rowId, { include: e.target.checked })} />
                <input className="icc-input" style={{ width: 120 }} type="date" value={r.date || ""} onChange={e => updateRow(r.rowId, { date: e.target.value })} />
                <select className="icc-select" style={{ width: 120 }} value={r.discipline || "run"} onChange={e => updateRow(r.rowId, { discipline: e.target.value })}>
                  {Object.keys(DISCIPLINES).map(k => <option key={k} value={k}>{DISCIPLINES[k].label}</option>)}
                </select>
                <input className="icc-input" style={{ width: 80 }} placeholder="min" value={r.durationMin || ""} onChange={e => updateRow(r.rowId, { durationMin: e.target.value })} />
                <input className="icc-input" style={{ width: 80 }} placeholder="km" value={r.distanceKm || ""} onChange={e => updateRow(r.rowId, { distanceKm: e.target.value })} />
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", flex: 1, minWidth: 140 }}>{r.notes}</div>
              </div>
            ))}
          </div>
          <button className="icc-btn icc-btn-gold" style={{ marginTop: 16 }} onClick={save}>Salvar selecionados</button>
          {saved && <span style={{ marginLeft: 12, fontSize: 12.5, color: "var(--green)" }}>Salvo!</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Workout log modal ---------------------------- */

function WorkoutLogModal({ session: s, onClose, onSave }) {
  const isMiss = s.status === "missed";
  const [outcome, setOutcome] = useState(isMiss ? "missed" : (s.status === "partial" ? "partial" : "completed"));
  const seed = s.actual || {};
  const [f, setF] = useState({
    durationMin: seed.durationMin ?? s.durationMin ?? "",
    distanceKm: seed.distanceKm ?? s.distanceKm ?? "",
    hrAvg: seed.hrAvg ?? "", power: seed.power ?? "", cadence: seed.cadence ?? "",
    elevationM: seed.elevationM ?? "", rpe: seed.rpe ?? 6, sensation: seed.sensation ?? "Bom",
    notes: seed.notes ?? "", nutrition: seed.nutrition ?? "",
    missedReason: s.missedReason ?? MISSED_REASONS[0], missedNote: s.missedNote ?? "",
  });

  const disc = s.discipline;
  const showDistance = disc !== "strength";
  const showPower = disc === "bike";
  const showCadence = disc === "bike" || disc === "run";
  const showElevation = disc === "bike" || disc === "run";

  function submit() {
    if (outcome === "missed") {
      onSave(s.instanceId, { status: "missed", missedReason: f.missedReason, missedNote: f.missedNote });
      return;
    }
    const distanceKm = f.distanceKm === "" ? null : +f.distanceKm;
    const durationMin = f.durationMin === "" ? 0 : +f.durationMin;
    const pace = disc === "run" ? formatPaceMinKm(durationMin, distanceKm) : disc === "swim" ? formatSwimPace(durationMin, distanceKm) : null;
    const speedKmh = disc === "bike" && distanceKm ? +(distanceKm / (durationMin/60)).toFixed(1) : null;
    onSave(s.instanceId, {
      status: outcome,
      actual: {
        durationMin, distanceKm, pace, speedKmh,
        hrAvg: f.hrAvg === "" ? null : +f.hrAvg,
        power: f.power === "" ? null : +f.power,
        cadence: f.cadence === "" ? null : +f.cadence,
        elevationM: f.elevationM === "" ? null : +f.elevationM,
        rpe: +f.rpe, sensation: f.sensation, notes: f.notes, nutrition: f.nutrition,
      },
    });
  }

  return (
    <ModalShell onClose={onClose} title={`Registrar treino — ${DISCIPLINES[disc].label}`} subtitle={`${formatDateLong(s.date)} · ${s.time}`}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["completed","partial","missed"].map(o => (
          <button key={o} className="icc-btn" onClick={() => setOutcome(o)}
            style={outcome === o ? { borderColor: "var(--gold)", color: "var(--gold)" } : {}}>
            {o === "completed" ? "✅ Concluído" : o === "partial" ? "🟡 Parcial" : "❌ Não realizado"}
          </button>
        ))}
      </div>

      {outcome === "missed" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="icc-label">Por que não realizou?</label>
            <select className="icc-select" value={f.missedReason} onChange={e => setF(v=>({...v, missedReason: e.target.value}))}>
              {MISSED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="icc-label">Comentário (opcional)</label>
            <textarea className="icc-textarea" rows={3} value={f.missedNote} onChange={e => setF(v=>({...v, missedNote: e.target.value}))} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Duração (min)"><input className="icc-input" type="number" value={f.durationMin} onChange={e=>setF(v=>({...v,durationMin:e.target.value}))} /></Field>
            {showDistance && <Field label="Distância (km)"><input className="icc-input" type="number" step="0.01" value={f.distanceKm} onChange={e=>setF(v=>({...v,distanceKm:e.target.value}))} /></Field>}
            <Field label="FC média (bpm)"><input className="icc-input" type="number" value={f.hrAvg} onChange={e=>setF(v=>({...v,hrAvg:e.target.value}))} /></Field>
            {showPower && <Field label="Potência (W)"><input className="icc-input" type="number" value={f.power} onChange={e=>setF(v=>({...v,power:e.target.value}))} /></Field>}
            {showCadence && <Field label="Cadência"><input className="icc-input" type="number" value={f.cadence} onChange={e=>setF(v=>({...v,cadence:e.target.value}))} /></Field>}
            {showElevation && <Field label="Elevação (m)"><input className="icc-input" type="number" value={f.elevationM} onChange={e=>setF(v=>({...v,elevationM:e.target.value}))} /></Field>}
          </div>
          <SliderField label="RPE (1-10)" value={f.rpe} onChange={v => setF(x=>({...x, rpe: v}))} />
          <Field label="Sensação geral">
            <select className="icc-select" value={f.sensation} onChange={e=>setF(v=>({...v,sensation:e.target.value}))}>
              {SENSATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Alimentação / hidratação (opcional)"><input className="icc-input" value={f.nutrition} onChange={e=>setF(v=>({...v,nutrition:e.target.value}))} /></Field>
          <Field label="Observações"><textarea className="icc-textarea" rows={3} value={f.notes} onChange={e=>setF(v=>({...v,notes:e.target.value}))} /></Field>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <button className="icc-btn" onClick={onClose}>Cancelar</button>
        <button className="icc-btn icc-btn-gold" onClick={submit}>Salvar registro</button>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }) {
  return <div><label className="icc-label">{label}</label>{children}</div>;
}

function ModalShell({ title, subtitle, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,5,6,0.72)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div className="icc-card icc-fade icc-scroll" style={{ width: "100%", maxWidth: wide ? 620 : 480, maxHeight: "88vh", overflowY: "auto", padding: 24, background: "var(--surface)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div className="icc-display" style={{ fontSize: 18 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{subtitle}</div>}
          </div>
          <X size={18} style={{ cursor: "pointer", color: "var(--text-muted)" }} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------- AI calls -------------------------------- */

// Fora do claude.ai a API da Anthropic não pode ser chamada direto do navegador
// (precisa de x-api-key e não libera CORS para qualquer origem). Por isso aqui
// chamamos nossa própria função serverless (/api/claude, em /api/claude.js),
// que guarda a chave no servidor (variável de ambiente ANTHROPIC_API_KEY).
async function callClaude(system, userPrompt) {
  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, prompt: userPrompt }),
    });
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || "").join("\n").trim();
    return text || "Não foi possível gerar a análise agora.";
  } catch (e) {
    return "Não foi possível conectar à IA agora. Tente novamente em instantes.";
  }
}

const AI_GUARDRAILS = `
Você é uma camada de análise sobre dados reais de treino de triathlon/Ironman. Regras rígidas:
- Use APENAS os dados fornecidos. Nunca invente números, sensações ou eventos não presentes nos dados.
- Se um dado não existir, diga explicitamente que não há dado suficiente — não estime silenciosamente.
- Separe claramente DADO (fato objetivo dos registros) de INTERPRETAÇÃO (sua leitura).
- Nunca afirme causalidade a partir de correlação. Use frases como "os dados disponíveis não permitem concluir causalidade".
- Nunca dê diagnóstico médico.
- Nunca sugira alterar o plano de treino — você não é o treinador desta pessoa; o plano é fonte de verdade.
- Responda em português do Brasil, de forma direta e objetiva, sem floreios.
`;

/* ---------------------------- Individual AI analysis ---------------------------- */

function AIAnalysisModal({ session: s, onClose }) {
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const planned = { duracaoMin: s.durationMin, distanciaKm: s.distanceKm, zona: s.zone, descricao: s.desc, horario: s.time };
      const actual = s.actual ? {
        duracaoMin: s.actual.durationMin, distanciaKm: s.actual.distanceKm, pace: s.actual.pace,
        velocidadeKmh: s.actual.speedKmh, fcMedia: s.actual.hrAvg, potencia: s.actual.power,
        cadencia: s.actual.cadence, elevacaoM: s.actual.elevationM, rpe: s.actual.rpe,
        sensacao: s.actual.sensation, observacoes: s.actual.notes || null, nutricao: s.actual.nutrition || null,
        dadoDemonstrativo: !!s.actual.isDemo,
      } : null;
      const prompt = `Analise esta sessão de ${DISCIPLINES[s.discipline].label} (status: ${s.status}).
PLANEJADO: ${JSON.stringify(planned)}
REALIZADO: ${JSON.stringify(actual)}

Estruture a resposta EXATAMENTE nestas seções, com esses títulos:
O QUE ACONTECEU
PONTOS POSITIVOS
PONTOS DE ATENÇÃO
PLANEJADO × REALIZADO
CONTEXTO

Se "dadoDemonstrativo" for true, mencione brevemente em CONTEXTO que este registro é demonstrativo.`;
      const result = await callClaude(AI_GUARDRAILS, prompt);
      setText(result);
      setLoading(false);
    })();
  }, [s.instanceId]);

  return (
    <ModalShell title="Análise com IA" subtitle={`${DISCIPLINES[s.discipline].label} · ${formatDateLong(s.date)}`} onClose={onClose} wide>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", padding: "20px 0" }}>
          <Loader2 size={16} className="icc-num" /> Analisando dados reais deste treino…
        </div>
      ) : (
        <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--text)" }}>{text}</div>
      )}
    </ModalShell>
  );
}

/* --------------------------------- AI Lab ---------------------------------- */

function AILabView({ sessions, recovery }) {
  const [sub, setSub] = useState("insights");
  const subTabs = [
    { id: "insights", label: "Insights" },
    { id: "weekly", label: "Análise semanal" },
    { id: "patterns", label: "Pattern Detector" },
    { id: "profile", label: "Athlete Profile" },
    { id: "ask", label: "Ask Your Data" },
  ];
  return (
    <div style={{ padding: "36px 28px 60px", maxWidth: 900 }}>
      <div className="icc-display" style={{ fontSize: 24, marginBottom: 4 }}>AI Training Lab</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 22 }}>
        Uma camada de inteligência sobre o seu treinamento existente — nunca um novo treinador.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {subTabs.map(t => (
          <button key={t.id} className="icc-btn" onClick={() => setSub(t.id)}
            style={sub === t.id ? { borderColor: "var(--gold)", color: "var(--gold)" } : {}}>{t.label}</button>
        ))}
      </div>
      {sub === "insights" && <InsightsPanel sessions={sessions} />}
      {sub === "weekly" && <WeeklyAIPanel sessions={sessions} />}
      {sub === "patterns" && <PatternDetectorPanel sessions={sessions} recovery={recovery} />}
      {sub === "profile" && <AthleteProfilePanel sessions={sessions} />}
      {sub === "ask" && <AskDataPanel sessions={sessions} recovery={recovery} />}
    </div>
  );
}

function InsightCard({ type, children, basedOn }) {
  const map = {
    positive: { icon: "🟢", label: "Positive" },
    discovery: { icon: "🔵", label: "Discovery" },
    observation: { icon: "🟡", label: "Observation" },
    attention: { icon: "🟠", label: "Attention" },
  };
  const m = map[type];
  return (
    <div className="icc-card-soft" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.icon} {m.label}</div>
      <div style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>{children}</div>
      {basedOn && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 10 }}>Baseado em: {basedOn}</div>}
    </div>
  );
}

function InsightsPanel({ sessions }) {
  const today = todayISO();
  const w3 = statsForRange(sessions, toISODate(addDays(new Date(), -21)), today);
  const w6 = statsForRange(sessions, toISODate(addDays(new Date(), -42)), today);

  const adh3 = w3.total ? Math.round(((w3.totalDone + w3.totalPartial*0.5)/w3.total)*100) : null;
  const missedByDiscipline = Object.entries(w6.byDiscipline).sort((a,b) => b[1].missed - a[1].missed)[0];
  const bestAdherence = Object.entries(w6.byDiscipline)
    .filter(([,v]) => v.planned > 0)
    .sort((a,b) => (b[1].done/b[1].planned) - (a[1].done/a[1].planned))[0];

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))" }}>
      {adh3 !== null && (
        <InsightCard type="positive" basedOn={`${w3.total} sessões nas últimas 3 semanas`}>
          Sua aderência nas últimas 3 semanas foi de {adh3}% ({w3.totalDone} concluídas, {w3.totalPartial} parciais, {w3.totalMissed} não realizadas).
        </InsightCard>
      )}
      {bestAdherence && bestAdherence[1].planned > 0 && (
        <InsightCard type="discovery" basedOn={`${bestAdherence[1].planned} sessões de ${DISCIPLINES[bestAdherence[0]].label.toLowerCase()} nas últimas 6 semanas`}>
          {DISCIPLINES[bestAdherence[0]].label} apresenta sua maior taxa de conclusão no período: {Math.round((bestAdherence[1].done/bestAdherence[1].planned)*100)}%.
        </InsightCard>
      )}
      {missedByDiscipline && missedByDiscipline[1].missed > 0 && (
        <InsightCard type="attention" basedOn={`${missedByDiscipline[1].missed} sessões não realizadas em 6 semanas`}>
          {DISCIPLINES[missedByDiscipline[0]].label} concentra o maior número de treinos não realizados no período ({missedByDiscipline[1].missed}).
        </InsightCard>
      )}
      {w6.rpeAvg && (
        <InsightCard type="observation" basedOn={`registros de RPE das últimas 6 semanas`}>
          Seu RPE médio nas últimas 6 semanas foi {w6.rpeAvg}.
        </InsightCard>
      )}
    </div>
  );
}

function WeeklyAIPanel({ sessions }) {
  const weekStart = toISODate(getMonday(new Date()));
  const weekEnd = toISODate(addDays(getMonday(new Date()), 6));
  const weekSessions = sessions.filter(s => s.date >= weekStart && s.date <= weekEnd);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");

  async function run() {
    setLoading(true);
    const payload = weekSessions.map(s => ({
      dia: DAY_LABELS[s.day], horario: s.time, modalidade: DISCIPLINES[s.discipline].label,
      status: s.status, planejado: { duracaoMin: s.durationMin, distanciaKm: s.distanceKm },
      realizado: s.actual ? { duracaoMin: s.actual.durationMin, distanciaKm: s.actual.distanceKm, rpe: s.actual.rpe, sensacao: s.actual.sensation } : null,
      motivoNaoRealizado: s.missedReason || null,
    }));
    const prompt = `Analise a semana de treino abaixo (planejado x realizado) e escreva um resumo curto em português, tipo:
"Você completou X dos Y treinos planejados." "Seu maior índice de aderência foi em [modalidade]." etc.
Separe DADO de INTERPRETAÇÃO. Não sugira mudanças no plano.
DADOS DA SEMANA: ${JSON.stringify(payload)}`;
    const result = await callClaude(AI_GUARDRAILS, prompt);
    setText(result);
    setLoading(false);
  }

  return (
    <div>
      <div className="icc-card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="icc-label" style={{margin:0}}>SEMANA ATUAL</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
          {weekSessions.length} sessões planejadas · {weekSessions.filter(s=>s.status==="completed").length} concluídas · {weekSessions.filter(s=>s.status==="missed").length} não realizadas
        </div>
        <button className="icc-btn icc-btn-gold" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }} onClick={run} disabled={loading}>
          {loading ? <Loader2 size={14} /> : <Sparkles size={14} />} Analisar minha semana
        </button>
      </div>
      {text && <div className="icc-card-soft" style={{ padding: 18, fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{text}</div>}
    </div>
  );
}

function PatternDetectorPanel({ sessions, recovery }) {
  // Rule-based, deterministic observations — the model doesn't fabricate correlations here,
  // we only surface computed stats and label them clearly as correlational, not causal.
  const completed = sessions.filter(s => s.status === "completed" || s.status === "partial");

  const byDayOfWeek = Array.from({ length: 7 }, (_, d) => {
    const list = sessions.filter(s => s.day === d);
    const done = list.filter(s => s.status === "completed").length;
    return { day: DAY_LABELS[d], rate: list.length ? Math.round((done/list.length)*100) : null, n: list.length };
  });
  const worstDay = byDayOfWeek.filter(d=>d.n>=3).sort((a,b) => (a.rate ?? 100) - (b.rate ?? 100))[0];

  // Run after bike (Saturday bike -> Sunday run) comparison
  const brickRuns = sessions.filter(s => s.discipline === "run" && s.day === 6 && s.actual);
  const otherRuns = sessions.filter(s => s.discipline === "run" && s.day !== 6 && s.actual);
  const avgRpe = (arr) => arr.length ? (arr.reduce((a,s)=>a+s.actual.rpe,0)/arr.length).toFixed(1) : null;
  const brickRpe = avgRpe(brickRuns), normalRpe = avgRpe(otherRuns);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <InsightCard type="observation" basedOn={`${byDayOfWeek.filter(d=>d.n>=3).length} dias da semana com histórico suficiente`}>
        {worstDay ? `${worstDay.day} apresenta a menor taxa de conclusão entre os dias com dados suficientes (${worstDay.rate}%).` : "Ainda não há dados suficientes por dia da semana."}
        {" "}Os dados disponíveis não permitem concluir a causa dessa diferença.
      </InsightCard>

      <InsightCard type="discovery" basedOn={`${brickRuns.length} corridas de domingo após bike de sábado, ${otherRuns.length} outras corridas registradas`}>
        {brickRpe && normalRpe
          ? `Suas corridas de domingo (após o longão de bike de sábado) têm RPE médio ${brickRpe}, contra ${normalRpe} nas demais corridas. Isso é uma correlação observada nos seus registros — os dados não permitem concluir causalidade.`
          : "Não há dados suficientes para comparar corridas após bike com as demais corridas ainda."}
      </InsightCard>

      <InsightCard type="observation" basedOn={`${completed.length} sessões concluídas ou parciais registradas`}>
        Esta seção identifica padrões estatísticos nos seus próprios dados — nunca afirma causa e efeito, e nunca altera seu plano.
      </InsightCard>
    </div>
  );
}

function AthleteProfilePanel({ sessions }) {
  const cutoff = toISODate(addDays(new Date(), -8*7));
  const stats = statsForRange(sessions, cutoff, todayISO());

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14, marginBottom: 18 }}>
        {Object.entries(DISCIPLINES).map(([key, d]) => {
          const s = stats.byDiscipline[key];
          const pct = s.planned ? Math.round((s.done/s.planned)*100) : null;
          return (
            <div key={key} className="icc-card-soft" style={{ padding: 16 }}>
              <DisciplinePill discipline={key} />
              <div className="icc-display icc-num" style={{ fontSize: 26, marginTop: 10 }}>{pct !== null ? `${pct}%` : "—"}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>consistência (8 semanas · {s.planned} sessões)</div>
            </div>
          );
        })}
      </div>
      <div className="icc-card" style={{ padding: 18, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Este perfil é construído exclusivamente a partir dos seus registros reais e demonstrativos das últimas 8 semanas.
        Conforme você registrar mais treinos, a consistência e os padrões por modalidade vão se tornando mais representativos.
      </div>
    </div>
  );
}

function AskDataPanel({ sessions, recovery }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Pergunte algo sobre seus treinos — ex: \"Como foi minha semana?\" ou \"Qual foi meu melhor treino de bike?\"" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function buildContext() {
    const stats30 = statsForRange(sessions, toISODate(addDays(new Date(), -30)), todayISO());
    const recentSessions = sessions
      .filter(s => s.status !== "planned")
      .slice(-40)
      .map(s => ({
        data: s.date, dia: DAY_LABELS[s.day], modalidade: DISCIPLINES[s.discipline].label, status: s.status,
        planejado: { duracaoMin: s.durationMin, distanciaKm: s.distanceKm },
        realizado: s.actual ? { duracaoMin: s.actual.durationMin, distanciaKm: s.actual.distanceKm, rpe: s.actual.rpe, fcMedia: s.actual.hrAvg, sensacao: s.actual.sensation } : null,
        motivoNaoRealizado: s.missedReason || null,
      }));
    return { resumo30dias: stats30, sessoesRecentes: recentSessions };
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);
    const context = buildContext();
    const prompt = `Contexto estruturado dos treinos do usuário (use apenas isto, não invente dados fora daqui):
${JSON.stringify(context)}

Pergunta do usuário: "${userMsg}"

Responda de forma direta, citando números reais do contexto. Se a pergunta pedir algo que não está no contexto, diga que não há dados suficientes.`;
    const result = await callClaude(AI_GUARDRAILS, prompt);
    setMessages(m => [...m, { role: "assistant", text: result }]);
    setLoading(false);
  }

  return (
    <div className="icc-card" style={{ display: "flex", flexDirection: "column", height: 480 }}>
      <div className="icc-scroll" style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%" }}>
            <div style={{
              padding: "10px 13px", borderRadius: 6, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
              background: m.role === "user" ? "var(--gold-soft)" : "var(--surface-2)",
              border: `1px solid ${m.role === "user" ? "transparent" : "var(--line)"}`,
            }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} /> Consultando seus dados…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--line)" }}>
        <input className="icc-input" placeholder="Pergunte sobre seus treinos…" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
        <button className="icc-btn icc-btn-gold" onClick={send} disabled={loading} style={{ display: "flex", alignItems: "center" }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
