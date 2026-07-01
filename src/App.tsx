import { useEffect, useMemo, useState } from "react";
import {
  Activity, Apple, Award, BarChart3, Bell, CalendarDays, Check, ChevronRight,
  CircleUserRound, Dumbbell, Flame, Gauge, HeartPulse, Home, LogOut, Menu,
  Minus, Moon, Plus, Settings, ShieldCheck, Sparkles, Sun, Target, Timer, Ellipsis,
  Trash2, Trophy, TrendingUp, UserRound, Watch, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { login, useSyncedState } from "./api";

type Page = "dashboard" | "today" | "log" | "skills" | "analytics" | "recovery" | "game" | "settings";
type SetRow = { reps: number; duration: number; assistance: number; weight: number; difficulty: number; pain: number; form: string; notes: string; completed?: boolean };
type Exercise = { name: string; target: string; sets: SetRow[] };
type Recovery = { energy: number; sleep: number; shoulder: number; chest: number; back: number; biceps: number; grip: number; quads: number; glutes: number; calves: number; walking: number; palms: number };
type SavedWorkout = {
  id: number; date: string; type: string; duration: number; calories: number; avgHr: number;
  exercises: number; assessment: string; completedAt?: string; totalSets?: number;
  volume?: number; maxPain?: number; exerciseDetails?: Exercise[];
};

const nav = [
  ["dashboard", "Home", Home], ["today", "Train", Dumbbell],
  ["log", "Workout Log", CalendarDays], ["skills", "Skill Tree", Target],
  ["analytics", "Analytics", BarChart3], ["recovery", "Recovery", HeartPulse],
  ["game", "Campaign", Trophy], ["settings", "Settings", Settings]
] as const;

const week = [
  { day: "SAT", label: "Push + rope", state: "done" }, { day: "SUN", label: "Pull + rope", state: "today" },
  { day: "MON", label: "Rest", state: "rest" }, { day: "TUE", label: "Legs", state: "up" },
  { day: "WED", label: "Skill + conditioning", state: "up" }, { day: "THU", label: "Rest", state: "rest" },
  { day: "FRI", label: "Rest", state: "rest" }
];

const skillData = [
  { name: "Pull-up", level: 3, progress: 64, next: "5 clean reps at 15 kg", color: "green", note: "Prioritize full range assisted reps.", prereq: "30s hang unlocked" },
  { name: "Muscle-up", level: 1, progress: 18, next: "First strict pull-up", color: "blue", note: "Build pulling base before transitions.", prereq: "Pull-up L5 required" },
  { name: "Handstand", level: 2, progress: 36, next: "20s wall hold", color: "amber", note: "Add two shoulder-safe wall sets.", prereq: "Hollow body L2" },
  { name: "Handstand push-up", level: 1, progress: 12, next: "10 pike push-ups", color: "blue", note: "Keep bent-knee pike volume controlled.", prereq: "Handstand L4" },
  { name: "Pistol squat", level: 2, progress: 43, next: "3 clean assisted sets", color: "green", note: "Use counterbalance and slow eccentrics.", prereq: "Balance L2" },
  { name: "Front lever", level: 1, progress: 22, next: "Scapular control", color: "blue", note: "Scapular pulls before lever work.", prereq: "Pull-up L3" },
  { name: "Planche", level: 1, progress: 15, next: "20s planche lean", color: "amber", note: "Keep lean shallow and pain-free.", prereq: "Push L3" },
  { name: "Human flag", level: 0, progress: 4, next: "Foundation locked", color: "blue", note: "Develop shoulder and core base first.", prereq: "Pull-up L5" },
  { name: "Hollow body", level: 3, progress: 68, next: "30s clean hold", color: "green", note: "Extend hold duration gradually.", prereq: "3 x 20s complete" },
  { name: "Rope conditioning", level: 4, progress: 77, next: "30 min continuous", color: "amber", note: "Stay relaxed and protect calf recovery.", prereq: "60 min weekly" }
];

const pullTemplate: Exercise[] = [
  ["Shoulder warm-up", "6 min"], ["Assisted Pull-Ups", "3 sets"], ["Negative Pull-Ups", "2 x 3"],
  ["Ring / Bar Rows", "3 x 10-12"], ["Dead Hangs", "2 sets"], ["Scapular Pull-Ups", "2 sets"],
  ["Bodyweight Curls", "3 sets"], ["Hollow Holds", "3 x 20 sec"], ["Jump Rope", "8-12 min optional"]
].map(([name, target], i) => ({
  name, target, sets: Array.from({ length: i === 0 ? 1 : i === 2 || i === 4 || i === 5 ? 2 : 3 }, () => ({
    reps: name.includes("Hold") || name.includes("Hang") || name.includes("Rope") || name.includes("warm") ? 0 : 8,
    duration: name.includes("Hold") ? 20 : name.includes("Hang") ? 25 : name.includes("Rope") ? 10 : name.includes("warm") ? 6 : 0,
    assistance: name.includes("Assisted") ? 20 : 0, weight: 0, difficulty: 6, pain: 0, form: "Good", notes: ""
  }))
}));

const history = [
  { week: "W1", pushups: 7, assist: 30, hang: 18, rope: 28, calories: 920 },
  { week: "W2", pushups: 8, assist: 25, hang: 22, rope: 34, calories: 1080 },
  { week: "W3", pushups: 8, assist: 25, hang: 25, rope: 41, calories: 1210 },
  { week: "W4", pushups: 9, assist: 20, hang: 27, rope: 46, calories: 1340 },
  { week: "W5", pushups: 10, assist: 20, hang: 30, rope: 53, calories: 1518 }
];

const initialRecovery: Recovery = { energy: 7, sleep: 8, shoulder: 2, chest: 3, back: 4, biceps: 3, grip: 4, quads: 1, glutes: 1, calves: 2, walking: 0, palms: 3 };

function usePersistent<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("obos-token"));
  const [page, setPage] = useState<Page>(() => {
    const requested = new URLSearchParams(window.location.search).get("screen");
    return nav.some(([id]) => id === requested) ? requested as Page : "dashboard";
  });
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = usePersistent<"dark" | "light">("obos-theme", "dark");
  const [recovery, setRecovery, recoverySync] = useSyncedState<Recovery>("recovery", initialRecovery, token);
  const [workouts, setWorkouts, workoutsSync] = useSyncedState<SavedWorkout[]>("workouts", [
    { id: 1, date: "Jun 27", type: "Push + Rope", duration: 52, calories: 488, avgHr: 136, exercises: 7, assessment: "Push volume improved with stable form." },
    { id: 2, date: "Jun 24", type: "Skill + Conditioning", duration: 61, calories: 612, avgHr: 144, exercises: 5, assessment: "Rope endurance is trending up." },
    { id: 3, date: "Jun 22", type: "Pull + Rope", duration: 58, calories: 522, avgHr: 132, exercises: 8, assessment: "Best 20 kg assisted pull-up volume." }
  ], token);
  const [exercises, setExercises, todaySync] = useSyncedState<Exercise[]>("today", pullTemplate, token);
  const syncStatus = [recoverySync, workoutsSync, todaySync].includes("offline")
    ? "offline"
    : [recoverySync, workoutsSync, todaySync].includes("syncing")
      ? "syncing"
      : [recoverySync, workoutsSync, todaySync].every((status) => status === "local")
        ? "local"
        : "synced";
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const expire = () => setToken(null);
    window.addEventListener("obos:unauthorized", expire);
    return () => window.removeEventListener("obos:unauthorized", expire);
  }, []);

  const signIn = (nextToken: string) => {
    localStorage.setItem("obos-token", nextToken);
    localStorage.removeItem("obos-auth");
    setToken(nextToken);
  };
  const signOut = () => {
    localStorage.removeItem("obos-token");
    setToken(null);
  };

  if (!token) return <Login onLogin={signIn} onLocal={() => signIn("local-only")} />;
  const render = () => {
    const props = { recovery, setRecovery, workouts, setWorkouts, exercises, setExercises, go: setPage };
    if (page === "dashboard") return <Dashboard {...props} />;
    if (page === "today") return <Today {...props} />;
    if (page === "log") return <WorkoutLog workouts={workouts} />;
    if (page === "skills") return <Skills />;
    if (page === "analytics") return <Analytics workouts={workouts} />;
    if (page === "recovery") return <RecoveryPage recovery={recovery} setRecovery={setRecovery} />;
    if (page === "game") return <Campaign />;
    return <SettingsPage onLogout={signOut} />;
  };

  return (
    <div className="app">
      <main>
        <header>
          <div className="app-title"><div className="brand-mark"><Zap size={17} /></div><div><span className="eyebrow">OPTIMAL BODY OS</span><h1>{nav.find(n => n[0] === page)?.[1]}</h1></div></div>
          <div className="header-actions"><span className={`data-sync ${syncStatus}`} title={`Data status: ${syncStatus}`}><i />{syncStatus}</span><button className="icon-btn theme-switch" aria-label="Toggle color mode" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-btn"><Bell size={18} /><i /></button><button className="avatar small" onClick={() => setPage("settings")}>MF</button></div>
        </header>
        <div className="content">{render()}</div>
      </main>
      <nav className="bottom-nav">
        {([
          ["dashboard", "Home", Home], ["today", "Train", Dumbbell],
          ["recovery", "Recovery", HeartPulse]
        ] as const).map(([id, label, Icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => { setPage(id); setMenu(false); }}><Icon size={20}/><span>{label}</span>{id === "recovery" && <i className="status-dot" />}</button>)}
        <button className={["skills","log","analytics","game","settings"].includes(page) ? "active" : ""} onClick={() => setMenu(true)}><Ellipsis size={21}/><span>More</span></button>
      </nav>
      {menu && <><button className="sheet-scrim" aria-label="Close menu" onClick={() => setMenu(false)}/><section className="more-sheet">
        <div className="sheet-handle"/><div className="sheet-head"><div><span className="eyebrow green">ATHLETE SYSTEM</span><h2>More</h2></div><button className="icon-btn" onClick={() => setMenu(false)}><X size={18}/></button></div>
        <div className="athlete-card"><div className="avatar">MF</div><div><strong>Mohamed Fadel</strong><span>Level 12 · Capability Builder</span></div><div className="sheet-xp"><b>1,840 XP</b><Progress value={74}/></div></div>
        <div className="more-grid">{nav.filter(([id]) => ["log","analytics","game","settings"].includes(id)).map(([id,label,Icon]) => <button key={id} onClick={() => { setPage(id); setMenu(false); }}><span><Icon size={20}/></span><b>{label}</b><ChevronRight size={16}/></button>)}</div>
        <div className="watch-tile"><Watch size={20}/><div><b>Apple Watch</b><span>Not connected · Integration ready</span></div><ChevronRight size={16}/></div>
      </section></>}
    </div>
  );
}

