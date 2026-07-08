import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

// ── UTILS ───────────────────────────────────────────────────
const ot  = a => a.sels.reduce((s,x) => s * x.odd, 1);
const ret = a => ot(a) * a.valor;
const luc = a => { if(a.status==="Green") return ret(a)-a.valor; if(a.status==="Red") return -a.valor; if(a.status==="Cashout") return (a.csv||0)-a.valor; return null; };
const fr  = (v,sh=true) => { if(v==null) return "—"; const ab=Math.abs(v); const s=sh&&ab>=1000?(ab/1000).toFixed(1)+"k":ab.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}); return(v<0?"-":"")+"R$ "+s; };
const frf = v => "R$ "+v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const hoje= () => new Date().toLocaleDateString("pt-BR");
const hojeISO = () => new Date().toISOString().slice(0,10);
const parseData = s => { if(!s) return null; const [d,m,y]=s.split("/"); return new Date(+y,+m-1,+d); };
const nid = list => { const ns=list.map(a=>parseInt(a.id.replace("BET-",""))||0); return "BET-"+String((ns.length?Math.max(...ns):0)+1).padStart(3,"0"); };

// ── CORES ──────────────────────────────────────────────────
const C = {
  bg:"#080c09", bg2:"#0d120e", card:"#111611", card2:"#161d16",
  border:"#1c261c", border2:"#243024",
  green:"#4ade80", green3:"#15803d", red:"#f87171",
  yellow:"#fbbf24", gray:"#52635a", white:"#edfaef", white2:"#c4e8ca",
  cashout:"#fb923c", blue:"#60a5fa",
};

