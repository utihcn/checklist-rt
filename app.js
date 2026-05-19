// ============================================================
//  app.js — Checklist RT | Hospital do Coração de Natal
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// ── Firebase Init ──────────────────────────────────────────
const app   = initializeApp(firebaseConfig);
const auth  = getAuth(app);
const db    = getFirestore(app);
const provider = new GoogleAuthProvider();

// ── Constantes de Domínio ──────────────────────────────────
const UTIs = ["UTI 1/A", "UTI 1/B", "UTI 2/A", "UTI 2/B", "UTI 3/A"];

// Dias padrão (segunda = 1 ... sexta = 5, 0 = todos os dias)
const DIAS_LABEL = { 1: "2ª", 2: "3ª", 3: "4ª", 4: "5ª", 5: "6ª" };

const INDICADORES_PADRAO = [
  { id: "cme",          label: "Limpeza e Armazenamento CME",                               dias: [2, 4], freq: "2x/sem" },
  { id: "laringo",      label: "Limpeza e Desinfecção de Laringoscópio",                    dias: [4],    freq: "1x/sem" },
  { id: "caixa_urg",   label: "Caixa de Urgência e Caixa de Transporte",                   dias: [1, 5], freq: "2x/sem" },
  { id: "carro_urg",   label: "Carro de Urgência",                                          dias: [1, 5], freq: "2x/sem" },
  { id: "desfib",      label: "Desfibrilador",                                              dias: [1, 5], freq: "2x/sem" },
  { id: "umidade",     label: "Umidade do Ar / Geladeira da Unidade e da Copa",             dias: [2, 4], freq: "2x/sem" },
  { id: "mat_mh",      label: "Limpeza e Desinfecção de Materiais Médico-Hospitalares",     dias: [2, 4], freq: "2x/sem" },
  { id: "pertences",   label: "Pertences de Pacientes (Sacos Transp.) e Almotolias",        dias: [2, 4], freq: "2x/sem" },
  { id: "huddle",      label: "HUDDLE (Reunião de Alinhamento)",                            dias: [3],    freq: "1x/sem" },
  { id: "visita_multi",label: "Visita Multiprofissional",                                   dias: [1, 5], freq: "2x/sem" },
  { id: "infra",       label: "Infraestrutura do Setor",                                    dias: [1, 4], freq: "2x/sem" },
  { id: "quadro_seg",  label: "Quadro de Segurança do Paciente",                            dias: [1, 4], freq: "2x/sem" },
  { id: "termos",      label: "Termos",                                                     dias: [1, 4], freq: "2x/sem" },
  { id: "tev",         label: "Protocolo de TEV (Tromboembolismo Venoso)",                  dias: [1, 4], freq: "2x/sem" },
];

// UTI 2/B tem dias próprios
const INDICADORES_UTI2B = [
  { id: "cme",          label: "Limpeza e Armazenamento CME",                               dias: [1, 4], freq: "2x/sem" },
  { id: "laringo",      label: "Limpeza e Desinfecção de Laringoscópio",                    dias: [3],    freq: "1x/sem" },
  { id: "caixa_urg",   label: "Caixa de Urgência e Caixa de Transporte",                   dias: [1, 5], freq: "2x/sem" },
  { id: "carro_urg",   label: "Carro de Urgência",                                          dias: [1, 5], freq: "2x/sem" },
  { id: "desfib",      label: "Desfibrilador",                                              dias: [1, 5], freq: "2x/sem" },
  { id: "umidade",     label: "Umidade do Ar / Geladeira da Unidade e da Copa",             dias: [1, 5], freq: "2x/sem" },
  { id: "mat_mh",      label: "Limpeza e Desinfecção de Materiais Médico-Hospitalares",     dias: [2, 4], freq: "2x/sem" },
  { id: "pertences",   label: "Pertences de Pacientes (Sacos Transp.) e Almotolias",        dias: [2, 4], freq: "2x/sem" },
  { id: "huddle",      label: "HUDDLE (Reunião de Alinhamento)",                            dias: [3],    freq: "1x/sem" },
  { id: "visita_multi",label: "Visita Multiprofissional",                                   dias: [1, 5], freq: "2x/sem" },
  { id: "infra",       label: "Infraestrutura do Setor",                                    dias: [1, 4], freq: "2x/sem" },
  { id: "quadro_seg",  label: "Quadro de Segurança do Paciente",                            dias: [1, 4], freq: "2x/sem" },
  { id: "termos",      label: "Termos",                                                     dias: [1, 4], freq: "2x/sem" },
  { id: "tev",         label: "Protocolo de TEV (Tromboembolismo Venoso)",                  dias: [1, 4], freq: "2x/sem" },
];

