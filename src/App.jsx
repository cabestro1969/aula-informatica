import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc,
  onSnapshot, addDoc, deleteDoc, setDoc
} from "firebase/firestore";

/* ─────────────────────────────────────────────────────────────────────────────
   🔥 FIREBASE CONFIG — reemplaza con tus credenciales del paso 1
───────────────────────────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyDJGha_gM0JYRwAkB9rjFBkhWaaKMOCxyM",
  authDomain:        "ies-comuneros.firebaseapp.com",
  projectId:         "ies-comuneros",
  storageBucket:     "ies-comuneros.firebasestorage.app",
  messagingSenderId: "513183491182",
  appId:             "1:513183491182:web:0509301da53761aaaa727f",
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

// Firestore paths:
//  reservas/{aulaId}/entries/{docId}
//  bloqueos/{aulaId}   → campo "map": { "1_3": true, … }

/* ─────────────────────────────────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────────────────────────────────── */
const ADMIN_EMAIL = "cabestro1969@gmail.com";
const ADMIN_PASS  = "admin1234";

const AULAS = [
  { id:"aula1", label:"Aula de Informática I",  icon:"🖥️", accent:"#6366f1", accentLight:"#818cf8" },
  { id:"aula2", label:"Aula de Informática II", icon:"💻", accent:"#0891b2", accentLight:"#22d3ee" },
];

const SLOTS = [
  { index:0, start:"08:00", end:"09:00" },
  { index:1, start:"09:00", end:"10:00" },
  { index:2, start:"10:00", end:"11:00" },
  { index:3, start:"11:30", end:"12:30" },
  { index:4, start:"12:30", end:"13:30" },
  { index:5, start:"15:00", end:"16:00" },
  { index:6, start:"16:00", end:"17:00" },
];

const DAYS_SHORT = ["LUN","MAR","MIÉ","JUE","VIE"];
const DAYS_FULL  = ["Lunes","Martes","Miércoles","Jueves","Viernes"];

const OCC_GRAD = [
  ["#bfdbfe","#93c5fd","#2563eb"],
  ["#a7f3d0","#6ee7b7","#059669"],
  ["#ddd6fe","#c4b5fd","#7c3aed"],
  ["#fde68a","#fcd34d","#d97706"],
  ["#fecaca","#fca5a5","#dc2626"],
];
const BLOCKED_BG     = "#1e1b2e";
const BLOCKED_BORDER = "#7c3aed";

/* ─────────────────────────────────────────────────────────────────────────────
   DATE UTILS
───────────────────────────────────────────────────────────────────────────── */
function getMonday(d) {
  const dt=new Date(d); dt.setHours(0,0,0,0);
  const day=dt.getDay();
  dt.setDate(dt.getDate()-(day===0?6:day-1));
  return dt;
}
const addDays  = (d,n) => { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt; };
const toISO    = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
};
const fmtDay   = d => d.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"});
const fmtMonth = d => d.toLocaleDateString("es-ES",{month:"long",year:"numeric"});
const initials = n => n.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const uid      = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

// Blocked key: dayOfWeek_slotIdx (local, 1=Lun…5=Vie)
const blockedKey = (date,slotIdx) => {
  const [y,m,d]=date.split("-").map(Number);
  const dow=new Date(y,m-1,d).getDay();
  return `${dow}_${slotIdx}`;
};
const panelKey = (dayIdx,slotIdx) => `${dayIdx+1}_${slotIdx}`;

/* ─────────────────────────────────────────────────────────────────────────────
   AUTH  (localStorage — solo para saber si eres admin en este navegador)
───────────────────────────────────────────────────────────────────────────── */
const LS_AUTH = "aula_admin_v4";
const loadAuth = () => { try { return JSON.parse(localStorage.getItem(LS_AUTH)||"null"); } catch { return null; } };
const saveAuth = a => { try { a ? localStorage.setItem(LS_AUTH,JSON.stringify(a)) : localStorage.removeItem(LS_AUTH); } catch {} };

/* ─────────────────────────────────────────────────────────────────────────────
   FIREBASE HELPERS
───────────────────────────────────────────────────────────────────────────── */
// Reservas: colección  reservas/{aulaId}/entries
const resCol  = aulaId => collection(db,"reservas",aulaId,"entries");
// Bloqueos: documento  bloqueos/{aulaId}  con campo "map"
const bloqDoc = aulaId => doc(db,"bloqueos",aulaId);