function Login({ onLogin, onLocal }: { onLogin: (token: string) => void; onLocal: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      onLogin(await login(password));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return <div className="login">
    <div className="login-panel">
      <div className="login-brand"><div className="brand-mark large"><Zap /></div><span>PRIVATE ATHLETE SYSTEM</span></div>
      <h1>Build the body.<br /><em>Unlock the skill.</em></h1>
      <p>One focused system for training, recovery, and capability.</p>
      <form className="login-form" onSubmit={submit}>
        <label><span>PRIVATE PASSWORD</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus /></label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="google" type="submit" disabled={loading}><CircleUserRound size={20} />{loading ? "Signing in..." : "Continue as Mohamed Fadel"}<ChevronRight size={18} /></button>
        <button className="local-login" type="button" onClick={onLocal}>Continue on this device</button>
      </form>
      <small><ShieldCheck size={14} /> Cloud sign-in requires server setup · Device access stays local</small>
    </div>
    <div className="login-visual">
      <div className="orbit one" /><div className="orbit two" />
      <div className="login-stat"><span>ACTIVE CAMPAIGN</span><b>FIRST PULL-UP</b><Progress value={64} /><small>64% readiness</small></div>
      <blockquote>“You are not exercising.<br />You are building capability.”</blockquote>
    </div>
  </div>;
}

type CommonProps = {
  recovery: Recovery; setRecovery: (v: Recovery) => void; workouts: SavedWorkout[];
  setWorkouts: (v: SavedWorkout[]) => void; exercises: Exercise[]; setExercises: (v: Exercise[]) => void; go: (p: Page) => void
};

function Dashboard({ recovery, go }: CommonProps) {
  const status = recoveryStatus(recovery);
  return <div className="stack clean-home">
    <section className="home-hero">
      <div className="home-hero-copy">
        <span className="eyebrow green">TODAY</span>
        <h2>Pull + Rope</h2>
        <p>Build pull-up strength, keep the shoulder calm, and finish with easy conditioning.</p>
        <button className="primary" onClick={() => go("today")}><Dumbbell size={17} />Start workout</button>
      </div>
      <button className={`readiness-card ${status.color}`} onClick={() => go("recovery")}>
        <Ring value={status.score} label="READY" />
        <span>{status.label}</span>
      </button>
    </section>

    <section className="clean-stats">
      <button onClick={() => go("analytics")}><TrendingUp size={18} /><span>Weight</span><b>95.0 kg</b><small>-1.8 kg</small></button>
      <button onClick={() => go("analytics")}><Flame size={18} /><span>Weekly burn</span><b>1,518</b><small>kcal</small></button>
      <button onClick={() => go("game")}><Trophy size={18} /><span>Streak</span><b>5 weeks</b><small>Level 12</small></button>
    </section>

    <section className="focus-card">
      <div className="focus-head">
        <div><span className="eyebrow green">COACH NOTE</span><h3>Keep it simple today</h3></div>
        <Sparkles size={19} />
      </div>
      <p>Recovery is <strong>{status.label.toLowerCase()}</strong>. Keep pulling controlled, stop sharp shoulder pain immediately, and only add rope if calves feel fresh.</p>
    </section>

    <section className="clean-list">
      <PanelHead title="Plan preview" kicker="THIS WEEK" action="View log" onClick={() => go("log")} />
      {week.slice(0, 4).map(d => <button className={`plan-row ${d.state}`} key={d.day} onClick={() => d.state === "today" ? go("today") : go("log")}>
        <span>{d.day}</span>
        <b>{d.label}</b>
        <i>{d.state === "done" ? "Done" : d.state === "today" ? "Today" : d.state === "rest" ? "Rest" : "Next"}</i>
      </button>)}
    </section>

    <section className="clean-list">
      <PanelHead title="Top skills" kicker="CURRENT FOCUS" action="Open" onClick={() => go("today")} />
      {skillData.slice(0, 3).map(s => <button className="skill-row" key={s.name} onClick={() => go("today")}>
        <span className={`skill-dot ${s.color}`}><Target size={16} /></span>
        <b>{s.name}</b>
        <Progress value={s.progress} color={s.color} />
        <i>{s.progress}%</i>
      </button>)}
    </section>
  </div>;
}

function DashboardLegacy({ recovery, go }: CommonProps) {
  const status = recoveryStatus(recovery);
  return <div className="stack">
    <section className="mission">
      <div><span className="eyebrow green">TODAY'S MISSION</span><h2>Pull strength.<br />Own every rep.</h2><p>Assisted pull-up volume with shoulder-safe control and a short rope finish.</p>
        <div className="mission-actions"><button className="primary" onClick={() => go("today")}><Dumbbell size={17} />Start workout</button><button className="secondary" onClick={() => go("recovery")}><HeartPulse size={17} />Check recovery</button></div>
      </div>
      <div className="readiness-ring"><Ring value={82} label="READY" /><div className="ring-copy"><span>Readiness</span><b>Strong signal</b><small>Sleep and energy support full volume.</small></div></div>
    </section>
    <div className="stat-grid">
      <Metric icon={Gauge} label="WEIGHT" value="95.0" unit="kg" delta="↓ 1.8 kg" />
      <Metric icon={Activity} label="BODY FAT" value="28" unit="%" delta="Goal ≤18%" />
      <Metric icon={Flame} label="WEEKLY BURN" value="1,518" unit="kcal" delta="+14% vs last" />
      <Metric icon={Trophy} label="STREAK" value="5" unit="weeks" delta="Best: 7 weeks" />
    </div>
    <div className="dashboard-grid">
      <section className="panel plan-panel"><PanelHead title="Weekly protocol" kicker="SATURDAY START" action="View log" onClick={() => go("log")} />
        <div className="week-row">{week.map(d => <div className={`day ${d.state}`} key={d.day}><span>{d.day}</span><div>{d.state === "done" ? <Check size={17} /> : d.state === "today" ? <Dumbbell size={17} /> : d.state === "rest" ? <Moon size={16} /> : <span className="day-num">•</span>}</div><b>{d.label}</b></div>)}</div>
      </section>
      <section className="panel coach-panel"><div className="coach-head"><div className="coach-icon"><Sparkles size={18} /></div><div><span>AI COACH</span><b>Protocol adjustment</b></div><i>LIVE LOGIC</i></div>
        <p>Recovery is <strong>{status.label.toLowerCase()}</strong>. Keep today's pulling volume, but cap hanging work if grip discomfort reaches 6/10. Finish with 8 minutes of rope only if calves stay fresh.</p>
        <div className="coach-tags"><span>Full pull volume</span><span>Shoulder-safe</span><span>Rope optional</span></div>
      </section>
    </div>
    <section className="panel"><PanelHead title="Capability matrix" kicker="SKILL READINESS" action="Open skill tree" onClick={() => go("skills")} />
      <div className="skill-summary">{skillData.slice(0, 5).map(s => <div className="skill-mini" key={s.name}><div className={`skill-icon ${s.color}`}><Target size={19} /></div><div><span>{s.name}</span><b>{s.progress}%</b></div><Progress value={s.progress} color={s.color} /><small>{s.next}</small></div>)}</div>
    </section>
    <div className="dashboard-grid three">
      <section className="panel"><PanelHead title="Performance trend" kicker="5-WEEK OUTPUT" /><div className="chart short"><ResponsiveContainer><AreaChart data={history}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7cf56b" stopOpacity=".35"/><stop offset="1" stopColor="#7cf56b" stopOpacity="0"/></linearGradient></defs><XAxis dataKey="week" /><Tooltip content={<ChartTip />} /><Area type="monotone" dataKey="calories" stroke="#7cf56b" fill="url(#g)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></section>
      <section className="panel prs"><PanelHead title="Latest unlocks" kicker="PERSONAL RECORDS" />{[["Push-ups", "10 reps", "Jun 27"], ["Dead hang", "30 sec", "Jun 22"], ["Ring rows", "12 / 12 / 12", "Jun 22"]].map(x => <div className="pr" key={x[0]}><Award size={17}/><div><span>{x[0]}</span><b>{x[1]}</b></div><small>{x[2]}</small></div>)}</section>
      <section className="panel recovery-card"><PanelHead title="Recovery" kicker="TODAY'S SIGNAL" action="Update" onClick={() => go("recovery")} /><div className={`recovery-state ${status.color}`}><span>{status.label}</span><b>{status.score}%</b></div><p>{status.message}</p><div className="micro-row"><span>Sleep <b>{recovery.sleep}/10</b></span><span>Energy <b>{recovery.energy}/10</b></span><span>Shoulder <b>{recovery.shoulder}/10</b></span></div></section>
    </div>
  </div>;
}

function Today({ exercises, setExercises, workouts, setWorkouts, go }: CommonProps) {
  const [open, setOpen] = useState(1);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"workout" | "skills">("workout");
  const [sessionStarted] = useState(() => Date.now());
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const updateSet = (ei: number, si: number, key: keyof SetRow, value: string) => {
    const copy = structuredClone(exercises);
    if (key === "form" || key === "notes") (copy[ei].sets[si][key] as string) = value;
    else if (key === "completed") copy[ei].sets[si].completed = value === "true";
    else (copy[ei].sets[si][key] as number) = Number(value);
    setExercises(copy);
  };
  const addSet = (ei: number) => {
    const copy = structuredClone(exercises);
    copy[ei].sets.push({ ...copy[ei].sets[copy[ei].sets.length - 1], completed: false, notes: "" });
    setExercises(copy);
  };
  const removeSet = (ei: number, si: number) => {
    const copy = structuredClone(exercises);
    if (copy[ei].sets.length === 1) return;
    copy[ei].sets.splice(si, 1);
    setExercises(copy);
  };
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.completed).length, 0);
  const completedExercises = exercises.filter(exercise => exercise.sets.some(set => set.completed)).length;
  const elapsedSeconds = Math.max(0, Math.floor((clock - sessionStarted) / 1000));
  const elapsedLabel = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const finish = () => {
    if (!completedSets) return;
    const completedAt = new Date();
    const duration = Math.max(1, Math.round(elapsedSeconds / 60));
    const completed = exercises.map(exercise => ({
      ...exercise,
      sets: exercise.sets.filter(set => set.completed)
    })).filter(exercise => exercise.sets.length);
    const allSets = completed.flatMap(exercise => exercise.sets);
    const volume = Math.round(allSets.reduce((sum, set) => sum + Math.max(0, set.weight) * Math.max(0, set.reps), 0));
    const maxPain = Math.max(0, ...allSets.map(set => set.pain));
    const avgRpe = allSets.reduce((sum, set) => sum + set.difficulty, 0) / allSets.length;
    const assessment = maxPain > 5
      ? "Session saved. Elevated pain was recorded; review recovery before the next workout."
      : avgRpe >= 8
        ? "High-effort session completed. Prioritize recovery and avoid unnecessary extra volume."
        : "Controlled session completed with sustainable effort.";
    setWorkouts([{
      id: completedAt.getTime(),
      completedAt: completedAt.toISOString(),
      date: completedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      type: "Pull + Rope",
      duration,
      calories: Math.round(duration * 8.5),
      avgHr: 0,
      exercises: completed.length,
      totalSets: completedSets,
      volume,
      maxPain,
      exerciseDetails: completed,
      assessment
    }, ...workouts]);
    setExercises(exercises.map(exercise => ({
      ...exercise,
      sets: exercise.sets.map(set => ({ ...set, completed: false }))
    })));
    setSaved(true); setTimeout(() => { setSaved(false); go("log"); }, 900);
  };
  if (mode === "skills") return <div className="stack train-screen">
    <section className="train-top">
      <div><span className="eyebrow green">TRAIN</span><h2>Capability work</h2><p>Skills now live inside training, so each session connects directly to an unlock.</p></div>
      <div className="train-tabs"><button onClick={() => setMode("workout")}>Workout</button><button className="active" onClick={() => setMode("skills")}>Skills</button></div>
    </section>
    <section className="skill-focus-card">
      <div><span className="eyebrow green">ACTIVE CAMPAIGN</span><h3>First Pull-Up</h3><p>Build pulling volume, grip tolerance, and hollow body control.</p></div>
      <Ring value={64} label="READY" />
    </section>
    <section className="skill-mobile-list">
      {skillData.map(s => <button className="skill-mobile-row" key={s.name}>
        <span className={`skill-dot ${s.color}`}><Target size={16} /></span>
        <div><b>{s.name}</b><small>{s.next}</small><Progress value={s.progress} color={s.color} /></div>
        <i>L{s.level}</i>
      </button>)}
    </section>
  </div>;
  return <div className="stack train-screen">
    <section className="train-top">
      <div><span className="eyebrow green">TRAIN</span><h2>Today’s session</h2><p>Log the workout, then move into the skills this session supports.</p></div>
      <div className="train-tabs"><button className="active" onClick={() => setMode("workout")}>Workout</button><button onClick={() => setMode("skills")}>Skills</button></div>
    </section>
    <section className="workout-hero"><div><span className="eyebrow green">WEEK 5 · SESSION 2</span><h2>Pull + Rope</h2><p>Strength first. Control the eccentric. Leave one clean rep in reserve.</p></div><div className="session-meta"><span><Timer size={16}/>{elapsedLabel}</span><span><Flame size={16}/>{Math.round(Math.max(1, elapsedSeconds / 60) * 8.5)} kcal est.</span><span><Target size={16}/>Pull-up foundation</span></div></section>
    <div className="safety"><ShieldCheck size={20}/><div><b>Shoulder protocol active</b><span>Stop any movement that produces sharp pain. Keep scapula controlled during hangs and negatives.</span></div></div>
    <section className="exercise-list">{exercises.map((ex, ei) => <div className={`exercise ${open === ei ? "expanded" : ""}`} key={ex.name}>
      <button className="exercise-head" onClick={() => setOpen(open === ei ? -1 : ei)}><span className="exercise-num">{String(ei + 1).padStart(2, "0")}</span><div><b>{ex.name}</b><span>{ex.target} · {ex.sets.filter(set => set.completed).length}/{ex.sets.length} complete</span></div><Progress value={ex.sets.filter(set => set.completed).length / ex.sets.length * 100}/><ChevronRight size={19}/></button>
      {open === ei && <div className="sets-wrap"><div className="set-grid header"><span>SET</span><span>DONE</span><span>REPS / MIN</span><span>WEIGHT kg</span><span>ASSIST kg</span><span>RPE</span><span>PAIN</span><span>FORM</span><span>NOTES</span><span/></div>
        {ex.sets.map((set, si) => <div className={`set-grid ${set.completed ? "set-complete" : ""}`} key={si}><b>{si + 1}</b><button className="set-check" aria-label={`Mark set ${si + 1} complete`} onClick={() => updateSet(ei, si, "completed", String(!set.completed))}><Check size={15}/></button><input type="number" min="0" value={set.reps || set.duration} onChange={e => updateSet(ei, si, set.reps ? "reps" : "duration", e.target.value)}/><input type="number" min="0" value={set.weight || ""} placeholder="—" onChange={e => updateSet(ei, si, "weight", e.target.value)}/><input type="number" min="0" value={set.assistance || ""} placeholder="—" onChange={e => updateSet(ei, si, "assistance", e.target.value)}/><input type="number" min="1" max="10" value={set.difficulty} onChange={e => updateSet(ei, si, "difficulty", e.target.value)}/><input className={set.pain > 3 ? "danger-input" : ""} type="number" min="0" max="10" value={set.pain} onChange={e => updateSet(ei, si, "pain", e.target.value)}/><select value={set.form} onChange={e => updateSet(ei, si, "form", e.target.value)}><option>Good</option><option>Clean</option><option>Partial</option><option>Poor</option></select><input value={set.notes} placeholder="Add note" onChange={e => updateSet(ei, si, "notes", e.target.value)}/><button className="remove-set" aria-label={`Remove set ${si + 1}`} disabled={ex.sets.length === 1} onClick={() => removeSet(ei, si)}><Trash2 size={15}/></button></div>)}
        <button className="add-set" onClick={() => addSet(ei)}><Plus size={15}/>Add set</button></div>}
    </div>)}</section>
    <div className="finish-bar"><div><span>SESSION PROGRESS</span><Progress value={totalSets ? completedSets / totalSets * 100 : 0}/><b>{completedSets}/{totalSets} sets · {completedExercises}/{exercises.length} exercises</b></div><button className="primary" disabled={!completedSets || saved} onClick={finish}>{saved ? <><Check size={18}/>Saved</> : <><Check size={18}/>Finish & save</>}</button></div>
  </div>;
}