function getIndicadores(uti) {
  return uti === "UTI 2/B" ? INDICADORES_UTI2B : INDICADORES_PADRAO;
}

// ── Estado Global ──────────────────────────────────────────
let currentUser = null;
let currentMes  = "";   // "2025-05"
let currentUTI  = "";
let dadosChecklist = {}; // { "semana1_cme_2": "C", ... }

// ── Helpers ────────────────────────────────────────────────
function mesLabel(mesStr) {
  if (!mesStr) return "";
  const [ano, m] = mesStr.split("-");
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${nomes[parseInt(m)-1]} ${ano}`;
}

function chaveDoc(mes, uti) {
  return `${mes}_${uti.replace(/\//g,"_").replace(/ /g,"_")}`;
}

// Gera as semanas (Mon–Fri) do mês
function gerarSemanas(mesStr) {
  const [ano, mes] = mesStr.split("-").map(Number);
  const semanas = [];
  let semana = [];
  const ultimo = new Date(ano, mes, 0).getDate();
  for (let d = 1; d <= ultimo; d++) {
    const dt = new Date(ano, mes - 1, d);
    const dow = dt.getDay(); // 0=Dom ... 6=Sab
    if (dow >= 1 && dow <= 5) {
      semana.push({ dia: d, dow });
      if (dow === 5 || d === ultimo) {
        semanas.push([...semana]);
        semana = [];
      }
    } else if (dow === 6 && semana.length > 0) {
      semanas.push([...semana]);
      semana = [];
    }
  }
  return semanas.slice(0, 5);
}

// ── Firestore ──────────────────────────────────────────────
async function salvarDados() {
  if (!currentUser || !currentMes || !currentUTI) return;
  const chave = chaveDoc(currentMes, currentUTI);
  await setDoc(doc(db, "auditorias", chave), {
    uid: currentUser.uid,
    mes: currentMes,
    uti: currentUTI,
    dados: dadosChecklist,
    updatedAt: new Date().toISOString()
  });
}

async function carregarDados(mes, uti) {
  const chave = chaveDoc(mes, uti);
  const snap = await getDoc(doc(db, "auditorias", chave));
  dadosChecklist = snap.exists() ? (snap.data().dados || {}) : {};
}

async function carregarTodosMes(mes) {
  const q = query(collection(db, "auditorias"), where("mes", "==", mes));
  const snaps = await getDocs(q);
  const resultado = {};
  snaps.forEach(s => { resultado[s.data().uti] = s.data().dados || {}; });
  return resultado;
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
  document.getElementById("btn-login").addEventListener("click", () => {
    signInWithPopup(auth, provider).catch(e => alert("Erro no login: " + e.message));
  });
}

// ── Render: Home (seletor mês + UTI) ──────────────────────
function renderHome() {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;

  // Gerar opções de meses (6 meses anteriores + atual)
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    meses.push({ value: v, label: mesLabel(v) });
  }

  document.getElementById("app").innerHTML = `
    <div class="home-screen">
      <header class="top-bar">
        <div class="top-bar-left">
          <div class="logo-sm">♥</div>
          <span class="top-title">Auditoria RT</span>
        </div>
        <div class="top-bar-right">
          <span class="user-name">${currentUser.displayName?.split(" ")[0]}</span>
          <button class="btn-icon" id="btn-logout" title="Sair">⏻</button>
        </div>
      </header>

      <div class="home-content">
        <div class="home-hero">
          <h1 class="home-title">Checklist Mensal</h1>
          <p class="home-subtitle">Selecione o mês e a UTI para iniciar a auditoria</p>
        </div>

        <div class="form-group">
          <label class="form-label">Competência</label>
          <select class="form-select" id="sel-mes">
            ${meses.map(m => `<option value="${m.value}"${m.value===mesAtual?" selected":""}>${m.label}</option>`).join("")}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Unidade</label>
          <div class="uti-grid">
            ${UTIs.map(u => `
              <button class="uti-btn" data-uti="${u}">
                <span class="uti-code">${u}</span>
              </button>
            `).join("")}
          </div>
        </div>

        <div class="home-actions">
          <button class="btn-primary" id="btn-dashboard">📊 Ver Dashboard</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-logout").addEventListener("click", () => signOut(auth));
  document.getElementById("btn-dashboard").addEventListener("click", () => {
    currentMes = document.getElementById("sel-mes").value;
    renderDashboard();
  });

  document.querySelectorAll(".uti-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      currentMes = document.getElementById("sel-mes").value;
      currentUTI = btn.dataset.uti;
      showLoading("Carregando checklist...");
      await carregarDados(currentMes, currentUTI);
      renderChecklist();
    });
  });
}

// ── Render: Checklist ──────────────────────────────────────
function renderChecklist() {
  const semanas  = gerarSemanas(currentMes);
  const indicadores = getIndicadores(currentUTI);

  document.getElementById("app").innerHTML = `
    <div class="checklist-screen">
      <header class="top-bar">
        <button class="btn-icon" id="btn-back">←</button>
        <div class="top-center">
          <span class="top-title">${currentUTI}</span>
          <span class="top-sub">${mesLabel(currentMes)}</span>
        </div>
        <button class="btn-text" id="btn-salvar">💾 Salvar</button>
      </header>

      <div class="checklist-content">
        ${semanas.map((semDias, si) => `
          <div class="semana-bloco">
            <div class="semana-header">
              <span class="semana-titulo">Semana ${si+1}</span>
              <span class="semana-periodo">${semDias[0].dia}–${semDias[semDias.length-1].dia}/${currentMes.split("-")[1]}</span>
            </div>

            ${indicadores.map(ind => {
              // Filtrar apenas dias desta semana que são dias de auditoria para este indicador
              const diasAudit = semDias.filter(d => ind.dias.includes(d.dow));
              if (diasAudit.length === 0) return `
                <div class="ind-row ind-row--skip">
                  <span class="ind-label">${ind.label}</span>
                  <span class="ind-freq na-badge">N/A esta semana</span>
                </div>
              `;
              return `
                <div class="ind-row">
                  <div class="ind-info">
                    <span class="ind-label">${ind.label}</span>
                    <span class="ind-freq">${ind.freq}</span>
                  </div>
                  <div class="ind-dias">
                    ${diasAudit.map(d => {
                      const chave = `s${si+1}_${ind.id}_${d.dia}`;
                      const val   = dadosChecklist[chave] || "";
                      return `
                        <div class="dia-col">
                          <span class="dia-label">${DIAS_LABEL[d.dow]} ${d.dia}</span>
                          <div class="toggle-group">
                            <button class="tog tog-c${val==="C"?" active":""}" data-key="${chave}" data-val="C">C</button>
                            <button class="tog tog-nc${val==="NC"?" active":""}" data-key="${chave}" data-val="NC">NC</button>
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `).join("")}
      </div>
    </div>
  `;

  document.getElementById("btn-back").addEventListener("click", renderHome);

  document.getElementById("btn-salvar").addEventListener("click", async () => {
    const btn = document.getElementById("btn-salvar");
    btn.textContent = "⏳ Salvando...";
    btn.disabled = true;
    await salvarDados();
    btn.textContent = "✅ Salvo!";
    setTimeout(() => { btn.textContent = "💾 Salvar"; btn.disabled = false; }, 2000);
  });

  document.querySelectorAll(".tog").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const val = btn.dataset.val;
      const jaAtivo = btn.classList.contains("active");

      // Toggle off se clicar no já ativo
      const grupo = document.querySelectorAll(`.tog[data-key="${key}"]`);
      grupo.forEach(b => b.classList.remove("active"));
      if (!jaAtivo) {
        btn.classList.add("active");
        dadosChecklist[key] = val;
      } else {
        delete dadosChecklist[key];
      }
    });
  });
}

// ── Render: Dashboard ──────────────────────────────────────
async function renderDashboard() {
  showLoading("Calculando indicadores...");
  const todos = await carregarTodosMes(currentMes);

  // Calcular % conformidade por UTI
  const stats = UTIs.map(uti => {
    const dados = todos[uti] || {};
    const vals  = Object.values(dados);
    const total = vals.length;
    const conf  = vals.filter(v => v === "C").length;
    const nconf = vals.filter(v => v === "NC").length;
    const pct   = total > 0 ? Math.round((conf / total) * 100) : null;
    return { uti, conf, nconf, total, pct };
  });

  // Calcular % conformidade por indicador (global)
  const indStats = INDICADORES_PADRAO.map(ind => {
    let c = 0, nc = 0;
    UTIs.forEach(uti => {
      const dados = todos[uti] || {};
      Object.entries(dados).forEach(([k, v]) => {
        if (k.includes(`_${ind.id}_`)) {
          if (v === "C") c++;
          else if (v === "NC") nc++;
        }
      });
    });
    const total = c + nc;
    return { ...ind, c, nc, total, pct: total > 0 ? Math.round((c/total)*100) : null };
  });

  document.getElementById("app").innerHTML = `
    <div class="dash-screen">
      <header class="top-bar">
        <button class="btn-icon" id="btn-back">←</button>
        <div class="top-center">
          <span class="top-title">Dashboard</span>
          <span class="top-sub">${mesLabel(currentMes)}</span>
        </div>
        <button class="btn-text" id="btn-export">📄 PDF</button>
      </header>

      <div class="dash-content" id="dash-print">
        <div class="dash-section">
          <h2 class="dash-section-title">Conformidade por UTI</h2>
          <div class="uti-cards">
            ${stats.map(s => `
              <div class="uti-card ${s.pct === null ? "uti-card--vazio" : s.pct >= 80 ? "uti-card--ok" : s.pct >= 60 ? "uti-card--warn" : "uti-card--crit"}">
                <div class="uti-card-name">${s.uti}</div>
                <div class="uti-card-pct">${s.pct !== null ? s.pct+"%" : "—"}</div>
                <div class="uti-card-detail">
                  ${s.total > 0 ? `<span class="badge-c">${s.conf} C</span> <span class="badge-nc">${s.nconf} NC</span>` : "Sem dados"}
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${s.pct||0}%"></div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="dash-section">
          <h2 class="dash-section-title">Conformidade por Indicador</h2>
          <div class="ind-list-dash">
            ${indStats.map(i => `
              <div class="ind-dash-row">
                <div class="ind-dash-label">${i.label}</div>
                <div class="ind-dash-bar">
                  <div class="ind-dash-fill ${i.pct===null?"empty":i.pct>=80?"ok":i.pct>=60?"warn":"crit"}"
                       style="width:${i.pct||0}%"></div>
                </div>
                <div class="ind-dash-pct">${i.pct !== null ? i.pct+"%" : "—"}</div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="dash-section">
          <h2 class="dash-section-title">Legenda</h2>
          <div class="legenda">
            <span class="leg-item leg-ok">≥80% Conforme</span>
            <span class="leg-item leg-warn">60–79% Atenção</span>
            <span class="leg-item leg-crit">&lt;60% Crítico</span>
          </div>
        </div>

        <div class="dash-footer">
          <p>Hospital do Coração de Natal — Grupo Atena</p>
          <p>Responsável Técnico | Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-back").addEventListener("click", renderHome);
  document.getElementById("btn-export").addEventListener("click", imprimirPDF);
}

function imprimirPDF() {
  window.print();
}

// ── Loading ────────────────────────────────────────────────
function showLoading(msg = "Carregando...") {
  document.getElementById("app").innerHTML = `
    <div class="loading-screen">
      <div class="loading-icon">♥</div>
      <p class="loading-msg">${msg}</p>
    </div>
  `;
}

// ── Auth State ─────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    renderHome();
  } else {
    currentUser = null;
    renderLogin();
  }
});