/* ─────────────────────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────────────────────── */
function useToast() {
  const [list,setList]=useState([]);
  const push=useCallback((msg,type="ok")=>{
    const id=uid();
    setList(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setList(p=>p.filter(t=>t.id!==id)),3800);
  },[]);
  return {list,push};
}
function ToastStack({list}) {
  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {list.map(t=>(
        <div key={t.id} style={{
          padding:"11px 18px",borderRadius:12,
          background:t.type==="err"?"#2d0a0a":"#0a2010",
          border:`1px solid ${t.type==="err"?"#f87171":"#4ade80"}`,
          color:t.type==="err"?"#fca5a5":"#86efac",
          fontSize:13,fontFamily:"'DM Sans',sans-serif",
          boxShadow:"0 4px 20px rgba(0,0,0,.4)",
          animation:"toastIn .3s ease",maxWidth:320,
        }}>
          {t.type==="err"?"✗ ":"✓ "}{t.msg}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRIMITIVES
───────────────────────────────────────────────────────────────────────────── */
function Overlay({onClick,children,style:s={}}) {
  return (
    <div onClick={onClick} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",
      backdropFilter:"blur(5px)",zIndex:1000,display:"flex",alignItems:"center",
      justifyContent:"center",padding:16,...s}}>
      {children}
    </div>
  );
}

function Field({label,value,onChange,placeholder,type="text",error,inputRef}) {
  const [foc,setFoc]=useState(false);
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",color:"#94a3b8",fontSize:11,fontWeight:700,
        marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</label>
      <input ref={inputRef} type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
        style={{width:"100%",padding:"9px 13px",borderRadius:9,
          background:"#1e2535",border:`1px solid ${error?"#f87171":foc?"#6366f1":"#334155"}`,
          color:"#f1f5f9",fontSize:14,outline:"none",boxSizing:"border-box",
          fontFamily:"'DM Sans',sans-serif",transition:"border .15s",
          boxShadow:foc?"0 0 0 3px rgba(99,102,241,.15)":"none",
        }}
      />
      {error&&<p style={{color:"#f87171",fontSize:11,margin:"3px 0 0"}}>{error}</p>}
    </div>
  );
}

const VARIANTS={
  primary:{bg:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",            color:"#fff"},
  ghost:  {bg:"transparent",                            border:"1px solid #334155",color:"#94a3b8"},
  warn:   {bg:"transparent",                            border:"1px solid #d97706",color:"#fbbf24"},
  danger: {bg:"transparent",                            border:"1px solid #dc2626",color:"#f87171"},
};
function Btn({variant="primary",onClick,disabled,children,style:s={}}) {
  const v=VARIANTS[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      style={{padding:"9px 16px",borderRadius:10,background:v.bg,border:v.border,color:v.color,
        fontSize:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",
        fontFamily:"'DM Sans',sans-serif",opacity:disabled?.55:1,transition:"opacity .15s",
        display:"flex",alignItems:"center",justifyContent:"center",gap:6,...s}}>
      {children}
    </button>
  );
}

function Avatar({name,size=30,fs=11}) {
  const palette=["#4f46e5","#059669","#7c3aed","#d97706","#dc2626"];
  const bg=palette[name.charCodeAt(0)%palette.length];
  return (
    <div style={{width:size,height:size,borderRadius:size*.3,background:bg,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:fs,color:"#fff",fontWeight:700,flexShrink:0}}>
      {initials(name)}
    </div>
  );
}
function Spin(){return <span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span>;}

/* ─────────────────────────────────────────────────────────────────────────────
   BOOKING MODAL
───────────────────────────────────────────────────────────────────────────── */
function BookModal({slot,date,dayName,aulaLabel,accentColor,onConfirm,onCancel,saving}) {
  const [f,setF]=useState({name:"",group:"",subject:""});
  const [errs,setErrs]=useState({});
  const ref0=useRef(null);
  useEffect(()=>{ref0.current?.focus();},[]);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  function submit(){
    const e={};
    if(!f.name.trim())    e.name="Obligatorio";
    if(!f.group.trim())   e.group="Obligatorio";
    if(!f.subject.trim()) e.subject="Obligatorio";
    setErrs(e);
    if(!Object.keys(e).length) onConfirm(f);
  }
  return (
    <Overlay onClick={onCancel}>
      <div style={{background:"#131929",border:"1px solid #1e2d45",borderRadius:20,
        padding:"28px 24px",width:"100%",maxWidth:420,
        boxShadow:"0 28px 70px rgba(0,0,0,.6)",animation:"popIn .22s ease"}}
        onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true"
        onKeyDown={e=>{if(e.key==="Escape")onCancel();if(e.key==="Enter")submit();}}
      >
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18}}>
          <span style={{fontSize:26}}>📅</span>
          <div>
            <div style={{color:"#f1f5f9",fontSize:16,fontWeight:700,fontFamily:"'Syne',sans-serif"}}>Nueva Reserva</div>
            <div style={{color:"#64748b",fontSize:12}}>{aulaLabel} · {dayName} {fmtDay(new Date(date+"T12:00:00"))} · Sesión {slot.index+1} ({slot.start}–{slot.end})</div>
          </div>
        </div>
        <div style={{height:1,background:`linear-gradient(90deg,${accentColor},transparent)`,marginBottom:18}}/>
        <Field label="Nombre completo" value={f.name}    onChange={set("name")}    placeholder="Ej: María García López" error={errs.name}    inputRef={ref0}/>
        <Field label="Grupo / Clase"   value={f.group}   onChange={set("group")}   placeholder="Ej: 2ºA DAM"            error={errs.group}/>
        <Field label="Asignatura"      value={f.subject} onChange={set("subject")} placeholder="Ej: Programación"       error={errs.subject}/>
        <div style={{display:"flex",gap:10,marginTop:18}}>
          <Btn variant="ghost"   onClick={onCancel} disabled={saving}>Cancelar</Btn>
          <Btn variant="primary" onClick={submit}   disabled={saving} style={{flex:2}}>
            {saving?<><Spin/> Guardando…</>:"✓ Confirmar reserva"}
          </Btn>
        </div>
      </div>
    </Overlay>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN LOGIN
───────────────────────────────────────────────────────────────────────────── */
function AdminLogin({onLogin,onCancel}) {
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [err,setErr]=useState("");
  function handle(){
    if(email.trim().toLowerCase()!==ADMIN_EMAIL){setErr("Cuenta no autorizada");return;}
    if(pw!==ADMIN_PASS){setErr("Contraseña incorrecta");return;}
    onLogin({email:email.trim()});
  }
  return (
    <Overlay onClick={onCancel}>
      <div style={{background:"#131929",border:"1px solid #4f46e5",borderRadius:20,
        padding:"28px 24px",width:"100%",maxWidth:380,
        boxShadow:"0 28px 70px rgba(99,102,241,.3)",animation:"popIn .22s ease"}}
        onClick={e=>e.stopPropagation()}
        onKeyDown={e=>{if(e.key==="Escape")onCancel();if(e.key==="Enter")handle();}}
      >
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:8}}>🔐</div>
          <div style={{color:"#f1f5f9",fontSize:19,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>Administración</div>
          <div style={{color:"#64748b",fontSize:12,marginTop:3}}>Acceso restringido · {ADMIN_EMAIL}</div>
        </div>
        <Field label="Email"      value={email} onChange={e=>setEmail(e.target.value)} placeholder={ADMIN_EMAIL} type="email"/>
        <Field label="Contraseña" value={pw}    onChange={e=>setPw(e.target.value)}    placeholder="••••••••"    type="password"/>
        {err&&<p style={{color:"#f87171",fontSize:12,textAlign:"center",marginBottom:8}}>{err}</p>}
        <div style={{display:"flex",gap:10,marginTop:16}}>
          <Btn variant="ghost"   onClick={onCancel}>Cancelar</Btn>
          <Btn variant="primary" onClick={handle} style={{flex:2}}>Entrar</Btn>
        </div>
      </div>
    </Overlay>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN PANEL
───────────────────────────────────────────────────────────────────────────── */
function AdminPanel({allData,onUnlock,onDelete,onToggleBlock,onClose}) {
  const [aulaTab,setAulaTab]=useState("aula1");
  const [secTab,setSecTab]  =useState("reservas");
  const [q,setQ]            =useState("");
  const [confirm,setConf]   =useState(null);

  const {reservations,blocked}=allData[aulaTab];
  const aulaInfo=AULAS.find(a=>a.id===aulaTab);
  const totalBlocked=Object.keys(blocked).length;

  const rows=reservations
    .filter(r=>{if(!q)return true;const s=q.toLowerCase();return[r.name,r.group,r.subject,r.date].some(v=>v.toLowerCase().includes(s));})
    .sort((a,b)=>a.date.localeCompare(b.date)||a.slotIndex-b.slotIndex);

  function ask(action,id){setConf({action,id,aulaId:aulaTab});}
  function doIt(){
    if(confirm.action==="unlock") onUnlock(confirm.aulaId,confirm.id);
    else onDelete(confirm.aulaId,confirm.id);
    setConf(null);
  }

  const TAB=active=>({padding:"7px 16px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
    fontFamily:"'DM Sans',sans-serif",background:active?"#6366f1":"transparent",color:active?"#fff":"#64748b",transition:"all .15s"});
  const AULATAB=id=>({padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
    fontFamily:"'Syne',sans-serif",background:aulaTab===id?AULAS.find(a=>a.id===id).accent:"transparent",
    color:aulaTab===id?"#fff":"#475569",borderBottom:aulaTab===id?`2px solid ${AULAS.find(a=>a.id===id).accent}`:"2px solid transparent",
    transition:"all .15s"});

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",backdropFilter:"blur(5px)",
      zIndex:900,overflow:"auto",padding:"20px 12px"}}>
      <div style={{maxWidth:860,margin:"0 auto",background:"#0f1623",borderRadius:20,
        border:"1px solid #1e2d45",boxShadow:"0 24px 70px rgba(0,0,0,.5)",overflow:"hidden"}}>

        <div style={{background:"#131929",borderBottom:"1px solid #1e2d45",padding:"16px 22px",
          display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={{color:"#f1f5f9",fontSize:19,fontWeight:800,fontFamily:"'Syne',sans-serif",margin:0}}>Panel de Administración</h2>
            <p style={{color:"#475569",fontSize:12,margin:0}}>IES Comuneros de Castilla</p>
          </div>
          <Btn variant="ghost" onClick={onClose}>✕ Cerrar</Btn>
        </div>

        <div style={{background:"#131929",borderBottom:"1px solid #1e2d45",padding:"0 22px",display:"flex",gap:4}}>
          {AULAS.map(a=><button key={a.id} style={AULATAB(a.id)} onClick={()=>{setAulaTab(a.id);setQ("");}}>{a.icon} {a.label}</button>)}
        </div>

        <div style={{padding:"10px 22px",background:"#131929",borderBottom:"1px solid #1e2d45",display:"flex",gap:4}}>
          <button style={TAB(secTab==="reservas")} onClick={()=>setSecTab("reservas")}>📋 Reservas ({rows.length})</button>
          <button style={TAB(secTab==="bloqueos")} onClick={()=>setSecTab("bloqueos")}>
            🔒 Bloquear huecos
            {totalBlocked>0&&<span style={{marginLeft:6,background:"#7c3aed",color:"#fff",fontSize:10,borderRadius:10,padding:"1px 7px"}}>{totalBlocked}</span>}
          </button>
        </div>

        <div style={{padding:"18px 22px"}}>

          {secTab==="reservas"&&<>
            <input value={q} onChange={e=>setQ(e.target.value)}
              placeholder="🔍  Buscar por nombre, grupo, asignatura o fecha…"
              style={{width:"100%",padding:"9px 14px",borderRadius:10,background:"#1e2535",
                border:"1px solid #334155",color:"#f1f5f9",fontSize:13,outline:"none",
                marginBottom:14,boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"}}/>
            {rows.length===0
              ?<div style={{textAlign:"center",color:"#334155",padding:"40px 0",fontSize:14}}>Sin reservas{q?" que coincidan":` en ${aulaInfo.label}`}</div>
              :rows.map(r=>{
                const s=SLOTS[r.slotIndex];
                const d=new Date(r.date+"T12:00:00");
                const dn=DAYS_FULL[d.getDay()-1]||"?";
                return (
                  <div key={r.id} style={{background:"#131929",border:"1px solid #1e2d45",borderRadius:12,
                    padding:"12px 14px",display:"flex",alignItems:"center",gap:10,marginBottom:7,flexWrap:"wrap"}}>
                    <Avatar name={r.name}/>
                    <div style={{flex:1,minWidth:100}}>
                      <div style={{color:"#f1f5f9",fontSize:13,fontWeight:600}}>{r.name}</div>
                      <div style={{color:"#64748b",fontSize:11}}>{r.group} · {r.subject}</div>
                    </div>
                    <div style={{textAlign:"center",minWidth:86}}>
                      <div style={{color:aulaInfo.accentLight,fontSize:12,fontWeight:600}}>{dn} {fmtDay(d)}</div>
                      <div style={{color:"#475569",fontSize:10}}>Sesión {r.slotIndex+1} · {s?.start}–{s?.end}</div>
                    </div>
                    <div style={{display:"flex",gap:7}}>
                      <Btn variant="warn"   onClick={()=>ask("unlock",r.id)} style={{padding:"6px 12px",fontSize:12}}>Liberar</Btn>
                      <Btn variant="danger" onClick={()=>ask("delete",r.id)} style={{padding:"6px 12px",fontSize:12}}>Borrar</Btn>
                    </div>
                  </div>
                );
              })
            }
          </>}

          {secTab==="bloqueos"&&<>
            <div style={{background:"#1e2535",border:"1px solid #2d3f5a",borderRadius:10,
              padding:"10px 14px",marginBottom:16,fontSize:12,color:"#94a3b8",lineHeight:1.6}}>
              🔒 Pulsa cualquiera de los <strong>35 huecos</strong> de <strong>{aulaInfo.label}</strong> para
              bloquearlo o desbloquearlo. Un hueco bloqueado <strong>no puede reservarse en ninguna semana</strong>.
            </div>
            <div style={{overflowX:"auto"}}>
              <div style={{minWidth:420}}>
                <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",gap:4,marginBottom:4}}>
                  <div/>
                  {DAYS_SHORT.map((d,i)=>(
                    <div key={i} style={{textAlign:"center",padding:"6px 4px",borderRadius:8,
                      background:"#1a2535",border:"1px solid #2d3f5a"}}>
                      <div style={{color:"#64748b",fontSize:10,fontWeight:700,letterSpacing:"0.07em"}}>{d}</div>
                    </div>
                  ))}
                </div>
                {SLOTS.map(slot=>(
                  <div key={slot.index} style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",gap:4,marginBottom:4}}>
                    <div style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"flex-end",paddingRight:8}}>
                      <div style={{color:aulaInfo.accent,fontSize:15,fontWeight:800,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{slot.index+1}</div>
                      <div style={{color:"#2d3f5a",fontSize:8,marginTop:1}}>{slot.start}</div>
                    </div>
                    {DAYS_SHORT.map((_d,dayIdx)=>{
                      const k=panelKey(dayIdx,slot.index);
                      const isBlocked=!!blocked[k];
                      return (
                        <button key={dayIdx} onClick={()=>onToggleBlock(aulaTab,dayIdx,slot.index)}
                          style={{borderRadius:8,minHeight:52,cursor:"pointer",border:"none",
                            background:isBlocked?"#2a1a3e":"#1a2535",
                            outline:isBlocked?"2px solid #7c3aed":"1px solid #2d3f5a",
                            outlineOffset:isBlocked?"-1px":"0",
                            boxShadow:isBlocked?"0 0 10px rgba(124,58,237,.3)":"none",
                            transition:"all .15s",
                            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}
                          onMouseEnter={e=>{e.currentTarget.style.background=isBlocked?"#341f52":"#1e2d45";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=isBlocked?"#2a1a3e":"#1a2535";}}>
                          {isBlocked
                            ?<><span style={{fontSize:14}}>🔒</span><span style={{color:"#a78bfa",fontSize:8,fontWeight:700}}>BLOQ.</span></>
                            :<span style={{color:"#2d3f5a",fontSize:16}}>○</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {totalBlocked>0&&(
              <div style={{marginTop:14,padding:"9px 14px",background:"#1e1b2e",borderRadius:10,
                border:"1px solid #4c1d95",fontSize:12,color:"#a78bfa",
                display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span>🔒 {totalBlocked} hueco{totalBlocked!==1?"s":""} bloqueado{totalBlocked!==1?"s":""} en {aulaInfo.label}</span>
                <button onClick={()=>onToggleBlock(aulaTab,"__clear__",-1)}
                  style={{marginLeft:"auto",padding:"4px 12px",borderRadius:7,background:"transparent",
                    border:"1px solid #7c3aed",color:"#c4b5fd",fontSize:11,fontWeight:600,cursor:"pointer",
                    fontFamily:"'DM Sans',sans-serif"}}>Desbloquear todo</button>
              </div>
            )}
          </>}
        </div>
      </div>

      {confirm&&(
        <Overlay style={{zIndex:1001}}>
          <div style={{background:"#131929",border:"1px solid #dc2626",borderRadius:16,
            padding:"26px 22px",maxWidth:320,textAlign:"center",
            boxShadow:"0 20px 50px rgba(220,38,38,.2)",animation:"popIn .2s ease"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:34,marginBottom:10}}>{confirm.action==="delete"?"🗑️":"🔓"}</div>
            <div style={{color:"#f1f5f9",fontSize:15,fontWeight:700,marginBottom:7,fontFamily:"'Syne',sans-serif"}}>¿Confirmar?</div>
            <div style={{color:"#64748b",fontSize:12,marginBottom:18}}>
              {confirm.action==="delete"?"La reserva se eliminará permanentemente.":"El hueco quedará disponible de nuevo."}
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn variant="ghost"  onClick={()=>setConf(null)}>Cancelar</Btn>
              <Btn variant={confirm.action==="delete"?"danger":"warn"} onClick={doIt} style={{flex:1}}>Confirmar</Btn>
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
function SlotCell({slot,res,isBlocked,dayIdx,accentColor,onBook}) {
  const [hov,setHov]=useState(false);
  const free=!res&&!isBlocked;
  const [c1,c2,accent]=OCC_GRAD[dayIdx]||OCC_GRAD[0];
  let bg,border,cursor;
  if(isBlocked){bg=BLOCKED_BG;border=`2px solid ${BLOCKED_BORDER}`;cursor="not-allowed";}
  else if(res){bg=`linear-gradient(140deg,${c1},${c2})`;border=`1px solid ${accent}55`;cursor="default";}
  else{bg=hov?"#243352":"#1e2d45";border=hov?`1px solid ${accentColor}`:"1px solid #2d3f5a";cursor="pointer";}
  return (
    <div role="button" tabIndex={0}
      aria-label={isBlocked?"Bloqueado":free?`Reservar sesión ${slot.index+1}`:`Ocupado: ${res.name}`}
      onClick={()=>free&&onBook(slot)}
      onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&free&&onBook(slot)}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{borderRadius:10,padding:"7px 8px",minHeight:72,cursor,background:bg,border,
        transition:"all .18s ease",transform:hov&&free?"scale(1.02)":"scale(1)",
        boxShadow:isBlocked?"0 0 10px rgba(124,58,237,.2)":hov&&free?"0 4px 14px rgba(99,102,241,.15)":"none",
        outline:"none"}}>
      {isBlocked?(
        <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          <div style={{fontSize:16}}>🔒</div>
          <div style={{color:"#7c3aed",fontSize:9,fontWeight:700,letterSpacing:"0.06em"}}>BLOQUEADO</div>
        </div>
      ):free?(
        <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          {hov?<><div style={{color:accentColor,fontSize:20,lineHeight:1}}>+</div><div style={{color:accentColor,fontSize:10,fontWeight:600}}>Reservar</div></>
              :<div style={{color:"#1e3a5f",fontSize:10}}>Libre</div>}
        </div>
      ):(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
            <Avatar name={res.name} size={22} fs={9}/>
            <span style={{color:"#1e293b",fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"calc(100% - 28px)"}}>
              {res.name.split(" ")[0]}
            </span>
          </div>
          <div style={{color:"#334155",fontSize:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{res.subject}</div>
          <div style={{color:"#475569",fontSize:9,marginTop:1}}>{res.group}</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   WEEK STRIP
───────────────────────────────────────────────────────────────────────────── */
function WeekStrip({current,reservations,accentColor,onSelect}) {
  const ref=useRef(null);
  const todayISO=toISO(getMonday(new Date()));
  const weeks=Array.from({length:13},(_,i)=>getMonday(addDays(current,(i-4)*7)));
  useEffect(()=>{
    const el=ref.current?.querySelector("[data-active='true']");
    el?.scrollIntoView({inline:"center",behavior:"smooth"});
  },[toISO(current)]);
  function countWeek(mon){
    const fri=toISO(addDays(mon,4));const m=toISO(mon);
    return reservations.filter(r=>r.date>=m&&r.date<=fri).length;
  }
  return (
    <div ref={ref} style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:2,scrollbarWidth:"none"}}>
      {weeks.map(mon=>{
        const iso=toISO(mon);const isCur=iso===toISO(current);const isToday=iso===todayISO;const count=countWeek(mon);
        return (
          <button key={iso} data-active={isCur} onClick={()=>onSelect(mon)}
            style={{flexShrink:0,padding:"7px 11px",borderRadius:10,cursor:"pointer",
              background:isCur?accentColor:isToday?"#1e1b2e":"#16213a",
              border:isCur?`1px solid ${accentColor}`:isToday?"1px solid #4f46e5":"1px solid #1e2d45",
              color:isCur?"#fff":isToday?"#a5b4fc":"#475569",
              transition:"all .15s",outline:"none",minWidth:62,textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
              {isToday&&!isCur&&<span style={{color:accentColor}}>● </span>}
              {fmtDay(mon)}
            </div>
            <div style={{fontSize:9,marginTop:2,color:isCur?"rgba(255,255,255,.6)":"#1e3a5f"}}>
              {count>0?`${count} res.`:"libre"}
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
  const [aulaId,setAulaId]       =useState("aula1");
  const [weekStart,setWeekStart] =useState(()=>getMonday(new Date()));
  const [aulaData,setAulaData]   =useState({
    aula1:{reservations:[],blocked:{},loading:true},
    aula2:{reservations:[],blocked:{},loading:true},
  });
  const [modal,setModal]         =useState(null);
  const [saving,setSaving]       =useState(false);
  const [admin,setAdmin]         =useState(null);
  const [showLogin,setShowLogin] =useState(false);
  const [showPanel,setShowPanel] =useState(false);
  const {list:toasts,push:toast} =useToast();

  // Auth (localStorage — only local)
  useEffect(()=>{ setAdmin(loadAuth()); },[]);

  // Firebase realtime listeners — one per aula
  useEffect(()=>{
    const unsubs=AULAS.map(({id})=>{
      // reservas listener
      const unsubRes=onSnapshot(resCol(id), snap=>{
        const reservations=snap.docs.map(d=>({id:d.id,...d.data()}));
        setAulaData(p=>({...p,[id]:{...p[id],reservations,loading:false}}));
      }, err=>{ console.error("Firestore reservas error:",err); });

      // bloqueos listener
      const unsubBloq=onSnapshot(bloqDoc(id), snap=>{
        const blocked=snap.exists()?(snap.data().map||{}):{};
        setAulaData(p=>({...p,[id]:{...p[id],blocked}}));
      }, err=>{ console.error("Firestore bloqueos error:",err); });

      return ()=>{ unsubRes(); unsubBloq(); };
    });
    return ()=>unsubs.forEach(fn=>fn());
  },[]);

  const aulaInfo     = AULAS.find(a=>a.id===aulaId);
  const {reservations,blocked,loading} = aulaData[aulaId];
  const weekDays     = Array.from({length:5},(_,i)=>addDays(weekStart,i));
  const getRes       = (date,idx)=>reservations.find(r=>r.date===toISO(date)&&r.slotIndex===idx)||null;
  const isBlockedCell= (date,idx)=>!!blocked[blockedKey(toISO(date),idx)];

  /* BOOK */
  async function handleBook(date,slot,{name,group,subject}){
    setSaving(true);
    // Check blocked
    if(blocked[blockedKey(toISO(date),slot.index)]){
      toast("Este hueco está bloqueado por el administrador","err"); setSaving(false); return;
    }
    // Check concurrent booking
    if(reservations.find(r=>r.date===toISO(date)&&r.slotIndex===slot.index)){
      toast("Hueco ya reservado — inténtalo con otro","err"); setSaving(false); return;
    }
    try {
      await addDoc(resCol(aulaId),{
        date:toISO(date), slotIndex:slot.index,
        startTime:slot.start, endTime:slot.end,
        name:name.trim(), group:group.trim(), subject:subject.trim(),
        createdAt:Date.now(),
      });
      setModal(null);
      toast(`Reserva confirmada en ${aulaInfo.label}: sesión ${slot.index+1}`);
    } catch(e){
      toast("Error al guardar — inténtalo de nuevo","err");
      console.error(e);
    }
    setSaving(false);
  }

  /* DELETE / UNLOCK reservation */
  async function handleUnlock(id,resId){
    try { await deleteDoc(doc(db,"reservas",id,"entries",resId)); toast("Hueco liberado"); }
    catch(e){ toast("Error al liberar","err"); console.error(e); }
  }
  async function handleDelete(id,resId){
    try { await deleteDoc(doc(db,"reservas",id,"entries",resId)); toast("Reserva eliminada"); }
    catch(e){ toast("Error al eliminar","err"); console.error(e); }
  }

  /* TOGGLE BLOCK */
  async function handleToggleBlock(id,dayIdx,slotIdx){
    const current=aulaData[id].blocked;
    let updated;
    if(dayIdx==="__clear__"){
      updated={};
      toast("Todos los huecos desbloqueados");
    } else {
      const k=panelKey(dayIdx,slotIdx);
      updated={...current};
      if(updated[k]){ delete updated[k]; toast(`${DAYS_SHORT[dayIdx]} · Sesión ${slotIdx+1} desbloqueada`); }
      else { updated[k]=true; toast(`${DAYS_SHORT[dayIdx]} · Sesión ${slotIdx+1} bloqueada en todas las semanas`); }
    }
    try { await setDoc(bloqDoc(id),{map:updated}); }
    catch(e){ toast("Error al guardar bloqueo","err"); console.error(e); }
  }

  function handleLogin(user){ setAdmin(user); saveAuth(user); setShowLogin(false); setShowPanel(true); toast("Bienvenido, Administrador"); }
  function handleLogout(){ setAdmin(null); saveAuth(null); setShowPanel(false); toast("Sesión cerrada"); }

  const isThisWeek   = toISO(weekStart)===toISO(getMonday(new Date()));
  const weekResCount = reservations.filter(r=>r.date>=toISO(weekStart)&&r.date<=toISO(addDays(weekStart,4))).length;
  const blockedCount = Object.keys(blocked).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{min-height:100%;background:#131e30;color:#f1f5f9;font-family:'DM Sans',sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#192236;}
        ::-webkit-scrollbar-thumb{background:#2d3f5a;border-radius:3px;}
        button:focus-visible{outline:2px solid #6366f1;outline-offset:2px;}
        @keyframes popIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
      `}</style>

      <div aria-hidden style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",top:-250,right:-200,width:650,height:650,borderRadius:"50%",
          background:`radial-gradient(circle,${aulaInfo.accent}12 0%,transparent 65%)`,transition:"background 0.4s"}}/>
      </div>

      <div style={{position:"relative",zIndex:1,minHeight:"100vh"}}>

        {/* HEADER */}
        <header style={{position:"sticky",top:0,zIndex:200,
          borderBottom:"1px solid #2d3f5a",background:"rgba(22,32,52,.96)",
          backdropFilter:"blur(14px)",padding:"0 16px",
          display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",minHeight:60}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
            <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
              background:`linear-gradient(135deg,${aulaInfo.accent},${aulaInfo.accentLight})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:18,boxShadow:`0 4px 14px ${aulaInfo.accent}44`,transition:"background 0.3s"}}>
              {aulaInfo.icon}
            </div>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,color:"#f1f5f9",lineHeight:1.2}}>{aulaInfo.label}</div>
              <div style={{fontSize:10,color:"#475569",lineHeight:1}}>IES Comuneros de Castilla</div>
            </div>
          </div>

          {/* AULA SELECTOR */}
          <div style={{display:"flex",gap:4,background:"#192236",borderRadius:12,padding:4,border:"1px solid #2d3f5a"}}>
            {AULAS.map(a=>{
              const active=aulaId===a.id;
              return (
                <button key={a.id} onClick={()=>setAulaId(a.id)}
                  style={{padding:"6px 14px",borderRadius:9,border:"none",cursor:"pointer",
                    background:active?a.accent:"transparent",color:active?"#fff":"#475569",
                    fontSize:12,fontWeight:700,fontFamily:"'Syne',sans-serif",
                    transition:"all .2s",whiteSpace:"nowrap",
                    boxShadow:active?`0 2px 10px ${a.accent}44`:"none"}}>
                  {a.icon} {a.id==="aula1"?"Aula I":"Aula II"}
                </button>
              );
            })}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0"}}>
            {/* connection indicator */}
            <div title="Sincronizado con la nube" style={{display:"flex",alignItems:"center",gap:4,
              fontSize:10,color:loading?"#64748b":"#22d3ee"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:loading?"#64748b":"#22d3ee",
                display:"inline-block",animation:loading?"pulse 1.2s ease infinite":"none"}}/>
              {loading?"Conectando…":"En vivo"}
            </div>
            {blockedCount>0&&(
              <span style={{background:"#1e1b2e",color:"#a78bfa",fontSize:11,fontWeight:700,
                padding:"3px 10px",borderRadius:20,border:"1px solid #4c1d95"}}>🔒 {blockedCount}</span>
            )}
            {admin?(
              <>
                <Btn variant="ghost" onClick={()=>setShowPanel(true)} style={{fontSize:12,padding:"6px 12px"}}>⚙ Admin</Btn>
                <Btn variant="ghost" onClick={handleLogout} style={{fontSize:12,padding:"6px 10px",color:"#475569"}}>Salir</Btn>
              </>
            ):(
              <Btn variant="ghost" onClick={()=>setShowLogin(true)} style={{fontSize:12,padding:"6px 12px"}}>🔐 Admin</Btn>
            )}
          </div>
        </header>

        <main style={{maxWidth:1120,margin:"0 auto",padding:"18px 14px 56px"}}>

          {/* WEEK NAV */}
          <div style={{background:"#192236",border:"1px solid #2d3f5a",borderRadius:16,
            padding:"16px 18px 13px",marginBottom:12,boxShadow:"0 2px 12px rgba(0,0,0,.25)",animation:"fadeUp .3s ease"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:13,flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"#f1f5f9",lineHeight:1.1}}>
                  {fmtDay(weekDays[0])} — {fmtDay(weekDays[4])}
                  <span style={{fontWeight:400,color:"#334155",fontSize:13,marginLeft:10,textTransform:"capitalize"}}>{fmtMonth(weekDays[0])}</span>
                </div>
                <div style={{color:"#334155",fontSize:12,marginTop:3}}>
                  {weekResCount} reserva{weekResCount!==1?"s":""} · {5*7-weekResCount} huecos libres
                  {blockedCount>0&&<span style={{color:"#7c3aed",marginLeft:8}}>· {blockedCount} bloqueado{blockedCount!==1?"s":""}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <button aria-label="Semana anterior" onClick={()=>setWeekStart(w=>addDays(w,-7))}
                  style={{width:38,height:38,borderRadius:10,background:"#16213a",border:"1px solid #1e2d45",
                    color:aulaInfo.accentLight,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#1e2d45"}
                  onMouseLeave={e=>e.currentTarget.style.background="#16213a"}>‹</button>
                {!isThisWeek&&(
                  <button onClick={()=>setWeekStart(getMonday(new Date()))}
                    style={{padding:"0 14px",height:38,borderRadius:10,background:"#1e1b2e",
                      border:`1px solid ${aulaInfo.accent}`,color:aulaInfo.accentLight,
                      fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>↩ Hoy</button>
                )}
                <button aria-label="Semana siguiente" onClick={()=>setWeekStart(w=>addDays(w,7))}
                  style={{width:38,height:38,borderRadius:10,background:"#16213a",border:"1px solid #1e2d45",
                    color:aulaInfo.accentLight,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#1e2d45"}
                  onMouseLeave={e=>e.currentTarget.style.background="#16213a"}>›</button>
              </div>
            </div>
            <WeekStrip current={weekStart} reservations={reservations} accentColor={aulaInfo.accent} onSelect={setWeekStart}/>
          </div>

          {/* CALENDAR */}
          <div style={{background:"#192236",border:"1px solid #2d3f5a",borderRadius:16,
            padding:"14px",overflowX:"auto",boxShadow:"0 2px 12px rgba(0,0,0,.25)",animation:"fadeUp .35s ease"}}>
            {loading?(
              <div style={{padding:"60px 0",textAlign:"center",color:"#334155",fontSize:14}}>
                <Spin/> <span style={{marginLeft:8}}>Cargando datos…</span>
              </div>
            ):(
              <div style={{minWidth:520}}>
                <div style={{display:"grid",gridTemplateColumns:"50px repeat(5,1fr)",gap:5,marginBottom:5}}>
                  <div/>
                  {weekDays.map((d,i)=>{
                    const isToday=toISO(d)===toISO(new Date());
                    const cnt=reservations.filter(r=>r.date===toISO(d)).length;
                    return (
                      <div key={i} style={{textAlign:"center",padding:"7px 3px",borderRadius:9,
                        background:isToday?"#1e1b2e":"#1e2d45",
                        border:isToday?`1px solid ${aulaInfo.accent}`:"1px solid #2d3f5a"}}>
                        <div style={{color:isToday?aulaInfo.accentLight:"#334155",fontSize:10,fontWeight:700,letterSpacing:"0.07em"}}>{DAYS_SHORT[i]}</div>
                        <div style={{color:isToday?aulaInfo.accentLight:"#64748b",fontSize:20,fontWeight:800,
                          fontFamily:"'Syne',sans-serif",lineHeight:1.1}}>{d.getDate()}</div>
                        <div style={{color:"#1e3a5f",fontSize:9}}>
                          {cnt>0?`${cnt} res.`:d.toLocaleDateString("es-ES",{month:"short"})}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {SLOTS.map(slot=>(
                  <div key={slot.index} style={{display:"grid",gridTemplateColumns:"50px repeat(5,1fr)",gap:5,marginBottom:5}}>
                    <div style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"flex-end",paddingRight:8}}>
                      <div style={{color:aulaInfo.accent,fontSize:17,fontWeight:800,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{slot.index+1}</div>
                      <div style={{color:"#1e2d45",fontSize:9,marginTop:2}}>{slot.start}</div>
                    </div>
                    {weekDays.map((d,di)=>(
                      <SlotCell key={`${toISO(d)}-${slot.index}`}
                        slot={slot} res={getRes(d,slot.index)}
                        isBlocked={isBlockedCell(d,slot.index)}
                        dayIdx={di} accentColor={aulaInfo.accent}
                        onBook={s=>setModal({date:d,slot:s})}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:18,marginTop:11,flexWrap:"wrap"}}>
            {[
              {bg:"#1e2d45",bd:"#2d3f5a",label:"Libre — click para reservar"},
              {bg:"linear-gradient(140deg,#bfdbfe,#93c5fd)",bd:"#3b82f655",label:"Ocupado"},
              {bg:BLOCKED_BG,bd:BLOCKED_BORDER,label:"Bloqueado por admin"},
            ].map(({bg,bd,label})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:7}}>
                <div style={{width:13,height:13,borderRadius:3,background:bg,border:`1px solid ${bd}`}}/>
                <span style={{color:"#334155",fontSize:11}}>{label}</span>
              </div>
            ))}
          </div>
        </main>
      </div>

      {modal&&(
        <BookModal slot={modal.slot} date={toISO(modal.date)}
          dayName={DAYS_FULL[modal.date.getDay()-1]}
          aulaLabel={aulaInfo.label} accentColor={aulaInfo.accent} saving={saving}
          onConfirm={data=>handleBook(modal.date,modal.slot,data)}
          onCancel={()=>!saving&&setModal(null)}/>
      )}
      {showLogin&&<AdminLogin onLogin={handleLogin} onCancel={()=>setShowLogin(false)}/>}
      {showPanel&&admin&&(
        <AdminPanel allData={aulaData}
          onUnlock={handleUnlock} onDelete={handleDelete}
          onToggleBlock={handleToggleBlock} onClose={()=>setShowPanel(false)}/>
      )}
      <ToastStack list={toasts}/>
    </>
  );
}





