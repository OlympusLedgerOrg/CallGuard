/* global React */
const { useState, useEffect, useCallback, useRef } = (typeof React !== "undefined") ? React : require("react");

/* ── API helpers (set by /api.js when served from Express) ── */
const api = (typeof window !== "undefined" && window.CallGuardAPI) || null;
const connectCallSocket = (typeof window !== "undefined" && window.CallGuardSocket) || null;

const C = {
  bg:"#07090F", surface:"#0E1219", card:"#131822", border:"#1B2840",
  accent:"#00C2FF", accentDim:"#00C2FF1A", accentGlow:"#00C2FF33",
  success:"#00E5A0", successDim:"#00E5A01A",
  warn:"#FFB547",   warnDim:"#FFB5471A",
  danger:"#FF4D6A", dangerDim:"#FF4D6A1A",
  text:"#EEF2FF",   muted:"#7A8BA8", faint:"#2E3D58",
  droidAccent:"#4FC3F7",
};

const G = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Roboto:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.94)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes slideUp{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{transform:scale(.82);opacity:0}70%{transform:scale(1.08)}to{transform:scale(1);opacity:1}}
@keyframes checkDraw{from{stroke-dashoffset:40}to{stroke-dashoffset:0}}
@keyframes notifIn{0%{transform:translateY(-110%);opacity:0}12%{transform:translateY(0);opacity:1}82%{transform:translateY(0);opacity:1}100%{transform:translateY(-120%);opacity:0}}
@keyframes smsIn{from{transform:translateX(50px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes w1{0%,100%{height:5px}50%{height:22px}}
@keyframes w2{0%,100%{height:13px}50%{height:6px}}
@keyframes w3{0%,100%{height:18px}50%{height:3px}}
@keyframes w4{0%,100%{height:7px}50%{height:24px}}
@keyframes w5{0%,100%{height:10px}50%{height:15px}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes panelUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes txLine{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes sentPop{0%{transform:scale(.9) translateX(30px);opacity:0}70%{transform:scale(1.03) translateX(-2px)}100%{transform:scale(1) translateX(0);opacity:1}}
@keyframes modePulse{0%,100%{box-shadow:0 0 0 0 currentColor}60%{box-shadow:0 0 0 6px transparent}}
.sc{overflow-y:auto;scrollbar-width:none}
.sc::-webkit-scrollbar{display:none}
.ch{cursor:pointer;transition:transform .15s,opacity .15s}
.ch:active{transform:scale(.975);opacity:.85}
.bp{cursor:pointer;transition:transform .14s}
.bp:active{transform:scale(.95)}
`;

function LoadingScreen({label="Checking access…"}){
  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
        <div style={{fontSize:22,fontWeight:600,color:C.accent}}>CallGuard</div>
        <div style={{fontSize:13,color:C.muted}}>{label}</div>
      </div>
    </div>
  );
}

function parseJwt(token){
  try{
    const parts=token.split(".");
    if(parts.length!==3) return null;
    const payload=parts[1];
    if(!payload) return null;
    const json=atob(payload.replace(/-/g,"+").replace(/_/g,"/"));
    return JSON.parse(json);
  }catch{
    if(typeof window!=="undefined"&&["localhost","127.0.0.1"].includes(window.location.hostname)){
      console.warn("Invalid auth token");
    }
    return null;
  }
}

function isTokenValid(token){
  const payload=parseJwt(token);
  if(!payload||!payload.exp) return false;
  return Date.now()<payload.exp*1000;
}

function LoginScreen({onLogin,error,loading,disabled}){
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const canSubmit=username.trim()&&password.trim()&&!loading&&!disabled;
  const showHint=(typeof window!=="undefined")&&["localhost","127.0.0.1"].includes(window.location.hostname);

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:"32px 16px"}}>
      <div style={{width:"100%",maxWidth:360,background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,padding:"28px 24px",boxShadow:"0 18px 40px rgba(0,0,0,.35)"}}>
        <div style={{fontSize:22,fontWeight:600,color:C.accent}}>CallGuard</div>
        <div style={{fontSize:13,color:C.muted,marginTop:6,marginBottom:18}}>Sign in to the owner dashboard</div>
        <label style={{display:"block",fontSize:12,color:C.muted,marginBottom:6}}>Username</label>
        <input
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
          placeholder="admin"
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,background:"#0B0F17",color:C.text,marginBottom:12}}
        />
        <label style={{display:"block",fontSize:12,color:C.muted,marginBottom:6}}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          placeholder="••••••••"
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,background:"#0B0F17",color:C.text,marginBottom:14}}
        />
        {error&&(
          <div style={{fontSize:12,color:C.danger,marginBottom:12}}>
            {error}
          </div>
        )}
        <button
          onClick={()=>canSubmit&&onLogin(username.trim(),password)}
          disabled={!canSubmit}
          style={{
            width:"100%",
            padding:"11px 12px",
            borderRadius:10,
            border:"none",
            background:canSubmit?C.accent:C.faint,
            color:canSubmit?"#001018":C.muted,
            fontWeight:600,
            cursor:canSubmit?"pointer":"not-allowed",
          }}
        >
          {loading?"Signing in…":"Sign in"}
        </button>
        {disabled&&(
          <div style={{fontSize:11,color:C.warn,marginTop:10}}>
            Server offline — sign-in is unavailable.
          </div>
        )}
        {showHint&&(
          <div style={{fontSize:11,color:C.faint,marginTop:14,lineHeight:1.4}}>
            Configure <span style={{color:C.muted}}>DASHBOARD_USER</span> and <span style={{color:C.muted}}>DASHBOARD_PASSWORD</span> on the server.
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({s}){
  const m={booked:{l:"Booked",bg:C.successDim,fg:C.success},info:{l:"Info",bg:C.accentDim,fg:C.accent},missed:{l:"Missed",bg:C.dangerDim,fg:C.danger},cancelled:{l:"Cancelled",bg:C.warnDim,fg:C.warn},confirmed:{l:"Confirmed",bg:C.successDim,fg:C.success},pending:{l:"Pending",bg:C.warnDim,fg:C.warn}}[s]||{l:s,bg:C.faint,fg:C.muted};
  return <span style={{background:m.bg,color:m.fg,fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:99,letterSpacing:".04em",flexShrink:0,whiteSpace:"nowrap"}}>{m.l}</span>;
}

function Wave({on}){
  const ws=[["w1","0s"],["w2",".1s"],["w3",".18s"],["w4",".07s"],["w5",".14s"],["w2",".22s"],["w4",".05s"]];
  return(
    <div style={{display:"flex",alignItems:"center",gap:3,height:28}}>
      {ws.map(([a,d],i)=>(
        <div key={i} style={{borderRadius:3,width:4,flexShrink:0,background:on?C.accent:C.faint,height:on?undefined:4,animation:on?`${a} ${.8+i*.05}s ${d} ease-in-out infinite`:"none",transition:"background .3s"}}/>
      ))}
    </div>
  );
}

const CALLS=[
  {id:1,caller:"Marcus Webb",num:"+1 (828) 555-0142",t:"Today 2:34 PM",dur:"3m 12s",s:"booked",ai:true,sum:"Scheduled teeth cleaning for April 3rd at 10 AM.",tx:"[AI: Apex Dental, how can I help?]\nI'd like to book a cleaning.\n[AI: Of course — April 3rd at 10 AM is open, shall I confirm?]\nYes please.\n[AI: Done! SMS confirmation on its way.]"},
  {id:2,caller:"Unknown",num:"+1 (704) 555-8821",t:"Today 11:18 AM",dur:"47s",s:"info",ai:true,sum:"Asked about office hours and parking.",tx:"[AI: Apex Dental, how can I help?]\nWhat are your Saturday hours?\n[AI: Open Sat 9 AM–1 PM. Free parking on Oak Ave.]\nThanks.\n[AI: Happy to help!]"},
  {id:3,caller:"Priya Nair",num:"+1 (336) 555-0033",t:"Yesterday 4:02 PM",dur:"5m 48s",s:"booked",ai:true,sum:"Rescheduled from Mar 28 → Apr 10, 9 AM.",tx:"[AI: Apex Dental, how can I help?]\nHi, I need to reschedule.\n[AI: Sure Priya — Apr 10 at 9 AM is available. OK?]\nPerfect.\n[AI: Rescheduled! SMS sent.]"},
  {id:4,caller:"Luis Fontaine",num:"+1 (910) 555-2290",t:"Yesterday 9:45 AM",dur:"1m 03s",s:"missed",ai:false,sum:"Voicemail left. No action taken.",tx:"[Call ended before AI responded. Voicemail recorded.]"},
  {id:5,caller:"Sandra Okafor",num:"+1 (828) 555-7761",t:"Mar 24 3:17 PM",dur:"2m 29s",s:"booked",ai:true,sum:"New patient intake. April 7th at 2 PM.",tx:"[AI: Apex Dental, how can I help?]\nI'd like to schedule as a new patient.\n[AI: Welcome! Apr 7 at 2 PM works — confirm?]\nYes.\n[AI: Booked! Confirmation SMS sent.]"},
  {id:6,caller:"Derek Hollis",num:"+1 (828) 555-0018",t:"Mar 23 10:55 AM",dur:"4m 01s",s:"cancelled",ai:true,sum:"Requested cancellation of March 28 slot.",tx:"[AI: Apex Dental, how can I help?]\nI need to cancel March 28.\n[AI: No problem Derek — cancelled. Want to rebook?]\nNot now.\n[AI: Of course, call anytime!]"},
];

const SERVICES=[
  {id:"clean",name:"Teeth Cleaning",dur:"45 min",icon:"🪥",desc:"Professional scale & polish"},
  {id:"new",name:"New Patient Intake",dur:"60 min",icon:"📋",desc:"Full exam + X-rays"},
  {id:"follow",name:"Follow-up Exam",dur:"30 min",icon:"🔍",desc:"Post-treatment check"},
  {id:"xray",name:"X-Ray & Consult",dur:"45 min",icon:"🦷",desc:"Diagnostic imaging"},
  {id:"white",name:"Teeth Whitening",dur:"60 min",icon:"✨",desc:"In-office whitening"},
  {id:"emerg",name:"Emergency Visit",dur:"30 min",icon:"🚨",desc:"Same-day urgent care"},
];
const DAYS=[{d:"Mon",dt:"Apr 7"},{d:"Tue",dt:"Apr 8"},{d:"Wed",dt:"Apr 9"},{d:"Thu",dt:"Apr 10"},{d:"Fri",dt:"Apr 11"},{d:"Sat",dt:"Apr 12"},{d:"Mon",dt:"Apr 14"},{d:"Tue",dt:"Apr 15"}];
const TIMES=["8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM"];
const BUSY=["9:00 AM","10:30 AM","2:30 PM"];
const STATS=[{l:"Calls This Week",v:"47",d:"+12%"},{l:"AI Handled",v:"94%",d:"+3%"},{l:"Appts Booked",v:"31",d:"+8"},{l:"Avg Handle Time",v:"2m 48s",d:"−18s"}];

/* ── Status bars ── */
function IOSBar(){
  return(
    <div style={{background:"#07090F",padding:"13px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:12,fontWeight:500,color:C.muted,fontFamily:"'DM Mono',monospace"}}>9:41</span>
      <div style={{width:72,height:20,background:"#0A0D14",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
        <div style={{width:8,height:8,borderRadius:99,background:"#1A2235"}}/><div style={{width:12,height:12,borderRadius:99,background:"#1A2235"}}/>
      </div>
      <div style={{display:"flex",gap:5,alignItems:"center"}}>
        <svg width="15" height="11" viewBox="0 0 15 11" fill={C.muted}><rect x="0" y="3" width="3" height="8" rx="1"/><rect x="4" y="2" width="3" height="9" rx="1"/><rect x="8" y="0" width="3" height="11" rx="1"/><rect x="12" y="0" width="3" height="11" rx="1" opacity=".3"/></svg>
        <svg width="23" height="11" viewBox="0 0 23 11"><rect x="0" y=".5" width="19" height="10" rx="2" fill="none" stroke={C.muted} strokeWidth="1.2"/><rect x="1.5" y="2" width="13" height="7" rx="1" fill={C.success}/><rect x="20" y="3.5" width="2" height="4" rx="1" fill={C.muted}/></svg>
      </div>
    </div>
  );
}

function DroidBar(){
  return(
    <div style={{background:"#06080E",padding:"10px 16px 6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:12,fontWeight:400,color:C.muted,fontFamily:"'Roboto',sans-serif"}}>9:41</span>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <svg width="14" height="10" viewBox="0 0 14 10" fill={C.muted}><rect x="0" y="2" width="2" height="8" rx=".5"/><rect x="3.5" y="1" width="2" height="9" rx=".5"/><rect x="7" y="0" width="2" height="10" rx=".5"/><rect x="10.5" y="0" width="2" height="10" rx=".5" opacity=".3"/></svg>
        <svg width="22" height="11" viewBox="0 0 22 11"><rect x="0" y=".5" width="18" height="10" rx="1.5" fill="none" stroke={C.muted} strokeWidth="1.2"/><rect x="1.5" y="2" width="12" height="7" rx=".5" fill={C.success}/><rect x="19" y="3.5" width="2" height="4" rx=".5" fill={C.muted}/></svg>
      </div>
    </div>
  );
}

/* ── Nav icons ── */
const NAV=[
  {id:"home",l:"Home",icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={a?C.accent:C.muted} strokeWidth="1.5" fill={a?C.accentDim:"none"}/><path d="M9 21V12h6v9" stroke={a?C.accent:C.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>},
  {id:"calls",l:"Calls",icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke={a?C.accent:C.muted} strokeWidth="1.5" fill={a?C.accentDim:"none"}/></svg>},
  {id:"ai",l:"Advisor",icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="14" rx="3" stroke={a?C.accent:C.muted} strokeWidth="1.5" fill={a?C.accentDim:"none"}/><path d="M8 9h8M8 12h5" stroke={a?C.accent:C.muted} strokeWidth="1.5" strokeLinecap="round"/><path d="M7 17l-3 4h16l-3-4" stroke={a?C.accent:C.muted} strokeWidth="1.5" strokeLinejoin="round"/></svg>,glow:true},
  {id:"book",l:"Book",icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke={a?C.accent:C.muted} strokeWidth="1.5" fill={a?C.accentDim:"none"}/><path d="M16 2v4M8 2v4M3 10h18" stroke={a?C.accent:C.muted} strokeWidth="1.5" strokeLinecap="round"/><path d="M12 14v4M10 16h4" stroke={a?C.accent:C.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>,dot:true},
  {id:"acct",l:"Account",icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={a?C.accent:C.muted} strokeWidth="1.5" fill={a?C.accentDim:"none"}/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={a?C.accent:C.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>},
];

function IOSNav({tab,setTab}){
  return(
    <div style={{background:`${C.surface}F0`,backdropFilter:"blur(20px)",borderTop:`0.5px solid ${C.border}`,display:"flex",justifyContent:"space-around",padding:"10px 0 16px"}}>
      {NAV.map(n=>(
        <button key={n.id} onClick={()=>setTab(n.id)} className="bp"
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",padding:"2px 8px",position:"relative"}}>
          {n.icon(tab===n.id)}
          {n.dot&&<div style={{position:"absolute",top:0,right:6,width:7,height:7,borderRadius:99,background:C.success,border:`1.5px solid ${C.bg}`}}/>}
          {n.glow&&tab!==n.id&&<div style={{position:"absolute",top:0,right:6,width:7,height:7,borderRadius:99,background:C.accent,border:`1.5px solid ${C.bg}`,animation:"pulse 2s ease-in-out infinite"}}/>}
          <span style={{fontSize:10,color:tab===n.id?C.accent:C.muted,fontFamily:"'DM Sans',sans-serif",fontWeight:tab===n.id?600:400}}>{n.l}</span>
        </button>
      ))}
    </div>
  );
}

function DroidNav({tab,setTab}){
  return(
    <div style={{background:"#0B0E16",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-around",padding:"8px 0 10px"}}>
      {NAV.map(n=>(
        <button key={n.id} onClick={()=>setTab(n.id)} className="bp"
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",padding:"2px 8px",position:"relative"}}>
          <div style={{padding:"4px 12px",borderRadius:18,background:tab===n.id?`${C.droidAccent}18`:"transparent",position:"relative",transition:"background .2s"}}>
            {n.icon(tab===n.id)}
            {n.dot&&<div style={{position:"absolute",top:2,right:8,width:6,height:6,borderRadius:99,background:C.success,border:`1.5px solid #0B0E16`}}/>}
            {n.glow&&tab!==n.id&&<div style={{position:"absolute",top:2,right:8,width:6,height:6,borderRadius:99,background:C.accent,border:`1.5px solid #0B0E16`,animation:"pulse 2s ease-in-out infinite"}}/>}
          </div>
          <span style={{fontSize:10,color:tab===n.id?C.droidAccent:C.muted,fontFamily:"'Roboto',sans-serif",fontWeight:tab===n.id?500:400}}>{n.l}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Push notification ── */
function PushNotif({plat,msg,onDismiss}){
  const ios=plat==="ios";
  useEffect(()=>{const t=setTimeout(onDismiss,5500);return()=>clearTimeout(t);},[]);
  return(
    <div onClick={onDismiss} style={{position:"absolute",top:ios?10:6,left:10,right:10,zIndex:200,animation:"notifIn 6s cubic-bezier(.22,1,.36,1) forwards",cursor:"pointer"}}>
      <div style={{background:ios?"rgba(18,24,40,0.95)":"#18212E",backdropFilter:ios?"blur(28px)":"none",borderRadius:ios?18:12,border:`1px solid ${ios?"rgba(255,255,255,0.07)":C.border}`,padding:"11px 13px",boxShadow:"0 8px 32px rgba(0,0,0,.65)"}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{width:34,height:34,borderRadius:ios?10:17,background:`${C.success}22`,border:`1px solid ${C.success}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:17}}>💬</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
              <span style={{fontSize:12,fontWeight:500,color:C.text,fontFamily:ios?"'DM Sans',sans-serif":"'Roboto',sans-serif"}}>{ios?"Messages":"SMS · now"}</span>
              <span style={{fontSize:11,color:C.muted}}>now</span>
            </div>
            <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:2,fontFamily:ios?"'DM Sans',sans-serif":"'Roboto',sans-serif"}}>Apex Dental Care</div>
            <div style={{fontSize:12,color:C.muted,lineHeight:1.5,fontFamily:ios?"'DM Sans',sans-serif":"'Roboto',sans-serif"}}>{msg}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── App bar ── */
function AppBar({plat}){
  const ios=plat==="ios";
  return(
    <div style={{position:"absolute",top:0,left:0,right:0,zIndex:30,background:`${C.bg}F2`,backdropFilter:"blur(16px)",padding:"10px 16px 8px",borderBottom:`${ios?".5px":"1px"} solid ${C.border}`,display:"flex",alignItems:"center",gap:9}}>
      <div style={{width:28,height:28,borderRadius:ios?9:14,background:`linear-gradient(135deg,${C.accent},${C.accent}99)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 1l3 6 6 1-4.5 4 1 6L12 15l-5.5 3 1-6L3 8l6-1z"/></svg>
      </div>
      <span style={{fontSize:15,fontWeight:ios?600:500,color:C.text,fontFamily:ios?"'DM Sans',sans-serif":"'Roboto',sans-serif"}}>CallGuard</span>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:7,height:7,borderRadius:99,background:C.success,animation:"pulse 2.5s ease-in-out infinite"}}/>
        <span style={{fontSize:11,color:C.muted}}>AI Live</span>
      </div>
    </div>
  );
}

/* ── Live call transcript lines ── */
const TX_SCRIPT=[
  {from:"caller", text:"Hi, my AC unit stopped working this morning."},
  {from:"ai",     text:"Oh no, I'm sorry to hear that! Is it completely off or just not cooling enough?"},
  {from:"caller", text:"Completely off. Tripped the breaker twice already."},
  {from:"ai",     text:"Got it — that sounds like it could be the capacitor or the compressor. What's your address so I can check availability near you?"},
  {from:"caller", text:"204 Maple Street, Boone."},
  {from:"ai",     text:"Perfect. We have a slot today at 3 PM or tomorrow morning at 9 AM. Which works better for you?"},
  {from:"caller", text:"Today at 3 would be great, but how much does it usually cost?"},
  {from:"ai",     text:"Diagnostics are $85 which goes toward the repair. Most capacitor jobs run $150–$250 total. Does 3 PM today work?"},
  {from:"caller", text:"Yeah that works. Name's Ray Burnett."},
  {from:"ai",     text:"Perfect Ray, I'm booking you in for 3 PM today. You'll get an SMS confirmation shortly. Anything else I can help with?"},
];

const QUICK_REPLIES=[
  {l:"Our address",   t:"We're at 204 Oak Ave, Boone NC 28607. Easy parking out front."},
  {l:"Today's hours", t:"We're open today until 6 PM. Tech is still available for afternoon jobs."},
  {l:"Pricing",       t:"Diagnostic fee is $85 (goes toward repair). Most jobs $150–$350 depending on parts."},
  {l:"ETA",           t:"Our tech can be there in about 45 mins from now."},
  {l:"Parts in stock",t:"We carry most common parts on the truck — same-day fix is usually possible."},
  {l:"Emergency rate",t:"After-hours emergency rate is $125 diagnostic. Worth it to get your AC back tonight!"},
];

/* ── LiveCallPanel ── */
function LiveCallPanel({plat,live,liveTranscript,onClose}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const [mode,setMode]=useState("ai");     // ai | listen | owner | ended
  const [tab,setTab]=useState("info");     // info | controls
  const [msgs,setMsgs]=useState([]);
  const [sentMsgs,setSentMsgs]=useState([]);
  const [custom,setCustom]=useState("");
  const [sending,setSending]=useState(false);
  const [joiningCall,setJoiningCall]=useState(false);
  const [txIdx,setTxIdx]=useState(0);
  const [muted,setMuted]=useState(false);
  const txRef=useRef(null);

  /* Use real WebSocket transcript when available, otherwise demo script */
  const hasLiveTranscript = liveTranscript && liveTranscript.length > 0;

  useEffect(()=>{
    if(hasLiveTranscript){
      setMsgs(liveTranscript.map(t=>({from:t.role==="user"?"caller":"ai",text:t.text})));
    }
  },[liveTranscript,hasLiveTranscript]);

  /* stream mock transcript lines in (only when no live data) */
  useEffect(()=>{
    if(hasLiveTranscript) return; // skip mock when we have real data
    if(mode==="ended") return;
    const delay=txIdx===0?400:2800;
    if(txIdx>=TX_SCRIPT.length) return;
    const t=setTimeout(()=>{
      setMsgs(m=>[...m,TX_SCRIPT[txIdx]]);
      setTxIdx(i=>i+1);
    },delay);
    return()=>clearTimeout(t);
  },[txIdx,mode,hasLiveTranscript]);

  /* auto-scroll transcript */
  useEffect(()=>{
    if(txRef.current) txRef.current.scrollTop=txRef.current.scrollHeight;
  },[msgs,sentMsgs]);

  const modeConfig={
    ai:     {label:"AI Handling",   color:C.danger,  dot:true},
    listen: {label:"You're Listening", color:C.warn,  dot:false},
    owner:  {label:"You're Talking",   color:C.success,dot:false},
    ended:  {label:"Call Ended",    color:C.muted,   dot:false},
  }[mode];

  const sendInfo=(text)=>{
    if(!text.trim()) return;
    setSending(true);
    const callerPhone = live && live.from ? live.from : null;
    if(api && callerPhone){
      api.sendSms(callerPhone, text.trim()).then(()=>{
        setSentMsgs(s=>[...s,{text:text.trim(),ts:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}]);
        setSending(false);setCustom("");setTab("info");
      }).catch(()=>{setSending(false);});
    } else {
      setTimeout(()=>{
        setSentMsgs(s=>[...s,{text:text.trim(),ts:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}]);
        setSending(false);setCustom("");setTab("info");
      },700);
    }
  };

  const handleJump=()=>{
    setJoiningCall(true);
    setTimeout(()=>{setJoiningCall(false);setMode("listen");},1600);
  };
  const handleTakeOver=()=>setMode("owner");
  const handleEnd=()=>{setMode("ended");setTimeout(onClose,1800);};
  const handleHandBack=()=>setMode("listen");

  const br=ios?18:12;

  return(
    <div style={{position:"absolute",inset:0,zIndex:100,display:"flex",flexDirection:"column",animation:"panelUp .38s cubic-bezier(.22,1,.36,1) both"}}>
      {/* Blurred backdrop header */}
      <div style={{background:`${C.bg}F8`,backdropFilter:"blur(20px)",flexShrink:0}}>
        {/* Drag handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
          <div style={{width:40,height:4,borderRadius:99,background:C.faint}}/>
        </div>
        {/* Caller row */}
        <div style={{padding:"6px 16px 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:".07em",color:modeConfig.color,display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              {modeConfig.dot&&<div style={{width:7,height:7,borderRadius:99,background:modeConfig.color,animation:"blink 1s ease-in-out infinite"}}/>}
              {modeConfig.label.toUpperCase()}
            </div>
            <div style={{fontSize:18,fontWeight:ios?600:500,color:C.text}}>{live.caller}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>+1 (828) 555-3301</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:modeConfig.color,fontWeight:500}}>{live.fmt}</span>
            <button onClick={onClose} style={{background:`${C.faint}44`,border:"none",borderRadius:99,padding:"4px 12px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:ff}}>✕ Close</button>
          </div>
        </div>

        {/* Mode action strip */}
        {mode==="ai"&&!joiningCall&&(
          <div style={{display:"flex",gap:8,padding:"0 16px 14px"}}>
            <button onClick={handleJump} className="bp"
              style={{flex:1,padding:"10px",background:`${C.warn}18`,border:`1px solid ${C.warn}44`,borderRadius:ios?14:10,color:C.warn,fontSize:13,fontWeight:600,fontFamily:ff,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" fill={C.warn}/></svg>
              Listen In
            </button>
            <button onClick={handleTakeOver} className="bp"
              style={{flex:1,padding:"10px",background:`${C.success}18`,border:`1px solid ${C.success}44`,borderRadius:ios?14:10,color:C.success,fontSize:13,fontWeight:600,fontFamily:ff,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={C.success}><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z" fill="#000"/></svg>
              Take Over
            </button>
          </div>
        )}
        {joiningCall&&(
          <div style={{padding:"10px 16px 14px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:16,height:16,border:`2px solid ${C.warn}`,borderTopColor:"transparent",borderRadius:99,animation:"spin .7s linear infinite"}}/>
            <span style={{fontSize:13,color:C.warn,fontFamily:ff}}>Joining silently...</span>
          </div>
        )}
        {mode==="listen"&&(
          <div style={{display:"flex",gap:8,padding:"0 16px 14px"}}>
            <button onClick={()=>setMuted(!muted)} className="bp"
              style={{flex:1,padding:"10px",background:muted?`${C.danger}18`:C.surface,border:`1px solid ${muted?C.danger:C.border}`,borderRadius:ios?14:10,color:muted?C.danger:C.muted,fontSize:12,fontWeight:600,fontFamily:ff,cursor:"pointer"}}>
              {muted?"🔇 Muted":"🎙 Mute Mic"}
            </button>
            <button onClick={handleTakeOver} className="bp"
              style={{flex:1,padding:"10px",background:`${C.success}18`,border:`1px solid ${C.success}44`,borderRadius:ios?14:10,color:C.success,fontSize:13,fontWeight:600,fontFamily:ff,cursor:"pointer"}}>
              🎤 Take Over
            </button>
            <button onClick={handleEnd} className="bp"
              style={{padding:"10px 14px",background:`${C.danger}18`,border:`1px solid ${C.danger}44`,borderRadius:ios?14:10,color:C.danger,fontSize:13,fontWeight:600,fontFamily:ff,cursor:"pointer"}}>
              End
            </button>
          </div>
        )}
        {mode==="owner"&&(
          <div style={{display:"flex",gap:8,padding:"0 16px 14px"}}>
            <button onClick={()=>setMuted(!muted)} className="bp"
              style={{flex:1,padding:"10px",background:muted?`${C.danger}18`:C.surface,border:`1px solid ${muted?C.danger:C.border}`,borderRadius:ios?14:10,color:muted?C.danger:C.muted,fontSize:12,fontWeight:600,fontFamily:ff,cursor:"pointer"}}>
              {muted?"🔇 Muted":"🎙 Unmuted"}
            </button>
            <button onClick={handleHandBack} className="bp"
              style={{flex:1,padding:"10px",background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:ios?14:10,color:C.accent,fontSize:12,fontWeight:600,fontFamily:ff,cursor:"pointer"}}>
              🤖 Hand to AI
            </button>
            <button onClick={handleEnd} className="bp"
              style={{padding:"10px 14px",background:`${C.danger}18`,border:`1px solid ${C.danger}44`,borderRadius:ios?14:10,color:C.danger,fontSize:13,fontWeight:600,fontFamily:ff,cursor:"pointer"}}>
              End
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",borderTop:`1px solid ${C.border}`}}>
          {[{id:"info",l:"📨 Send Info"},{id:"tx",l:"📝 Transcript"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{flex:1,padding:"10px",background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?C.accent:"transparent"}`,color:tab===t.id?C.accent:C.muted,fontSize:13,fontWeight:tab===t.id?600:400,cursor:"pointer",fontFamily:ff,transition:"all .15s"}}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div style={{flex:1,background:C.bg,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {tab==="tx"&&(
          <div ref={txRef} className="sc" style={{flex:1,overflowY:"auto",padding:"14px 16px 8px",display:"flex",flexDirection:"column",gap:10}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.from==="ai"?"flex-start":"flex-end",animation:"txLine .3s ease both"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:3,paddingLeft:m.from==="ai"?4:0,paddingRight:m.from==="caller"?4:0}}>
                  {m.from==="ai"?"🤖 Ava AI":"👤 Caller"}
                </div>
                <div style={{maxWidth:"82%",background:m.from==="ai"?`${C.accent}18`:C.surface,border:`1px solid ${m.from==="ai"?C.accent+"33":C.border}`,borderRadius:m.from==="ai"?"4px 14px 14px 14px":"14px 4px 14px 14px",padding:"9px 12px"}}>
                  <span style={{fontSize:13,color:C.text,lineHeight:1.55}}>{m.text}</span>
                </div>
              </div>
            ))}
            {/* Sent SMS messages inline */}
            {sentMsgs.map((m,i)=>(
              <div key={"s"+i} style={{display:"flex",flexDirection:"column",alignItems:"flex-end",animation:"sentPop .35s cubic-bezier(.22,1,.36,1) both"}}>
                <div style={{fontSize:10,color:C.success,marginBottom:3,paddingRight:4}}>📩 You → Caller (SMS)</div>
                <div style={{maxWidth:"82%",background:`${C.success}18`,border:`1px solid ${C.success}44`,borderRadius:"14px 4px 14px 14px",padding:"9px 12px"}}>
                  <span style={{fontSize:13,color:C.success,lineHeight:1.55}}>{m.text}</span>
                </div>
                <div style={{fontSize:10,color:C.muted,marginTop:3,paddingRight:4}}>Delivered {m.ts}</div>
              </div>
            ))}
            {txIdx<TX_SCRIPT.length&&mode!=="ended"&&(
              <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:4}}>
                <div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:99,background:C.accent,animation:`pulse ${.8+i*.2}s ${i*.15}s ease-in-out infinite`}}/>)}</div>
                <span style={{fontSize:11,color:C.muted}}>Ava is responding…</span>
              </div>
            )}
          </div>
        )}

        {tab==="info"&&(
          <div className="sc" style={{flex:1,overflowY:"auto",padding:"14px 16px 8px"}}>
            {/* Sent history */}
            {sentMsgs.length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:600,color:C.success,letterSpacing:".07em",marginBottom:8}}>SENT THIS CALL</div>
                {sentMsgs.map((m,i)=>(
                  <div key={i} style={{background:`${C.success}0E`,border:`1px solid ${C.success}22`,borderRadius:ios?12:8,padding:"9px 12px",marginBottom:6,animation:"sentPop .3s ease both"}}>
                    <div style={{fontSize:12,color:C.success,lineHeight:1.55,marginBottom:3}}>{m.text}</div>
                    <div style={{fontSize:10,color:C.muted}}>Delivered {m.ts}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick replies */}
            <div style={{fontSize:10,fontWeight:600,color:C.muted,letterSpacing:".07em",marginBottom:10}}>QUICK SEND TO CALLER</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {QUICK_REPLIES.map((q,i)=>(
                <button key={i} onClick={()=>sendInfo(q.t)} disabled={sending} className="bp"
                  style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?14:10,padding:"11px 14px",textAlign:"left",cursor:sending?"not-allowed":"pointer",opacity:sending?.6:1,fontFamily:ff}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.accent,marginBottom:3}}>{q.l}</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.4}}>{q.t}</div>
                </button>
              ))}
            </div>

            {/* Custom message */}
            <div style={{fontSize:10,fontWeight:600,color:C.muted,letterSpacing:".07em",marginBottom:8}}>CUSTOM MESSAGE</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input value={custom} onChange={e=>setCustom(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&custom.trim())sendInfo(custom);}}
                placeholder="Type anything to send via SMS…"
                style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?12:8,padding:"11px 13px",color:C.text,fontSize:13,fontFamily:ff,outline:"none"}}/>
              <button onClick={()=>sendInfo(custom)} disabled={!custom.trim()||sending} className="bp"
                style={{width:44,height:44,borderRadius:ios?14:10,background:custom.trim()?C.accent:C.faint,border:"none",cursor:custom.trim()&&!sending?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background .2s"}}>
                {sending
                  ?<div style={{width:14,height:14,border:"2px solid #000",borderTopColor:"transparent",borderRadius:99,animation:"spin .7s linear infinite"}}/>
                  :<svg width="16" height="16" viewBox="0 0 24 24" fill={custom.trim()?"#000":C.muted}><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
                }
              </button>
            </div>
            <div style={{fontSize:11,color:C.muted,marginBottom:20,lineHeight:1.6}}>SMS is sent directly to the caller's number in real time — they receive it as a regular text message while still on the call.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── TEST MY AI PANEL ── */
function TestMyAIPanel({plat,onClose}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [sessionId]=useState(()=>"test-"+Date.now());
  const [bizType,setBizType]=useState("hvac");
  const bottomRef=useRef(null);

  useEffect(()=>{if(bottomRef.current)bottomRef.current.scrollIntoView({behavior:"smooth"});},[msgs]);

  // Start session on mount
  useEffect(()=>{
    const start=async()=>{
      setLoading(true);
      if(api){
        const r=await api.testCall(sessionId,"",bizType);
        if(r&&r.response) setMsgs([{from:"ai",text:r.response}]);
      } else {
        setMsgs([{from:"ai",text:"Thanks for calling Apex HVAC & Mechanical. I'm Ava, your AI receptionist. How can I help you today?"}]);
      }
      setLoading(false);
    };
    start();
    return()=>{if(api)api.endTestCall(sessionId);};
  },[bizType]);

  const send=async()=>{
    const txt=input.trim();if(!txt||loading)return;
    setInput("");
    setMsgs(m=>[...m,{from:"caller",text:txt}]);
    setLoading(true);
    if(api){
      const r=await api.testCall(sessionId,txt,bizType);
      if(r&&r.response) setMsgs(m=>[...m,{from:"ai",text:r.response}]);
      if(r&&r.done) setMsgs(m=>[...m,{from:"system",text:`Call ended. Disposition: ${r.disposition||"unknown"}`}]);
    } else {
      await new Promise(r=>setTimeout(r,500));
      setMsgs(m=>[...m,{from:"ai",text:"I want to make sure I get the right person out to you. Can you describe what's going on?"}]);
    }
    setLoading(false);
  };

  return(
    <div style={{position:"absolute",inset:0,zIndex:100,display:"flex",flexDirection:"column",background:C.bg,animation:"panelUp .38s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <div style={{fontSize:16,fontWeight:ios?600:500,color:C.text,fontFamily:ff}}>🧪 Test My AI</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>Simulated call — no Twilio needed</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={bizType} onChange={e=>{setBizType(e.target.value);setMsgs([]);}}
            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 8px",color:C.text,fontSize:11,fontFamily:ff}}>
            <option value="hvac">HVAC</option>
            <option value="mechanic">Mechanic</option>
          </select>
          <button onClick={onClose} style={{background:`${C.faint}44`,border:"none",borderRadius:99,padding:"4px 12px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:ff}}>✕</button>
        </div>
      </div>
      <div className="sc" style={{flex:1,overflowY:"auto",padding:"14px 16px 8px",display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.from==="ai"?"flex-start":m.from==="system"?"center":"flex-end",animation:"txLine .3s ease both"}}>
            {m.from==="system"?(
              <div style={{background:`${C.success}18`,border:`1px solid ${C.success}33`,borderRadius:10,padding:"8px 14px",fontSize:12,color:C.success,fontWeight:500}}>{m.text}</div>
            ):(
              <>
                <div style={{fontSize:10,color:C.muted,marginBottom:3}}>{m.from==="ai"?"🤖 Ava AI":"👤 You (Caller)"}</div>
                <div style={{maxWidth:"82%",background:m.from==="ai"?`${C.accent}18`:C.surface,border:`1px solid ${m.from==="ai"?C.accent+"33":C.border}`,borderRadius:m.from==="ai"?"4px 14px 14px 14px":"14px 4px 14px 14px",padding:"9px 12px"}}>
                  <span style={{fontSize:13,color:C.text,lineHeight:1.55}}>{m.text}</span>
                </div>
              </>
            )}
          </div>
        ))}
        {loading&&<div style={{display:"flex",gap:3,paddingLeft:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:99,background:C.accent,animation:`pulse ${.8+i*.2}s ${i*.15}s ease-in-out infinite`}}/>)}</div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,background:C.surface,flexShrink:0}}>
        <div style={{display:"flex",gap:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")send();}}
            placeholder="Say something as the caller…"
            style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:ios?20:12,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:ff,outline:"none"}}/>
          <button onClick={send} disabled={!input.trim()||loading} className="bp"
            style={{width:40,height:40,borderRadius:ios?99:12,background:input.trim()&&!loading?C.accent:C.faint,border:"none",cursor:input.trim()&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={input.trim()?"#000":C.muted}><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── CALLBACK QUEUE PANEL ── */
function CallbackQueue({plat}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const DEMO_CALLBACKS=[
    {id:"cb1",caller_name:"Luis Fontaine",caller_phone:"+1 (910) 555-2290",reason:"Call dropped before AI answered",urgency:"normal",status:"pending",created_at:"Today 9:45 AM"},
    {id:"cb2",caller_name:"Ray Burnett",caller_phone:"+1 (828) 555-3301",reason:"Needs price estimate for compressor replacement",urgency:"high",status:"pending",created_at:"Today 2:34 PM"},
  ];
  const [callbacks,setCallbacks]=useState(DEMO_CALLBACKS);

  useEffect(()=>{
    if(!api) return;
    api.getCallbacks("demo-biz-1","pending").then(d=>{
      if(d&&d.length) setCallbacks(d);
    });
  },[]);

  const dismiss=(id)=>setCallbacks(c=>c.filter(x=>x.id!==id));
  const urgColor={high:C.danger,normal:C.warn,low:C.muted};
  const br=ios?14:10;

  if(callbacks.length===0) return null;
  return(
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:600,color:C.warn,letterSpacing:".06em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
        <span>📋</span> CALL ME BACK QUEUE
        <span style={{background:`${C.warn}22`,color:C.warn,fontSize:10,padding:"1px 6px",borderRadius:99,fontWeight:700}}>{callbacks.length}</span>
      </div>
      {callbacks.map(cb=>(
        <div key={cb.id} style={{background:C.surface,border:`1px solid ${urgColor[cb.urgency]||C.border}44`,borderRadius:br,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:14,fontWeight:500,color:C.text}}>{cb.caller_name||"Unknown"}</div>
            <span style={{fontSize:10,fontWeight:600,color:urgColor[cb.urgency]||C.muted,background:`${urgColor[cb.urgency]||C.muted}1A`,padding:"2px 7px",borderRadius:99}}>{cb.urgency}</span>
          </div>
          <div style={{fontSize:12,color:C.muted,marginBottom:4}}>{cb.caller_phone}</div>
          {cb.reason&&<div style={{fontSize:12,color:C.muted,marginBottom:8,lineHeight:1.4}}>{cb.reason}</div>}
          <div style={{display:"flex",gap:8}}>
            <a href={`tel:${(cb.caller_phone||"").replace(/\D/g,"")}`}
              style={{flex:1,padding:"8px",background:`${C.success}18`,border:`1px solid ${C.success}44`,borderRadius:br,color:C.success,fontSize:12,fontWeight:600,textAlign:"center",textDecoration:"none",cursor:"pointer"}}>
              📞 Call Back
            </a>
            <button onClick={()=>dismiss(cb.id)} className="bp"
              style={{padding:"8px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:br,color:C.muted,fontSize:12,cursor:"pointer",fontFamily:ff}}>
              ✓ Done
            </button>
          </div>
          <div style={{fontSize:10,color:C.faint,marginTop:6}}>{cb.created_at}</div>
        </div>
      ))}
    </div>
  );
}

/* ── SCRIPT WIZARD PANEL ── */
function ScriptWizardPanel({plat,onClose}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const br=ios?14:10;
  const [step,setStep]=useState(0);
  const [greeting,setGreeting]=useState("Thanks for calling {{business_name}}. I'm Ava, your AI receptionist. How can I help you today?");
  const [questions,setQuestions]=useState(["Can you describe what's happening?","How long has this been going on?"]);
  const [triggers,setTriggers]=useState(["speak to someone","talk to the owner","this is urgent"]);
  const [smsConfirm,setSmsConfirm]=useState("✅ Confirmed! {{service}} on {{date}} at {{time}}. {{business_name}}. Reply CANCEL to cancel.");
  const [smsMissed,setSmsMissed]=useState("📞 Missed call from {{caller_number}} at {{time}}. Reply to follow up.");
  const [saved,setSaved]=useState(false);

  const inputStyle={width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?12:8,padding:"11px 14px",color:C.text,fontSize:13,fontFamily:ff,outline:"none"};

  const save=async()=>{
    const scripts={
      greeting,
      triage_questions:{general:questions.filter(q=>q.trim())},
      escalation_triggers:triggers.filter(t=>t.trim()),
      sms_templates:{booking_confirm:smsConfirm,missed_call:smsMissed},
    };
    if(api) await api.updateScripts("demo-biz-1",scripts);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const addQ=()=>setQuestions(q=>[...q,""]);
  const updateQ=(i,v)=>setQuestions(q=>q.map((x,j)=>j===i?v:x));
  const removeQ=(i)=>setQuestions(q=>q.filter((_,j)=>j!==i));
  const addT=()=>setTriggers(t=>[...t,""]);
  const updateT=(i,v)=>setTriggers(t=>t.map((x,j)=>j===i?v:x));
  const removeT=(i)=>setTriggers(t=>t.filter((_,j)=>j!==i));

  const steps=[
    {title:"Greeting",desc:"What Ava says when answering the phone"},
    {title:"Triage Questions",desc:"Questions to understand the caller's needs"},
    {title:"Escalation Triggers",desc:"Phrases that trigger owner callback"},
    {title:"SMS Templates",desc:"Auto-sent text messages"},
  ];

  return(
    <div style={{position:"absolute",inset:0,zIndex:100,display:"flex",flexDirection:"column",background:C.bg,animation:"panelUp .38s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:16,fontWeight:ios?600:500,color:C.text,fontFamily:ff}}>📝 Script Wizard</div>
          <button onClick={onClose} style={{background:`${C.faint}44`,border:"none",borderRadius:99,padding:"4px 12px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:ff}}>✕</button>
        </div>
        <div style={{fontSize:12,color:C.muted}}>Step {step+1} of {steps.length} · {steps[step].title}</div>
        <div style={{marginTop:8,height:3,background:C.border,borderRadius:99}}>
          <div style={{width:`${((step+1)/steps.length)*100}%`,height:"100%",background:C.accent,borderRadius:99,transition:"width .4s ease"}}/>
        </div>
      </div>
      <div className="sc" style={{flex:1,overflowY:"auto",padding:"14px 16px 24px"}}>
        <div style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.5}}>{steps[step].desc}</div>

        {step===0&&(
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:8}}>GREETING MESSAGE</div>
            <textarea value={greeting} onChange={e=>setGreeting(e.target.value)} rows={4}
              style={{...inputStyle,resize:"none"}}/>
            <div style={{fontSize:11,color:C.faint,marginTop:8,lineHeight:1.5}}>
              Variables: {"{{business_name}}"} — auto-replaced with your business name
            </div>
          </div>
        )}

        {step===1&&(
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:8}}>TRIAGE QUESTIONS</div>
            {questions.map((q,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                <span style={{fontSize:12,color:C.muted,flexShrink:0,width:20}}>{i+1}.</span>
                <input value={q} onChange={e=>updateQ(i,e.target.value)} placeholder="Enter question…" style={{...inputStyle,flex:1}}/>
                {questions.length>1&&<button onClick={()=>removeQ(i)} style={{background:"none",border:"none",color:C.danger,fontSize:16,cursor:"pointer",flexShrink:0}}>×</button>}
              </div>
            ))}
            <button onClick={addQ} className="bp"
              style={{padding:"8px 14px",background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:br,color:C.accent,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:ff}}>
              + Add Question
            </button>
          </div>
        )}

        {step===2&&(
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:8}}>ESCALATION TRIGGERS</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:10,lineHeight:1.5}}>When a caller says any of these, Ava will escalate to you immediately.</div>
            {triggers.map((t,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                <input value={t} onChange={e=>updateT(i,e.target.value)} placeholder="e.g. speak to the owner" style={{...inputStyle,flex:1}}/>
                {triggers.length>1&&<button onClick={()=>removeT(i)} style={{background:"none",border:"none",color:C.danger,fontSize:16,cursor:"pointer",flexShrink:0}}>×</button>}
              </div>
            ))}
            <button onClick={addT} className="bp"
              style={{padding:"8px 14px",background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:br,color:C.accent,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:ff}}>
              + Add Trigger
            </button>
          </div>
        )}

        {step===3&&(
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:8}}>BOOKING CONFIRMATION SMS</div>
            <textarea value={smsConfirm} onChange={e=>setSmsConfirm(e.target.value)} rows={3}
              style={{...inputStyle,resize:"none",marginBottom:14}}/>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:8}}>MISSED CALL FOLLOW-UP SMS</div>
            <textarea value={smsMissed} onChange={e=>setSmsMissed(e.target.value)} rows={3}
              style={{...inputStyle,resize:"none"}}/>
            <div style={{fontSize:11,color:C.faint,marginTop:8,lineHeight:1.5}}>
              Variables: {"{{service}}"}, {"{{date}}"}, {"{{time}}"}, {"{{business_name}}"}, {"{{caller_number}}"}
            </div>
          </div>
        )}
      </div>
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.surface,flexShrink:0,display:"flex",gap:8}}>
        {step>0&&(
          <button onClick={()=>setStep(s=>s-1)} className="bp"
            style={{padding:"12px 20px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:br,color:C.muted,fontSize:13,cursor:"pointer",fontFamily:ff}}>
            ← Back
          </button>
        )}
        {step<steps.length-1?(
          <button onClick={()=>setStep(s=>s+1)} className="bp"
            style={{flex:1,padding:"12px",background:C.accent,border:"none",borderRadius:br,color:"#000",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:ff}}>
            Next →
          </button>
        ):(
          <button onClick={save} className="bp"
            style={{flex:1,padding:"12px",background:saved?C.success:C.accent,border:"none",borderRadius:br,color:"#000",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:ff,transition:"background .3s"}}>
            {saved?"✓ Saved!":"Save Scripts"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── HOME ── */
function HomeScreen({plat,triggerNotif}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const [live,setLive]=useState(null);
  const [panelOpen,setPanelOpen]=useState(false);
  const [liveTranscript,setLiveTranscript]=useState([]);
  const [testAIOpen,setTestAIOpen]=useState(false);

  /* ── live stats & calls from API (fallback to mock) ── */
  const [stats,setStats]=useState(STATS);
  const [recentCalls,setRecentCalls]=useState(CALLS.slice(0,3));

  useEffect(()=>{
    if(!api) return;
    api.getStats().then(d=>{
      if(!d) return;
      setStats([
        {l:"Calls This Week",v:String(d.callsThisWeek),d:"live"},
        {l:"AI Handled",v:d.aiHandledPct+"%",d:"live"},
        {l:"Appts Booked",v:String(d.bookingsThisWeek),d:"live"},
        {l:"Active Calls",v:String(d.activeCalls),d:"now"},
      ]);
    });
    api.getCallLog(3).then(d=>{
      if(!d||!d.length) return;
      setRecentCalls(d.map((c,i)=>({id:c.callSid||i,caller:c.from||"Unknown",num:c.from||"",t:c.startedAt||"",dur:"",s:c.outcome||"handled",ai:true,sum:c.outcome||""})));
    });
  },[]);

  /* ── WebSocket for live calls ── */
  useEffect(()=>{
    if(!connectCallSocket) {
      // offline mock: simulate a live call
      const t=setTimeout(()=>setLive({caller:"David Kim",s:0}),2400);
      return()=>clearTimeout(t);
    }
    const close=connectCallSocket({
      onSnapshot(d){
        if(d.activeCalls&&d.activeCalls.length){
          const c=d.activeCalls[0];
          setLive({caller:c.from||"Incoming",s:0,callSid:c.callSid});
          setLiveTranscript(c.transcript||[]);
        }
      },
      onCallStart(d){
        setLive({caller:d.from||"Incoming",s:0,callSid:d.callSid});
        setLiveTranscript([]);
      },
      onTranscript(d){
        setLiveTranscript(prev=>[...prev,d.turn]);
      },
      onCallEnd(){
        setLive(null);
        setLiveTranscript([]);
      },
    });
    return close;
  },[]);

  useEffect(()=>{if(!live)return;const t=setInterval(()=>setLive(c=>c?{...c,s:c.s+1}:null),1000);return()=>clearInterval(t);},[!!live]);
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const br=ios?16:10;

  return(
    <div className="sc" style={{height:"100%",overflowY:"auto",padding:"6px 16px 24px",color:C.text,fontFamily:ff,animation:"slideUp .28s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{padding:"14px 0 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:13,color:C.muted,marginBottom:2}}>Good afternoon</div>
          <div style={{fontSize:20,fontWeight:ios?600:500,letterSpacing:ios?"-.3px":"0"}}>Apex Dental Care</div>
        </div>
        <div style={{width:40,height:40,borderRadius:ios?14:20,background:`${C.accent}18`,border:`1px solid ${C.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19}}>🦷</div>
      </div>

      {/* Live call card OR idle card */}
      {live?(
        <div className="ch" onClick={()=>setPanelOpen(true)}
          style={{background:`${C.danger}10`,border:`1px solid ${C.danger}55`,borderRadius:ios?18:12,padding:"14px 16px",marginBottom:14,position:"relative",overflow:"hidden"}}>
          {/* Subtle animated border glow */}
          <div style={{position:"absolute",inset:0,borderRadius:ios?18:12,background:`linear-gradient(135deg,${C.danger}0A,transparent)`,pointerEvents:"none"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:8,height:8,borderRadius:99,background:C.danger,animation:"blink 1s ease-in-out infinite"}}/>
              <span style={{fontSize:11,fontWeight:600,color:C.danger,letterSpacing:".07em"}}>LIVE CALL</span>
            </div>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:C.danger}}>{fmt(live.s)}</span>
          </div>
          <div style={{fontSize:15,fontWeight:600,marginBottom:8,color:C.text}}>{live.caller}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:12,color:C.muted}}>AI receptionist is handling</span>
            <Wave on={true}/>
          </div>
          {/* Owner action buttons inline */}
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1,padding:"9px 0",background:`${C.warn}18`,border:`1px solid ${C.warn}44`,borderRadius:ios?12:8,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={C.warn}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>
              <span style={{fontSize:12,fontWeight:600,color:C.warn}}>Listen In</span>
            </div>
            <div style={{flex:1,padding:"9px 0",background:`${C.success}18`,border:`1px solid ${C.success}44`,borderRadius:ios?12:8,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <span style={{fontSize:12,fontWeight:600,color:C.success}}>🎤 Take Over</span>
            </div>
            <div style={{padding:"9px 12px",background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:ios?12:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:12,fontWeight:600,color:C.accent}}>📨</span>
            </div>
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center"}}>Tap to open call controls →</div>
        </div>
      ):(
        <div style={{background:C.surface,border:`1px solid ${C.accent}33`,borderRadius:ios?18:12,padding:"14px 16px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:8,height:8,borderRadius:99,background:C.success,animation:"pulse 2s ease-in-out infinite"}}/>
              <span style={{fontSize:11,fontWeight:600,color:C.success,letterSpacing:".07em"}}>AI ONLINE</span>
            </div>
            <span style={{fontSize:11,color:C.muted}}>+1 (828) 555-0100</span>
          </div>
          <div style={{fontSize:13,color:C.muted,marginBottom:10}}>Answering calls 24 / 7</div>
          <Wave on={false}/>
        </div>
      )}

      {/* Live call panel overlay */}
      {panelOpen&&live&&(
        <LiveCallPanel plat={plat} live={{...live,fmt:fmt(live.s)}} liveTranscript={liveTranscript} onClose={()=>setPanelOpen(false)}/>
      )}
      {testAIOpen&&(
        <TestMyAIPanel plat={plat} onClose={()=>setTestAIOpen(false)}/>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {stats.map((s,i)=>(
          <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:br,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:5}}>{s.l}</div>
            <div style={{fontSize:19,fontWeight:600,letterSpacing:"-.5px",marginBottom:3}}>{s.v}</div>
            <div style={{fontSize:11,color:C.success}}>{s.d} this week</div>
          </div>
        ))}
      </div>

      {/* ⭐ Call Me Back Queue */}
      <CallbackQueue plat={plat}/>

      <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:10}}>RECENT CALLS</div>
      {recentCalls.map(c=>(
        <div key={c.id} className="ch" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:br,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0,paddingRight:8}}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:2}}>{c.caller}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:5}}>{c.t} · {c.dur}</div>
            <div style={{fontSize:12,color:C.muted,lineHeight:1.4}}>{c.sum}</div>
          </div>
          <Badge s={c.s}/>
        </div>
      ))}

      {/* ⭐ Test My AI Button */}
      <button onClick={()=>setTestAIOpen(true)} className="bp"
        style={{width:"100%",marginTop:6,padding:"13px",background:`${C.accent}14`,border:`1px solid ${C.accent}33`,borderRadius:ios?16:10,color:C.accent,fontSize:14,fontWeight:ios?600:500,fontFamily:ff,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <span>🧪</span> Test My AI
      </button>

      <button onClick={triggerNotif} className="bp"
        style={{width:"100%",marginTop:6,padding:"13px",background:`${C.success}14`,border:`1px solid ${C.success}33`,borderRadius:ios?16:10,color:C.success,fontSize:14,fontWeight:ios?600:500,fontFamily:ff,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <span>💬</span> Simulate SMS Notification
      </button>
    </div>
  );
}

/* ── CALLS ── */
function CallsScreen({plat}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const [open,setOpen]=useState(null);
  const [fil,setFil]=useState("All");
  const [calls,setCalls]=useState(CALLS);

  /* Fetch call log from API when available */
  useEffect(()=>{
    if(!api) return;
    api.getCallLog(50).then(d=>{
      if(!d||!d.length) return;
      setCalls(d.map((c,i)=>({
        id:c.callSid||i,
        caller:c.from||"Unknown",
        num:c.from||"",
        t:c.startedAt?new Date(c.startedAt).toLocaleString():"",
        dur:c.endedAt?Math.round((new Date(c.endedAt)-new Date(c.startedAt))/1000)+"s":"",
        s:c.outcome||"handled",
        ai:c.outcome!=="transferred",
        sum:c.outcome||"",
        tx:(c.transcript||[]).map(t=>`[${t.role==="assistant"?"AI":"Caller"}: ${t.text}]`).join("\n"),
      })));
    });
  },[]);

  const filtered=calls.filter(c=>fil==="All"||(fil==="AI"&&c.ai)||(fil==="Booked"&&c.s==="booked")||(fil==="Missed"&&c.s==="missed"));
  return(
    <div style={{height:"100%",color:C.text,fontFamily:ff,display:"flex",flexDirection:"column",animation:"slideUp .28s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{fontSize:18,fontWeight:ios?600:500,marginBottom:10}}>Call History</div>
        <div style={{display:"flex",gap:6}}>
          {["All","AI","Booked","Missed"].map(f=>(
            <button key={f} onClick={()=>setFil(f)} style={{fontSize:12,fontWeight:ios?500:400,padding:"5px 13px",borderRadius:ios?99:8,border:`1px solid ${f===fil?C.accent:C.border}`,background:f===fil?`${C.accent}18`:"transparent",color:f===fil?C.accent:C.muted,cursor:"pointer",fontFamily:ff}}>{f}</button>
          ))}
        </div>
      </div>
      <div className="sc" style={{flex:1,padding:"8px 16px 24px",overflowY:"auto"}}>
        {filtered.map(c=>(
          <div key={c.id}>
            <div className="ch" onClick={()=>setOpen(open===c.id?null:c.id)}
              style={{background:open===c.id?`${C.accent}08`:C.surface,border:`1px solid ${open===c.id?C.accent+"33":C.border}`,borderRadius:ios?14:10,padding:"13px 14px",marginBottom:8,transition:"background .2s,border .2s"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:ios?99:10,background:`${C.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:C.accent,flexShrink:0}}>
                    {c.caller==="Unknown"?"?":c.caller.split(" ").map(x=>x[0]).join("").slice(0,2)}
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:500}}>{c.caller}</div>
                    <div style={{fontSize:11,color:C.muted}}>{c.num}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <Badge s={c.s}/>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>{c.dur}</div>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.muted}}>{c.t}</span>
                {c.ai&&<span style={{fontSize:10,color:C.accent,background:C.accentDim,padding:"2px 7px",borderRadius:99,fontWeight:600}}>AI</span>}
              </div>
            </div>
            {open===c.id&&(
              <div style={{background:`${C.accent}06`,border:`1px solid ${C.accent}1A`,borderRadius:ios?12:8,padding:"12px 14px",marginBottom:8,marginTop:-4,animation:"fadeIn .2s ease"}}>
                <div style={{fontSize:10,fontWeight:600,color:C.accent,marginBottom:8,letterSpacing:".07em"}}>TRANSCRIPT</div>
                <pre style={{fontSize:12,color:C.muted,lineHeight:1.8,fontFamily:"'DM Mono',monospace",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{c.tx}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── BOOK ── */
function BookScreen({plat,onBooked}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const [step,setStep]=useState(0);
  const [svc,setSvc]=useState(null);
  const [day,setDay]=useState(null);
  const [time,setTime]=useState(null);
  const [name,setName]=useState("");
  const [ph,setPh]=useState("");
  const [note,setNote]=useState("");
  const [loading,setLoading]=useState(false);
  const br=ios?16:10;

  const progress=["33%","66%","100%","100%"][step]||"0%";

  const confirm=()=>{
    setLoading(true);
    if(api && ph){
      api.createBooking({
        service: svc?.name||"Appointment",
        date: day?.dt||"",
        time: time||"",
        customerName: name||"Customer",
        customerPhone: ph,
      }).then(()=>{
        setLoading(false);setStep(3);onBooked({svc,day,time,name});
      }).catch(()=>{
        // Fall back to offline behavior on error
        setTimeout(()=>{setLoading(false);setStep(3);onBooked({svc,day,time,name});},500);
      });
    } else {
      setTimeout(()=>{setLoading(false);setStep(3);onBooked({svc,day,time,name});},1900);
    }
  };
  const reset=()=>{setStep(0);setSvc(null);setDay(null);setTime(null);setName("");setPh("");setNote("");};

  const ProgressBar=({pct})=>(
    <div style={{marginTop:10,height:3,background:C.border,borderRadius:99}}>
      <div style={{width:pct,height:"100%",background:C.accent,borderRadius:99,transition:"width .4s ease"}}/>
    </div>
  );

  const inputStyle={width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?12:8,padding:"11px 14px",color:C.text,fontSize:14,fontFamily:ff,outline:"none"};

  if(step===0) return(
    <div style={{height:"100%",color:C.text,fontFamily:ff,display:"flex",flexDirection:"column",animation:"slideUp .28s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{fontSize:18,fontWeight:ios?600:500}}>Book Appointment</div>
        <div style={{fontSize:13,color:C.muted,marginTop:3}}>Step 1 of 3 · Choose a service</div>
        <ProgressBar pct="33%"/>
      </div>
      <div className="sc" style={{flex:1,padding:"12px 16px 24px",overflowY:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,alignContent:"start"}}>
        {SERVICES.map(s=>(
          <div key={s.id} className="ch" onClick={()=>{setSvc(s);setStep(1);}}
            style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:br+2,padding:"14px 12px"}}>
            <div style={{fontSize:24,marginBottom:8}}>{s.icon}</div>
            <div style={{fontSize:13,fontWeight:ios?600:500,marginBottom:3,lineHeight:1.3}}>{s.name}</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>{s.desc}</div>
            <span style={{fontSize:10,color:C.accent,background:C.accentDim,padding:"2px 8px",borderRadius:99,fontWeight:600}}>{s.dur}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if(step===1) return(
    <div style={{height:"100%",color:C.text,fontFamily:ff,display:"flex",flexDirection:"column",animation:"slideUp .28s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <button onClick={()=>setStep(0)} style={{background:"none",border:"none",color:C.accent,fontSize:13,cursor:"pointer",fontFamily:ff,padding:0,marginBottom:6}}>← Back</button>
        <div style={{fontSize:18,fontWeight:ios?600:500}}>{svc?.icon} {svc?.name}</div>
        <div style={{fontSize:13,color:C.muted,marginTop:3}}>Step 2 of 3 · Pick a date & time</div>
        <ProgressBar pct="66%"/>
      </div>
      <div className="sc" style={{flex:1,padding:"12px 16px 24px",overflowY:"auto"}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:10}}>AVAILABLE DAYS</div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,marginBottom:16}}>
          {DAYS.map(d=>{
            const sel=day?.dt===d.dt;
            return(
              <button key={d.dt} onClick={()=>{setDay(d);setTime(null);}}
                style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",padding:"9px 12px",borderRadius:ios?14:10,border:`1.5px solid ${sel?C.accent:C.border}`,background:sel?`${C.accent}18`:"transparent",cursor:"pointer",minWidth:54,fontFamily:ff}}>
                <span style={{fontSize:10,color:sel?C.accent:C.muted,fontWeight:600,letterSpacing:".04em"}}>{d.d}</span>
                <span style={{fontSize:19,fontWeight:600,color:sel?C.accent:C.text,lineHeight:1.3}}>{d.dt.split(" ")[1]}</span>
                <span style={{fontSize:9,color:sel?C.accent:C.muted}}>{d.dt.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
        {day&&(
          <>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:10}}>TIME SLOTS · {day.dt}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
              {TIMES.map(t=>{
                const busy=BUSY.includes(t);
                const sel=time===t;
                return(
                  <button key={t} disabled={busy} onClick={()=>setTime(t)}
                    style={{padding:"9px 4px",borderRadius:ios?12:8,border:`1.5px solid ${sel?C.accent:busy?C.faint:C.border}`,background:sel?`${C.accent}22`:busy?C.surface:"transparent",color:sel?C.accent:busy?C.faint:C.text,fontSize:12,fontWeight:sel?600:400,cursor:busy?"not-allowed":"pointer",fontFamily:ff,textDecoration:busy?"line-through":"none",opacity:busy?.45:1,transition:"all .15s"}}>
                    {t}
                  </button>
                );
              })}
            </div>
            <div style={{display:"flex",gap:14,marginBottom:16}}>
              {[{bg:`${C.accent}22`,b:C.accent,l:"Selected"},{bg:C.surface,b:C.faint,l:"Unavailable",o:.45}].map(({bg,b,l,o})=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:10,height:10,borderRadius:3,background:bg,border:`1.5px solid ${b}`,opacity:o||1}}/>
                  <span style={{fontSize:11,color:C.muted}}>{l}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {time&&(
          <button onClick={()=>setStep(2)} className="bp"
            style={{width:"100%",padding:14,background:C.accent,border:"none",borderRadius:ios?16:10,color:"#000",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:ff}}>
            Continue →
          </button>
        )}
      </div>
    </div>
  );

  if(step===2) return(
    <div style={{height:"100%",color:C.text,fontFamily:ff,display:"flex",flexDirection:"column",animation:"slideUp .28s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <button onClick={()=>setStep(1)} style={{background:"none",border:"none",color:C.accent,fontSize:13,cursor:"pointer",fontFamily:ff,padding:0,marginBottom:6}}>← Back</button>
        <div style={{fontSize:18,fontWeight:ios?600:500}}>Confirm Details</div>
        <div style={{fontSize:13,color:C.muted,marginTop:3}}>Step 3 of 3 · Review & book</div>
        <ProgressBar pct="100%"/>
      </div>
      <div className="sc" style={{flex:1,padding:"12px 16px 24px",overflowY:"auto"}}>
        <div style={{background:`${C.accent}0A`,border:`1px solid ${C.accent}22`,borderRadius:ios?16:10,padding:"14px 16px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:44,height:44,borderRadius:ios?12:8,background:`${C.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{svc?.icon}</div>
          <div>
            <div style={{fontSize:15,fontWeight:600,marginBottom:3}}>{svc?.name}</div>
            <div style={{fontSize:13,color:C.accent}}>{day?.dt} {day?.d} · {time}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{svc?.dur}</div>
          </div>
        </div>

        <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:10}}>YOUR DETAILS</div>
        {[{l:"Full Name",v:name,fn:setName,ph:"e.g. Jordan Smith",t:"text"},{l:"Mobile Number",v:ph,fn:setPh,ph:"e.g. +1 (828) 555-0000",t:"tel"}].map(f=>(
          <div key={f.l} style={{marginBottom:12}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:5}}>{f.l}</div>
            <input value={f.v} onChange={e=>f.fn(e.target.value)} type={f.t} placeholder={f.ph} style={inputStyle}/>
          </div>
        ))}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:5}}>Notes (optional)</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Any special requests or medical notes..." rows={3} style={{...inputStyle,resize:"none"}}/>
        </div>

        <div style={{background:C.successDim,border:`1px solid ${C.success}33`,borderRadius:ios?12:8,padding:"10px 12px",marginBottom:14,display:"flex",gap:8,alignItems:"flex-start"}}>
          <span style={{fontSize:14,flexShrink:0}}>💬</span>
          <span style={{fontSize:12,color:C.success,lineHeight:1.5}}>SMS confirmation will be sent to {ph||"your number"} after booking. You can reply CANCEL to cancel at any time.</span>
        </div>

        <button onClick={confirm} disabled={!name||!ph||loading} className="bp"
          style={{width:"100%",padding:14,background:!name||!ph?C.faint:C.accent,border:"none",borderRadius:ios?16:10,color:!name||!ph?"#555":"#000",fontSize:15,fontWeight:700,cursor:!name||!ph?"not-allowed":"pointer",fontFamily:ff,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"background .2s"}}>
          {loading?<><div style={{width:17,height:17,border:"2px solid #000",borderTopColor:"transparent",borderRadius:99,animation:"spin .7s linear infinite"}}/>Booking...</>:"Confirm Booking"}
        </button>
      </div>
    </div>
  );

  /* Step 3 — Success */
  return(
    <div style={{height:"100%",color:C.text,fontFamily:ff,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 20px 56px",textAlign:"center",animation:"slideUp .28s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{width:78,height:78,borderRadius:99,background:C.successDim,border:`2px solid ${C.success}44`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18,animation:"popIn .5s cubic-bezier(.22,1,.36,1) both"}}>
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <path d="M7 17l7 7 13-13" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" strokeDashoffset="0" style={{animation:"checkDraw .5s .25s ease both"}}/>
        </svg>
      </div>
      <div style={{fontSize:22,fontWeight:ios?700:500,marginBottom:5,animation:"slideUp .4s .2s both"}}>Appointment Booked!</div>
      <div style={{fontSize:14,color:C.muted,marginBottom:3,animation:"slideUp .4s .3s both"}}>{svc?.name}</div>
      <div style={{fontSize:14,color:C.accent,marginBottom:18,animation:"slideUp .4s .35s both"}}>{day?.dt} {day?.d} · {time}</div>

      {/* SMS bubble */}
      <div style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?18:12,padding:"14px",marginBottom:18,animation:"smsIn .5s .55s cubic-bezier(.22,1,.36,1) both"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:32,height:32,borderRadius:ios?10:16,background:`${C.success}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💬</div>
          <div>
            <div style={{fontSize:12,fontWeight:600}}>Apex Dental Care</div>
            <div style={{fontSize:10,color:C.muted}}>SMS · Just now</div>
          </div>
        </div>
        <div style={{background:`${C.success}12`,border:`1px solid ${C.success}22`,borderRadius:12,padding:"10px 12px",textAlign:"left"}}>
          <p style={{fontSize:12,color:C.success,lineHeight:1.7,margin:0}}>
            ✅ Confirmed! {svc?.name} on {day?.dt} at {time}.<br/>
            Apex Dental — 204 Oak Ave, Boone NC 28607.<br/>
            Reply CANCEL to cancel or HELP for info.<br/>
            See you soon{name?`, ${name}`:""}!
          </p>
        </div>
      </div>

      <div style={{display:"flex",gap:10,width:"100%",animation:"slideUp .4s .7s both"}}>
        <button onClick={()=>setStep(0)} className="bp"
          style={{flex:1,padding:"12px",background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:ios?14:10,color:C.accent,fontSize:13,fontWeight:ios?600:500,cursor:"pointer",fontFamily:ff}}>
          Book Another
        </button>
        <button onClick={reset} className="bp"
          style={{flex:1,padding:"12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?14:10,color:C.muted,fontSize:13,cursor:"pointer",fontFamily:ff}}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ── ACCOUNT ── */
function AccountScreen({plat}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const [n,setN]=useState({smsBook:true,smsCancel:true,smsRemind:true,emailWeek:false,aiSum:true});
  const [wizardOpen,setWizardOpen]=useState(false);
  const T=({k})=>(
    <div onClick={()=>setN(x=>({...x,[k]:!x[k]}))} style={{width:44,height:26,borderRadius:99,background:n[k]?C.accent:C.faint,cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:n[k]?21:3,width:20,height:20,borderRadius:99,background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.4)"}}/>
    </div>
  );
  const Sec=({title,ch})=>(<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".07em",marginBottom:8,paddingLeft:2}}>{title}</div><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?16:10,overflow:"hidden"}}>{ch}</div></div>);
  const Row=({l,sub,r,last})=>(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",borderBottom:last?"none":`1px solid ${C.border}`}}><div><div style={{fontSize:14,color:C.text}}>{l}</div>{sub&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{sub}</div>}</div>{r}</div>);
  return(
    <div style={{height:"100%",color:C.text,fontFamily:ff,display:"flex",flexDirection:"column",animation:"slideUp .28s cubic-bezier(.22,1,.36,1) both"}}>
      <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}><div style={{fontSize:18,fontWeight:ios?600:500}}>Account</div></div>
      <div className="sc" style={{flex:1,padding:"14px 16px 32px",overflowY:"auto"}}>
        <div style={{background:C.surface,border:`1px solid ${C.accent}2A`,borderRadius:ios?18:12,padding:16,marginBottom:14,display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:52,height:52,borderRadius:ios?16:26,background:`${C.accent}18`,border:`1px solid ${C.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🦷</div>
          <div>
            <div style={{fontSize:16,fontWeight:ios?600:500,marginBottom:2}}>Apex Dental Care</div>
            <div style={{fontSize:13,color:C.muted}}>Boone, NC · Est. 2019</div>
            <div style={{fontSize:12,color:C.accent,marginTop:4}}>Pro Plan · Renews May 1</div>
          </div>
        </div>

        {/* ⭐ Script Wizard Button */}
        <button onClick={()=>setWizardOpen(true)} className="bp"
          style={{width:"100%",marginBottom:14,padding:"13px",background:`${C.accent}14`,border:`1px solid ${C.accent}33`,borderRadius:ios?16:10,color:C.accent,fontSize:14,fontWeight:ios?600:500,fontFamily:ff,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span>📝</span> Script Wizard
        </button>

        <Sec title="AI RECEPTIONIST" ch={<>
          <Row l="Phone Number" r={<span style={{fontSize:13,color:C.muted}}>+1 (828) 555-0100</span>}/>
          <Row l="AI Voice" r={<span style={{fontSize:13,color:C.muted}}>Ava (Neural)</span>}/>
          <Row l="Timezone" r={<span style={{fontSize:13,color:C.muted}}>America/New_York</span>}/>
          <Row l="Answering Hours" r={<span style={{fontSize:13,color:C.muted}}>24 / 7</span>} last/>
        </>}/>
        <Sec title="NOTIFICATIONS" ch={<>
          <Row l="Appointment booked" sub="SMS when AI confirms" r={<T k="smsBook"/>}/>
          <Row l="Appointment cancelled" sub="SMS on cancellation" r={<T k="smsCancel"/>}/>
          <Row l="24-hour reminder" sub="SMS day before" r={<T k="smsRemind"/>}/>
          <Row l="AI call summary" sub="After every call" r={<T k="aiSum"/>}/>
          <Row l="Weekly email report" sub="Every Monday 8 AM" r={<T k="emailWeek"/>} last/>
        </>}/>
        <Sec title="INTEGRATIONS" ch={<>
          <Row l="Google Calendar" r={<span style={{fontSize:12,color:C.success,fontWeight:500}}>Connected ✓</span>}/>
          <Row l="Twilio" r={<span style={{fontSize:12,color:C.success,fontWeight:500}}>Active ✓</span>}/>
          <Row l="Stripe Billing" r={<span style={{fontSize:12,color:C.muted}}>Not connected</span>} last/>
        </>}/>
        <Sec title="ACCOUNT" ch={<>
          <Row l="Owner" sub="owner@apexdental.com" r={null}/>
          <Row l="API Keys" r={<span style={{fontSize:12,color:C.warn}}>Manage →</span>}/>
          <Row l="Data & Privacy" r={<span style={{fontSize:12,color:C.muted}}>→</span>}/>
          <Row l="Sign Out" r={<span style={{fontSize:13,color:C.danger,fontWeight:500}}>Sign out</span>} last/>
        </>}/>
      </div>
      {wizardOpen&&(
        <ScriptWizardPanel plat={plat} onClose={()=>setWizardOpen(false)}/>
      )}
    </div>
  );
}

/* ── Frames ── */
function IOSFrame({children}){
  return(
    <div style={{position:"relative",width:375}}>
      <div style={{background:"#090C14",border:"1.5px solid #1C2840",borderRadius:52,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,.72),0 0 0 .5px #2A3A55,inset 0 0 0 1px #121B2C"}}>
        <IOSBar/>
        <div style={{background:C.bg,height:624,position:"relative",overflow:"hidden"}}>{children}</div>
        <div style={{background:"#08090F",padding:"10px 0 16px",display:"flex",justifyContent:"center"}}>
          <div style={{width:110,height:4,borderRadius:99,background:"#243040"}}/>
        </div>
      </div>
      <div style={{position:"absolute",right:-2,top:95,width:3,height:32,background:"#1C2840",borderRadius:"0 2px 2px 0"}}/>
      <div style={{position:"absolute",left:-2,top:85,width:3,height:22,background:"#1C2840",borderRadius:"2px 0 0 2px"}}/>
      <div style={{position:"absolute",left:-2,top:115,width:3,height:38,background:"#1C2840",borderRadius:"2px 0 0 2px"}}/>
      <div style={{position:"absolute",left:-2,top:162,width:3,height:38,background:"#1C2840",borderRadius:"2px 0 0 2px"}}/>
    </div>
  );
}

function DroidFrame({children}){
  return(
    <div style={{position:"relative",width:375}}>
      <div style={{background:"#07090E",border:"1.5px solid #1B2438",borderRadius:36,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,.72),0 0 0 .5px #2A3A52"}}>
        <div style={{background:"#06080E",height:10,position:"relative"}}>
          <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:90,height:8,background:"#0A0D16",borderRadius:"0 0 8px 8px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:14,height:4,borderRadius:99,background:"#1A2235"}}/>
          </div>
        </div>
        <DroidBar/>
        <div style={{background:C.bg,height:614,position:"relative",overflow:"hidden"}}>{children}</div>
        <div style={{background:"#06080E",padding:"10px 0 14px",display:"flex",justifyContent:"center"}}>
          <div style={{width:110,height:4,borderRadius:99,background:"#1E2A3D"}}/>
        </div>
      </div>
      <div style={{position:"absolute",left:-2,top:80,width:3,height:28,background:"#172030",borderRadius:"2px 0 0 2px"}}/>
      <div style={{position:"absolute",left:-2,top:118,width:3,height:44,background:"#172030",borderRadius:"2px 0 0 2px"}}/>
      <div style={{position:"absolute",left:-2,top:170,width:3,height:44,background:"#172030",borderRadius:"2px 0 0 2px"}}/>
      <div style={{position:"absolute",right:-2,top:110,width:3,height:54,background:"#172030",borderRadius:"0 2px 2px 0"}}/>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AVA — LOCAL AI ENGINE  (zero cost, zero API, zero network)
   Intent classifier → context injector → response generator
   Reads live app data: CALLS, STATS, APPTS
   ════════════════════════════════════════════════════════════ */

/* ── Business context snapshot (reads live mock data) ── */
const BIZ={
  name:"Apex HVAC & Mechanical",
  location:"Boone, NC",
  phone:"+1 (828) 555-0100",
  plan:"Pro · $149/mo",
  hours:"Mon–Fri 8 AM–6 PM · Sat 9 AM–1 PM",
  emergency:true,
  pricing:{diagnostic:85,capacitor:"150–250",brake:"200–400",emergency:125},
};

/* ── Intent definitions: priority order, patterns, handler key ── */
const INTENTS=[
  // Performance / stats
  {k:"performance",  p:[/how.*(ai|performing|doing|work)/i,/this week/i,/stats|metrics|numbers/i,/performance/i]},
  {k:"missed",       p:[/miss|luis|fontaine|didn.t answer|no answer|fallback/i]},
  {k:"calls_summary",p:[/call.*(history|log|recent|last)/i,/recent calls/i,/who called/i]},
  {k:"booked_jobs",  p:[/book|appointment|schedul|job.*(booked|confirmed)/i]},
  // Pricing
  {k:"emergency_price",p:[/emergency.*(rate|price|cost|charge)/i,/after.?hour/i,/charge.*emergency/i]},
  {k:"pricing",       p:[/price|cost|charge|how much|fee|rate/i]},
  // SMS / follow-up
  {k:"sms_draft",    p:[/draft|write|sms|text.*miss|follow.?up|missed.*text/i]},
  // Reviews / growth
  {k:"reviews",      p:[/review|rating|google|5.?star|reputation/i]},
  {k:"growth",       p:[/more (job|customer|lead|call|business)|grow|market|slow season|off.?season|quiet/i]},
  // AI behaviour
  {k:"ai_tone",      p:[/tone|sound|friendl|formal|robot|adjust.*ai|change.*voice/i]},
  {k:"ai_script",    p:[/script|what.*ask|question.*caller|ai.*say|say.*ai/i]},
  {k:"escalate",     p:[/escalat|when.*transfer|hand.?off|jump.*call/i]},
  // Specific callers
  {k:"caller_detail",p:[/marcus|priya|sandra|derek|david|ray/i]},
  // Business ops
  {k:"slow_season",  p:[/slow|off.?season|winter|quiet time|dead.*month/i]},
  {k:"hours",        p:[/hour|open|close|schedule|when.*open/i]},
  // Greetings / small talk
  {k:"greeting",     p:[/^(hey|hi|hello|yo|sup|morning|afternoon|evening)[\s!.,?]*$/i]},
  {k:"thanks",       p:[/^(thanks|thank you|cheers|appreciate|perfect|great|awesome|cool)[\s!.,?]*$/i]},
  {k:"help",         p:[/what can you|help me|what do you know|capabilities|commands/i]},
];

/* ── Classify an utterance → intent key ── */
function classify(txt){
  for(const i of INTENTS){
    if(i.p.some(r=>r.test(txt))) return i.k;
  }
  return "fallback";
}

/* ── Token-replace helper: {{VAR}} in template strings ── */
function tpl(str,vars){
  return str.replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]??k);
}

/* ── Thin "typing" simulator: returns reply after delay ── */
function think(ms=420){ return new Promise(r=>setTimeout(r,ms)); }

/* ── Response bank — pure local data, no network ── */
function respond(intent, txt, history){
  const missed=CALLS.filter(c=>c.s==="missed");
  const booked=CALLS.filter(c=>c.s==="booked");
  const aiHandled=CALLS.filter(c=>c.ai);
  const lastMsg=history.length>1?history[history.length-2]?.content:"";

  const R={
    greeting:[
      "Hey! What's going on with the business today?",
      "Hey, what can I pull up for you?",
      "Good to hear from you. What do you need?",
    ],
    thanks:[
      "Anytime. Anything else you want to dig into?",
      "You got it. Ask me anything.",
      "Happy to help. What's next?",
    ],
    help:[
      `I live inside your CallGuard app, so I work completely offline — no internet needed, no extra costs. I can pull your call stats, flag missed jobs, draft SMS messages, give you pricing guidance for HVAC and mechanic work, and help you tune how the AI handles calls. Just ask in plain English.`,
    ],
    performance:[
      `This week looks solid. You had ${STATS[0].v} calls total, the AI handled ${STATS[1].v} of them without you touching anything, and ${STATS[2].v} jobs got booked. That's a strong handle rate — most shops in your tier sit around 80%. The 47-second drop in average handle time means the AI is getting to the point faster, which callers prefer.`,
    ],
    missed:[
      `Luis Fontaine called yesterday at 9:45 AM. The call lasted just over a minute but the AI didn't get to respond before the line dropped — most likely a bad cell connection on his end or he hung up before the greeting finished. There's no voicemail content to act on. I'd suggest firing him a quick text: "Hey Luis, we saw your call this morning — how can we help?" You'll probably get a callback within the hour.`,
    ],
    calls_summary:[
      `Last six calls: Marcus Webb booked a cleaning for Apr 3, an unknown number asked about hours, Priya Nair rescheduled to Apr 10, Luis Fontaine's call dropped before the AI answered, Sandra Okafor booked a new patient intake for Apr 7, and Derek Hollis cancelled his March 28 slot. Five out of six were handled cleanly. Luis is the only one worth following up on.`,
    ],
    booked_jobs:[
      `You've got ${booked.length} confirmed bookings from recent calls. Marcus Webb is in for Apr 3 at 10 AM, Sandra Okafor Apr 7 at 2 PM, and Priya Nair Apr 10 at 9 AM. All three were booked by the AI on first contact — no callback needed. The AI is converting at about 60% of answered calls, which is above average for trade businesses.`,
    ],
    emergency_price:[
      `Standard emergency rate is $${BIZ.pricing.emergency} for the diagnostic, which applies after hours and weekends. That fee rolls into the job cost if they proceed, so customers don't feel like they're getting double-charged. For HVAC in July, most people pay it without pushback — they've been without AC for three hours and they just want it fixed. Don't discount it.`,
    ],
    pricing:[
      `Quick reference: diagnostics run $${BIZ.pricing.diagnostic} (goes toward the repair), capacitor jobs typically land at $${BIZ.pricing.capacitor} total, brake jobs $${BIZ.pricing.brake} depending on pads vs rotors. Emergency call-out after hours is $${BIZ.pricing.emergency}. The AI will quote these ranges on calls if a customer asks — it's calibrated to give "starting from" numbers so you have room to adjust on-site.`,
    ],
    sms_draft:[
      `Here's a follow-up for missed calls:\n\n"Hey [Name], this is ${BIZ.name} — looks like we missed your call earlier. Give us a ring at ${BIZ.phone} or reply here and we'll get you sorted. We're available ${BIZ.hours}."\n\nKeep it short, no pressure. Response rate on this style is usually 35–50% within two hours.`,
    ],
    reviews:[
      `Best time to ask is right after the job is done and the customer is happy — the tech can hand them their phone and say "if you've got 30 seconds, a Google review helps us a lot." That moment converts at about 40%. For the AI-booked jobs, you can set up an automatic follow-up SMS 2 hours after the appointment slot ends. Something like: "Hope we took great care of you today! If you have a moment: [Google link]." I can draft that message if you want.`,
    ],
    growth:[
      `Three things that move the needle for trade shops without ad spend: Google reviews (even 5 extra in a month bumps local pack ranking noticeably), a referral nudge at invoice time ("know anyone with a similar issue?"), and off-season service reminders to your existing customer list — furnace check-ups in October, AC tune-ups in March. Your AI already captures every caller's number, so that list is building automatically.`,
    ],
    slow_season:[
      `For HVAC in the mountains, late October through February tends to go quiet on cooling calls. That's the window to push heating maintenance — furnace inspections, heat pump checks, filter replacements. Flat-rate $89 tune-up packages are easy for the AI to book and take less than an hour on-site. You're keeping revenue moving and you're already at the customer's house if something needs replacing.`,
    ],
    ai_tone:[
      `The AI currently uses a friendly, professional tone — conversational but efficient. If it's sounding too stiff for your customers, I can dial it toward warmer and more casual. If you're in a market where people expect a more formal shop, I can tighten it up. What's your preference — more like talking to a knowledgeable neighbour, or more like a front-desk professional?`,
    ],
    ai_script:[
      `For HVAC calls the AI asks: what's the issue, is it completely out or just underperforming, and what's the address. For mechanic calls it asks: what's the symptom, roughly when it started, and whether they need a tow or can drive in. It keeps it to two questions max before offering a booking slot — longer interrogations kill conversion. Want me to add or change any of those qualifying questions?`,
    ],
    escalate:[
      `Right now the AI hands off to you when: the caller explicitly asks for the owner, the job sounds like it needs a written estimate over $500, or the caller gets frustrated and repeats themselves twice. Those calls get flagged and you see them as "Needs Callback" in the dashboard. You can also jump in live from the Home screen — tap the red LIVE CALL card and hit "Listen In" or "Take Over."`,
    ],
    caller_detail:[
      ()=>{
        const names={marcus:"Marcus Webb",priya:"Priya Nair",sandra:"Sandra Okafor",derek:"Derek Hollis",david:"David Kim",ray:"Ray Burnett"};
        const match=Object.entries(names).find(([k])=>new RegExp(k,"i").test(txt));
        if(!match) return "I don't see that name in recent calls. Can you give me more context?";
        const name=match[1];
        const call=CALLS.find(c=>c.caller===name);
        if(!call) return `I don't have a recent call record for ${name}.`;
        return `${name} called ${call.t}. The call lasted ${call.dur} and was ${call.ai?"handled by the AI":"not handled by the AI"}. Outcome: ${call.sum} The full transcript is in your Calls tab if you want to review exactly what was said.`;
      },
    ],
    hours:[
      `You're open ${BIZ.hours}. The AI answers calls 24/7 and can book jobs outside those hours for the next available slot. Emergency calls after hours get flagged separately so you can decide whether to respond that night or first thing in the morning.`,
    ],
    fallback:[
      `I'm not sure I caught that exactly. I can help with: your call stats, missed jobs, pricing guidance, SMS drafts, AI behaviour, or growth ideas. What are you trying to figure out?`,
      `Can you give me a bit more context? I work best with specific questions — like "what happened on Luis's call" or "how should I price emergency jobs."`,
      `I didn't quite get that. Try asking about your call performance, a specific caller, pricing, or how to handle a call type and I'll pull up what you need.`,
    ],
  };

  const bank=R[intent]||R.fallback;
  const pick=bank[Math.floor(Math.random()*bank.length)];
  return typeof pick==="function"?pick():pick;
}

/* ── Suggestions (static) ── */
const SUGGESTIONS=[
  "How's my AI performing this week?",
  "Why did we miss Luis Fontaine's call?",
  "What should I charge for emergency jobs?",
  "Draft a follow-up SMS for missed calls",
  "How do I get more 5-star reviews?",
  "What can you help me with?",
];

/* ── AIScreen component ── */
function AIScreen({plat}){
  const ios=plat==="ios"; const ff=ios?"'DM Sans',sans-serif":"'Roboto',sans-serif";
  const WELCOME="Hey! I'm Ava, your built-in CallGuard advisor. I run completely inside the app — no internet needed. Ask me about your calls, pricing, missed jobs, or how to grow the business.";
  const [msgs,setMsgs]=useState([{role:"assistant",content:WELCOME}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);

  useEffect(()=>{
    if(bottomRef.current) bottomRef.current.scrollIntoView({behavior:"smooth"});
  },[msgs,loading]);

  const send=async(text)=>{
    const txt=(text||input).trim();
    if(!txt||loading) return;
    setInput("");
    if(inputRef.current){inputRef.current.style.height="auto";}
    const userMsg={role:"user",content:txt};
    setMsgs(m=>[...m,userMsg]);
    setLoading(true);
    // Simulate a natural thinking pause (180–480ms based on response complexity)
    const intent=classify(txt);
    const delay=["greeting","thanks"].includes(intent)?180:["fallback"].includes(intent)?280:420;
    await think(delay);
    const reply=respond(intent,txt,[...msgs,userMsg]);
    setMsgs(m=>[...m,{role:"assistant",content:reply}]);
    setLoading(false);
  };

  const accent=ios?C.accent:C.droidAccent;

  return(
    <div style={{height:"100%",color:C.text,fontFamily:ff,display:"flex",flexDirection:"column",animation:"slideUp .28s cubic-bezier(.22,1,.36,1) both"}}>

      {/* Header */}
      <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${C.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:ios?12:18,background:`linear-gradient(135deg,${accent},${accent}88)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 1l3 6 6 1-4.5 4 1 6L12 15l-5.5 3 1-6L3 8l6-1z"/></svg>
        </div>
        <div>
          <div style={{fontSize:15,fontWeight:ios?600:500}}>Ava — Business Advisor</div>
          <div style={{fontSize:11,color:C.muted,marginTop:1,display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:5,height:5,borderRadius:99,background:C.success,animation:"pulse 2s ease-in-out infinite"}}/>
            Built-in · works offline · zero cost
          </div>
        </div>
        {msgs.length>1&&(
          <button onClick={()=>setMsgs([{role:"assistant",content:WELCOME}])} className="bp"
            style={{marginLeft:"auto",background:"none",border:`1px solid ${C.border}`,borderRadius:99,padding:"4px 10px",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:ff}}>
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="sc" style={{flex:1,overflowY:"auto",padding:"12px 14px 4px",display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((m,i)=>{
          const isAI=m.role==="assistant";
          return(
            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:isAI?"flex-start":"flex-end",animation:"txLine .22s ease both"}}>
              {isAI&&(
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                  <div style={{width:16,height:16,borderRadius:99,background:`${accent}28`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill={accent}><path d="M12 1l3 6 6 1-4.5 4 1 6L12 15l-5.5 3 1-6L3 8l6-1z"/></svg>
                  </div>
                  <span style={{fontSize:10,color:C.muted,fontWeight:600,letterSpacing:".04em"}}>AVA</span>
                </div>
              )}
              <div style={{
                maxWidth:"88%",
                background:isAI?C.surface:`${accent}1E`,
                border:`1px solid ${isAI?C.border:accent+"44"}`,
                borderRadius:isAI?(ios?"4px 16px 16px 16px":"4px 12px 12px 12px"):(ios?"16px 4px 16px 16px":"12px 4px 12px 12px"),
                padding:"10px 13px",
              }}>
                <p style={{fontSize:13,color:C.text,lineHeight:1.7,margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{m.content}</p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",animation:"txLine .2s ease both"}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
              <div style={{width:16,height:16,borderRadius:99,background:`${accent}28`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill={accent}><path d="M12 1l3 6 6 1-4.5 4 1 6L12 15l-5.5 3 1-6L3 8l6-1z"/></svg>
              </div>
              <span style={{fontSize:10,color:C.muted}}>Ava</span>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?"4px 16px 16px 16px":"4px 12px 12px 12px",padding:"12px 16px",display:"flex",gap:5,alignItems:"center"}}>
              {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:99,background:accent,animation:`pulse ${.7+i*.18}s ${i*.15}s ease-in-out infinite`}}/>)}
            </div>
          </div>
        )}

        {/* Suggested questions — only on fresh chat */}
        {msgs.length===1&&!loading&&(
          <div style={{marginTop:6}}>
            <div style={{fontSize:10,fontWeight:600,color:C.muted,letterSpacing:".06em",marginBottom:8,paddingLeft:2}}>ASK AVA</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {SUGGESTIONS.map((s,i)=>(
                <button key={i} onClick={()=>send(s)} className="bp"
                  style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:ios?14:10,padding:"10px 13px",textAlign:"left",cursor:"pointer",fontFamily:ff,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,color:accent,flexShrink:0,fontWeight:700}}>›</span>
                  <span style={{fontSize:13,color:C.muted,lineHeight:1.4}}>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,background:C.surface,flexShrink:0}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,110)+"px";}}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Ask Ava anything about your business…"
            rows={1}
            style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:ios?20:12,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:ff,outline:"none",resize:"none",lineHeight:1.5,maxHeight:110,overflowY:"auto",scrollbarWidth:"none"}}
          />
          <button onClick={()=>send()} disabled={!input.trim()||loading} className="bp"
            style={{width:40,height:40,borderRadius:ios?99:12,background:input.trim()&&!loading?accent:C.faint,border:"none",cursor:input.trim()&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background .2s"}}>
            {loading
              ?<div style={{width:15,height:15,border:`2px solid ${C.bg}`,borderTopColor:"transparent",borderRadius:99,animation:"spin .7s linear infinite"}}/>
              :<svg width="16" height="16" viewBox="0 0 24 24" fill={input.trim()?(ios?"#000":C.bg):C.muted}><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
            }
          </button>
        </div>
        <div style={{fontSize:10,color:C.faint,textAlign:"center",marginTop:5}}>Runs locally · no internet · no cost per message</div>
      </div>
    </div>
  );
}

/* ── OS detection ── */
function detectOS(){
  const ua=navigator.userAgent||"";
  const pl=navigator.platform||"";
  // iOS: iPhone, iPad, iPod — including iPad on iOS 13+ which reports as MacIntel but has touch
  if(/iPhone|iPod/.test(ua)) return {os:"ios",method:"userAgent"};
  if(/iPad/.test(ua)) return {os:"ios",method:"userAgent"};
  // iOS 13+ iPad: MacIntel platform + maxTouchPoints > 1
  if(/Mac/.test(pl) && navigator.maxTouchPoints > 1) return {os:"ios",method:"touchHeuristic"};
  if(/Android/.test(ua)) return {os:"android",method:"userAgent"};
  // Desktop fallback: treat macOS/Safari as iOS preview, everything else Android
  if(/Mac/.test(pl)||/Mac/.test(ua)) return {os:"ios",method:"platformFallback"};
  if(/Win|Linux/.test(pl)) return {os:"android",method:"platformFallback"};
  return {os:"ios",method:"default"};
}

/* ── ROOT ── */
function App(){
  const [authState,setAuthState]=useState({checking:true,authenticated:false,error:"",offline:false});
  const [loggingIn,setLoggingIn]=useState(false);
  const [detected]=useState(()=>detectOS());
  const [plat,setPlat]=useState(()=>detectOS().os);
  const [manualOverride,setManualOverride]=useState(false);
  const [tab,setTab]=useState("home");
  const [notif,setNotif]=useState(null);
  const ios=plat==="ios";

  useEffect(()=>{
    let mounted=true;
    if(!api||!api.getSession){
      if(mounted) setAuthState({checking:false,authenticated:false,error:"Dashboard API unavailable",offline:true});
      return()=>{mounted=false;};
    }
    api.getSession().then(({status,data})=>{
      if(!mounted) return;
      if(status===200&&data?.user){
        setAuthState({checking:false,authenticated:true,error:"",offline:false});
        return;
      }
      if(status===401){
        api.setAuthToken?.(null);
        setAuthState({checking:false,authenticated:false,error:"",offline:false});
        return;
      }
      if(status===0){
        const token=api.getAuthToken?.();
        const isValidToken=token&&isTokenValid(token);
        if(token&&!isValidToken){
          api.setAuthToken?.(null);
        }
        setAuthState({
          checking:false,
          authenticated:Boolean(isValidToken),
          error:isValidToken?"":"Server offline — cannot verify session",
          offline:true
        });
        return;
      }
      setAuthState({checking:false,authenticated:false,error:"Unable to reach server",offline:false});
    });
    return()=>{mounted=false;};
  },[]);

  const handleLogin=useCallback(async(username,password)=>{
    if(!api||!api.login){
      setAuthState({checking:false,authenticated:false,error:"Server unavailable",offline:false});
      return;
    }
    setLoggingIn(true);
    const res=await api.login(username,password);
    if(res?.token){
      api.setAuthToken?.(res.token);
      setAuthState({checking:false,authenticated:true,error:"",offline:false});
    }else{
      setAuthState({checking:false,authenticated:false,error:res?.error||"Invalid credentials",offline:false});
    }
    setLoggingIn(false);
  },[]);

  const switchPlat=(p)=>{setPlat(p);setManualOverride(p!==detected.os);};

  const triggerNotif=useCallback(()=>{
    setNotif("✅ AI booked a call! Apex Dental Care — 204 Oak Ave, Boone NC. Reply CANCEL to cancel.");
  },[]);

  const onBooked=useCallback((d)=>{
    setTimeout(()=>setNotif(`✅ ${d.svc?.name} confirmed for ${d.day?.dt} at ${d.time}. Apex Dental — 204 Oak Ave, Boone NC. Reply CANCEL to cancel. See you soon${d.name?`, ${d.name}`:""}!`),900);
  },[]);

  const screens={
    home:<HomeScreen plat={plat} triggerNotif={triggerNotif}/>,
    calls:<CallsScreen plat={plat}/>,
    ai:<AIScreen plat={plat}/>,
    book:<BookScreen plat={plat} onBooked={onBooked}/>,
    acct:<AccountScreen plat={plat}/>,
  };

  const navEl=ios
    ?<div style={{position:"absolute",bottom:0,left:0,right:0}}><IOSNav tab={tab} setTab={setTab}/></div>
    :<div style={{position:"absolute",bottom:0,left:0,right:0}}><DroidNav tab={tab} setTab={setTab}/></div>;

  if(authState.checking) return <LoadingScreen/>;
  if(!authState.authenticated){
    return (
      <LoginScreen
        onLogin={handleLogin}
        error={authState.error}
        loading={loggingIn}
        disabled={authState.offline}
      />
    );
  }

  const inner=(
    <>
      <AppBar plat={plat}/>
      {notif&&<PushNotif plat={plat} msg={notif} onDismiss={()=>setNotif(null)}/>}
      <div key={tab} style={{position:"absolute",top:52,left:0,right:0,bottom:ios?64:60,overflow:"hidden"}}>
        {screens[tab]}
      </div>
      {navEl}
    </>
  );

  const detectedLabel=detected.os==="ios"?" iOS":"🤖 Android";
  const detectedColor=detected.os==="ios"?C.accent:C.droidAccent;

  return(
    <>
      <style>{G}</style>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 16px 48px",minHeight:"100vh",background:"#030508",fontFamily:"'DM Sans',sans-serif"}}>

        {/* Auto-detect banner */}
        <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:7,background:`${detectedColor}0E`,border:`1px solid ${detectedColor}28`,borderRadius:12,padding:"6px 13px"}}>
          <div style={{width:6,height:6,borderRadius:99,background:detectedColor,animation:"pulse 2.5s ease-in-out infinite",flexShrink:0}}/>
          <span style={{fontSize:12,color:detectedColor,fontWeight:500}}>
            {detectedLabel} detected
          </span>
          <span style={{fontSize:11,color:C.muted}}>·</span>
          <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{detected.method}</span>
        </div>

        {/* Manual override toggle */}
        <div style={{marginBottom:20,background:"#0D1118",border:"1px solid #1B2840",borderRadius:14,padding:4,display:"flex",gap:4}}>
          {["ios","android"].map(p=>{
            const active=plat===p;
            const isDetected=p===detected.os&&!manualOverride;
            const col=p==="ios"?C.accent:C.droidAccent;
            return(
              <button key={p} onClick={()=>switchPlat(p)} style={{padding:"7px 18px",borderRadius:11,border:"none",cursor:"pointer",background:active?`${col}22`:"transparent",color:active?col:C.muted,fontSize:13,fontWeight:active?600:400,fontFamily:p==="ios"?"'DM Sans',sans-serif":"'Roboto',sans-serif",transition:"all .2s",display:"flex",alignItems:"center",gap:5}}>
                {p==="ios"?" iOS":"🤖 Android"}
                {isDetected&&(
                  <span style={{fontSize:9,background:`${col}33`,color:col,padding:"1px 5px",borderRadius:99,fontWeight:700,letterSpacing:".04em"}}>AUTO</span>
                )}
              </button>
            );
          })}
        </div>

        {ios
          ?<IOSFrame>{inner}</IOSFrame>
          :<DroidFrame>{inner}</DroidFrame>
        }

        <div style={{marginTop:16,fontSize:12,color:C.muted,textAlign:"center",lineHeight:1.8}}>
          <span style={{color:C.accent,fontWeight:600}}>CallGuard</span> Customer App · v2.1
          {manualOverride&&(
            <span style={{marginLeft:8,fontSize:11,color:C.warn}}>
              (overridden — <button onClick={()=>{setPlat(detected.os);setManualOverride(false);}} style={{background:"none",border:"none",color:C.warn,fontSize:11,cursor:"pointer",textDecoration:"underline",padding:0,fontFamily:"inherit"}}>reset</button>)
            </span>
          )}<br/>
          <span style={{fontSize:11}}>Auto-detected from your device · override above</span>
        </div>
      </div>
    </>
  );
}

/* Register globally so index.html can mount it, and also support module import */
if (typeof window !== "undefined") { window.__CallGuardApp = App; }
if (typeof module !== "undefined") { module.exports = App; }