function WorkoutLog({ workouts }: { workouts: SavedWorkout[] }) {
  const totalMinutes = workouts.reduce((sum, workout) => sum + workout.duration, 0);
  const totalCalories = workouts.reduce((sum, workout) => sum + workout.calories, 0);
  const totalSets = workouts.reduce((sum, workout) => sum + (workout.totalSets || 0), 0);
  const consistency = Math.min(100, Math.round(workouts.filter(workout => {
    const date = workout.completedAt ? new Date(workout.completedAt) : null;
    return date && Date.now() - date.getTime() < 28 * 86400000;
  }).length / 12 * 100));
  return <div className="stack"><div className="page-intro"><div><span className="eyebrow green">TRAINING ARCHIVE</span><h2>Every session compounds.</h2></div><div className="inline-stats"><span><b>{workouts.length}</b> sessions</span><span><b>{(totalMinutes / 60).toFixed(1)}h</b> trained</span><span><b>{totalCalories.toLocaleString()}</b> kcal</span></div></div>
    <div className="log-layout"><section className="panel table-panel"><PanelHead title="Workout history" kicker="MOST RECENT" />{workouts.length === 0 && <div className="empty-state"><Dumbbell size={24}/><b>No workouts saved yet</b><span>Complete your first session to build the archive.</span></div>}{workouts.map((w, i) => <div className="workout-row" key={w.id}><div className="workout-date"><b>{w.date}</b><span>{w.completedAt ? new Date(w.completedAt).toLocaleDateString(undefined, { weekday: "short" }).toUpperCase() : "SESSION"}</span></div><div className="workout-type"><span className={`workout-symbol s${i % 3}`}><Dumbbell size={18}/></span><div><b>{w.type}</b><span>{w.exercises} exercises · {w.totalSets || "—"} sets · {w.duration} min</span></div></div><div><span className="cell-label">VOLUME</span><b>{w.volume ? `${w.volume.toLocaleString()} kg` : "—"}</b></div><div><span className="cell-label">MAX PAIN</span><b>{w.maxPain ?? "—"}/10</b></div><div className="assessment"><Sparkles size={15}/><span>{w.assessment}</span></div><ChevronRight size={18}/></div>)}</section>
      <aside className="panel log-aside"><PanelHead title="Recent output" kicker="LIVE DATA" /><Ring value={consistency} label="CONSISTENCY"/><div className="log-kpis"><span>Sessions <b>{workouts.length}</b></span><span>Sets <b>{totalSets}</b></span><span>Minutes <b>{totalMinutes}</b></span></div></aside>
    </div></div>;
}

