// ============================================================
//  app.js — Checklist RT | Hospital do Coração de Natal
//  v2.0 — Filtro por dia, histórico, layout responsivo PC
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// ── Firebase Init ──────────────────────────────────────────
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

// ── Constantes ─────────────────────────────────────────────
const UTIs = ["UTI 1/A", "UTI 1/B", "UTI 2/A", "UTI 2/B", "UTI 3/A", "UTI 3/B"];

const DIAS_NOME  = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const DIAS_ABREV = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MESES_NOME = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// dow: 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex
const INDICADORES_PADRAO = [
  { id:"cme",         label:"Limpeza e Armazenamento CME",                             dias:[2,4], freq:"2x/sem" },
  { id:"laringo",     label:"Limpeza e Desinfecção de Laringoscópio",                  dias:[4],   freq:"1x/sem" },
  { id:"caixa_urg",  label:"Caixa de Urgência e Caixa de Transporte",                 dias:[1,5], freq:"2x/sem" },
  { id:"carro_urg",  label:"Carro de Urgência",                                        dias:[1,5], freq:"2x/sem" },
  { id:"desfib",     label:"Desfibrilador",                                            dias:[1,5], freq:"2x/sem" },
  { id:"umidade",    label:"Umidade do Ar / Geladeira da Unidade e da Copa",           dias:[2,4], freq:"2x/sem" },
  { id:"mat_mh",     label:"Limpeza e Desinfecção de Materiais Médico-Hospitalares",   dias:[2,4], freq:"2x/sem" },
  { id:"pertences",  label:"Pertences de Pacientes (Sacos Transp.) e Almotolias",      dias:[2,4], freq:"2x/sem" },
  { id:"huddle",     label:"HUDDLE (Reunião de Alinhamento)",                          dias:[3],   freq:"1x/sem" },
  { id:"visita",     label:"Visita Multiprofissional",                                 dias:[1,5], freq:"2x/sem" },
  { id:"infra",      label:"Infraestrutura do Setor",                                  dias:[1,4], freq:"2x/sem" },
  { id:"quadro_seg", label:"Quadro de Segurança do Paciente",                          dias:[1,4], freq:"2x/sem" },
  { id:"termos",     label:"Termos",                                                   dias:[1,4], freq:"2x/sem" },
  { id:"tev",        label:"Protocolo de TEV (Tromboembolismo Venoso)",                dias:[1,4], freq:"2x/sem" },
];

const INDICADORES_UTI2B = [
  { id:"cme",         label:"Limpeza e Armazenamento CME",                             dias:[1,4], freq:"2x/sem" },
  { id:"laringo",     label:"Limpeza e Desinfecção de Laringoscópio",                  dias:[3],   freq:"1x/sem" },
  { id:"caixa_urg",  label:"Caixa de Urgência e Caixa de Transporte",                 dias:[1,5], freq:"2x/sem" },
  { id:"carro_urg",  label:"Carro de Urgência",                                        dias:[1,5], freq:"2x/sem" },
  { id:"desfib",     label:"Desfibrilador",                                            dias:[1,5], freq:"2x/sem" },
  { id:"umidade",    label:"Umidade do Ar / Geladeira da Unidade e da Copa",           dias:[1,5], freq:"2x/sem" },
  { id:"mat_mh",     label:"Limpeza e Desinfecção de Materiais Médico-Hospitalares",   dias:[2,4], freq:"2x/sem" },
  { id:"pertences",  label:"Pertences de Pacientes (Sacos Transp.) e Almotolias",      dias:[2,4], freq:"2x/sem" },
  { id:"huddle",     label:"HUDDLE (Reunião de Alinhamento)",                          dias:[3],   freq:"1x/sem" },
  { id:"visita",     label:"Visita Multiprofissional",                                 dias:[1,5], freq:"2x/sem" },
  { id:"infra",      label:"Infraestrutura do Setor",                                  dias:[1,4], freq:"2x/sem" },
  { id:"quadro_seg", label:"Quadro de Segurança do Paciente",                          dias:[1,4], freq:"2x/sem" },
  { id:"termos",     label:"Termos",                                                   dias:[1,4], freq:"2x/sem" },
  { id:"tev",        label:"Protocolo de TEV (Tromboembolismo Venoso)",                dias:[1,4], freq:"2x/sem" },
];

function getIndicadores(uti) {
  return uti === "UTI 2/B" ? INDICADORES_UTI2B : INDICADORES_PADRAO;
}

