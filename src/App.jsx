import { useState, useEffect, useCallback, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────────────────────────────────── */
const ADMIN_EMAIL = "cabestro1969@gmail.com";
const ADMIN_PASS  = "admin1234";

const SLOTS = [
  { index: 0, start: "08:00", end: "09:00", label: "1ª" },
  { index: 1, start: "09:00", end: "10:00", label: "2ª" },
  { index: 2, start: "10:00", end: "11:00", label: "3ª" },
  { index: 3, start: "11:30", end: "12:30", label: "4ª" },
  { index: 4, start: "12:30", end: "13:30", label: "5ª" },
  { index: 5, start: "15:00", end: "16:00", label: "6ª" },
  { index: 6, start: "16:00", end: "17:00", label: "7ª" },
];

const DAYS_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE"];
const DAYS_FULL  = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const OCCUPIED_GRADIENTS = [
  ["#1e3a5f", "#2563eb"],
  ["#1e3a2f", "#059669"],
  ["#3b1f5e", "#7c3aed"],
  ["#3a2010", "#d97706"],
  ["#3a1020", "#e11d48"],
];

/* ─────────────────────────────────────────────────────────────────────────────
   DATE UTILS
───────────────────────────────────────────────────────────────────────────── */
function getMonday(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
  return dt;
}
const addDays  = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt; };
const toISO    = (d) => d.toISOString().split("T")[0];
const fmtDay   = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
const fmtMonth = (d) => d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
const initials = (n) => n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
const uid      = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ─────────────────────────────────────────────────────────────────────────────
   STORAGE  (localStorage — works on Vercel)
───────────────────────────────────────────────────────────────────────────── */
const LS_RES  = "aula_reservas_v2";
const LS_AUTH = "aula_admin_v2";

function loadRes()   { try { return JSON.parse(localStorage.getItem(LS_RES)  || "[]"); }  catch { return []; } }
function saveRes(r)  { try { localStorage.setItem(LS_RES, JSON.stringify(r)); }           catch {} }
function loadAuth()  { try { return JSON.parse(localStorage.getItem(LS_AUTH) || "null"); } catch { return null; } }
function saveAuth(a) { try { a ? localStorage.setItem(LS_AUTH, JSON.stringify(a)) : localStorage.removeItem(LS_AUTH); } catch {} }

/* ─────────────────────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────────────────────── */
function useToast() {
  const [list, setList] = useState([]);
  const push = useCallback((msg, type = "ok") => {
    const id = uid();
    setList(p => [...p, { id, msg, type }]);
    setTimeout(() => setList(p => p.filter(t => t.id !== id)), 3800);
  }, []);
  return { list, push };
}

function ToastStack({ list }) {
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
      {list.map(t => (
        <div key={t.id} style={{
          padding:"11px 18px", borderRadius:12,
          background: t.type === "err" ? "#1c0a0a" : "#0b1a10",
          border:`1px solid ${t.type === "err" ? "#f87171" : "#4ade80"}`,
          color: t.type === "err" ? "#fca5a5" : "#86efac",
          fontSize:13, fontFamily:"'DM Sans',sans-serif",
          boxShadow:"0 8px 32px rgba(0,0,0,.5)",
          animation:"toastIn .3s ease", maxWidth:320,
        }}>
          {t.type === "err" ? "✗ " : "✓ "}{t.msg}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED PRIMITIVES
───────────────────────────────────────────────────────────────────────────── */
function Overlay({ onClick, children, style: s = {} }) {
  return (
    <div onClick={onClick}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", backdropFilter:"blur(6px)",
        zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, ...s }}>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type="text", error, inputRef }) {
  const [foc, setFoc] = useState(false);
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", color:"#9ca3af", fontSize:11, fontWeight:700,
        marginBottom:5, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</label>
      <input ref={inputRef} type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
        style={{ width:"100%", padding:"9px 13px", borderRadius:9,
          background:"#141720", border:`1px solid ${error?"#f87171":foc?"#6366f1":"#252836"}`,
          color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box",
          fontFamily:"'DM Sans',sans-serif", transition:"border .15s",
          boxShadow: foc ? "0 0 0 3px rgba(99,102,241,.12)" : "none",
        }}
      />
      {error && <p style={{ color:"#f87171", fontSize:11, margin:"3px 0 0" }}>{error}</p>}
    </div>
  );
}

const VARIANTS = {
  primary: { bg:"linear-gradient(135deg,#6366f1,#8b5cf6)", border:"none",            color:"#fff"    },
  ghost:   { bg:"transparent",                             border:"1px solid #252836", color:"#9ca3af" },
  warn:    { bg:"transparent",                             border:"1px solid #d97706", color:"#fbbf24" },
  danger:  { bg:"transparent",                             border:"1px solid #dc2626", color:"#f87171" },
};

function Btn({ variant="primary", onClick, disabled, children, style: s = {} }) {
  const v = VARIANTS[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding:"9px 16px", borderRadius:10, background:v.bg, border:v.border, color:v.color,
        fontSize:13, fontWeight:600, cursor:disabled?"not-allowed":"pointer",
        fontFamily:"'DM Sans',sans-serif", opacity:disabled?.6:1, transition:"opacity .15s",
        display:"flex", alignItems:"center", justifyContent:"center", gap:6, ...s }}>
      {children}
    </button>
  );
}