function Skills() {
  const [selected, setSelected] = useState(skillData[0]);
  return <div className="stack"><div className="page-intro"><div><span className="eyebrow green">CAPABILITY SYSTEM</span><h2>Train attributes. Unlock skills.</h2><p>Progress is calculated from relevant performance, consistency, and prerequisites.</p></div><div className="campaign-pill"><Target size={18}/><div><span>ACTIVE CAMPAIGN</span><b>First Pull-Up · 64%</b></div></div></div>
    <div className="skill-layout"><section className="skill-map">{skillData.map((s, i) => <button className={`skill-node ${selected.name === s.name ? "selected" : ""} ${s.color}`} key={s.name} onClick={() => setSelected(s)}><div><Target size={21}/><i>{s.level}</i></div><span>{s.name}</span><Progress value={s.progress} color={s.color}/><small>{s.progress}%</small>{i < skillData.length - 1 && <em/>}</button>)}</section>
      <aside className="panel skill-detail"><span className="eyebrow">SELECTED SKILL</span><div className={`detail-icon ${selected.color}`}><Target size={27}/></div><h2>{selected.name}</h2><p>Level {selected.level} · Foundation phase</p><div className="big-progress"><b>{selected.progress}%</b><Progress value={selected.progress} color={selected.color}/></div><div className="next-unlock"><span>NEXT UNLOCK</span><b>{selected.next}</b></div><dl><dt>Prerequisite</dt><dd>{selected.prereq}</dd><dt>Recent evidence</dt><dd>3 relevant sessions in 14 days</dd><dt>Coach recommendation</dt><dd>{selected.note}</dd></dl><button className="secondary full"><Sparkles size={16}/>View training recommendation</button></aside>
    </div></div>;
}

