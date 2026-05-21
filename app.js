// ============================================================
//  app.js — Checklist RT | Hospital do Coração de Natal
//  v4.0 — Admin, NC obrigatório, Dashboard NCs expandível
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc,
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

// ── Admins ─────────────────────────────────────────────────
const ADMINS = [
  "carlisonrn@gmail.com",
  "edna.chieregato@athena.hcnatal.com.br"
];

// ── Constantes ─────────────────────────────────────────────
const UTIs = ["UTI 1/A","UTI 1/B","UTI 2/A","UTI 2/B","UTI 3/A"];
const DIAS_LABEL = {1:"Segunda",2:"Terça",3:"Quarta",4:"Quinta",5:"Sexta"};
const MESES_NOME = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const INDICADORES_PADRAO = [
  { id:"cme",          label:"Limpeza e Armazenamento CME",                           dias:[2,4], freq:"2x/sem" },
  { id:"laringo",      label:"Limpeza e Desinfecção de Laringoscópio",                dias:[4],   freq:"1x/sem" },
  { id:"caixa_urg",   label:"Caixa de Urgência e Caixa de Transporte",                dias:[1,5], freq:"2x/sem" },
  { id:"carro_urg",   label:"Carro de Urgência",                                       dias:[1,5], freq:"2x/sem" },
  { id:"desfib",      label:"Desfibrilador",                                           dias:[1,5], freq:"2x/sem" },
  { id:"umidade",     label:"Umidade do Ar / Geladeira da Unidade e da Copa",          dias:[2,4], freq:"2x/sem" },
  { id:"mat_mh",      label:"Limpeza e Desinfecção de Materiais Médico-Hospitalares",  dias:[2,4], freq:"2x/sem" },
  { id:"pertences",   label:"Pertences de Pacientes (Sacos Transp.) e Almotolias",     dias:[2,4], freq:"2x/sem" },
  { id:"huddle",      label:"HUDDLE (Reunião de Alinhamento)",                         dias:[3],   freq:"1x/sem" },
  { id:"visita_multi",label:"Visita Multiprofissional",                                dias:[1,5], freq:"2x/sem" },
  { id:"infra",       label:"Infraestrutura do Setor",                                 dias:[1,4], freq:"2x/sem" },
  { id:"quadro_seg",  label:"Quadro de Segurança do Paciente",                         dias:[1,4], freq:"2x/sem" },
  { id:"termos",      label:"Termos",                                                  dias:[1,4], freq:"2x/sem" },
  { id:"tev",         label:"Protocolo de TEV (Tromboembolismo Venoso)",               dias:[1,4], freq:"2x/sem" },
];

const INDICADORES_UTI2B = [
  { id:"cme",          label:"Limpeza e Armazenamento CME",                           dias:[1,4], freq:"2x/sem" },
  { id:"laringo",      label:"Limpeza e Desinfecção de Laringoscópio",                dias:[3],   freq:"1x/sem" },
  { id:"caixa_urg",   label:"Caixa de Urgência e Caixa de Transporte",                dias:[1,5], freq:"2x/sem" },
  { id:"carro_urg",   label:"Carro de Urgência",                                       dias:[1,5], freq:"2x/sem" },
  { id:"desfib",      label:"Desfibrilador",                                           dias:[1,5], freq:"2x/sem" },
  { id:"umidade",     label:"Umidade do Ar / Geladeira da Unidade e da Copa",          dias:[1,5], freq:"2x/sem" },
  { id:"mat_mh",      label:"Limpeza e Desinfecção de Materiais Médico-Hospitalares",  dias:[2,4], freq:"2x/sem" },
  { id:"pertences",   label:"Pertences de Pacientes (Sacos Transp.) e Almotolias",     dias:[2,4], freq:"2x/sem" },
  { id:"huddle",      label:"HUDDLE (Reunião de Alinhamento)",                         dias:[3],   freq:"1x/sem" },
  { id:"visita_multi",label:"Visita Multiprofissional",                                dias:[1,5], freq:"2x/sem" },
  { id:"infra",       label:"Infraestrutura do Setor",                                 dias:[1,4], freq:"2x/sem" },
  { id:"quadro_seg",  label:"Quadro de Segurança do Paciente",                         dias:[1,4], freq:"2x/sem" },
  { id:"termos",      label:"Termos",                                                  dias:[1,4], freq:"2x/sem" },
  { id:"tev",         label:"Protocolo de TEV (Tromboembolismo Venoso)",               dias:[1,4], freq:"2x/sem" },
];

function getIndicadores(uti) {
  return uti === "UTI 2/B" ? INDICADORES_UTI2B : INDICADORES_PADRAO;
}