// ── Estado Global ──────────────────────────────────────────
let currentUser    = null;
let currentDate    = new Date();   // Data selecionada
let currentUTI     = "";
let dadosChecklist = {};

// ── Helpers ────────────────────────────────────────────────
function dateToMes(d)  { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function dateToKey(d)  { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function mesLabel(s)   { const [a,m]=s.split("-"); return `${MESES_NOME[+m-1]} ${a}`; }
function dateLabel(d)  { return `${DIAS_NOME[d.getDay()]}, ${d.getDate()} de ${MESES_NOME[d.getMonth()]} de ${d.getFullYear()}`; }
function chaveDoc(dateKey, uti) { return `${dateKey}_${uti.replace(/\//g,"_").replace(/ /g,"_")}`; }

// Número da semana no mês (0-indexed)
function semanaDoMes(d) {
  const primeiro = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.floor((d.getDate() + primeiro - 1) / 7);
}

// chave da célula no Firestore: "dia_<indicadorId>"
function itemKey(indId) { return `dia_${indId}`; }

// ── Firestore ──────────────────────────────────────────────
async function salvarDados() {
  if (!currentUser || !currentUTI) return;
  const dateKey = dateToKey(currentDate);
  const chave   = chaveDoc(dateKey, currentUTI);
  await setDoc(doc(db, "auditorias", chave), {
    uid:       currentUser.uid,
    mes:       dateToMes(currentDate),
    data:      dateKey,
    diaSemana: currentDate.getDay(),
    uti:       currentUTI,
    dados:     dadosChecklist,
    updatedAt: new Date().toISOString()
  });
}

async function carregarDados() {
  const dateKey = dateToKey(currentDate);
  const chave   = chaveDoc(dateKey, currentUTI);
  const snap    = await getDoc(doc(db, "auditorias", chave));
  dadosChecklist = snap.exists() ? (snap.data().dados || {}) : {};
}

async function carregarHistorico(limite = 30) {
  const q = query(
    collection(db, "auditorias"),
    where("uid", "==", currentUser.uid)
  );
  const snaps = await getDocs(q);
  const lista = [];
  snaps.forEach(s => lista.push({ id: s.id, ...s.data() }));
  lista.sort((a,b) => (b.data||"").localeCompare(a.data||""));
  return lista.slice(0, limite);
}

async function carregarTodosMes(mes) {
  const q = query(collection(db, "auditorias"),
    where("uid", "==", currentUser.uid),
    where("mes", "==", mes));
  const snaps = await getDocs(q);
  const res = {};
  snaps.forEach(s => {
    const d = s.data();
    if (!res[d.uti]) res[d.uti] = {};
    Object.assign(res[d.uti], d.dados || {});
  });
  return res;
}

// ── Layout PC: Sidebar ─────────────────────────────────────
function renderShell(activeNav) {
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-heart">♥</div>
          <div>
            <div class="sidebar-hosp">Hospital do Coração</div>
            <div class="sidebar-sub">Checklist RT</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <button class="nav-item ${activeNav==="home"?"active":""}" onclick="window._nav('home')">
            <span class="nav-icon">📋</span><span class="nav-label">Auditoria</span>
          </button>
          <button class="nav-item ${activeNav==="historico"?"active":""}" onclick="window._nav('historico')">
            <span class="nav-icon">🗂</span><span class="nav-label">Histórico</span>
          </button>
          <button class="nav-item ${activeNav==="dashboard"?"active":""}" onclick="window._nav('dashboard')">
            <span class="nav-icon">📊</span><span class="nav-label">Dashboard</span>
          </button>
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <img src="${currentUser.photoURL||""}" class="user-avatar" onerror="this.style.display='none'" />
            <div class="sidebar-user-info">
              <span class="sidebar-user-name">${currentUser.displayName?.split(" ")[0]}</span>
              <span class="sidebar-user-role">Resp. Técnico</span>
            </div>
          </div>
          <button class="btn-logout" onclick="window._logout()">⏻ Sair</button>
        </div>
      </aside>
      <main class="main-content" id="main-content">
      </main>
    </div>
  `;
}

window._nav = async (page) => {
  if (page === "home")      renderHome();
  if (page === "historico") { showMainLoading("Carregando histórico..."); const h = await carregarHistorico(); renderHistorico(h); }
  if (page === "dashboard") { showMainLoading("Calculando indicadores..."); renderDashboardPage(); }
};
window._logout = () => signOut(auth);

function showMainLoading(msg="Carregando...") {
  const el = document.getElementById("main-content");
  if (el) el.innerHTML = `<div class="main-loading"><div class="loading-heart">♥</div><p>${msg}</p></div>`;
}

// ── Render: Login ──────────────────────────────────────────
function renderLogin() {
  document.getElementById("app").innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">
          <div class="logo-icon">♥</div>
          <div class="login-title">
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
      </div>
    </div>
  `;
  document.getElementById("btn-login").addEventListener("click", () =>
    signInWithPopup(auth, provider).catch(e => alert("Erro no login: " + e.message))
  );
}

// ── Render: Home ───────────────────────────────────────────
function renderHome() {
  document.getElementById("app").innerHTML = renderShell("home");

  const hoje      = new Date();
  const selDate   = currentDate;
  const dow       = selDate.getDay();
  const isWeekend = dow === 0 || dow === 6;

  // Gerar seletor de data (últimos 14 dias + próximos 2)
  const opcoesDatas = [];
  for (let i = -14; i <= 2; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const dow2 = d.getDay();
    if (dow2 >= 1 && dow2 <= 5) opcoesDatas.push(d);
  }

  document.getElementById("main-content").innerHTML = `
    <div class="home-page">
      <div class="page-header">
        <h1 class="page-title">Nova Auditoria</h1>
        <p class="page-subtitle">Selecione a data e a unidade para iniciar</p>
      </div>

      <div class="form-card">
        <div class="form-group">
          <label class="form-label">📅 Data da Auditoria</label>
          <select class="form-select" id="sel-data">
            ${opcoesDatas.map(d => {
              const v = dateToKey(d);
              const isHoje = dateToKey(d) === dateToKey(hoje);
              const label = isHoje
                ? `Hoje — ${DIAS_NOME[d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}`
                : `${DIAS_NOME[d.getDay()]}, ${d.getDate()}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
              return `<option value="${v}" ${dateToKey(d)===dateToKey(selDate)?"selected":""}>${label}</option>`;
            }).join("")}
          </select>
        </div>

        ${isWeekend ? `
          <div class="alert-weekend">
            ⚠️ Fim de semana selecionado — não há itens de auditoria programados para este dia.
          </div>
        ` : `
          <div class="dia-badge">
            <span class="dia-badge-icon">📋</span>
            <span>${DIAS_NOME[dow]}-feira · ${getIndicadores("UTI 1/A").filter(i=>i.dias.includes(dow)).length} indicadores programados</span>
          </div>
        `}
      </div>

      ${!isWeekend ? `
        <div class="form-card">
          <label class="form-label">🏥 Selecione a Unidade</label>
          <div class="uti-grid">
            ${UTIs.map(u => {
              const inds = getIndicadores(u).filter(i => i.dias.includes(dow));
              return `
                <button class="uti-btn" data-uti="${u}">
                  <span class="uti-code">${u}</span>
                  <span class="uti-count">${inds.length} itens</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;

  document.getElementById("sel-data").addEventListener("change", e => {
    const [ano, mes, dia] = e.target.value.split("-").map(Number);
    currentDate = new Date(ano, mes - 1, dia);
    renderHome();
  });

  document.querySelectorAll(".uti-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      currentUTI = btn.dataset.uti;
      showMainLoading("Carregando checklist...");
      await carregarDados();
      renderChecklist();
    });
  });
}