function Analytics({ workouts }: { workouts: SavedWorkout[] }) {
  const [metric, setMetric] = useState<"duration" | "sets" | "volume">("duration");
  const analyticsData = [...workouts].reverse().slice(-10).map((workout, index) => ({
    session: `S${index + 1}`,
    duration: workout.duration,
    sets: workout.totalSets || 0,
    volume: workout.volume || 0,
    calories: workout.calories
  }));
  const totalMinutes = workouts.reduce((sum, workout) => sum + workout.duration, 0);
  const totalSets = workouts.reduce((sum, workout) => sum + (workout.totalSets || 0), 0);
  const totalVolume = workouts.reduce((sum, workout) => sum + (workout.volume || 0), 0);
  const averageDuration = workouts.length ? Math.round(totalMinutes / workouts.length) : 0;
  const elevatedPainSessions = workouts.filter(workout => (workout.maxPain || 0) > 5).length;
  return <div className="stack"><div className="page-intro"><div><span className="eyebrow green">PERFORMANCE INTELLIGENCE</span><h2>Your trend is the truth.</h2></div><div className="segments">{[["duration","Duration"],["sets","Sets"],["volume","Volume"]].map(([id,label]) => <button className={metric === id ? "active" : ""} onClick={() => setMetric(id as typeof metric)} key={id}>{label}</button>)}</div></div>
    <div className="stat-grid"><Metric icon={Dumbbell} label="SESSIONS" value={String(workouts.length)} unit="" delta="Saved workouts"/><Metric icon={Timer} label="AVG DURATION" value={String(averageDuration)} unit="min" delta={`${totalMinutes} total minutes`}/><Metric icon={TrendingUp} label="TRAINING VOLUME" value={totalVolume.toLocaleString()} unit="kg" delta={`${totalSets} completed sets`}/><Metric icon={Activity} label="PAIN FLAGS" value={String(elevatedPainSessions)} unit="" delta="Sessions above 5/10"/></div>
    <div className="analytics-grid"><section className="panel chart-panel"><PanelHead title={metric === "sets" ? "Completed sets" : metric === "volume" ? "Training volume" : "Session duration"} kicker="SAVED WORKOUTS"/><div className="chart">{analyticsData.length ? <ResponsiveContainer><LineChart data={analyticsData}><CartesianGrid stroke="#202a38" vertical={false}/><XAxis dataKey="session"/><YAxis/><Tooltip content={<ChartTip/>}/><Line type="monotone" dataKey={metric} stroke="#7cf56b" strokeWidth={3} dot={{fill:"#7cf56b",r:4}}/></LineChart></ResponsiveContainer> : <div className="chart-empty">Complete a workout to start your trend.</div>}</div></section>
      <section className="panel"><PanelHead title="Calorie estimate" kicker="SAVED WORKOUTS"/><div className="chart">{analyticsData.length ? <ResponsiveContainer><BarChart data={analyticsData}><XAxis dataKey="session"/><Tooltip content={<ChartTip/>}/><Bar dataKey="calories" fill="#35a7ff" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer> : <div className="chart-empty">No workout data yet.</div>}</div></section></div>
    <div className="analytics-grid lower"><section className="panel"><PanelHead title="Training signal" kicker="CURRENT DATA"/><div className="insight"><div className="insight-score">{workouts.length}</div><div><b>{workouts.length >= 6 ? "A useful trend is forming" : "Build your baseline"}</b><p>{workouts.length >= 6 ? "Your saved sessions now provide enough history to compare duration, volume, and completed sets." : "Complete at least six sessions before treating short-term changes as a reliable trend."}</p></div></div></section>
      <section className="panel forecast"><PanelHead title="Readiness forecast" kicker="AI ESTIMATE"/>{[["Strict pull-up","8-12 weeks",64],["Pistol squat","10-14 weeks",43],["Wall handstand","6-9 weeks",36]].map(x => <div key={x[0] as string}><span>{x[0]}</span><Progress value={x[2] as number}/><b>{x[1]}</b></div>)}</section></div>
  </div>;
}