const inp = { width:"100%", padding:"9px 12px", background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", outline:"none" };

// ── PROMPT IA ──────────────────────────────────────────────
const SYSTEM_PROMPT = `Você extrai/atualiza apostas esportivas. Responda SOMENTE JSON puro, sem markdown.
Para NOVAS: extraia tipo(Simples/Dupla/Tripla), seleções(nome+odd), casa, valor.
Para STATUS: "bateu/green/acertou"→Green | "red/perdeu"→Red | "cashout"→Cashout. ID formato BET-XXX.
Formato:
{"acao":"adicionar","novas":[{"tipo":"Dupla","sels":[{"nome":"Time A","odd":2.10}],"casa":"Betano","valor":500}]}
{"acao":"atualizar","atualizacoes":[{"id":"BET-001","status":"Green"}]}
{"acao":"misto","novas":[...],"atualizacoes":[...]}
{"acao":"nada","resumo":"motivo"}`;

// ── COMPONENTES COMUNS ──────────────────────────────────────
const SectionTitle = ({children}) => (
  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:".9rem",letterSpacing:3,color:C.green,marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
    {children}<div style={{flex:1,height:1,background:C.border}}/>
  </div>
);

const Badge = ({status}) => {
  const m = {Green:{bg:"rgba(74,222,128,.1)",c:C.green,b:"rgba(74,222,128,.22)"},Red:{bg:"rgba(248,113,113,.1)",c:C.red,b:"rgba(248,113,113,.22)"},Cashout:{bg:"rgba(251,146,60,.1)",c:C.cashout,b:"rgba(251,146,60,.18)"},"Em Aberto":{bg:"rgba(96,165,250,.08)",c:C.blue,b:"rgba(96,165,250,.16)"}};
  const d = m[status]||m["Em Aberto"];
  const labels = {Green:"✅ Green",Red:"❌ Red",Cashout:"💰 Cashout","Em Aberto":"⏳ Em Aberto"};
  return <span style={{fontSize:".6rem",fontWeight:700,padding:"2px 9px",borderRadius:99,textTransform:"uppercase",letterSpacing:1,background:d.bg,color:d.c,border:`1px solid ${d.b}`}}>{labels[status]||status}</span>;
};

const ApostaCard = ({a, onClick}) => {
  const l = luc(a);
  const borderL = {Green:C.green,Red:C.red,Cashout:C.cashout,"Em Aberto":C.blue}[a.status]||C.blue;
  return (
    <div onClick={()=>onClick(a.id)} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${borderL}`,borderRadius:9,padding:"13px 15px",cursor:"pointer"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:".62rem",color:C.gray}}>{a.id} · {a.data}</span>
        <span style={{fontSize:".58rem",textTransform:"uppercase",fontWeight:700,padding:"2px 8px",borderRadius:99,background:C.bg2,color:C.gray,border:`1px solid ${C.border}`}}>{a.tipo}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:9}}>
        {a.sels.map((s,i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:".79rem",fontWeight:500,color:C.white2,flex:1}}>{s.nome}</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:".7rem",fontWeight:600,color:C.yellow,background:"rgba(251,191,36,.07)",padding:"2px 7px",borderRadius:4}}>@{s.odd.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:9,borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:".63rem",color:C.gray}}>Casa: <b style={{color:C.white2}}>{a.casa}</b></span>
          <span style={{fontSize:".63rem",color:C.gray}}>Valor: <b style={{color:C.white2}}>{fr(a.valor)}</b></span>
          <span style={{fontSize:".63rem",color:C.gray}}>Ret.: <b style={{color:C.white2}}>{fr(ret(a))}</b></span>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
          <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"1.2rem",color:C.yellow,lineHeight:1}}>{ot(a).toFixed(2)}x</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:".7rem",fontWeight:600,color:l==null?C.gray:l>=0?C.green:C.red}}>{l!=null?fr(l):"—"}</span>
          <Badge status={a.status}/>
        </div>
      </div>
    </div>
  );
};

// ── MODAL ADICIONAR/EDITAR BET ──────────────────────────────
const CASAS = ["Bet Nacional","Betano","Bet365","Superbet","Novibet","MC Games","Shuffle","FortuneJack","KTO","Vai de Bet","Pixbet","Esportes da Sorte","Outra"];
const TIPOS = ["Simples","Dupla","Tripla","Acumuladora"];
const STATUSES = ["Em Aberto","Green","Red","Cashout"];

function ModalAdicionarBet({onSave, onClose, apostaDados}) {
  const isEdit = !!apostaDados;
  const toISO = br => { if(!br) return hojeISO(); const [d,m,y]=br.split("/"); return `${y}-${m}-${d}`; };

  const [tipo,   setTipo]   = useState(isEdit ? apostaDados.tipo   : "Simples");
  const [casa,   setCasa]   = useState(isEdit ? apostaDados.casa   : "Bet Nacional");
  const [valor,  setValor]  = useState(isEdit ? String(apostaDados.valor) : "");
  const [status, setStatus] = useState(isEdit ? apostaDados.status : "Em Aberto");
  const [sels,   setSels]   = useState(isEdit ? apostaDados.sels.map(s=>({nome:s.nome,odd:String(s.odd)})) : [{nome:"",odd:""}]);
  const [erro,   setErro]   = useState("");
  const [dataISO,setDataISO]= useState(isEdit ? toISO(apostaDados.data) : hojeISO());

  const addSel = () => setSels(p=>[...p,{nome:"",odd:""}]);
  const remSel = i => setSels(p=>p.filter((_,j)=>j!==i));
  const updSel = (i,k,v) => setSels(p=>p.map((s,j)=>j===i?{...s,[k]:v}:s));

  const salvar = () => {
    if (!valor||isNaN(Number(valor))) return setErro("Informe um valor válido.");
    const ok = sels.filter(s=>s.nome.trim()&&s.odd&&!isNaN(Number(s.odd)));
    if (!ok.length) return setErro("Adicione pelo menos uma seleção com nome e odd.");
    setErro("");
    const [y,m,d] = dataISO.split("-");
    onSave({tipo,casa,valor:Number(valor),status,data:`${d}/${m}/${y}`,sels:ok.map(s=>({nome:s.nome.trim(),odd:Number(s.odd)}))});
  };

  const lbl = {fontSize:".62rem",textTransform:"uppercase",letterSpacing:1.5,color:C.gray,fontWeight:700,marginBottom:6,display:"block"};
  const sel = {...inp,cursor:"pointer"};

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card2,border:`1px solid ${C.border2}`,borderRadius:14,padding:24,width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.7)"}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"1.3rem",letterSpacing:2,color:C.green,marginBottom:4}}>
          {isEdit ? `✏️ Editar ${apostaDados.id}` : "➕ Nova Aposta"}
        </div>
        <div style={{fontSize:".7rem",color:C.gray,marginBottom:20}}>
          {isEdit ? "Edite os dados da aposta abaixo" : "Preencha os dados da aposta manualmente"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div><label style={lbl}>Tipo</label><select style={sel} value={tipo} onChange={e=>setTipo(e.target.value)}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label style={lbl}>Casa de Aposta</label><select style={sel} value={casa} onChange={e=>setCasa(e.target.value)}>{CASAS.map(c=><option key={c}>{c}</option>)}</select></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
          <div><label style={lbl}>Valor (R$)</label><input style={inp} type="number" placeholder="500" value={valor} onChange={e=>setValor(e.target.value)}/></div>
          <div><label style={lbl}>Status</label><select style={sel} value={status} onChange={e=>setStatus(e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label style={lbl}>Data</label><input style={{...inp,colorScheme:"dark"}} type="date" value={dataISO} onChange={e=>setDataISO(e.target.value)}/></div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <label style={{...lbl,marginBottom:0}}>Seleções</label>
            <button onClick={addSel} style={{fontSize:".68rem",fontWeight:700,padding:"3px 10px",borderRadius:99,background:"rgba(74,222,128,.1)",color:C.green,border:"1px solid rgba(74,222,128,.25)",cursor:"pointer"}}>+ Adicionar</button>
          </div>
          {sels.map((s,i) => (
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 90px 28px",gap:6,marginBottom:6,alignItems:"center"}}>
              <input style={inp} placeholder={`Seleção ${i+1}`} value={s.nome} onChange={e=>updSel(i,"nome",e.target.value)}/>
              <input style={inp} placeholder="Odd" type="number" step="0.01" value={s.odd} onChange={e=>updSel(i,"odd",e.target.value)}/>
              {sels.length>1 && <button onClick={()=>remSel(i)} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",color:C.red,borderRadius:6,cursor:"pointer",fontSize:".8rem",height:34}}>✕</button>}
            </div>
          ))}
        </div>
        {erro && <div style={{fontSize:".74rem",color:C.red,marginBottom:12,padding:"8px 12px",background:"rgba(248,113,113,.08)",borderRadius:8,border:"1px solid rgba(248,113,113,.2)"}}>{erro}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={onClose} style={{padding:11,borderRadius:9,fontSize:".75rem",cursor:"pointer",background:"transparent",color:C.gray,border:`1px solid ${C.border}`}}>Cancelar</button>
          <button onClick={salvar} style={{padding:11,borderRadius:9,fontSize:".75rem",fontWeight:700,cursor:"pointer",background:C.green,color:"#060a07",border:"none",boxShadow:"0 4px 16px rgba(74,222,128,.25)"}}>
            {isEdit ? "💾 Salvar Alterações" : "✅ Salvar Aposta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TOOLTIPS ────────────────────────────────────────────────
const CustomTooltip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:C.card2,border:`1px solid ${C.border2}`,borderRadius:9,padding:"10px 14px",fontSize:".75rem"}}>
      <div style={{fontWeight:700,color:C.white,marginBottom:6}}>{label}</div>
      {payload.map((p,i) => <div key={i} style={{color:p.color,marginBottom:2}}>{p.name}: {fr(p.value,false)}</div>)}
    </div>
  );
};

const LineTooltip = ({active,payload}) => {
  if (!active||!payload?.length) return null;
  const d = payload[0].payload;
  const lucroVal = d.lucro;
  return (
    <div style={{background:C.card2,border:`1px solid ${lucroVal>=0?"rgba(74,222,128,.35)":"rgba(248,113,113,.35)"}`,borderRadius:10,padding:"10px 14px",fontSize:".75rem",boxShadow:"0 4px 20px rgba(0,0,0,.6)"}}>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:".68rem",color:C.gray,marginBottom:4}}>📅 {d.data}</div>
      {d.id!=="hoje" && <div style={{fontSize:".68rem",color:C.gray,marginBottom:6}}>{d.id}</div>}
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"1.15rem",letterSpacing:1,color:lucroVal>=0?C.green:C.red}}>{frf(lucroVal)}</div>
    </div>
  );
};

// ── ÍCONE OLHO ──────────────────────────────────────────────
const EyeIcon = ({oculto, onClick}) => (
  <button onClick={onClick} title={oculto?"Mostrar valores":"Ocultar valores"} style={{background:"transparent",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6}}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={oculto?"#52635a":"#4ade80"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {oculto ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </>
      )}
    </svg>
  </button>
);

// ── APP ──────────────────────────────────────────────────────
export default function App() {
  const INITIAL_BETS = [
    // ── BET NACIONAL ──
    { id:"BET-001", data:"05/02/2026", tipo:"Dupla", casa:"Bet Nacional", valor:900, status:"Em Aberto",
      sels:[{nome:"Shamrock Rovers - Vencedor Premier Division",odd:2.25},{nome:"Cruzeiro - Terminar no Top 4 Brasileirão",odd:1.83}] },
    { id:"BET-002", data:"23/08/2025", tipo:"Dupla", casa:"Bet Nacional", valor:800, status:"Red",
      sels:[{nome:"Chapecoense SC - Vencedor",odd:2.85},{nome:"FC Basel 1893 - Vencedor",odd:1.94}] },
    { id:"BET-003", data:"15/12/2025", tipo:"Dupla", casa:"Bet Nacional", valor:1000, status:"Red",
      sels:[{nome:"FC Salzburgo - Vencedor",odd:2.20},{nome:"Bayer Leverkusen - Vencedor",odd:1.89}] },
    { id:"BET-004", data:"15/12/2025", tipo:"Dupla", casa:"Bet Nacional", valor:1000, status:"Red",
      sels:[{nome:"Rochdale FC - Vencedor",odd:2.75},{nome:"Pisa SC - Vencedor",odd:1.50}] },
    { id:"BET-005", data:"04/12/2025", tipo:"Dupla", casa:"Bet Nacional", valor:2500, status:"Red",
      sels:[{nome:"Levante - Vencedor",odd:1.61},{nome:"Bayer Leverkusen - Vencedor",odd:1.73}] },
    { id:"BET-006", data:"20/10/2025", tipo:"Dupla", casa:"Bet Nacional", valor:1465, status:"Green",
      sels:[{nome:"RB Leipzig - Vencedor",odd:2.00},{nome:"Pisa SC - Vencedor",odd:1.90}] },
    { id:"BET-007", data:"28/01/2026", tipo:"Dupla", casa:"Bet Nacional", valor:2051.30, status:"Red",
      sels:[{nome:"Levante - Vencedor",odd:1.61},{nome:"Rochdale FC - Vencedor",odd:2.15}] },
    { id:"BET-008", data:"05/04/2026", tipo:"Simples", casa:"Bet Nacional", valor:3391, status:"Green",
      sels:[{nome:"Lech Poznań - Vencedor Ekstraklasa 25/26",odd:2.85}] },
    { id:"BET-009", data:"05/04/2026", tipo:"Simples", casa:"Bet Nacional", valor:2976, status:"Green",
      sels:[{nome:"Lech Poznań - Vencedor Ekstraklasa 25/26",odd:2.85}] },

    // ── BETANO — encerradas ──
    { id:"BET-010", data:"24/04/2026", tipo:"Simples", casa:"Betano", valor:600, status:"Red",
      sels:[{nome:"Millwall FC - Resultado Final (vs Leicester)",odd:1.80}] },
    { id:"BET-011", data:"03/05/2026", tipo:"Simples", casa:"Betano", valor:600, status:"Green",
      sels:[{nome:"Mais de 3.5 Escanteios 1T - Club América x UNAM Pumas",odd:1.57}] },
    { id:"BET-012", data:"03/05/2026", tipo:"Simples", casa:"Betano", valor:600, status:"Cashout", csv:445.68,
      sels:[{nome:"Mais de 3.5 Escanteios 1T - Mirassol x Corinthians",odd:1.72}] },
    { id:"BET-013", data:"04/05/2026", tipo:"Simples", casa:"Betano", valor:600, status:"Green",
      sels:[{nome:"Mais de 7.5 Escanteios 1T - NK Istra x NK Slaven Belupo Koprivnica",odd:1.70}] },
    { id:"BET-014", data:"04/05/2026", tipo:"Simples", casa:"Betano", valor:600, status:"Red",
      sels:[{nome:"Mais de 4.5 Escanteios 1T - Los Chankas CYC x Deportivo Garcilaso",odd:1.72}] },
    { id:"BET-015", data:"04/05/2026", tipo:"Simples", casa:"Betano", valor:600, status:"Red",
      sels:[{nome:"Mais de 13.5 Escanteios - FK Bodo/Glimt x Molde FK",odd:1.60}] },
    { id:"BET-016", data:"08/05/2026", tipo:"Simples", casa:"Betano", valor:600, status:"Cashout", csv:225.15,
      sels:[{nome:"Mais de 19.5 Escanteios - Lech Poznan x Arka Gdynia",odd:1.60}] },
    { id:"BET-017", data:"05/05/2026", tipo:"Dupla", casa:"Betano", valor:1250, status:"Red",
      sels:[{nome:"Sevilha FC - Acabar nos últimos 3 LaLiga 25/26",odd:3.00},{nome:"Club Brugge KV - Vencedor Final 1A Pro League",odd:1.60}] },

    // ── BETANO — em aberto ──
    { id:"BET-018", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:595.82, status:"Em Aberto",
      sels:[{nome:"Shamrock Rovers FC - Vencedor Premier Division 2026",odd:2.25},{nome:"Cruzeiro - Top 4 Brasileirão 2026",odd:2.05}] },
    { id:"BET-019", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:1000, status:"Em Aberto",
      sels:[{nome:"Palmeiras - Top 4 Brasileirão 2026",odd:1.50},{nome:"Shamrock Rovers FC - Vencedor Premier Division 2026",odd:2.25}] },
    { id:"BET-020", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:326.26, status:"Em Aberto",
      sels:[{nome:"O Higgins - Top 6 Liga de Primera 2026",odd:1.80},{nome:"Vitória - Últimos 4 Brasileirão 2026",odd:2.90}] },
    { id:"BET-021", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:864.35, status:"Em Aberto",
      sels:[{nome:"Shamrock Rovers FC - Vencedor Premier Division 2026",odd:2.00},{nome:"Remo - Últimos 4 Brasileirão 2026",odd:1.70}] },
    { id:"BET-022", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:1100, status:"Em Aberto",
      sels:[{nome:"Philadelphia Phillies - Eliminatórias MLB 2026",odd:1.40},{nome:"IFK Norrkoping - Vencedor Superettan 2026",odd:2.75}] },
    { id:"BET-023", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:1000, status:"Em Aberto",
      sels:[{nome:"São Bernardo - Top 6 Série B 2026",odd:2.90},{nome:"Independiente del Valle - Vencedor Liga Pro 2026",odd:1.75}] },
    { id:"BET-024", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:1464.60, status:"Em Aberto",
      sels:[{nome:"Chapecoense - Última posição Brasileirão 2026",odd:1.40},{nome:"Independiente del Valle - Vencedor Liga Pro 2026",odd:1.90}] },
    { id:"BET-025", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:1500, status:"Em Aberto",
      sels:[{nome:"Independiente del Valle - Vencedor Liga Pro 2026",odd:2.00},{nome:"IK Sirius - Vencedor Allsvenskan 2026",odd:1.85}] },
    { id:"BET-026", data:"30/05/2026", tipo:"Dupla", casa:"Betano", valor:510.97, status:"Em Aberto",
      sels:[{nome:"Huachipato - Top 6 Liga de Primera 2026",odd:2.15},{nome:"Independiente del Valle - Vencedor Liga Pro 2026",odd:2.00}] },

    // ── NOVIBET — encerradas ──
    { id:"BET-027", data:"23/03/2026", tipo:"Dupla", casa:"Novibet", valor:1500, status:"Cashout", csv:6057.69,
      sels:[{nome:"Lech Poznan - Vencedor Ekstraklasa 25/26",odd:2.75},{nome:"Liverpool - Top 5 Premier League 25/26",odd:1.50}] },
    { id:"BET-028", data:"08/04/2026", tipo:"Simples", casa:"Novibet", valor:428.62, status:"Green",
      sels:[{nome:"Lech Poznan - Vencedor Ekstraklasa 25/26",odd:2.40}] },
    { id:"BET-029", data:"25/03/2026", tipo:"Dupla", casa:"Novibet", valor:1500, status:"Cashout", csv:1988.67,
      sels:[{nome:"Lech Poznan - Vencedor Ekstraklasa 25/26",odd:2.75},{nome:"HB Koge - Rebaixado 1st Division 25/26",odd:0.52}] },

    // ── NOVIBET — em aberto ──
    { id:"BET-030", data:"30/05/2026", tipo:"Dupla", casa:"Novibet", valor:1140, status:"Em Aberto",
      sels:[{nome:"Shamrock Rovers - Vencedor Premier Division 2026",odd:2.05},{nome:"Remo PA - Despromovido Série A 2026",odd:1.70}] },
    { id:"BET-031", data:"30/05/2026", tipo:"Dupla", casa:"Novibet", valor:1100, status:"Em Aberto",
      sels:[{nome:"Londrina PR - Despromovido Série B 2026",odd:1.90},{nome:"Mjallby - Top 3 Allsvenskan 2026",odd:2.35}] },
    { id:"BET-032", data:"30/05/2026", tipo:"Dupla", casa:"Novibet", valor:2100, status:"Em Aberto",
      sels:[{nome:"Shamrock Rovers - Vencedor Premier Division 2026",odd:1.65},{nome:"Mirassol SP - Despromovido Série A 2026",odd:1.85}] },
    { id:"BET-033", data:"30/05/2026", tipo:"Dupla", casa:"Novibet", valor:2400, status:"Em Aberto",
      sels:[{nome:"Independiente del Valle - Vencedor Serie A 2026",odd:1.80},{nome:"Londrina PR - Despromovido Série B 2026",odd:1.70}] },

    // ── SUPERBET — encerradas ──
    { id:"BET-034", data:"17/05/2026", tipo:"Simples", casa:"Superbet", valor:1131, status:"Cashout", csv:227.82,
      sels:[{nome:"Jagiellonia Bialystok - Vencedor Ekstraklasa 25/26",odd:7.50}] },
    { id:"BET-035", data:"17/05/2026", tipo:"Simples", casa:"Superbet", valor:899, status:"Cashout", csv:181.08,
      sels:[{nome:"Jagiellonia Bialystok - Vencedor Ekstraklasa 25/26",odd:7.50}] },
    { id:"BET-036", data:"17/05/2026", tipo:"Simples", casa:"Superbet", valor:893, status:"Cashout", csv:199.36,
      sels:[{nome:"Gornik Zabrze - Vencedor Ekstraklasa 25/26",odd:9.50}] },
    { id:"BET-037", data:"04/05/2026", tipo:"Simples", casa:"Superbet", valor:369, status:"Cashout", csv:369,
      sels:[{nome:"Zaglebie Lubin - Vencedor Ekstraklasa 25/26",odd:18.00}] },
    { id:"BET-038", data:"17/05/2026", tipo:"Simples", casa:"Superbet", valor:710, status:"Cashout", csv:158.51,
      sels:[{nome:"Gornik Zabrze - Vencedor Ekstraklasa 25/26",odd:9.50}] },
    { id:"BET-039", data:"26/04/2026", tipo:"Simples", casa:"Superbet", valor:30, status:"Green",
      sels:[{nome:"Real Sociedad - Resultado Final vence (vs Rayo Vallecano)",odd:2.55}] },
    { id:"BET-040", data:"24/05/2026", tipo:"Simples", casa:"Superbet", valor:500, status:"Green",
      sels:[{nome:"CRB AL - Resultado Final vence (vs Ponte Preta)",odd:2.22}] },

    // ── SUPERBET — em aberto ──
    { id:"BET-041", data:"30/05/2026", tipo:"Dupla", casa:"Superbet", valor:1000, status:"Em Aberto",
      sels:[{nome:"Colo Colo - Vencedor Chile Primeira Divisão 2026",odd:2.25},{nome:"Mirassol - Rebaixado Série A 2026",odd:1.95}] },
    { id:"BET-042", data:"30/05/2026", tipo:"Dupla", casa:"Superbet", valor:255, status:"Em Aberto",
      sels:[{nome:"Colo Colo - Vencedor Chile Primeira Divisão 2026",odd:2.25},{nome:"Londrina - Rebaixado Série B 2026",odd:2.10}] },
    { id:"BET-043", data:"30/05/2026", tipo:"Dupla", casa:"Superbet", valor:1500, status:"Em Aberto",
      sels:[{nome:"Ponte Preta - Rebaixado Série B 2026",odd:1.62},{nome:"São Paulo - Top 6 Série A 2026",odd:1.90}] },
    { id:"BET-044", data:"30/05/2026", tipo:"Dupla", casa:"Superbet", valor:1000, status:"Em Aberto",
      sels:[{nome:"AS Roma - Vence (vs Verona)",odd:1.38},{nome:"Ponte Preta - Rebaixado Série B 2026",odd:1.63}] },
    { id:"BET-045", data:"30/05/2026", tipo:"Dupla", casa:"Superbet", valor:1364, status:"Em Aberto",
      sels:[{nome:"Goiás - Top 6 Série B 2026",odd:2.15},{nome:"Palmeiras - Vencedor Série A 2026",odd:1.74}] },

    // ── MC GAMES ──
    { id:"BET-046", data:"30/05/2026", tipo:"Dupla", casa:"MC Games", valor:1500, status:"Em Aberto",
      sels:[{nome:"Independiente del Valle - Vencedor Liga Pro Serie A 2026",odd:2.00},{nome:"Huachipato - Top 6 Liga de Primera 2026",odd:2.15}] },
  ];

  const [apostas, setApostas] = useState(INITIAL_BETS);
  const [storageReady, setStorageReady] = useState(false);
  const [tab,setTab]               = useState("dashboard");
  const [filtro,setFiltro]         = useState("todos");
  const [filtroCasa,setFiltroCasa] = useState("todas");
  const [busca,setBusca]           = useState("");
  const [modal,setModal]           = useState(null);
  const [showAdd,setShowAdd]       = useState(false);
  const [showEdit,setShowEdit]     = useState(false);
  const [confirmDelete,setConfirmDelete] = useState(false);
  const [ocultarNum,setOcultarNum] = useState(false);
  const mV = v => ocultarNum ? "—" : v;
  const [aiMode,setAiMode]   = useState("chat");
  const [chatTxt,setChatTxt] = useState("");
  const [imgB64,setImgB64]   = useState(null);
  const [imgUrl,setImgUrl]   = useState(null);
  const [loading,setLoading] = useState(false);
  const [aiRes,setAiRes]     = useState(null);
  const [toast,setToast]     = useState(null);
  const [drag,setDrag]       = useState(false);
  const [cashoutInput,setCashoutInput]   = useState({});
  const [showCashoutField,setShowCashoutField] = useState(false);

  // ── STORAGE (IndexedDB + localStorage fallback) ─────────────
  const DB_NAME = "apostas_db";
  const DB_STORE = "apostas";
  const DB_KEY = "apostas_v1";

  const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });

  const idbSave = async (data) => {
    try {
      const db = await openDB();
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(data, DB_KEY);
      await new Promise((res,rej) => { tx.oncomplete=res; tx.onerror=rej; });
      db.close();
    } catch(e) {}
    // também salva no localStorage como backup
    try { localStorage.setItem("apostas_amigo_v1", JSON.stringify(data)); } catch(e) {}
  };

  const idbLoad = async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(DB_KEY);
      const result = await new Promise((res,rej) => { req.onsuccess=()=>res(req.result); req.onerror=rej; });
      db.close();
      if (result) return result;
    } catch(e) {}
    // fallback localStorage
    try { const r=localStorage.getItem("apostas_amigo_v1"); if(r) return JSON.parse(r); } catch(e) {}
    return null;
  };

  // Carrega dados na inicialização
  useEffect(() => {
    idbLoad().then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        setApostas(data);
      }
      setStorageReady(true);
    });
  }, []);

  // Salva sempre que apostas mudar (mas só após storage estar pronto)
  useEffect(() => {
    if (!storageReady) return;
    idbSave(apostas);
  }, [apostas, storageReady]);

  const showToast = useCallback((msg,tipo="ok") => { setToast({msg,tipo}); setTimeout(()=>setToast(null),2800); }, []);

  useEffect(() => {
    if (modal?.id) {
      const ap = apostas.find(a=>a.id===modal.id);
      if(ap) setCashoutInput(prev=>({...prev,[modal.id]:ap.csv!=null?ap.csv:ap.valor}));
    }
    setShowCashoutField(false);
    setConfirmDelete(false);
  }, [modal?.id]);

  // ── STATS ──
  const st = (() => {
    const enc=apostas.filter(a=>a.status!=="Em Aberto");
    const ab=apostas.filter(a=>a.status==="Em Aberto");
    const gr=apostas.filter(a=>a.status==="Green");
    const rd=apostas.filter(a=>a.status==="Red");
    const co=apostas.filter(a=>a.status==="Cashout");
    const ti=apostas.reduce((s,a)=>s+a.valor,0);
    const lt=enc.reduce((s,a)=>s+(luc(a)||0),0);
    const pot=ab.reduce((s,a)=>s+ret(a),0);
    const ei=enc.reduce((s,a)=>s+a.valor,0);
    const roi=ei?lt/ei:0;
    const ac=enc.length?gr.length/enc.length:0;
    const mb=apostas.length?apostas.reduce((b,a)=>ot(a)>ot(b)?a:b,apostas[0]):{sels:[{odd:0}],id:""};
    const cm={};
    apostas.forEach(a=>{ if(!cm[a.casa])cm[a.casa]={t:0,c:0,g:0}; cm[a.casa].t+=a.valor; cm[a.casa].c++; if(a.status==="Green")cm[a.casa].g++; });
    return {enc,ab,gr,rd,co,ti,lt,pot,ei,roi,ac,mb,cm};
  })();

  const powerRanking = () => {
    const map={};
    apostas.forEach(a=>a.sels.forEach(s=>{ if(!map[s.nome])map[s.nome]={nome:s.nome,stake:0,apostas:0}; map[s.nome].stake+=a.valor; map[s.nome].apostas++; }));
    return Object.values(map).sort((a,b)=>b.stake-a.stake).slice(0,15).map((r,i)=>({...r,pos:i+1}));
  };

  const chartData = () => {
    const cm={};
    apostas.forEach(a=>{ if(!cm[a.casa])cm[a.casa]={casa:a.casa,investido:0,lucro:0}; cm[a.casa].investido+=a.valor; const l=luc(a); if(l!=null)cm[a.casa].lucro+=l; });
    return Object.values(cm).sort((a,b)=>b.investido-a.investido);
  };

  const lucroLineData = () => {
    const enc=apostas.filter(a=>a.status!=="Em Aberto"&&parseData(a.data));
    enc.sort((a,b)=>parseData(a.data)-parseData(b.data));
    let acum=0;
    const pts=enc.map(a=>{ acum+=(luc(a)||0); return {data:a.data,lucro:parseFloat(acum.toFixed(2)),id:a.id}; });
    const todayStr=hoje();
    if(pts.length&&pts[pts.length-1].data!==todayStr) pts.push({data:todayStr,lucro:pts[pts.length-1].lucro,id:"hoje"});
    return pts;
  };

  const medalha = pos => pos===1?"🥇":pos===2?"🥈":pos===3?"🥉":`${pos}º`;

  // ── AÇÕES ──
  const setStatus = (s,csvVal) => {
    setApostas(p=>p.map(a=>a.id===modal.id?{...a,status:s,...(s==="Cashout"?{csv:csvVal??a.valor}:{})}:a));
    showToast(`${modal.id} → ${s}`,s==="Green"||s==="Cashout"?"ok":"err");
    setModal(null); setShowCashoutField(false);
  };
  const deleteAposta = () => { setApostas(p=>p.filter(a=>a.id!==modal.id)); showToast("Aposta excluída","err"); setModal(null); setConfirmDelete(false); };
  const adicionarBet = dados => { const nova={id:nid(apostas),data:dados.data||hoje(),...dados}; setApostas(p=>[...p,nova]); setShowAdd(false); showToast(`${nova.id} adicionada!`,"ok"); };
  const editarBet = dados => { setApostas(p=>p.map(a=>a.id===modal.id?{...a,...dados}:a)); setShowEdit(false); setModal(null); showToast(`${modal.id} atualizada!`,"ok"); };

  // ── IA ──
  const processResult = r => {
    let added=0,updated=0,errs=[];
    const novo=[...apostas];
    (r.novas||[]).forEach(n=>{ if(!n.sels?.length)return; novo.push({id:nid(novo),data:hoje(),tipo:n.tipo||"Simples",sels:n.sels.map(s=>({nome:s.nome||"?",odd:parseFloat(s.odd)||1})),casa:n.casa||"?",valor:parseFloat(n.valor)||0,status:"Em Aberto"}); added++; });
    (r.atualizacoes||[]).forEach(u=>{ const i=novo.findIndex(x=>x.id===u.id); if(i>=0){novo[i]={...novo[i],status:u.status};updated++;}else errs.push(u.id); });
    setApostas(novo);
    const msgs=[];
    if(added)   msgs.push(`✅ ${added} aposta${added>1?"s":""} adicionada${added>1?"s":""}`);
    if(updated) msgs.push(`🔄 ${updated} status atualizado${updated>1?"s":""}`);
    if(errs.length) msgs.push(`⚠️ IDs não encontrados: ${errs.join(", ")}`);
    setAiRes({tipo:"ok",msg:msgs.join("\n")||"✅ Processado!"});
    showToast(added?`${added} adicionada${added>1?"s":""}!`:updated?`${updated} atualizado${updated>1?"s":""}!`:"OK!");
  };
  const callAI = async msgs => {
    const resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,system:SYSTEM_PROMPT,messages:msgs})});
    const data=await resp.json();
    if(data.error) throw new Error(data.error.message);
    const txt=(data.content||[]).map(c=>c.text||"").join("").trim();
    const m=txt.match(/\{[\s\S]*\}/);
    if(!m) throw new Error("IA não retornou JSON válido.");
    return JSON.parse(m[0]);
  };
  const sendChat = async () => { if(!chatTxt.trim())return; setLoading(true);setAiRes(null); try{const r=await callAI([{role:"user",content:chatTxt}]); if(r.acao==="nada")setAiRes({tipo:"ok",msg:"ℹ️ "+(r.resumo||"Nada encontrado.")}); else processResult(r);}catch(e){setAiRes({tipo:"err",msg:"❌ "+e.message});} setLoading(false); };
  const sendImg  = async () => { if(!imgB64){showToast("Seleciona uma imagem primeiro","err");return;} setLoading(true);setAiRes(null); try{const r=await callAI([{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:imgB64}},{type:"text",text:"Extraia todas as apostas desta imagem."}]}]); if(r.acao==="nada")setAiRes({tipo:"ok",msg:"ℹ️ "+(r.resumo||"Nada encontrado.")}); else processResult(r);}catch(e){setAiRes({tipo:"err",msg:"❌ "+e.message});} setLoading(false); };
  const handleImg = e => { const f=e.target.files[0];if(!f)return; const reader=new FileReader(); reader.onload=ev=>{setImgB64(ev.target.result.split(",")[1]);setImgUrl(ev.target.result);}; reader.readAsDataURL(f); };

  const casasUnicas = ["todas",...Array.from(new Set(apostas.map(a=>a.casa))).sort()];
  const listaFiltrada = [...apostas].reverse()
    .filter(a=>filtro==="todos"||a.status===filtro)
    .filter(a=>filtroCasa==="todas"||a.casa===filtroCasa)
    .filter(a=>!busca||a.id.toLowerCase().includes(busca)||a.sels.some(s=>s.nome.toLowerCase().includes(busca))||a.casa.toLowerCase().includes(busca));
  const modalAposta = modal?apostas.find(a=>a.id===modal.id):null;

  const sBlock = {background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:18};
  const sRow   = {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:".77rem"};
  const kpi    = hi => ({background:C.card,border:`1px solid ${hi?"rgba(74,222,128,0.2)":C.border}`,borderRadius:14,padding:"16px 18px",position:"relative",overflow:"hidden"});

  const EmptyState = () => (
    <div style={{textAlign:"center",padding:"60px 20px",color:C.gray}}>
      <div style={{fontSize:"3rem",marginBottom:16}}>🎯</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"1.4rem",letterSpacing:2,color:C.white2,marginBottom:8}}>Nenhuma aposta ainda</div>
      <div style={{fontSize:".82rem",marginBottom:24,lineHeight:1.6}}>Use o botão <b style={{color:C.green}}>+ Nova Bet</b> para adicionar<br/>ou vá na aba <b style={{color:C.green}}>IA</b> para importar via print ou chat</div>
      <button onClick={()=>setShowAdd(true)} style={{padding:"10px 24px",borderRadius:99,background:C.green,color:"#060a07",fontWeight:700,fontSize:".8rem",border:"none",cursor:"pointer",boxShadow:"0 4px 20px rgba(74,222,128,.3)"}}>➕ Adicionar minha primeira bet</button>
    </div>
  );

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif",color:C.white,maxWidth:900,margin:"0 auto",padding:"0 14px 100px"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}textarea::placeholder,input::placeholder{color:${C.gray}}select option{background:${C.card2};color:${C.white}}input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.6)}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border2};border-radius:99px}`}</style>

      {/* ── HEADER ── */}
      <div style={{padding:"24px 0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,marginBottom:22}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10}}>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"2rem",letterSpacing:3,color:C.green,margin:0,textShadow:"0 0 30px rgba(74,222,128,0.25)"}}>⚽ APOSTAS</h1>
          <span style={{fontSize:".63rem",color:C.gray,letterSpacing:3,textTransform:"uppercase",fontWeight:600}}>Dashboard Pro</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <EyeIcon oculto={ocultarNum} onClick={()=>setOcultarNum(p=>!p)}/>
          <button onClick={()=>setShowAdd(true)} style={{fontSize:".7rem",fontWeight:700,padding:"6px 16px",borderRadius:99,color:"#060a07",background:C.green,border:"none",cursor:"pointer",boxShadow:"0 2px 12px rgba(74,222,128,.3)"}}>+ Nova Bet</button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{display:"flex",gap:3,background:C.card,border:`1px solid ${C.border}`,borderRadius:99,padding:4,marginBottom:22,width:"fit-content"}}>
        {["dashboard","apostas","ia","stats"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"8px 18px",borderRadius:99,fontSize:".72rem",fontWeight:700,letterSpacing:.8,cursor:"pointer",color:tab===t?"#060a07":C.gray,border:"none",background:tab===t?C.green:"transparent",textTransform:"uppercase",boxShadow:tab===t?"0 2px 16px rgba(74,222,128,0.3)":"none"}}>
            {t==="ia"?"IA":t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab==="dashboard" && (
        <div>
          {apostas.length===0 ? <EmptyState/> : <>
            <SectionTitle>Resumo Financeiro</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
              {[
                [true,"Lucro Líquido",mV(fr(st.lt)),st.lt>=0?"green":"red",st.enc.length+" apostas encerradas",true],
                [false,"Total Investido",mV(fr(st.ti)),"white",apostas.length+" apostas no total",false],
                [false,"Ret. Potencial",mV(fr(st.pot)),"yellow","apostas em aberto",false],
                [false,"ROI",mV((st.roi*100).toFixed(1)+"%"),st.roi>=0?"green":"red","encerradas",false],
                [false,"Taxa Acerto",(st.ac*100).toFixed(0)+"%","white",st.gr.length+"/"+st.enc.length+" encerradas",true],
                [false,"Melhor Odd",st.mb.sels?ot(st.mb).toFixed(2)+"x":"—","yellow",st.mb.id||"—",false],
              ].map(([hi,label,val,col,sub,bar],i)=>(
                <div key={i} style={kpi(hi)}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${hi?"rgba(74,222,128,0.8)":"rgba(74,222,128,0.2)"},transparent)`}}/>
                  <div style={{fontSize:".6rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,fontWeight:700,marginBottom:8}}>{label}</div>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"1.6rem",letterSpacing:1,lineHeight:1,color:{green:C.green,red:C.red,yellow:C.yellow,white:C.white}[col]||C.white}}>{val}</div>
                  <div style={{fontSize:".62rem",color:C.gray,marginTop:5}}>{sub}</div>
                  {bar&&!ocultarNum&&<div style={{height:2,background:C.border,borderRadius:99,marginTop:10,overflow:"hidden"}}><div style={{height:"100%",width:`${col==="green"?Math.min(Math.abs(st.lt)/Math.max(st.ei,1)*100,100):st.ac*100}%`,background:`linear-gradient(90deg,${C.green3},${C.green})`,borderRadius:99}}/></div>}
                </div>
              ))}
            </div>
            <SectionTitle>Status</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
              {[[C.green,"rgba(74,222,128,0.22)","✅",st.gr.length,"Greens"],[C.red,"rgba(248,113,113,0.22)","❌",st.rd.length,"Reds"],[C.cashout,"rgba(251,146,60,0.18)","💰",st.co.length,"Cashout"],[C.blue,"rgba(96,165,250,0.18)","⏳",st.ab.length,"Em Aberto"]].map(([nc,bc,ico,num,lbl])=>(
                <div key={lbl} style={{background:C.card,border:`1px solid ${bc}`,borderRadius:9,padding:"12px 10px",textAlign:"center"}}>
                  <div style={{fontSize:"1.1rem",marginBottom:3}}>{ico}</div>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"1.4rem",color:nc,lineHeight:1}}>{num}</div>
                  <div style={{fontSize:".58rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,marginTop:2}}>{lbl}</div>
                </div>
              ))}
            </div>
            <SectionTitle>Casas de Aposta</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {Object.entries(st.cm).sort((a,b)=>b[1].t-a[1].t).map(([n,d])=>(
                <div key={n} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontWeight:700,fontSize:".83rem"}}>{n}</div><div style={{fontSize:".63rem",color:C.gray,marginTop:2}}>{d.c} bet{d.c>1?"s":""} · {d.g}G</div></div>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:".76rem",color:C.yellow,fontWeight:600}}>{mV(fr(d.t))}</span>
                </div>
              ))}
            </div>
          </>}
        </div>
      )}

      {/* ── APOSTAS ── */}
      {tab==="apostas" && (
        <div>
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
            {[["todos","Todos"],["Green","✅ Green"],["Red","❌ Red"],["Cashout","💰 Cashout"],["Em Aberto","⏳ Aberto"]].map(([f,l])=>(
              <button key={f} onClick={()=>setFiltro(f)} style={{padding:"5px 12px",borderRadius:99,fontSize:".68rem",fontWeight:700,cursor:"pointer",color:filtro===f?"#060a07":C.gray,textTransform:"uppercase",border:`1px solid ${filtro===f?C.green:C.border}`,background:filtro===f?C.green:"transparent"}}>{l}</button>
            ))}
            <input style={{padding:"6px 14px",borderRadius:99,background:C.card,border:`1px solid ${C.border}`,color:C.white,fontSize:".74rem",outline:"none",width:160,marginLeft:"auto"}} placeholder="🔍 Buscar..." value={busca} onChange={e=>setBusca(e.target.value.toLowerCase())}/>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:".6rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,fontWeight:700,marginRight:2}}>Casa:</span>
            {casasUnicas.map(c=>(
              <button key={c} onClick={()=>setFiltroCasa(c)} style={{padding:"4px 11px",borderRadius:99,fontSize:".65rem",fontWeight:700,cursor:"pointer",color:filtroCasa===c?"#060a07":C.gray,border:`1px solid ${filtroCasa===c?"rgba(251,191,36,.6)":C.border}`,background:filtroCasa===c?C.yellow:"transparent"}}>
                {c==="todas"?"Todas":c}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {listaFiltrada.length ? listaFiltrada.map(a=><ApostaCard key={a.id} a={a} onClick={id=>setModal({id})}/>) : (
              apostas.length===0 ? <EmptyState/> : <div style={{textAlign:"center",padding:"48px 20px",color:C.gray}}><div style={{fontSize:"2.2rem",marginBottom:10}}>🔍</div><p>Nenhuma aposta encontrada</p></div>
            )}
          </div>
        </div>
      )}

      {/* ── IA ── */}
      {tab==="ia" && (
        <div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:36,height:36,borderRadius:99,background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem"}}>🤖</div>
              <div><div style={{fontWeight:700,fontSize:".86rem"}}>Assistente de Apostas</div><div style={{fontSize:".66rem",color:C.gray,marginTop:1}}>Envie print ou descreva suas apostas</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[["chat","💬","Chat","Descrever apostas"],["img","📸","Print","Foto da casa"]].map(([m,ico,t,sub])=>(
                <div key={m} onClick={()=>{setAiMode(m);setAiRes(null);}} style={{padding:"10px 14px",borderRadius:9,border:`1px solid ${aiMode===m?"rgba(74,222,128,.32)":C.border}`,background:aiMode===m?"rgba(74,222,128,0.08)":C.bg2,cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:"1.15rem",marginBottom:3}}>{ico}</div>
                  <div style={{fontSize:".71rem",fontWeight:700,color:C.white2}}>{t}</div>
                  <div style={{fontSize:".61rem",color:C.gray,marginTop:2}}>{sub}</div>
                </div>
              ))}
            </div>
            {aiMode==="chat" && <>
              <textarea style={{...inp,resize:"none",minHeight:76,marginBottom:10}} rows={3} value={chatTxt} onChange={e=>setChatTxt(e.target.value)} placeholder={"Ex: Dupla Náutico vence @2.10 + Fortaleza top4 @1.80 — R$500 Betano\n\nOu: BET-001 bateu green / BET-002 deu red"}/>
              <button onClick={sendChat} disabled={loading} style={{width:"100%",padding:11,borderRadius:9,background:loading?"#2d6a4f":C.green,color:"#060a07",fontWeight:700,fontSize:".78rem",border:"none",cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1}}>{loading?"⏳ Processando...":"⚡ Processar com IA"}</button>
            </>}
            {aiMode==="img" && <>
              <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f){const i=document.createElement("input");i.files=e.dataTransfer.files;handleImg({target:i});}}} onClick={()=>document.getElementById("img-amigo").click()} style={{border:`2px dashed ${drag?"rgba(74,222,128,.5)":C.border}`,borderRadius:9,padding:"26px 20px",textAlign:"center",cursor:"pointer",marginBottom:10,background:drag?"rgba(74,222,128,0.06)":"transparent"}}>
                <input id="img-amigo" type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
                <div style={{fontSize:"1.6rem",marginBottom:4}}>📷</div>
                <div style={{fontSize:".76rem",color:C.gray}}><b style={{color:C.white2}}>Clique ou arraste</b> o print aqui</div>
              </div>
              {imgUrl && <img src={imgUrl} style={{maxHeight:140,width:"100%",objectFit:"contain",borderRadius:9,marginBottom:10}} alt="preview"/>}
              <button onClick={sendImg} disabled={loading} style={{width:"100%",padding:11,borderRadius:9,background:loading?"#2d6a4f":C.green,color:"#060a07",fontWeight:700,fontSize:".78rem",border:"none",cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1}}>{loading?"⏳ Lendo print...":"⚡ Ler Print com IA"}</button>
            </>}
            {aiRes && <div style={{marginTop:12,padding:"12px 14px",background:C.bg2,border:`1px solid ${aiRes.tipo==="ok"?"rgba(74,222,128,.22)":"rgba(248,113,113,.22)"}`,borderRadius:9,fontSize:".76rem",color:aiRes.tipo==="err"?C.red:C.white2,lineHeight:1.55}}>{aiRes.msg.split("\n").map((l,i)=><div key={i}>{l}</div>)}</div>}
          </div>
          <SectionTitle>Últimas Adicionadas</SectionTitle>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {apostas.length===0 ? <div style={{textAlign:"center",padding:"30px 20px",color:C.gray,fontSize:".82rem"}}>Nenhuma aposta adicionada ainda.</div>
            : [...apostas].slice(-5).reverse().map(a=><ApostaCard key={a.id} a={a} onClick={id=>setModal({id})}/>)}
          </div>
        </div>
      )}

      {/* ── STATS ── */}
      {tab==="stats" && (()=>{
        const pr=powerRanking(); const cd=chartData(); const ld=lucroLineData();
        return apostas.length===0 ? <EmptyState/> : (
          <div>
            <SectionTitle>Evolução do Lucro Líquido</SectionTitle>
            <div style={{...sBlock,marginBottom:14}}>
              <div style={{fontSize:".61rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,fontWeight:700,marginBottom:16}}>📈 Lucro acumulado · passe o mouse ou clique num ponto para ver detalhes</div>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={ld} margin={{top:8,right:8,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="data" tick={{fill:C.gray,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>{ const p=v.split("/"); return p.length===3?`${p[1]}/${p[2]?.slice(2)}`:v; }} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:C.gray,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>{ const a=Math.abs(v); return (v<0?"-":"")+(a>=1000?(a/1000).toFixed(0)+"k":a); }}/>
                  <Tooltip content={<LineTooltip/>}/>
                  <ReferenceLine y={0} stroke={C.border2} strokeDasharray="4 2" strokeWidth={1.5}/>
                  <Line type="monotone" dataKey="lucro" name="Lucro" stroke={C.green} strokeWidth={2.5} dot={{r:4,fill:C.bg,stroke:C.green,strokeWidth:2,cursor:"pointer"}} activeDot={{r:7,fill:C.green,stroke:C.card2,strokeWidth:2}} connectNulls/>
                </LineChart>
              </ResponsiveContainer>
              {ld.length>0 && <div style={{display:"flex",justifyContent:"space-between",marginTop:10,padding:"8px 12px",background:C.bg2,borderRadius:8,border:`1px solid ${C.border}`}}>
                <span style={{fontSize:".62rem",color:C.gray}}>🗓 Início: <b style={{color:C.white2}}>{ld[0]?.data}</b></span>
                <span style={{fontSize:".62rem",color:C.gray}}>Lucro atual: <b style={{color:ld[ld.length-1]?.lucro>=0?C.green:C.red}}>{frf(ld[ld.length-1]?.lucro||0)}</b></span>
              </div>}
            </div>
            <SectionTitle>Investimento vs Lucro por Casa</SectionTitle>
            <div style={{...sBlock,marginBottom:14}}>
              <div style={{fontSize:".61rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,fontWeight:700,marginBottom:16}}>📊 Comparativo por casa de aposta</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cd} margin={{top:4,right:4,left:0,bottom:4}} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="casa" tick={{fill:C.gray,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.gray,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${Math.abs(v)>=1000?(v/1000).toFixed(0)+"k":v}`}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:".7rem",color:C.gray,paddingTop:8}}/>
                  <Bar dataKey="investido" name="Investido" fill={C.blue} opacity={0.8} radius={[4,4,0,0]}/>
                  <Bar dataKey="lucro" name="Lucro/Prejuízo" radius={[4,4,0,0]}>{cd.map((d,i)=><Cell key={i} fill={d.lucro>=0?C.green:C.red} opacity={0.85}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div style={sBlock}>
                <div style={{fontSize:".61rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,fontWeight:700,marginBottom:14}}>📋 Por Tipo</div>
                {(()=>{const m={}; apostas.forEach(a=>{if(!m[a.tipo])m[a.tipo]={c:0,t:0};m[a.tipo].c++;m[a.tipo].t+=a.valor;}); return Object.entries(m).sort((a,b)=>b[1].c-a[1].c).map(([t,d])=>(<div key={t} style={sRow}><span style={{color:C.gray}}>{t}</span><span style={{fontWeight:700,fontFamily:"'JetBrains Mono',monospace",fontSize:".71rem",color:C.yellow}}>{d.c} · {fr(d.t)}</span></div>));})()}
              </div>
              <div style={sBlock}>
                <div style={{fontSize:".61rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,fontWeight:700,marginBottom:14}}>⭐ Top 5 Odds</div>
                {[...apostas].sort((a,b)=>ot(b)-ot(a)).slice(0,5).map((a,i)=>(
                  <div key={a.id} style={sRow}><span style={{color:C.gray}}>{i+1}. {a.id}</span><span style={{fontWeight:700,fontFamily:"'JetBrains Mono',monospace",fontSize:".71rem",color:C.yellow}}>{ot(a).toFixed(2)}x</span></div>
                ))}
              </div>
            </div>
            <div style={{...sBlock,marginBottom:14}}>
              <div style={{fontSize:".61rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,fontWeight:700,marginBottom:14}}>📈 Performance Geral</div>
              {[["Total apostas",apostas.length,""],["Encerradas",st.enc.length,""],["Em aberto",st.ab.length,C.blue],["Total investido",frf(st.ti),C.yellow],["Lucro líquido",frf(st.lt),st.lt>=0?C.green:C.red],["ROI",(st.roi*100).toFixed(2)+"%",st.roi>=0?C.green:C.red],["Taxa de acerto",(st.ac*100).toFixed(1)+"% ("+st.gr.length+"/"+st.enc.length+")",C.green],["Ret. potencial",frf(st.pot),C.yellow]].map(([k,v,c])=>(
                <div key={k} style={sRow}><span style={{color:C.gray}}>{k}</span><span style={{fontWeight:700,fontFamily:"'JetBrains Mono',monospace",fontSize:".71rem",color:c||C.white}}>{v}</span></div>
              ))}
            </div>
            <SectionTitle>Power Ranking de Seleções</SectionTitle>
            <div style={{...sBlock,marginBottom:14}}>
              <div style={{fontSize:".61rem",textTransform:"uppercase",letterSpacing:2,color:C.gray,fontWeight:700,marginBottom:14}}>🏆 Top 15 seleções por stake total apostada</div>
              {pr.length===0 ? <div style={{textAlign:"center",padding:"20px",color:C.gray,fontSize:".8rem"}}>Nenhuma seleção ainda.</div> :
              pr.map(r=>{
                const maxStake=pr[0].stake; const pct=(r.stake/maxStake*100).toFixed(1);
                const medalCor=r.pos===1?C.yellow:r.pos===2?"#C0C0C0":r.pos===3?"#CD7F32":C.gray;
                return(
                  <div key={r.nome} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                        <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"1rem",color:medalCor,width:28,flexShrink:0}}>{medalha(r.pos)}</span>
                        <span style={{fontSize:".78rem",fontWeight:600,color:r.pos<=3?C.white:C.white2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nome}</span>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0,marginLeft:8}}>
                        <span style={{fontSize:".62rem",color:C.gray}}>{r.apostas} bet{r.apostas>1?"s":""}</span>
                        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:".72rem",fontWeight:700,color:C.yellow}}>{fr(r.stake,false)}</span>
                      </div>
                    </div>
                    <div style={{height:4,background:C.border,borderRadius:99,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:r.pos===1?`linear-gradient(90deg,${C.yellow},#f59e0b)`:r.pos<=3?`linear-gradient(90deg,${C.green3},${C.green})`:`linear-gradient(90deg,${C.border2},${C.gray})`,borderRadius:99}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── MODAL STATUS ── */}
      {modal && modalAposta && (
        <div onClick={e=>{if(e.target===e.currentTarget)setModal(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.card2,border:`1px solid ${C.border2}`,borderRadius:14,padding:24,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.6)"}}>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"1.15rem",letterSpacing:2,color:C.green,marginBottom:4}}>{modalAposta.id}</div>
            <div style={{fontSize:".73rem",color:C.gray,marginBottom:16}}>{modalAposta.tipo} · {modalAposta.casa} · {modalAposta.data}</div>
            <div style={{marginBottom:14}}>
              {modalAposta.sels.map((s,i)=>(
                <div key={i} style={{padding:"8px 12px",background:C.bg2,borderRadius:9,marginBottom:6,display:"flex",justifyContent:"space-between",fontSize:".77rem",border:`1px solid ${C.border}`}}>
                  <span>{s.nome}</span><span style={{fontFamily:"'JetBrains Mono',monospace",color:C.yellow,fontWeight:600,fontSize:".71rem"}}>@{s.odd.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[["Valor",frf(modalAposta.valor),C.white],["Odd Total",ot(modalAposta).toFixed(2)+"x",C.white],["Retorno",frf(ret(modalAposta)),C.white],["Lucro",luc(modalAposta)!=null?frf(luc(modalAposta)):"Em aberto",luc(modalAposta)==null?C.gray:luc(modalAposta)>=0?C.green:C.red]].map(([l,v,c])=>(
                <div key={l} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px"}}>
                  <div style={{fontSize:".59rem",textTransform:"uppercase",letterSpacing:1.5,color:C.gray,marginBottom:3}}>{l}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:".82rem",fontWeight:600,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:".65rem",textTransform:"uppercase",letterSpacing:1.5,color:C.gray,fontWeight:700,marginBottom:10}}>Atualizar Status</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {[["green","✅ Green","Green"],["red","❌ Red","Red"],["aberto","⏳ Em Aberto","Em Aberto"]].map(([k,l,s])=>{
                const mc={green:{bg:"rgba(74,222,128,.12)",c:C.green,b:"rgba(74,222,128,.28)"},red:{bg:"rgba(248,113,113,.12)",c:C.red,b:"rgba(248,113,113,.28)"},aberto:{bg:"rgba(96,165,250,.08)",c:C.blue,b:"rgba(96,165,250,.18)"}}[k];
                return <button key={k} onClick={()=>setStatus(s)} style={{padding:11,borderRadius:9,fontSize:".73rem",fontWeight:700,cursor:"pointer",background:mc.bg,color:mc.c,border:`1px solid ${mc.b}`,letterSpacing:.5}}>{l}</button>;
              })}
              <button onClick={()=>setShowCashoutField(p=>!p)} style={{padding:11,borderRadius:9,fontSize:".73rem",fontWeight:700,cursor:"pointer",background:showCashoutField?"rgba(251,146,60,.2)":"rgba(251,146,60,.12)",color:C.cashout,border:`1px solid ${showCashoutField?"rgba(251,146,60,.45)":"rgba(251,146,60,.2)"}`,letterSpacing:.5}}>💰 Cashout</button>
            </div>
            {showCashoutField && (
              <div style={{background:"rgba(251,146,60,.06)",border:"1px solid rgba(251,146,60,.25)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:".6rem",textTransform:"uppercase",letterSpacing:1.5,color:C.cashout,fontWeight:700,marginBottom:8}}>Valor recebido no cashout (R$)</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input type="number" step="0.01" value={cashoutInput[modal.id]??modalAposta.valor} onChange={e=>setCashoutInput(p=>({...p,[modal.id]:e.target.value}))} style={{...inp,flex:1,border:"1px solid rgba(251,146,60,.35)",background:C.bg2}}/>
                  <button onClick={()=>{ const v=parseFloat(cashoutInput[modal.id]); if(isNaN(v)||v<0)return; setStatus("Cashout",v); }} style={{padding:"9px 16px",borderRadius:9,fontSize:".73rem",fontWeight:700,cursor:"pointer",background:C.cashout,color:"#1a0a00",border:"none",whiteSpace:"nowrap",boxShadow:"0 2px 12px rgba(251,146,60,.3)"}}>Confirmar</button>
                </div>
                <div style={{fontSize:".6rem",color:C.gray,marginTop:6}}>
                  Lucro/prejuízo: <b style={{color:(parseFloat(cashoutInput[modal.id]??modalAposta.valor)-modalAposta.valor)>=0?C.green:C.red}}>{frf((parseFloat(cashoutInput[modal.id]??modalAposta.valor)||0)-modalAposta.valor)}</b>
                </div>
              </div>
            )}
            <button onClick={()=>setShowEdit(true)} style={{width:"100%",padding:10,borderRadius:9,fontSize:".7rem",fontWeight:700,cursor:"pointer",background:"rgba(74,222,128,.08)",color:C.green,border:"1px solid rgba(74,222,128,.2)",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>✏️ Editar Aposta</button>
            {!confirmDelete ? (
              <button onClick={()=>setConfirmDelete(true)} style={{width:"100%",padding:10,borderRadius:9,fontSize:".7rem",fontWeight:700,cursor:"pointer",background:"rgba(220,38,38,.08)",color:C.red,border:"1px solid rgba(220,38,38,.18)",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>🗑 Excluir Aposta</button>
            ) : (
              <div style={{background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:9,padding:"12px 14px",marginBottom:8}}>
                <div style={{fontSize:".72rem",color:C.red,fontWeight:600,marginBottom:10,textAlign:"center"}}>Tem certeza? Essa ação não pode ser desfeita.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <button onClick={()=>setConfirmDelete(false)} style={{padding:9,borderRadius:8,fontSize:".72rem",cursor:"pointer",background:"transparent",color:C.gray,border:`1px solid ${C.border}`}}>Cancelar</button>
                  <button onClick={deleteAposta} style={{padding:9,borderRadius:8,fontSize:".72rem",fontWeight:700,cursor:"pointer",background:"rgba(220,38,38,.18)",color:C.red,border:"1px solid rgba(220,38,38,.35)"}}>Confirmar</button>
                </div>
              </div>
            )}
            <button onClick={()=>{setModal(null);setConfirmDelete(false);setShowCashoutField(false);}} style={{width:"100%",padding:9,borderRadius:9,fontSize:".7rem",cursor:"pointer",background:"transparent",color:C.gray,border:`1px solid ${C.border}`}}>Fechar</button>
          </div>
        </div>
      )}

      {showAdd && <ModalAdicionarBet onSave={adicionarBet} onClose={()=>setShowAdd(false)}/>}
      {showEdit && modalAposta && <ModalAdicionarBet apostaDados={modalAposta} onSave={editarBet} onClose={()=>setShowEdit(false)}/>}
      {toast && <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:C.card2,border:`1px solid ${toast.tipo==="ok"?"rgba(74,222,128,.28)":"rgba(248,113,113,.28)"}`,borderRadius:99,padding:"10px 22px",fontSize:".76rem",fontWeight:600,zIndex:999,color:toast.tipo==="ok"?C.green:C.red,whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,.4)"}}>{toast.msg}</div>}
    </div>
  );
}