// ── Estado Global ──────────────────────────────────────────
let currentUser    = null;
let isAdmin        = false;
let currentMes     = "";
let currentUTI     = "";
let currentData    = null;
let dadosChecklist = {}; // { "s1_cme_7": "C" | "NC", "s1_cme_7_obs": "texto..." }

// ── Helpers ────────────────────────────────────────────────
function mesStr(d)    { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function mesLabel(m)  { const [a,ms]=m.split("-"); return `${MESES_NOME[parseInt(ms)-1]} ${a}`; }
function dataFormatada(d) { return d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}); }
function dataInput(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function chaveDoc(mes,uti) { return `${mes}_${uti.replace(/\//g,"_").replace(/ /g,"_")}`; }
function emailId(email) { return email.toLowerCase().replace(/[^a-z0-9]/g,"_"); }

function getSemanaDoMes(date) {
  let s = 1;
  for (let d=1; d<date.getDate(); d++)
    if (new Date(date.getFullYear(),date.getMonth(),d).getDay()===5) s++;
  return Math.min(s,5);
}

function showToast(msg, tipo="ok") {
  const t = document.createElement("div");
  t.className = `toast toast--${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add("toast--show"),10);
  setTimeout(()=>{ t.classList.remove("toast--show"); setTimeout(()=>t.remove(),300); },3000);
}

// ── Auth helpers ───────────────────────────────────────────
async function verificarAcesso(email) {
  if (ADMINS.includes(email)) return true;
  const snap = await getDoc(doc(db,"usuarios_autorizados",emailId(email)));
  return snap.exists() && snap.data().ativo !== false;
}

// ── Firestore: usuários ────────────────────────────────────
async function listarUsuarios() {
  const snaps = await getDocs(collection(db,"usuarios_autorizados"));
  return snaps.docs.map(d=>({id:d.id,...d.data()}));
}
async function adicionarUsuario(email, nome) {
  await setDoc(doc(db,"usuarios_autorizados",emailId(email)), {
    email: email.toLowerCase().trim(),
    nome:  nome.trim(),
    ativo: true,
    criadoEm:  new Date().toISOString(),
    criadoPor: currentUser.email
  });
}
async function removerUsuario(id)        { await deleteDoc(doc(db,"usuarios_autorizados",id)); }
async function toggleUsuario(id, ativo)  { await setDoc(doc(db,"usuarios_autorizados",id),{ativo},{merge:true}); }

// ── Firestore: auditorias ──────────────────────────────────
async function salvarDados() {
  if (!currentUser||!currentMes||!currentUTI) return;
  await setDoc(doc(db,"auditorias",chaveDoc(currentMes,currentUTI)),{
    uid: currentUser.uid, mes: currentMes, uti: currentUTI,
    dados: dadosChecklist, updatedAt: new Date().toISOString()
  });
}
async function carregarDados(mes,uti) {
  const snap = await getDoc(doc(db,"auditorias",chaveDoc(mes,uti)));
  dadosChecklist = snap.exists() ? (snap.data().dados||{}) : {};
}
async function carregarTodosMes(mes) {
  const snaps = await getDocs(query(collection(db,"auditorias"),where("mes","==",mes)));
  const res={};
  snaps.forEach(s=>{ res[s.data().uti]=s.data().dados||{}; });
  return res;
}
async function listarHistorico() {
  const snaps = await getDocs(collection(db,"auditorias"));
  const hist={};
  snaps.forEach(s=>{
    const d=s.data();
    if(!hist[d.mes]) hist[d.mes]={};
    hist[d.mes][d.uti]=d.dados||{};
  });
  return hist;
}

// ── Loading ────────────────────────────────────────────────
function showLoading(msg="Carregando...") {
  document.getElementById("main-content").innerHTML=`
    <div class="loading-screen">
      <div class="loading-icon">♥</div>
      <p class="loading-msg">${msg}</p>
    </div>`;
}

// ── Shell ──────────────────────────────────────────────────
function renderShell(activePage) {
  if (document.getElementById("shell")) { updateNav(activePage); return; }
  const adminNav = isAdmin ? `
    <button class="nav-item ${activePage==="admin"?"active":""}" data-page="admin">
      <span class="nav-icon">👥</span><span class="nav-label">Usuários</span>
    </button>` : "";

  document.getElementById("app").innerHTML = `
    <div id="shell">
      <aside id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">♥</div>
          <div class="sidebar-brand">
            <span class="brand-name">Hospital do Coração</span>
            <span class="brand-sub">Checklist RT</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          <button class="nav-item ${activePage==="home"?"active":""}"      data-page="home">
            <span class="nav-icon">📋</span><span class="nav-label">Auditoria</span>
          </button>
          <button class="nav-item ${activePage==="historico"?"active":""}" data-page="historico">
            <span class="nav-icon">📂</span><span class="nav-label">Histórico</span>
          </button>
          <button class="nav-item ${activePage==="dashboard"?"active":""}" data-page="dashboard">
            <span class="nav-icon">📊</span><span class="nav-label">Dashboard</span>
          </button>
          ${adminNav}
        </nav>
        <div class="sidebar-footer">
          <div class="user-info">
            <span class="user-avatar">${currentUser.displayName?.charAt(0)||"R"}</span>
            <div class="user-details">
              <span class="user-name">${currentUser.displayName?.split(" ")[0]||"RT"}</span>
              <span class="user-role">${isAdmin?"Admin":"Usuário"}</span>
            </div>
          </div>
          <button class="btn-logout" id="btn-logout">⏻</button>
        </div>
      </aside>
      <div id="content-wrap">
        <header id="mobile-bar">
          <button class="mob-menu-btn" id="mob-menu-btn">☰</button>
          <div class="mob-title"><span class="mob-heart">♥</span><span>Checklist RT</span></div>
          <button class="btn-icon-sm" id="btn-logout-mob">⏻</button>
        </header>
        <main id="main-content"></main>
      </div>
      <div id="mob-overlay" class="mob-overlay"></div>
    </div>`;

  document.getElementById("mob-menu-btn").addEventListener("click",()=>{
    document.getElementById("sidebar").classList.toggle("mob-open");
    document.getElementById("mob-overlay").classList.toggle("active");
  });
  document.getElementById("mob-overlay").addEventListener("click", closeMobMenu);
  document.getElementById("btn-logout").addEventListener("click",     ()=>signOut(auth));
  document.getElementById("btn-logout-mob").addEventListener("click", ()=>signOut(auth));

  document.querySelectorAll(".nav-item").forEach(btn=>{
    btn.addEventListener("click",()=>{
      closeMobMenu();
      const p=btn.dataset.page;
      if      (p==="home")      renderHome();
      else if (p==="historico") renderHistorico();
      else if (p==="dashboard"){ currentMes=mesStr(currentData||new Date()); renderDashboard(); }
      else if (p==="admin")     renderAdmin();
    });
  });
}

function closeMobMenu() {
  document.getElementById("sidebar")?.classList.remove("mob-open");
  document.getElementById("mob-overlay")?.classList.remove("active");
}
function updateNav(p) {
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
}

// ── Login ──────────────────────────────────────────────────
function renderLogin() {
  document.getElementById("app").innerHTML=`
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo-wrap">
          <div class="login-heart">♥</div>
          <div>
            <span class="login-hospital">Hospital do Coração</span>
            <span class="login-sub">Checklist RT — Auditoria Mensal</span>
          </div>
        </div>
        <p class="login-desc">Acesse com sua conta Google autorizada</p>
        <button class="btn-google" id="btn-login">
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.2-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.6 4.9C9.8 39.7 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.9 35.5 44 30.1 44 24c0-1.3-.2-2.7-.4-4z"/>
          </svg>
          Entrar com Google
        </button>
        <p id="login-erro" class="login-erro"></p>
      </div>
    </div>`;
  document.getElementById("btn-login").addEventListener("click",async()=>{
    try { await signInWithPopup(auth,provider); }
    catch(e){ document.getElementById("login-erro").textContent="Erro ao fazer login. Tente novamente."; }
  });
}

function renderAcessoNegado() {
  document.getElementById("app").innerHTML=`
    <div class="login-screen">
      <div class="login-card login-card--negado">
        <div class="negado-icon">🔒</div>
        <h2 class="negado-titulo">Acesso não autorizado</h2>
        <p class="negado-desc">
          Sua conta <strong>${currentUser?.email}</strong> não tem permissão para acessar este sistema.<br><br>
          Solicite acesso a um dos administradores.
        </p>
        <button class="btn-google" id="btn-sair-negado">Sair e tentar outra conta</button>
      </div>
    </div>`;
  document.getElementById("btn-sair-negado").addEventListener("click",()=>signOut(auth));
}

// ── Home ───────────────────────────────────────────────────
function renderHome() {
  renderShell("home"); updateNav("home");
  if (!currentData) currentData = new Date();
  const dow = currentData.getDay();
  const isWeekend = dow===0||dow===6;

  document.getElementById("main-content").innerHTML=`
    <div class="page-home">
      <div class="page-header">
        <h1 class="page-title">Nova Auditoria</h1>
        <p class="page-subtitle">Selecione a data e a unidade para iniciar</p>
      </div>
      <div class="card">
        <label class="field-label">Data da Auditoria</label>
        <input type="date" id="input-data" class="field-input"
               value="${dataInput(currentData)}" max="${dataInput(new Date())}"/>
        <div class="dia-badge ${isWeekend?"dia-badge--warn":""}">
          ${isWeekend?"⚠️ Final de semana — sem itens de auditoria":`📅 ${dataFormatada(currentData)}`}
        </div>
      </div>
      ${!isWeekend?`
      <div class="card">
        <label class="field-label">Unidade</label>
        <div class="uti-grid">
          ${UTIs.map(u=>{
            const n=getIndicadores(u).filter(i=>i.dias.includes(dow)).length;
            return `<button class="uti-btn" data-uti="${u}">
              <span class="uti-code">${u}</span>
              <span class="uti-count">${n} item${n!==1?"s":""}</span>
            </button>`;
          }).join("")}
        </div>
      </div>`:""}
      <button class="btn-dash-link" id="btn-go-dash">📊 Ver Dashboard do mês</button>
    </div>`;

  document.getElementById("input-data").addEventListener("change",e=>{
    currentData=new Date(e.target.value+"T12:00:00"); renderHome();
  });
  document.getElementById("btn-go-dash").addEventListener("click",()=>{
    currentMes=mesStr(currentData); renderDashboard();
  });
  document.querySelectorAll(".uti-btn").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      currentUTI=btn.dataset.uti; currentMes=mesStr(currentData);
      showLoading("Carregando checklist...");
      await carregarDados(currentMes,currentUTI);
      renderChecklist();
    });
  });
}

// ── Checklist ──────────────────────────────────────────────
function renderChecklist() {
  renderShell("home"); updateNav("home");
  const dow       = currentData.getDay();
  const semana    = getSemanaDoMes(currentData);
  const diaN      = currentData.getDate();
  const itens     = getIndicadores(currentUTI).filter(i=>i.dias.includes(dow));
  const chaves    = itens.map(i=>`s${semana}_${i.id}_${diaN}`);

  function calcProgresso() {
    // item completo = tem valor C, ou tem valor NC + obs não vazia
    return itens.filter((_,idx)=>{
      const k=chaves[idx]; const v=dadosChecklist[k];
      if (v==="C") return true;
      if (v==="NC") return (dadosChecklist[k+"_obs"]||"").trim().length>0;
      return false;
    }).length;
  }

  function atualizarProgresso() {
    const resp=calcProgresso();
    const pct=itens.length>0?Math.round((resp/itens.length)*100):0;
    const bar=document.getElementById("prog-bar");
    const lbl=document.getElementById("prog-label");
    if(bar) bar.style.width=pct+"%";
    if(lbl) lbl.textContent=`${resp}/${itens.length} itens`;
  }

  const resp0=calcProgresso();
  const pct0 =itens.length>0?Math.round((resp0/itens.length)*100):0;

  document.getElementById("main-content").innerHTML=`
    <div class="page-checklist">
      <div class="checklist-topbar">
        <button class="btn-back" id="btn-back">← Voltar</button>
        <div class="checklist-info">
          <span class="checklist-uti">${currentUTI}</span>
          <span class="checklist-data">${DIAS_LABEL[dow]}, ${currentData.toLocaleDateString("pt-BR")}</span>
        </div>
        <button class="btn-save" id="btn-salvar">💾 Salvar</button>
      </div>

      <div class="progress-wrap">
        <div class="progress-bar-outer">
          <div class="progress-bar-inner" id="prog-bar" style="width:${pct0}%"></div>
        </div>
        <span class="progress-label" id="prog-label">${resp0}/${itens.length} itens</span>
      </div>

      ${itens.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>Nenhum item de auditoria para ${DIAS_LABEL[dow]}.</p>
        </div>`:`
      <div class="checklist-list">
        ${itens.map((ind,idx)=>{
          const chave=chaves[idx];
          const val  =dadosChecklist[chave]||"";
          const obs  =dadosChecklist[chave+"_obs"]||"";
          return `
            <div class="cl-item ${val==="C"?"cl-item--c":val==="NC"?"cl-item--nc":""}" data-chave="${chave}">
              <div class="cl-item-top">
                <div class="cl-item-left">
                  <span class="cl-num">${String(idx+1).padStart(2,"0")}</span>
                  <div class="cl-text">
                    <span class="cl-label">${ind.label}</span>
                    <span class="cl-freq">${ind.freq}</span>
                  </div>
                </div>
                <div class="cl-toggle">
                  <button class="tog-btn tog-c  ${val==="C" ?"tog-active":""}" data-key="${chave}" data-val="C">C</button>
                  <button class="tog-btn tog-nc ${val==="NC"?"tog-active":""}" data-key="${chave}" data-val="NC">NC</button>
                </div>
              </div>
              <div class="nc-obs-wrap ${val==="NC"?"nc-obs-wrap--visible":""}" id="obs-wrap-${chave}">
                <textarea
                  class="nc-obs-input ${obs.trim()&&val==="NC"?"nc-obs-input--filled":""}"
                  id="obs-${chave}"
                  placeholder="Descreva a não conformidade... (obrigatório)"
                  maxlength="500"
                >${obs}</textarea>
                <span class="nc-obs-hint">Campo obrigatório para salvar com NC</span>
              </div>
            </div>`;
        }).join("")}
      </div>`}
    </div>`;

  document.getElementById("btn-back").addEventListener("click", renderHome);

  // Toggles C / NC
  document.querySelectorAll(".tog-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const key=btn.dataset.key; const val=btn.dataset.val;
      const jaAtivo=btn.classList.contains("tog-active");
      document.querySelectorAll(`.tog-btn[data-key="${key}"]`).forEach(b=>b.classList.remove("tog-active"));
      const item=document.querySelector(`.cl-item[data-chave="${key}"]`);
      const obsWrap=document.getElementById(`obs-wrap-${key}`);
      item.classList.remove("cl-item--c","cl-item--nc");

      if (!jaAtivo) {
        btn.classList.add("tog-active");
        dadosChecklist[key]=val;
        if (val==="NC") {
          item.classList.add("cl-item--nc");
          obsWrap.classList.add("nc-obs-wrap--visible");
          setTimeout(()=>document.getElementById(`obs-${key}`)?.focus(),100);
        } else {
          item.classList.add("cl-item--c");
          obsWrap.classList.remove("nc-obs-wrap--visible");
          delete dadosChecklist[key+"_obs"];
        }
      } else {
        delete dadosChecklist[key];
        delete dadosChecklist[key+"_obs"];
        obsWrap.classList.remove("nc-obs-wrap--visible");
      }
      atualizarProgresso();
    });
  });

  // Salvar obs no estado enquanto digita
  document.querySelectorAll(".nc-obs-input").forEach(ta=>{
    const key=ta.id.replace("obs-","");
    ta.addEventListener("input",()=>{
      dadosChecklist[key+"_obs"]=ta.value;
      ta.classList.toggle("nc-obs-input--filled", ta.value.trim().length>0);
      atualizarProgresso();
    });
  });

  // Salvar
  document.getElementById("btn-salvar").addEventListener("click",async()=>{
    // Validar NCs sem obs
    const semObs=itens.filter((_,idx)=>{
      const k=chaves[idx];
      return dadosChecklist[k]==="NC" && !(dadosChecklist[k+"_obs"]||"").trim();
    });
    if (semObs.length>0) {
      showToast(`Preencha a descrição das ${semObs.length} NC(s) antes de salvar.`,"erro");
      // Destacar campos vazios
      semObs.forEach(ind=>{
        const k=`s${semana}_${ind.id}_${diaN}`;
        document.getElementById(`obs-${k}`)?.classList.add("nc-obs-input--error");
      });
      return;
    }
    const btn=document.getElementById("btn-salvar");
    btn.textContent="⏳ Salvando..."; btn.disabled=true;
    await salvarDados();
    showToast("Auditoria salva com sucesso!","ok");
    btn.textContent="✅ Salvo!";
    setTimeout(()=>{ btn.textContent="💾 Salvar"; btn.disabled=false; },2000);
  });
}