function RecoveryPage({ recovery, setRecovery }: { recovery: Recovery; setRecovery: (r: Recovery) => void }) {
  const status = recoveryStatus(recovery);
  const fields: [keyof Recovery,string][] = [["energy","Energy"],["sleep","Sleep quality"],["shoulder","Shoulder discomfort"],["chest","Chest soreness"],["back","Back soreness"],["biceps","Biceps soreness"],["grip","Forearm / grip"],["quads","Quad soreness"],["glutes","Glute soreness"],["calves","Calf soreness"],["walking","Walking difficulty"],["palms","Palm / callus"]];
  return <div className="stack"><section className={`recovery-banner ${status.color}`}><div><span className="eyebrow">TODAY'S RECOVERY SIGNAL</span><h2>{status.label}</h2><p>{status.message}</p></div><Ring value={status.score} label="RECOVERED"/></section>
    <div className="recovery-layout"><section className="panel"><PanelHead title="Daily check-in" kicker="JUNE 29 · 6:40 PM"/><div className="sliders">{fields.map(([key,label]) => <label key={key}><span>{label}<b>{recovery[key]}/10</b></span><input type="range" min="0" max="10" value={recovery[key]} onChange={e => setRecovery({...recovery,[key]:Number(e.target.value)})}/></label>)}</div><button className="primary save-check"><Check size={17}/>Check-in saved automatically</button></section>
      <aside className="stack"><section className="panel coach-panel"><div className="coach-head"><div className="coach-icon"><Sparkles size={18}/></div><div><span>AI RECOVERY COACH</span><b>Today's prescription</b></div></div><p>{status.color === "red" ? "Recovery only. Skip loading and use gentle mobility." : status.color === "yellow" ? "Reduce total volume by 25%. Avoid high-pain patterns and keep rope easy." : "Train normally. Keep shoulder pain below 3 and stop hanging if grip worsens."}</p></section><section className="panel rule-list"><PanelHead title="Safety logic" kicker="ACTIVE RULES"/><div><ShieldCheck/><span>Shoulder pain above 3</span><b>{recovery.shoulder > 3 ? "Triggered" : "Clear"}</b></div><div><ShieldCheck/><span>Leg soreness above 6</span><b>{Math.max(recovery.quads,recovery.glutes,recovery.calves) > 6 ? "Triggered" : "Clear"}</b></div><div><ShieldCheck/><span>Grip / palm pain high</span><b>{Math.max(recovery.grip,recovery.palms) > 6 ? "Triggered" : "Clear"}</b></div></section></aside>
    </div></div>;
}