// ── Render: Checklist ──────────────────────────────────────
function renderChecklist() {
  document.getElementById("app").innerHTML = renderShell("home");

  const dow        = currentDate.getDay();
  const indicadores = getIndicadores(currentUTI).filter(i => i.dias.includes(dow));
  const dateKey    = dateToKey(currentDate);

  document.getElementById("main-content").innerHTML = `
    <div class="checklist-page">
      <div class="page-header checklist-header">
        <div>
          <button class="btn-back" id="btn-back">← Voltar</button>
          <h1 class="page-title">${currentUTI}</h1>
          <p class="page-subtitle">${dateLabel(currentDate)}</p>
        </div>
        <button class="btn-save" id="btn-salvar">💾 Salvar</button>
      </div>

      <div class="progress-header">
        <span class="progress-label" id="prog-label">0 de ${indicadores.length} preenchidos</span>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" id="prog-bar" style="width:0%"></div>
        </div>
      </div>

      <div class="checklist-list" id="checklist-list">
        ${indicadores.map(ind => {
          const key = itemKey(ind.id);
          const val = dadosChecklist[key] || "";
          return `
            <div class="check-item" data-key="${key}">
              <div class="check-item-info">
                <span class="check-item-label">${ind.label}</span>
                <span class="check-item-freq">${ind.freq}</span>
              </div>
              <div class="check-toggle">
                <button class="tog-btn tog-c ${val==="C"?"active":""}" data-key="${key}" data-val="C">
                  <span class="tog-icon">✓</span> Conforme
                </button>
                <button class="tog-btn tog-nc ${val==="NC"?"active":""}" data-key="${key}" data-val="NC">
                  <span class="tog-icon">✗</span> Não Conforme
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="checklist-actions">
        <button class="btn-primary-full" id="btn-salvar-bottom">💾 Salvar Auditoria</button>
      </div>
    </div>
  `;

  atualizarProgresso(indicadores.length);

  document.getElementById("btn-back").addEventListener("click", renderHome);

  async function salvar(btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Salvando...";
    await salvarDados();
    btn.textContent = "✅ Salvo!";
    setTimeout(() => { btn.disabled = false; btn.textContent = btn.id === "btn-salvar" ? "💾 Salvar" : "💾 Salvar Auditoria"; }, 2000);
  }

  document.getElementById("btn-salvar").addEventListener("click", e => salvar(e.target));
  document.getElementById("btn-salvar-bottom").addEventListener("click", e => salvar(e.target));

  document.querySelectorAll(".tog-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const val = btn.dataset.val;
      const jaAtivo = btn.classList.contains("active");
      document.querySelectorAll(`.tog-btn[data-key="${key}"]`).forEach(b => b.classList.remove("active"));
      if (!jaAtivo) {
        btn.classList.add("active");
        dadosChecklist[key] = val;
      } else {
        delete dadosChecklist[key];
      }
      atualizarProgresso(indicadores.length);
    });
  });
}

function atualizarProgresso(total) {
  const preenchidos = Object.keys(dadosChecklist).length;
  const pct = total > 0 ? Math.round((preenchidos / total) * 100) : 0;
  const lbl = document.getElementById("prog-label");
  const bar = document.getElementById("prog-bar");
  if (lbl) lbl.textContent = `${preenchidos} de ${total} preenchidos`;
  if (bar) bar.style.width = pct + "%";
}

// ── Render: Histórico ──────────────────────────────────────
function renderHistorico(lista) {
  document.getElementById("app").innerHTML = renderShell("historico");

  if (lista.length === 0) {
    document.getElementById("main-content").innerHTML = `
      <div class="historico-page">
        <div class="page-header"><h1 class="page-title">Histórico</h1></div>
        <div class="empty-state">
          <div class="empty-icon">🗂</div>
          <p>Nenhuma auditoria registrada ainda.</p>
        </div>
      </div>
    `;
    return;
  }

  // Agrupar por data
  const porData = {};
  lista.forEach(item => {
    const d = item.data || "???";
    if (!porData[d]) porData[d] = [];
    porData[d].push(item);
  });

  const html = Object.entries(porData).map(([data, items]) => {
    const dt     = data !== "???" ? new Date(data + "T12:00:00") : null;
    const titulo = dt ? dateLabel(dt) : data;
    return `
      <div class="hist-grupo">
        <div class="hist-data-titulo">${titulo}</div>
        ${items.map(item => {
          const vals   = Object.values(item.dados || {});
          const total  = vals.length;
          const conf   = vals.filter(v=>v==="C").length;
          const nconf  = vals.filter(v=>v==="NC").length;
          const pct    = total > 0 ? Math.round((conf/total)*100) : null;
          const status = pct === null ? "vazio" : pct >= 80 ? "ok" : pct >= 60 ? "warn" : "crit";
          return `
            <div class="hist-card" data-id="${item.id}" data-data="${item.data}" data-uti="${item.uti}">
              <div class="hist-card-left">
                <span class="hist-uti">${item.uti}</span>
                <div class="hist-badges">
                  ${total > 0 ? `<span class="badge-c">${conf} C</span><span class="badge-nc">${nconf} NC</span>` : '<span class="badge-vazio">Sem dados</span>'}
                </div>
              </div>
              <div class="hist-card-right">
                <span class="hist-pct hist-pct--${status}">${pct !== null ? pct+"%" : "—"}</span>
                <button class="btn-preview" data-id="${item.id}" data-data="${item.data}" data-uti="${item.uti}">Ver ›</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }).join("");

  document.getElementById("main-content").innerHTML = `
    <div class="historico-page">
      <div class="page-header">
        <h1 class="page-title">Histórico de Auditorias</h1>
        <p class="page-subtitle">Últimas ${lista.length} auditorias registradas</p>
      </div>
      <div class="hist-lista">${html}</div>
    </div>
    <div class="modal-overlay" id="modal-overlay" style="display:none">
      <div class="modal-box" id="modal-box"></div>
    </div>
  `;

  document.querySelectorAll(".btn-preview").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id  = btn.dataset.id;
      const snap = await getDoc(doc(db, "auditorias", id));
      if (!snap.exists()) return;
      const d   = snap.data();
      const dt  = d.data ? new Date(d.data + "T12:00:00") : null;
      const dow = dt ? dt.getDay() : 0;
      const inds = getIndicadores(d.uti);
      const vals = d.dados || {};

      const rows = inds.map(ind => {
        const key = itemKey(ind.id);
        const val = vals[key] || "";
        if (!val) return "";
        return `
          <div class="preview-row ${val==="C"?"preview-c":"preview-nc"}">
            <span class="preview-label">${ind.label}</span>
            <span class="preview-val">${val}</span>
          </div>
        `;
      }).filter(Boolean).join("");

      document.getElementById("modal-box").innerHTML = `
        <div class="modal-header">
          <div>
            <div class="modal-uti">${d.uti}</div>
            <div class="modal-data">${dt ? dateLabel(dt) : d.data}</div>
          </div>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          ${rows || '<p style="color:var(--text-muted);text-align:center;padding:24px">Sem registros nesta auditoria.</p>'}
        </div>
        <div class="modal-footer" style="display:flex; gap:10px;">
          <button id="btn-excluir-hist" style="padding:14px;border-radius:var(--radius);background:white;color:var(--nconf);border:1.5px solid #FCA5A5;font-family:'Outfit', sans-serif;font-weight:600;font-size:1rem;cursor:pointer;flex:1;transition:all 0.2s;" onmouseover="this.style.background='var(--nconf-bg)'" onmouseout="this.style.background='white'">🗑️ Excluir</button>
          <button class="btn-primary-full" id="btn-editar-hist" style="flex:2;">✏️ Editar Auditoria</button>
        </div>
      `;

      document.getElementById("modal-overlay").style.display = "flex";
      document.getElementById("modal-close").addEventListener("click", () => {
        document.getElementById("modal-overlay").style.display = "none";
      });
      document.getElementById("btn-excluir-hist").addEventListener("click", async () => {
        if (confirm("Tem certeza que deseja excluir permanentemente esta auditoria? O Dashboard será atualizado.")) {
          document.getElementById("btn-excluir-hist").textContent = "⏳...";
          await deleteDoc(doc(db, "auditorias", id));
          document.getElementById("modal-overlay").style.display = "none";
          showMainLoading("Atualizando histórico...");
          const h = await carregarHistorico();
          renderHistorico(h);
        }
      });
      document.getElementById("btn-editar-hist").addEventListener("click", async () => {
        if (dt) currentDate = dt;
        currentUTI = d.uti;
        document.getElementById("modal-overlay").style.display = "none";
        showMainLoading("Carregando...");
        await carregarDados();
        renderChecklist();
      });
    });
  });

  document.getElementById("modal-overlay")?.addEventListener("click", e => {
    if (e.target.id === "modal-overlay") e.target.style.display = "none";
  });
}

// ── Render: Dashboard ──────────────────────────────────────
async function renderDashboardPage() {
  document.getElementById("app").innerHTML = renderShell("dashboard");

  const hoje  = new Date();
  const mesAtual = dateToMes(hoje);

  // Seletor de mês
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const v = dateToMes(d);
    meses.push({ value: v, label: mesLabel(v) });
  }

  document.getElementById("main-content").innerHTML = `
    <div class="dashboard-page">
      <div class="page-header dash-page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Indicadores de conformidade</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <select class="form-select form-select--sm" id="sel-mes-dash">
            ${meses.map(m=>`<option value="${m.value}"${m.value===mesAtual?" selected":""}>${m.label}</option>`).join("")}
          </select>
          <button class="btn-pdf" id="btn-pdf">📄 PDF</button>
        </div>
      </div>
      <div id="dash-body"><div class="main-loading"><div class="loading-heart">♥</div><p>Calculando...</p></div></div>
    </div>
  `;

  async function carregarDash(mes) {
    const todos = await carregarTodosMes(mes);
    const stats = UTIs.map(uti => {
      const dados = todos[uti] || {};
      const vals  = Object.values(dados);
      const conf  = vals.filter(v=>v==="C").length;
      const nconf = vals.filter(v=>v==="NC").length;
      const total = vals.length;
      const pct   = total > 0 ? Math.round((conf/total)*100) : null;
      return { uti, conf, nconf, total, pct };
    });
    const indStats = INDICADORES_PADRAO.map(ind => {
      let c=0, nc=0;
      UTIs.forEach(uti => {
        const dados = todos[uti] || {};
        const key = itemKey(ind.id);
        Object.entries(dados).forEach(([k,v]) => {
          if (k === key) { if (v==="C") c++; else if (v==="NC") nc++; }
        });
      });
      const total = c+nc;
      return { ...ind, c, nc, total, pct: total>0?Math.round((c/total)*100):null };
    });

    const totalGlobal = stats.reduce((a,s)=>a+s.total,0);
    const confGlobal  = stats.reduce((a,s)=>a+s.conf,0);
    const pctGlobal   = totalGlobal > 0 ? Math.round((confGlobal/totalGlobal)*100) : null;

    document.getElementById("dash-body").innerHTML = `
      <div class="dash-kpi-row">
        <div class="kpi-card">
          <span class="kpi-label">Conformidade Global</span>
          <span class="kpi-value ${pctGlobal!==null?(pctGlobal>=80?"kpi-ok":pctGlobal>=60?"kpi-warn":"kpi-crit"):""}">
            ${pctGlobal !== null ? pctGlobal+"%" : "—"}
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Total Registros</span>
          <span class="kpi-value">${totalGlobal}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Conformes</span>
          <span class="kpi-value kpi-ok">${confGlobal}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Não Conformes</span>
          <span class="kpi-value kpi-crit">${stats.reduce((a,s)=>a+s.nconf,0)}</span>
        </div>
      </div>

      <div class="dash-grid">
        <div class="dash-card">
          <h2 class="dash-card-title">Por Unidade</h2>
          ${stats.map(s => `
            <div class="uti-stat-row">
              <span class="uti-stat-name">${s.uti}</span>
              <div class="uti-stat-bar">
                <div class="uti-stat-fill ${s.pct===null?"":s.pct>=80?"ok":s.pct>=60?"warn":"crit"}"
                     style="width:${s.pct||0}%"></div>
              </div>
              <span class="uti-stat-pct ${s.pct===null?"":s.pct>=80?"ok-txt":s.pct>=60?"warn-txt":"crit-txt"}">
                ${s.pct!==null?s.pct+"%":"—"}
              </span>
              <div class="uti-stat-badges">
                ${s.total>0?`<span class="badge-c">${s.conf}C</span><span class="badge-nc">${s.nconf}NC</span>`:"<span class='badge-vazio'>sem dados</span>"}
              </div>
            </div>
          `).join("")}
        </div>

        <div class="dash-card">
          <h2 class="dash-card-title">Por Indicador</h2>
          ${indStats.map(i => `
            <div class="ind-stat-row">
              <span class="ind-stat-label">${i.label}</span>
              <div class="ind-stat-bar">
                <div class="ind-stat-fill ${i.pct===null?"":i.pct>=80?"ok":i.pct>=60?"warn":"crit"}"
                     style="width:${i.pct||0}%"></div>
              </div>
              <span class="ind-stat-pct">${i.pct!==null?i.pct+"%":"—"}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="legenda-row">
        <span class="leg ok-txt">● ≥80% Conforme</span>
        <span class="leg warn-txt">● 60–79% Atenção</span>
        <span class="leg crit-txt">● &lt;60% Crítico</span>
      </div>

      <div class="dash-footer-txt">
        Hospital do Coração de Natal — Grupo Atena &nbsp;|&nbsp;
        Responsável Técnico &nbsp;|&nbsp;
        Gerado em ${new Date().toLocaleDateString("pt-BR")}
      </div>
    `;
  }

  await carregarDash(mesAtual);

  document.getElementById("sel-mes-dash").addEventListener("change", e => carregarDash(e.target.value));
  document.getElementById("btn-pdf").addEventListener("click", () => window.print());
}

// ── Loading ────────────────────────────────────────────────
function showLoading() {
  document.getElementById("app").innerHTML = `
    <div class="loading-screen">
      <div class="loading-heart">♥</div>
      <p>Iniciando...</p>
    </div>
  `;
}

// ── Auth State ─────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) renderHome();
  else renderLogin();
});