function Avatar({ name, size=30, fs=11 }) {
  const palette = ["#312e81","#1e3a5f","#3b1f5e","#0f3d2e","#3a1010"];
  const bg = palette[name.charCodeAt(0) % palette.length];
  return (
    <div style={{ width:size, height:size, borderRadius:size*.3, background:bg,
      border:"1px solid rgba(255,255,255,.15)", display:"flex", alignItems:"center",
      justifyContent:"center", fontSize:fs, color:"#e2e8f0", fontWeight:700, flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}

function Spin() { return <span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</span>; }

/* ─────────────────────────────────────────────────────────────────────────────
   BOOKING MODAL
───────────────────────────────────────────────────────────────────────────── */
function BookModal({ slot, date, dayName, onConfirm, onCancel, saving }) {
  const [f, setF]   = useState({ name:"", group:"", subject:"" });
  const [errs, setErrs] = useState({});
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    const e = {};
    if (!f.name.trim())    e.name    = "Obligatorio";
    if (!f.group.trim())   e.group   = "Obligatorio";
    if (!f.subject.trim()) e.subject = "Obligatorio";
    setErrs(e);
    if (!Object.keys(e).length) onConfirm(f);
  }

  return (
    <Overlay onClick={onCancel}>
      <div style={{ background:"#0d1018", border:"1px solid #252836", borderRadius:20,
        padding:"30px 26px", width:"100%", maxWidth:420,
        boxShadow:"0 32px 80px rgba(0,0,0,.7)", animation:"popIn .22s ease" }}
        onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        onKeyDown={e => { if(e.key==="Escape") onCancel(); if(e.key==="Enter") submit(); }}
      >
        <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:20 }}>
          <span style={{ fontSize:28 }}>📅</span>
          <div>
            <div style={{ color:"#fff", fontSize:17, fontWeight:700, fontFamily:"'Syne',sans-serif" }}>Nueva Reserva</div>
            <div style={{ color:"#6b7280", fontSize:12 }}>{dayName} {fmtDay(new Date(date))} · {slot.start}–{slot.end}</div>
          </div>
        </div>
        <div style={{ height:1, background:"linear-gradient(90deg,#6366f1,transparent)", marginBottom:20 }}/>

        <Field label="Nombre completo" value={f.name}    onChange={set("name")}    placeholder="Ej: María García López" error={errs.name}    inputRef={firstRef} />
        <Field label="Grupo / Clase"   value={f.group}   onChange={set("group")}   placeholder="Ej: 2ºA DAM"            error={errs.group}   />
        <Field label="Asignatura"      value={f.subject} onChange={set("subject")} placeholder="Ej: Programación"       error={errs.subject} />

        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <Btn variant="ghost"   onClick={onCancel} disabled={saving}>Cancelar</Btn>
          <Btn variant="primary" onClick={submit}   disabled={saving} style={{ flex:2 }}>
            {saving ? <><Spin /> Guardando…</> : "✓ Confirmar reserva"}
          </Btn>
        </div>
      </div>
    </Overlay>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN LOGIN
───────────────────────────────────────────────────────────────────────────── */
function AdminLogin({ onLogin, onCancel }) {
  const [email, setEmail] = useState("");
  const [pw, setPw]       = useState("");
  const [err, setErr]     = useState("");

  function handle() {
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) { setErr("Cuenta no autorizada"); return; }
    if (pw !== ADMIN_PASS) { setErr("Contraseña incorrecta"); return; }
    onLogin({ email: email.trim() });
  }

  return (
    <Overlay onClick={onCancel}>
      <div style={{ background:"#0d1018", border:"1px solid #4f46e5", borderRadius:20,
        padding:"30px 26px", width:"100%", maxWidth:380,
        boxShadow:"0 32px 80px rgba(99,102,241,.25)", animation:"popIn .22s ease" }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if(e.key==="Escape") onCancel(); if(e.key==="Enter") handle(); }}
      >
        <div style={{ textAlign:"center", marginBottom:26 }}>
          <div style={{ fontSize:42, marginBottom:8 }}>🔐</div>
          <div style={{ color:"#fff", fontSize:20, fontWeight:800, fontFamily:"'Syne',sans-serif" }}>Administración</div>
          <div style={{ color:"#6b7280", fontSize:12, marginTop:4 }}>Acceso restringido · {ADMIN_EMAIL}</div>
        </div>
        <Field label="Email"      value={email} onChange={e => setEmail(e.target.value)} placeholder={ADMIN_EMAIL} type="email"    />
        <Field label="Contraseña" value={pw}    onChange={e => setPw(e.target.value)}    placeholder="••••••••"    type="password" />
        {err && <p style={{ color:"#f87171", fontSize:12, textAlign:"center", marginBottom:8 }}>{err}</p>}
        <div style={{ display:"flex", gap:10, marginTop:18 }}>
          <Btn variant="ghost"   onClick={onCancel}>Cancelar</Btn>
          <Btn variant="primary" onClick={handle} style={{ flex:2 }}>Entrar</Btn>
        </div>
      </div>
    </Overlay>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN PANEL
───────────────────────────────────────────────────────────────────────────── */
function AdminPanel({ reservations, onUnlock, onDelete, onClose }) {
  const [q, setQ]         = useState("");
  const [confirm, setConf] = useState(null);

  const rows = reservations
    .filter(r => {
      if (!q) return true;
      const s = q.toLowerCase();
      return [r.name, r.group, r.subject, r.date].some(v => v.toLowerCase().includes(s));
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.slotIndex - b.slotIndex);

  function ask(action, id) { setConf({ action, id }); }
  function doIt() {
    if (confirm.action === "unlock") onUnlock(confirm.id);
    else onDelete(confirm.id);
    setConf(null);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", backdropFilter:"blur(8px)",
      zIndex:900, overflow:"auto", padding:"24px 16px" }}>
      <div style={{ maxWidth:780, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          flexWrap:"wrap", gap:12, marginBottom:24 }}>
          <div>
            <h2 style={{ color:"#fff", fontSize:22, fontWeight:800, fontFamily:"'Syne',sans-serif", margin:0 }}>Panel de Administración</h2>
            <p style={{ color:"#6b7280", fontSize:13, margin:0 }}>{rows.length} reserva{rows.length!==1?"s":""}</p>
          </div>
          <Btn variant="ghost" onClick={onClose}>✕ Cerrar</Btn>
        </div>

        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍  Buscar por nombre, grupo, asignatura o fecha…"
          style={{ width:"100%", padding:"10px 16px", borderRadius:12, background:"#141720",
            border:"1px solid #252836", color:"#f1f5f9", fontSize:14, outline:"none",
            marginBottom:16, boxSizing:"border-box", fontFamily:"'DM Sans',sans-serif" }}
        />

        {rows.length === 0
          ? <div style={{ textAlign:"center", color:"#374151", padding:"60px 0", fontSize:15 }}>Sin resultados</div>
          : rows.map(r => {
              const s  = SLOTS[r.slotIndex];
              const d  = new Date(r.date + "T00:00:00");
              const dn = DAYS_FULL[d.getDay() - 1] || "?";
              return (
                <div key={r.id} style={{ background:"#0d1018", border:"1px solid #252836", borderRadius:14,
                  padding:"13px 16px", display:"flex", alignItems:"center", gap:12, marginBottom:8, flexWrap:"wrap" }}>
                  <Avatar name={r.name} />
                  <div style={{ flex:1, minWidth:100 }}>
                    <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{r.name}</div>
                    <div style={{ color:"#9ca3af", fontSize:12 }}>{r.group} · {r.subject}</div>
                  </div>
                  <div style={{ textAlign:"center", minWidth:88 }}>
                    <div style={{ color:"#a5b4fc", fontSize:13, fontWeight:600 }}>{dn} {fmtDay(d)}</div>
                    <div style={{ color:"#6b7280", fontSize:11 }}>{s?.start}–{s?.end}</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn variant="warn"   onClick={() => ask("unlock", r.id)}>Liberar</Btn>
                    <Btn variant="danger" onClick={() => ask("delete", r.id)}>Borrar</Btn>
                  </div>
                </div>
              );
            })
        }
      </div>

      {confirm && (
        <Overlay style={{ zIndex:1001 }}>
          <div style={{ background:"#0d1018", border:"1px solid #ef4444", borderRadius:16,
            padding:"28px 24px", maxWidth:330, textAlign:"center",
            boxShadow:"0 24px 64px rgba(239,68,68,.3)", animation:"popIn .2s ease" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize:36, marginBottom:12 }}>{confirm.action==="delete"?"🗑️":"🔓"}</div>
            <div style={{ color:"#fff", fontSize:16, fontWeight:700, marginBottom:8, fontFamily:"'Syne',sans-serif" }}>¿Confirmar?</div>
            <div style={{ color:"#9ca3af", fontSize:13, marginBottom:20 }}>
              {confirm.action==="delete" ? "La reserva se eliminará permanentemente." : "El hueco quedará disponible de nuevo."}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <Btn variant="ghost"  onClick={() => setConf(null)}>Cancelar</Btn>
              <Btn variant={confirm.action==="delete"?"danger":"warn"} onClick={doIt} style={{ flex:1 }}>Confirmar</Btn>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SLOT CELL
───────────────────────────────────────────────────────────────────────────── */
function SlotCell({ slot, res, dayIdx, onBook }) {
  const [hov, setHov] = useState(false);
  const free = !res;
  const [g1, g2] = OCCUPIED_GRADIENTS[dayIdx] || OCCUPIED_GRADIENTS[0];

  return (
    <div
      role="button" tabIndex={0}
      aria-label={free ? `Reservar ${slot.label} ${slot.start}` : `Ocupado: ${res.name}`}
      onClick={() => free && onBook(slot)}
      onKeyDown={e => (e.key==="Enter"||e.key===" ") && free && onBook(slot)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        borderRadius:10, padding:"7px 8px", minHeight:72, cursor:free?"pointer":"default",
        background: free
          ? hov ? "rgba(99,102,241,.1)" : "rgba(255,255,255,.02)"
          : `linear-gradient(140deg,${g1}dd,${g2}bb)`,
        border: free
          ? `1px solid ${hov?"#4f46e5":"#1c1f2e"}`
          : "1px solid rgba(255,255,255,.08)",
        transition:"all .18s ease",
        transform: hov&&free ? "scale(1.03)" : "scale(1)",
        boxShadow: !free ? "0 4px 20px rgba(0,0,0,.35)" : "none",
        outline:"none",
      }}
    >
      {free ? (
        <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 }}>
          {hov
            ? <><div style={{ color:"#6366f1", fontSize:22, lineHeight:1 }}>+</div><div style={{ color:"#a5b4fc", fontSize:10, fontWeight:600 }}>Reservar</div></>
            : <div style={{ color:"#2a2d3e", fontSize:10 }}>Libre</div>
          }
        </div>
      ) : (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
            <Avatar name={res.name} size={22} fs={9} />
            <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"calc(100% - 28px)" }}>
              {res.name.split(" ")[0]}
            </span>
          </div>
          <div style={{ color:"rgba(255,255,255,.65)", fontSize:10, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{res.subject}</div>
          <div style={{ color:"rgba(255,255,255,.4)", fontSize:9, marginTop:1 }}>{res.group}</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   WEEK STRIP — quick week selector
───────────────────────────────────────────────────────────────────────────── */
function WeekStrip({ current, reservations, onSelect }) {
  const scrollRef = useRef(null);
  const todayISO  = toISO(getMonday(new Date()));

  // 4 weeks back, current, 8 weeks forward = 13 total
  const weeks = Array.from({ length: 13 }, (_, i) => getMonday(addDays(current, (i - 4) * 7)));

  // scroll active week into center on mount
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-active='true']");
    el?.scrollIntoView({ inline:"center", behavior:"smooth" });
  }, [toISO(current)]);

  function countWeek(mon) {
    const fri = toISO(addDays(mon, 4));
    const monISO = toISO(mon);
    return reservations.filter(r => r.date >= monISO && r.date <= fri).length;
  }

  return (
    <div ref={scrollRef}
      style={{ display:"flex", gap:5, overflowX:"auto", paddingBottom:4, scrollbarWidth:"none" }}>
      {weeks.map(mon => {
        const iso    = toISO(mon);
        const isCur  = iso === toISO(current);
        const isToday = iso === todayISO;
        const count  = countWeek(mon);
        return (
          <button key={iso} data-active={isCur}
            onClick={() => onSelect(mon)}
            style={{
              flexShrink:0, padding:"8px 11px", borderRadius:11, cursor:"pointer",
              background: isCur
                ? "linear-gradient(135deg,#4f46e5,#7c3aed)"
                : isToday ? "rgba(99,102,241,.08)" : "rgba(255,255,255,.025)",
              border: isCur  ? "1px solid #6366f1"
                     : isToday ? "1px solid #4f46e5"
                     : "1px solid #1c1f2e",
              color: isCur ? "#fff" : "#9ca3af",
              transition:"all .15s", outline:"none", minWidth:64, textAlign:"center",
            }}
          >
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.03em", fontFamily:"'DM Sans',sans-serif" }}>
              {isToday && !isCur && <span style={{ color:"#6366f1" }}>● </span>}
              {fmtDay(mon)}
            </div>
            <div style={{ fontSize:9, marginTop:2, color: isCur?"rgba(255,255,255,.6)":"#374151" }}>
              {count > 0 ? `${count} res.` : "libre"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   APP ROOT
───────────────────────────────────────────────────────────────────────────── */
export default function App() {
  const [weekStart, setWeekStart]       = useState(() => getMonday(new Date()));
  const [reservations, setReservations] = useState([]);
  const [modal, setModal]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [admin, setAdmin]               = useState(null);
  const [showLogin, setShowLogin]       = useState(false);
  const [showPanel, setShowPanel]       = useState(false);
  const { list: toasts, push: toast }   = useToast();

  useEffect(() => {
    setReservations(loadRes());
    setAdmin(loadAuth());
  }, []);

  const weekDays = Array.from({ length:5 }, (_, i) => addDays(weekStart, i));

  const getRes = (date, idx) => reservations.find(r => r.date === toISO(date) && r.slotIndex === idx) || null;

  /* book */
  async function handleBook(date, slot, { name, group, subject }) {
    setSaving(true);
    await new Promise(r => setTimeout(r, 480));
    const latest = loadRes();
    if (latest.find(r => r.date === toISO(date) && r.slotIndex === slot.index)) {
      toast("Hueco ya reservado — inténtalo con otro", "err");
      setReservations(latest); setSaving(false); return;
    }
    const entry = {
      id: uid(), date: toISO(date), slotIndex: slot.index,
      startTime: slot.start, endTime: slot.end,
      name: name.trim(), group: group.trim(), subject: subject.trim(),
      createdAt: Date.now(),
    };
    const updated = [...latest, entry];
    saveRes(updated); setReservations(updated);
    setModal(null); setSaving(false);
    toast(`Reserva confirmada: ${slot.start}–${slot.end}`);
  }

  function handleUnlock(id) {
    const u = reservations.filter(r => r.id !== id);
    saveRes(u); setReservations(u); toast("Hueco liberado");
  }
  function handleDelete(id) {
    const u = reservations.filter(r => r.id !== id);
    saveRes(u); setReservations(u); toast("Reserva eliminada");
  }
  function handleLogin(user) {
    setAdmin(user); saveAuth(user); setShowLogin(false); setShowPanel(true);
    toast("Bienvenido, Administrador");
  }
  function handleLogout() {
    setAdmin(null); saveAuth(null); setShowPanel(false); toast("Sesión cerrada");
  }

  const isThisWeek = toISO(weekStart) === toISO(getMonday(new Date()));
  const weekResCount = reservations.filter(r => r.date >= toISO(weekStart) && r.date <= toISO(addDays(weekStart, 4))).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{min-height:100%;background:#080c14;color:#f1f5f9;font-family:'DM Sans',sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#0d1018;}
        ::-webkit-scrollbar-thumb{background:#252836;border-radius:3px;}
        button:focus-visible{outline:2px solid #6366f1;outline-offset:2px;}
        @keyframes popIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ambient glows */}
      <div aria-hidden style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-300, right:-200, width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle,rgba(99,102,241,.07) 0%,transparent 65%)" }}/>
        <div style={{ position:"absolute", bottom:-200, left:-150, width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(139,92,246,.05) 0%,transparent 65%)" }}/>
      </div>

      <div style={{ position:"relative", zIndex:1, minHeight:"100vh" }}>

        {/* ══ HEADER ══ */}
        <header style={{
          position:"sticky", top:0, zIndex:200,
          borderBottom:"1px solid #151a26",
          background:"rgba(8,12,20,.93)", backdropFilter:"blur(14px)",
          padding:"0 20px", height:58,
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10,
              background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, boxShadow:"0 4px 14px rgba(99,102,241,.35)" }}>🖥️</div>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:"#fff", lineHeight:1.2 }}>Aula Informática</div>
              <div style={{ fontSize:10, color:"#4b5563" }}>Reservas</div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {admin ? (
              <>
                <Btn variant="ghost" onClick={() => setShowPanel(true)} style={{ fontSize:12, padding:"6px 12px" }}>⚙ Panel Admin</Btn>
                <Btn variant="ghost" onClick={handleLogout} style={{ fontSize:12, padding:"6px 10px", color:"#6b7280" }}>Salir</Btn>
              </>
            ) : (
              <Btn variant="ghost" onClick={() => setShowLogin(true)} style={{ fontSize:12, padding:"6px 12px" }}>🔐 Admin</Btn>
            )}
          </div>
        </header>

        {/* ══ MAIN ══ */}
        <main style={{ maxWidth:1120, margin:"0 auto", padding:"20px 16px 56px" }}>

          {/* ── WEEK NAVIGATION CARD ── */}
          <div style={{ background:"#0d1018", border:"1px solid #151a26", borderRadius:16,
            padding:"18px 18px 14px", marginBottom:14, animation:"fadeUp .3s ease" }}>

            {/* row 1: title + arrows */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              gap:12, marginBottom:14, flexWrap:"wrap" }}>

              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:21, color:"#fff", lineHeight:1.1 }}>
                  {fmtDay(weekDays[0])} — {fmtDay(weekDays[4])}
                  <span style={{ fontWeight:400, color:"#4b5563", fontSize:13, marginLeft:10, textTransform:"capitalize" }}>
                    {fmtMonth(weekDays[0])}
                  </span>
                </div>
                <div style={{ color:"#4b5563", fontSize:12, marginTop:3 }}>
                  {weekResCount} reserva{weekResCount!==1?"s":""} · {5*7-weekResCount} huecos libres
                </div>
              </div>

              {/* nav buttons */}
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <button aria-label="Semana anterior"
                  onClick={() => setWeekStart(w => addDays(w, -7))}
                  style={{ width:40, height:40, borderRadius:11, background:"#141720", border:"1px solid #252836",
                    color:"#a5b4fc", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background="#1e2130"}
                  onMouseLeave={e => e.currentTarget.style.background="#141720"}
                >‹</button>

                {!isThisWeek && (
                  <button onClick={() => setWeekStart(getMonday(new Date()))}
                    style={{ padding:"0 16px", height:40, borderRadius:11,
                      background:"rgba(99,102,241,.1)", border:"1px solid #4f46e5",
                      color:"#a5b4fc", fontSize:12, fontWeight:700, cursor:"pointer",
                      fontFamily:"'DM Sans',sans-serif", transition:"background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(99,102,241,.18)"}
                    onMouseLeave={e => e.currentTarget.style.background="rgba(99,102,241,.1)"}
                  >↩ Hoy</button>
                )}

                <button aria-label="Semana siguiente"
                  onClick={() => setWeekStart(w => addDays(w, 7))}
                  style={{ width:40, height:40, borderRadius:11, background:"#141720", border:"1px solid #252836",
                    color:"#a5b4fc", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background="#1e2130"}
                  onMouseLeave={e => e.currentTarget.style.background="#141720"}
                >›</button>
              </div>
            </div>

            {/* row 2: week strip */}
            <WeekStrip current={weekStart} reservations={reservations} onSelect={setWeekStart} />
          </div>

          {/* ── CALENDAR ── */}
          <div style={{ background:"#0d1018", border:"1px solid #151a26", borderRadius:16,
            padding:"16px", overflowX:"auto", animation:"fadeUp .35s ease" }}>
            <div style={{ minWidth:540 }}>

              {/* day headers */}
              <div style={{ display:"grid", gridTemplateColumns:"52px repeat(5,1fr)", gap:5, marginBottom:6 }}>
                <div/>
                {weekDays.map((d, i) => {
                  const isToday = toISO(d) === toISO(new Date());
                  const cnt = reservations.filter(r => r.date === toISO(d)).length;
                  return (
                    <div key={i} style={{ textAlign:"center", padding:"8px 4px", borderRadius:10,
                      background: isToday?"rgba(99,102,241,.1)":"rgba(255,255,255,.015)",
                      border: isToday?"1px solid #4f46e5":"1px solid #151a26" }}>
                      <div style={{ color:isToday?"#a5b4fc":"#6b7280", fontSize:10, fontWeight:700, letterSpacing:"0.07em" }}>
                        {DAYS_SHORT[i]}
                      </div>
                      <div style={{ color:isToday?"#fff":"#9ca3af", fontSize:20, fontWeight:800,
                        fontFamily:"'Syne',sans-serif", lineHeight:1.1 }}>
                        {d.getDate()}
                      </div>
                      <div style={{ color:"#374151", fontSize:9 }}>
                        {cnt>0 ? `${cnt} res.` : d.toLocaleDateString("es-ES",{month:"short"})}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* slot rows */}
              {SLOTS.map(slot => (
                <div key={slot.index}
                  style={{ display:"grid", gridTemplateColumns:"52px repeat(5,1fr)", gap:5, marginBottom:5 }}>
                  <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"flex-end", paddingRight:8 }}>
                    <div style={{ color:"#6366f1", fontSize:17, fontWeight:800, fontFamily:"'Syne',sans-serif", lineHeight:1 }}>{slot.index + 1}</div>
                    <div style={{ color:"#2a2d3e", fontSize:9, marginTop:2 }}>{slot.start}</div>
                  </div>
                  {weekDays.map((d, di) => (
                    <SlotCell key={`${toISO(d)}-${slot.index}`}
                      slot={slot} res={getRes(d, slot.index)} dayIdx={di}
                      onBook={s => setModal({ date:d, slot:s })}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* legend */}
          <div style={{ display:"flex", gap:18, marginTop:12, flexWrap:"wrap" }}>
            {[
              { bg:"rgba(255,255,255,.02)", bd:"#1c1f2e",               label:"Libre — click para reservar" },
              { bg:"linear-gradient(140deg,#1e3a5fdd,#2563ebbb)", bd:"rgba(255,255,255,.08)", label:"Ocupado" },
            ].map(({ bg, bd, label }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{ width:13, height:13, borderRadius:3, background:bg, border:`1px solid ${bd}` }}/>
                <span style={{ color:"#4b5563", fontSize:11 }}>{label}</span>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* ══ OVERLAYS ══ */}
      {modal && (
        <BookModal
          slot={modal.slot} date={toISO(modal.date)}
          dayName={DAYS_FULL[modal.date.getDay()-1]}
          saving={saving}
          onConfirm={data => handleBook(modal.date, modal.slot, data)}
          onCancel={() => !saving && setModal(null)}
        />
      )}
      {showLogin && <AdminLogin onLogin={handleLogin} onCancel={() => setShowLogin(false)} />}
      {showPanel && admin && (
        <AdminPanel reservations={reservations}
          onUnlock={handleUnlock} onDelete={handleDelete} onClose={() => setShowPanel(false)} />
      )}

      <ToastStack list={toasts} />
    </>
  );
}