// ── Histórico ──────────────────────────────────────────────
async function renderHistorico() {
  renderShell("historico"); updateNav("historico");
  showLoading("Carregando histórico...");
  const hist  = await listarHistorico();
  const meses = Object.keys(hist).sort().reverse();

  if (meses.length===0) {
    document.getElementById("main-content").innerHTML=`
      <div class="page-historico">
        <div class="page-header"><h1 class="page-title">Histórico</h1></div>
        <div class="empty-state"><div class="empty-icon">📂</div><p>Nenhuma auditoria registrada ainda.</p></div>
      </div>`;
    return;
  }

  document.getElementById("main-content").innerHTML=`
    <div class="page-historico">
      <div class="page-header">
        <h1 class="page-title">Histórico</h1>
        <p class="page-subtitle">${meses.length} mês(es) com registros</p>
      </div>
      ${meses.map(mes=>{
        const dados=hist[mes];
        const utisReg=Object.keys(dados);
        const totalC =utisReg.reduce((a,u)=>a+Object.entries(dados[u]).filter(([k,v])=>!k.endsWith("_obs")&&v==="C").length,0);
        const totalNC=utisReg.reduce((a,u)=>a+Object.entries(dados[u]).filter(([k,v])=>!k.endsWith("_obs")&&v==="NC").length,0);
        const total  =totalC+totalNC;
        const pct    =total>0?Math.round((totalC/total)*100):null;
        return `
          <div class="hist-card">
            <div class="hist-card-header">
              <div>
                <h2 class="hist-mes">${mesLabel(mes)}</h2>
                <span class="hist-utis">${utisReg.length} UTI(s) auditada(s)</span>
              </div>
              <div class="hist-pct-badge ${pct===null?"":pct>=80?"pct-ok":pct>=60?"pct-warn":"pct-crit"}">
                ${pct!==null?pct+"%":"—"}
              </div>
            </div>
            <div class="hist-uti-row">
              ${UTIs.map(uti=>{
                const d=dados[uti];
                if(!d||Object.keys(d).length===0)
                  return `<div class="hist-uti-chip hist-uti-chip--vazio" title="${uti}">${uti}</div>`;
                const c =Object.entries(d).filter(([k,v])=>!k.endsWith("_obs")&&v==="C").length;
                const nc=Object.entries(d).filter(([k,v])=>!k.endsWith("_obs")&&v==="NC").length;
                const t =c+nc; const p=t>0?Math.round((c/t)*100):0;
                return `<div class="hist-uti-chip hist-uti-chip--${p>=80?"ok":p>=60?"warn":"crit"}"
                             title="${uti}: ${p}% (${c}C / ${nc}NC)">
                  ${uti}<br><small>${p}%</small>
                </div>`;
              }).join("")}
            </div>
            <div class="hist-actions">
              <button class="btn-hist-dash" data-mes="${mes}">📊 Dashboard</button>
              <span class="hist-detail">${totalC}C / ${totalNC}NC de ${total} itens</span>
            </div>
          </div>`;
      }).join("")}
    </div>`;

  document.querySelectorAll(".btn-hist-dash").forEach(btn=>{
    btn.addEventListener("click",()=>{ currentMes=btn.dataset.mes; renderDashboard(); });
  });
}