function Campaign() {
  const badges = [["First 10 Push-Ups","UNLOCKED"],["30-Second Dead Hang","UNLOCKED"],["Ring Row 12/12/12","UNLOCKED"],["Rope Warrior","72%"],["Shoulder Guardian","UNLOCKED"],["Pull-Up Hunter","64%"],["Pistol Path Started","UNLOCKED"],["Consistency King","5 / 8"]];
  return <div className="stack"><section className="campaign-hero"><div><span className="eyebrow green">LEVEL 12 · CAPABILITY BUILDER</span><h2>First Pull-Up<br />Campaign</h2><p>Become stronger, lighter, and more skillful every week.</p><div className="campaign-progress"><span><b>18,440 XP</b> / 20,000 XP</span><Progress value={82}/><small>1,560 XP to Level 13</small></div></div><div className="level-emblem"><Trophy size={40}/><b>12</b><span>BUILDER</span></div></section>
    <div className="game-grid"><section className="panel quests"><PanelHead title="Weekly quests" kicker="3 DAYS REMAINING"/>{[["Complete Pull Day","500 XP",100],["60 minutes of rope","700 XP",72],["2 recovery check-ins","250 XP",50],["Zero shoulder pain violations","400 XP",100]].map(q=><div key={q[0] as string}><div><Check size={16}/><span>{q[0]}</span><b>{q[1]}</b></div><Progress value={q[2] as number}/></div>)}</section><section className="panel boss"><span className="eyebrow">BOSS CHALLENGE</span><Target size={34}/><h3>The First Strict Rep</h3><p>Unlock when pull-up readiness reaches 90% and you complete 3 clean reps at 10 kg assistance.</p><Progress value={64}/><b>64% PREPARED</b></section></div>
    <section className="panel"><PanelHead title="Achievement vault" kicker="7 OF 18 UNLOCKED"/><div className="badges">{badges.map((b,i)=><div className={b[1] === "UNLOCKED" ? "badge unlocked" : "badge"} key={b[0]}><div>{i%3===0?<Award/>:i%3===1?<Flame/>:<Zap/>}</div><b>{b[0]}</b><span>{b[1]}</span></div>)}</div></section>
  </div>;
}