// ── Dashboard ──────────────────────────────────────────────
async function renderDashboard() {
  renderShell("dashboard"); updateNav("dashboard");
  if (!currentMes) currentMes=mesStr(new Date());
  showLoading("Calculando indicadores...");

  const hist  = await listarHistorico();
  const todos = await carregarTodosMes(currentMes);
  const mesesDisp = Object.keys(hist).sort().reverse();

  // Stats por UTI
  const stats=UTIs.map(uti=>{
    const d=todos[uti]||{};
    const entries=Object.entries(d).filter(([k])=>!k.endsWith("_obs"));
    const c =entries.filter(([,v])=>v==="C").length;
    const nc=entries.filter(([,v])=>v==="NC").length;
    const tot=c+nc;
    // Coletar NCs com obs agrupadas por indicador
    const ncs=[];
    entries.filter(([,v])=>v==="NC").forEach(([k])=>{
      const obs=(d[k+"_obs"]||"").trim();
      // Extrair id do indicador da chave: s{n}_{id}_{dia}
      const parts=k.split("_"); // ex: s1, caixa, urg, 7 — ou s1, cme, 7
      const indId=parts.slice(1,-1).join("_");
      const dia=parts[parts.length-1];
      const ind=[...INDICADORES_PADRAO,...INDICADORES_UTI2B].find(i=>i.id===indId);
      ncs.push({ label: ind?.label||indId, dia, obs });
    });
    return { uti, c, nc, total:tot, pct:tot>0?Math.round((c/tot)*100):null, ncs };
  });

  // Stats por indicador
  const indStats=INDICADORES_PADRAO.map(ind=>{
    let c=0,nc=0;
    UTIs.forEach(uti=>{
      Object.entries(todos[uti]||{}).forEach(([k,v])=>{
        if(!k.endsWith("_obs")&&k.includes(`_${ind.id}_`)){
          if(v==="C") c++; else if(v==="NC") nc++;
        }
      });
    });
    const tot=c+nc;
    return {...ind,c,nc,total:tot,pct:tot>0?Math.round((c/tot)*100):null};
  });

  // Total de NCs com obs no mês
  const totalNCs=stats.reduce((a,s)=>a+s.ncs.length,0);

  document.getElementById("main-content").innerHTML=`
    <div class="page-dash" id="dash-print">
      <div class="page-header dash-header-row">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Conformidade mensal por UTI e indicador</p>
        </div>
        <div class="dash-controls">
          <select class="field-input field-input--sm" id="sel-mes-dash">
            ${mesesDisp.map(m=>`<option value="${m}" ${m===currentMes?"selected":""}>${mesLabel(m)}</option>`).join("")}
            ${!mesesDisp.includes(currentMes)?`<option value="${currentMes}" selected>${mesLabel(currentMes)}</option>`:""}
          </select>
          <button class="btn-print" onclick="window.print()">🖨️ PDF</button>
        </div>
      </div>

      <!-- Cards por UTI -->
      <div class="dash-uti-grid">
        ${stats.map(s=>`
          <div class="dash-uti-card dash-uti-card--${s.pct===null?"vazio":s.pct>=80?"ok":s.pct>=60?"warn":"crit"}">
            <div class="duc-name">${s.uti}</div>
            <div class="duc-pct">${s.pct!==null?s.pct+"%":"—"}</div>
            <div class="duc-badges">
              ${s.total>0?`<span class="bd-c">${s.c} C</span><span class="bd-nc">${s.nc} NC</span>`:"Sem dados"}
            </div>
            <div class="prog-bar-outer">
              <div class="prog-bar-inner prog-bar-inner--${s.pct===null?"vazio":s.pct>=80?"ok":s.pct>=60?"warn":"crit"}"
                   style="width:${s.pct||0}%"></div>
            </div>
          </div>`).join("")}
      </div>

      <!-- Indicadores -->
      <div class="card">
        <h2 class="card-title">Conformidade por Indicador</h2>
        <div class="ind-dash-list">
          ${indStats.map(i=>`
            <div class="ind-dash-row">
              <span class="ind-dash-lbl">${i.label}</span>
              <div class="ind-dash-track">
                <div class="ind-dash-fill ind-dash-fill--${i.pct===null?"empty":i.pct>=80?"ok":i.pct>=60?"warn":"crit"}"
                     style="width:${i.pct||0}%"></div>
              </div>
              <span class="ind-dash-pct">${i.pct!==null?i.pct+"%":"—"}</span>
            </div>`).join("")}
        </div>
      </div>

      <!-- Não Conformidades -->
      <div class="card">
        <h2 class="card-title">
          Não Conformidades Registradas
          <span class="nc-total-badge ${totalNCs===0?"nc-total-badge--ok":"nc-total-badge--alert"}">${totalNCs}</span>
        </h2>
        ${totalNCs===0
          ? `<div class="nc-vazio"><span>✅</span> Nenhuma não conformidade registrada neste mês.</div>`
          : stats.filter(s=>s.ncs.length>0).map(s=>`
              <div class="nc-uti-bloco">
                <button class="nc-uti-toggle" data-uti="${s.uti}">
                  <span class="nc-uti-nome">${s.uti}</span>
                  <span class="nc-uti-count">${s.ncs.length} NC${s.ncs.length!==1?"s":""}</span>
                  <span class="nc-chevron" id="chev-${s.uti.replace(/[\/ ]/g,"-")}">▼</span>
                </button>
                <div class="nc-uti-lista" id="nclista-${s.uti.replace(/[\/ ]/g,"-")}">
                  ${s.ncs.map(nc=>`
                    <div class="nc-item">
                      <div class="nc-item-header">
                        <span class="nc-item-ind">📌 ${nc.label}</span>
                        <span class="nc-item-dia">Dia ${nc.dia}</span>
                      </div>
                      ${nc.obs?`<p class="nc-item-obs">${nc.obs}</p>`
                               :`<p class="nc-item-obs nc-item-obs--vazio">Sem descrição registrada.</p>`}
                    </div>`).join("")}
                </div>
              </div>`).join("")}
      </div>

      <!-- Legenda -->
      <div class="card legenda-card">
        <div class="legenda">
          <span class="leg-item leg-ok">≥ 80% Conforme</span>
          <span class="leg-item leg-warn">60–79% Atenção</span>
          <span class="leg-item leg-crit">&lt; 60% Crítico</span>
        </div>
      </div>

      <div class="dash-footer">
        <p>Hospital do Coração de Natal — Grupo Atena</p>
        <p>Responsável Técnico | ${new Date().toLocaleDateString("pt-BR")}</p>
      </div>
    </div>`;

  // Seletor de mês
  document.getElementById("sel-mes-dash").addEventListener("change",e=>{
    currentMes=e.target.value; renderDashboard();
  });

  // Acordeão de NCs por UTI
  document.querySelectorAll(".nc-uti-toggle").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const utiKey=btn.dataset.uti.replace(/[\/ ]/g,"-");
      const lista =document.getElementById(`nclista-${utiKey}`);
      const chev  =document.getElementById(`chev-${utiKey}`);
      const aberto=lista.classList.toggle("nc-uti-lista--open");
      chev.textContent=aberto?"▲":"▼";
    });
  });
}