function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const [notice, setNotice] = useState(true);
  const [duration, setDuration] = useState("60");
  return <div className="settings-layout"><aside className="settings-tabs">{["Profile","Goals & priorities","Training protocol","Equipment","Injury notes","Integrations","Appearance"].map((x,i)=><button className={i===0?"active":""} key={x}>{i===0?<UserRound/>:i===5?<Watch/>:<Settings/>}{x}</button>)}</aside>
    <div className="stack"><section className="panel settings-panel"><PanelHead title="Athlete profile" kicker="PRIVATE ACCOUNT"/><div className="profile-head"><div className="avatar large-avatar">MF</div><div><h3>Mohamed Fadel</h3><span>Hybrid calisthenics athlete</span></div><button className="secondary">Change photo</button></div><div className="form-grid"><Field label="FULL NAME" value="Mohamed Fadel"/><Field label="HEIGHT" value="178 cm"/><Field label="WEIGHT" value="95 kg"/><Field label="BODY FAT ESTIMATE" value="28%"/><Field label="PREFERRED TRAINING" value="Evening"/><label><span>WORKOUT DURATION</span><select value={duration} onChange={e=>setDuration(e.target.value)}><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="75">75 minutes</option></select></label></div></section>
      <section className="panel settings-panel"><PanelHead title="Preferences" kicker="APP BEHAVIOR"/><div className="toggle-row"><div><Bell/><span><b>Training reminders</b><small>Evening protocol and recovery prompts</small></span></div><button className={notice?"toggle on":"toggle"} onClick={()=>setNotice(!notice)}><i/></button></div><div className="toggle-row"><div><Moon/><span><b>Dark performance theme</b><small>Optimized for evening training</small></span></div><button className="toggle on"><i/></button></div></section>
      <section className="panel integration"><div><Apple/><span><b>Apple Health & Watch</b><small>Workout, heart rate, sleep, steps, and recovery signals</small></span></div><button className="secondary">Connect when available</button></section>
      <button className="logout" onClick={onLogout}><LogOut size={17}/>Sign out of private profile</button></div>
  </div>;
}

function Metric({ icon: Icon, label, value, unit, delta }: { icon: typeof Activity; label:string; value:string; unit:string; delta:string }) {
  return <div className="metric"><div><Icon size={18}/><span>{label}</span></div><b>{value}<small>{unit}</small></b><p>{delta}</p></div>;
}
function PanelHead({ title, kicker, action, onClick }: { title:string; kicker:string; action?:string; onClick?:()=>void }) {
  return <div className="panel-head"><div><span>{kicker}</span><h3>{title}</h3></div>{action&&<button onClick={onClick}>{action}<ChevronRight size={15}/></button>}</div>;
}
function Progress({ value, color="green" }: { value:number; color?:string }) { return <div className={`progress ${color}`}><i style={{width:`${Math.min(100,value)}%`}}/></div>; }
function Ring({ value, label }: { value:number; label:string }) { return <div className="ring" style={{"--p":`${value*3.6}deg`} as React.CSSProperties}><div><b>{value}%</b><span>{label}</span></div></div>; }
function Field({label,value}:{label:string;value:string}) { return <label><span>{label}</span><input defaultValue={value}/></label>; }
function ChartTip({active,payload,label}: any) { if (!active || !payload?.length) return null; return <div className="chart-tip"><span>{label}</span><b>{payload[0].value}</b></div>; }
function recoveryStatus(r: Recovery) {
  const pain = Math.max(r.shoulder, r.grip, r.quads, r.glutes, r.calves, r.walking);
  const score = Math.round(Math.max(18, Math.min(98, ((r.energy+r.sleep)*5) - pain*3 + 20)));
  if (r.shoulder > 6 || pain > 8 || r.energy < 3) return {label:"Recovery only",color:"red",score,message:"High risk signal detected. Prioritize sleep, walking, and gentle mobility."};
  if (r.shoulder > 3 || pain > 6 || r.energy < 5) return {label:"Reduce volume",color:"yellow",score,message:"Some fatigue markers are elevated. Train with controlled volume."};
  return {label:"Train normally",color:"green",score,message:"Recovery supports the planned session. Maintain shoulder-safe form."};
}

export default App;