// ── Admin ──────────────────────────────────────────────────
async function renderAdmin() {
  if (!isAdmin) { renderHome(); return; }
  renderShell("admin"); updateNav("admin");
  showLoading("Carregando usuários...");
  const usuarios = await listarUsuarios();

  document.getElementById("main-content").innerHTML=`
    <div class="page-admin">
      <div class="page-header">
        <h1 class="page-title">Gerenciar Usuários</h1>
        <p class="page-subtitle">Adicione ou remova acesso ao sistema</p>
      </div>

      <!-- Formulário de adição -->
      <div class="card">
        <h2 class="card-title">Adicionar novo usuário</h2>
        <div class="admin-form">
          <div class="field-group">
            <label class="field-label">Nome</label>
            <input type="text" id="add-nome" class="field-input" placeholder="Nome completo"/>
          </div>
          <div class="field-group">
            <label class="field-label">E-mail Google</label>
            <input type="email" id="add-email" class="field-input" placeholder="usuario@gmail.com"/>
          </div>
          <button class="btn-primary-sm" id="btn-adicionar">+ Adicionar</button>
        </div>
      </div>

      <!-- Admins fixos -->
      <div class="card">
        <h2 class="card-title">Administradores <span class="badge-admin">fixo</span></h2>
        <div class="user-list">
          ${ADMINS.map(email=>`
            <div class="user-row user-row--admin">
              <div class="user-avatar-sm">${email.charAt(0).toUpperCase()}</div>
              <div class="user-row-info">
                <span class="user-row-email">${email}</span>
                <span class="user-row-role">Administrador</span>
              </div>
              <span class="user-status user-status--on">Ativo</span>
            </div>`).join("")}
        </div>
      </div>

      <!-- Usuários cadastrados -->
      <div class="card">
        <h2 class="card-title">Usuários autorizados <span class="badge-count">${usuarios.length}</span></h2>
        ${usuarios.length===0
          ? `<div class="nc-vazio"><span>👤</span> Nenhum usuário cadastrado ainda.</div>`
          : `<div class="user-list" id="user-list">
              ${usuarios.map(u=>`
                <div class="user-row" data-id="${u.id}">
                  <div class="user-avatar-sm ${u.ativo===false?"avatar--off":""}">${(u.nome||u.email).charAt(0).toUpperCase()}</div>
                  <div class="user-row-info">
                    <span class="user-row-name">${u.nome||"—"}</span>
                    <span class="user-row-email">${u.email}</span>
                  </div>
                  <div class="user-row-actions">
                    <button class="btn-toggle-user ${u.ativo===false?"btn-toggle-user--off":""}"
                            data-id="${u.id}" data-ativo="${u.ativo!==false}">
                      ${u.ativo!==false?"Ativo":"Inativo"}
                    </button>
                    <button class="btn-remover-user" data-id="${u.id}" title="Remover">🗑</button>
                  </div>
                </div>`).join("")}
            </div>`}
      </div>
    </div>`;

  // Adicionar usuário
  document.getElementById("btn-adicionar").addEventListener("click",async()=>{
    const nome =document.getElementById("add-nome").value.trim();
    const email=document.getElementById("add-email").value.trim().toLowerCase();
    if (!nome||!email) { showToast("Preencha nome e e-mail.","erro"); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { showToast("E-mail inválido.","erro"); return; }
    if (ADMINS.includes(email)) { showToast("Este e-mail já é administrador.","erro"); return; }
    const btn=document.getElementById("btn-adicionar");
    btn.textContent="Adicionando..."; btn.disabled=true;
    await adicionarUsuario(email,nome);
    showToast(`${nome} adicionado com sucesso!`,"ok");
    renderAdmin();
  });

  // Toggle ativo/inativo
  document.querySelectorAll(".btn-toggle-user").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      const id=btn.dataset.id; const ativo=btn.dataset.ativo==="true";
      btn.textContent="..."; btn.disabled=true;
      await toggleUsuario(id,!ativo);
      showToast(ativo?"Usuário desativado.":"Usuário reativado.",ativo?"erro":"ok");
      renderAdmin();
    });
  });

  // Remover usuário
  document.querySelectorAll(".btn-remover-user").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      if (!confirm("Remover este usuário? Ele perderá o acesso imediatamente.")) return;
      await removerUsuario(btn.dataset.id);
      showToast("Usuário removido.","erro");
      renderAdmin();
    });
  });
}

// ── Auth State ─────────────────────────────────────────────
onAuthStateChanged(auth,async user=>{
  if (user) {
    currentUser=user;
    const acesso=await verificarAcesso(user.email);
    if (!acesso) { renderAcessoNegado(); return; }
    isAdmin=ADMINS.includes(user.email);
    renderHome();
  } else {
    currentUser=null; isAdmin=false;
    renderLogin();
  }
});
