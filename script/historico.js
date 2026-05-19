// ============================================================
//  historico.js — Histórico & Controle da Fábrica Brodão
//  Nós Firebase utilizados:
//    lancamentos/<id>  — produção e saídas registradas aqui
//    historico/<loja>  — entregas confirmadas pelas lojas
//  Nós existentes NÃO são modificados.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  query,
  orderByChild,
  limitToLast,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── Config ───────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD5WD6H5KDr3cglKW71JRqdgtnKyypwKtc",
  authDomain: "estoque-brodao.firebaseapp.com",
  databaseURL: "https://estoque-brodao-default-rtdb.firebaseio.com",
  projectId: "estoque-brodao",
};
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ── Catálogo ─────────────────────────────────────────────────
const PER_BOX = 20;
const CATALOG = [
  { id: 1,  emoji: "🧅", name: "Cebola",         sub: "Queijo, Presunto e cebola" },
  { id: 2,  emoji: "🧀", name: "Queijo e Presunto", sub: "Tradicional" },
  { id: 3,  emoji: "🍔", name: "Hamburguer",      sub: "Mussarela" },
  { id: 4,  emoji: "🍯", name: "Hamburguer",      sub: "Cheddar" },
  { id: 5,  emoji: "🍗", name: "Frango",          sub: "Frango com Requeijão" },
  { id: 6,  emoji: "🍖", name: "Carne-Seca",      sub: "" },
  { id: 7,  emoji: "🌿", name: "Pastel de Forno", sub: "Queijo minas e espinafre" },
  { id: 8,  emoji: "🍗", name: "Pastel de Forno", sub: "Frango" },
  { id: 9,  emoji: "🍕", name: "Calabresa",       sub: "" },
  { id: 10, emoji: "🍡", name: "Napolitano",      sub: "" },
  { id: 11, emoji: "🌭", name: "Dogão",           sub: "" },
  { id: 12, emoji: "🥩", name: "Costela",         sub: "" },
  { id: 13, emoji: "🥐", name: "Croissant",       sub: "Chocolate" },
];

const LOJAS = [
  { key: "travessa",  label: "Loja Travessa" },
  { key: "flamengo",  label: "Loja Flamengo" },
  { key: "centro",    label: "Loja Centro"   },
  { key: "aeroporto", label: "Aeroporto"     },
];

// ── Estado local ─────────────────────────────────────────────
let lancamentos = [];   // lançamentos manuais (producao / entrega da fábrica)
let historicoLojas = []; // entregas confirmadas pelas lojas (nó historico/)
let tipoAtual = "producao";
let periodoFiltro = 7;
let typeFiltro = "all";
let groupFiltro = "day";

// Gráficos Chart.js
let chartMain  = null;
let chartSaldo = null;

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `show ${type}`;
  setTimeout(() => { el.className = ""; }, 3000);
}

// ── Relógio ───────────────────────────────────────────────────
setInterval(() => {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString("pt-BR");
}, 1000);

// ── Tab switch ────────────────────────────────────────────────
window.switchTab = function (id) {
  document.querySelectorAll(".tab-btn").forEach((b, i) => {
    const ids = ["registrar","historico","grafico","lojas"];
    b.classList.toggle("active", ids[i] === id);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === `tab-${id}`);
  });
  if (id === "grafico")  renderCharts();
  if (id === "historico") renderTabela();
  if (id === "lojas")    renderLojas();
};

// ── Tipo lançamento ───────────────────────────────────────────
window.setTipo = function (tipo) {
  tipoAtual = tipo;
  document.getElementById("btn-tipo-producao").classList.toggle("active", tipo === "producao");
  document.getElementById("btn-tipo-entrega").classList.toggle("active", tipo === "entrega");
  document.getElementById("sel-loja").style.display = tipo === "entrega" ? "inline-block" : "none";
};

// ── Filtros ───────────────────────────────────────────────────
window.setPeriod = function (btn, days) {
  document.querySelectorAll("[data-period]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  periodoFiltro = days;
  renderTabela();
  renderCharts();
};
window.setType = function (btn, type) {
  document.querySelectorAll("[data-type]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  typeFiltro = type;
  renderTabela();
};
window.setGroup = function (btn, group) {
  document.querySelectorAll("[data-group]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  groupFiltro = group;
  renderCharts();
};

// ── Formulário de registro ────────────────────────────────────
function buildForm() {
  const grid = document.getElementById("registro-grid");
  grid.innerHTML = "";
  CATALOG.forEach((item) => {
    const div = document.createElement("div");
    div.className = "reg-item";
    div.innerHTML = `
      <span class="reg-emoji">${item.emoji}</span>
      <div class="reg-info">
        <div class="reg-name">${item.name}</div>
        ${item.sub ? `<div class="reg-sub">${item.sub}</div>` : ""}
      </div>
      <input class="reg-input" type="number" min="0" step="1"
             placeholder="0" id="reg-${item.id}"
             onkeydown="handleRegKey(event, ${item.id})">
    `;
    grid.appendChild(div);
  });
}

window.handleRegKey = function (e, id) {
  if (e.key === "Enter") {
    const next = document.getElementById(`reg-${id + 1}`);
    if (next) next.focus();
  }
};

window.limparForm = function () {
  CATALOG.forEach((item) => {
    const el = document.getElementById(`reg-${item.id}`);
    if (el) el.value = "";
  });
};

window.salvarLancamento = async function () {
  const itens = [];
  CATALOG.forEach((item) => {
    const el = document.getElementById(`reg-${item.id}`);
    const qty = parseInt(el?.value || "0", 10);
    if (qty > 0) itens.push({ id: item.id, emoji: item.emoji, name: item.name, sub: item.sub, qty });
  });

  if (itens.length === 0) {
    showToast("⚠️ Nenhuma quantidade informada.", "err");
    return;
  }

  if (tipoAtual === "entrega") {
    const lojaKey = document.getElementById("sel-loja").value;
    if (!lojaKey) {
      showToast("⚠️ Selecione a loja de destino.", "err");
      return;
    }
  }

  const lojaKey   = tipoAtual === "entrega" ? document.getElementById("sel-loja").value : null;
  const lojaLabel = lojaKey ? LOJAS.find(l => l.key === lojaKey)?.label : null;

  const lancamento = {
    tipo: tipoAtual,               // "producao" | "entrega"
    timestamp: new Date().toISOString(),
    itens,
    ...(lojaKey && { lojaKey, lojaLabel }),
  };

  try {
    await push(ref(db, "lancamentos"), lancamento);
    showToast(tipoAtual === "producao" ? "✅ Produção registrada!" : "✅ Saída registrada!", "ok");
    limparForm();
  } catch (err) {
    console.error(err);
    showToast("❌ Erro ao salvar. Verifique a conexão.", "err");
  }
};

// ── Helpers de data ───────────────────────────────────────────
function parseTs(ts) {
  return ts ? new Date(ts) : null;
}
function formatDT(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function weekKey(ts) {
  const d = new Date(ts);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-S${String(week).padStart(2,"0")}`;
}
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function groupKey(ts) {
  if (groupFiltro === "week")  return weekKey(ts);
  if (groupFiltro === "month") return monthKey(ts);
  return dayKey(ts);
}

function isInPeriod(ts) {
  if (!periodoFiltro) return true;
  const cutoff = Date.now() - periodoFiltro * 86400000;
  return new Date(ts).getTime() >= cutoff;
}

// ── Todos os eventos (lançamentos + entregas das lojas) ───────
function allEvents() {
  const events = [];

  // Lançamentos manuais
  lancamentos.forEach((l) => {
    const caixas   = (l.itens || []).reduce((s, i) => s + (i.qty || 0), 0);
    const salgados = caixas * PER_BOX;
    events.push({
      tipo:      l.tipo,
      timestamp: l.timestamp,
      destino:   l.lojaLabel || (l.tipo === "producao" ? "Fábrica" : "—"),
      caixas,
      salgados,
      itens:     l.itens || [],
      fonte:     "manual",
    });
  });

  // Entregas confirmadas pelas lojas (nó historico/)
  historicoLojas.forEach((h) => {
    const itens    = Array.isArray(h.itens)
      ? h.itens
      : Object.entries(h.itens || {}).map(([id, qty]) => ({ id, qty }));
    const caixas   = itens.reduce((s, i) => s + (i.qty || 0), 0);
    const salgados = caixas * PER_BOX;
    events.push({
      tipo:      "entrega",
      timestamp: h.entregueEm || h.timestamp,
      destino:   h.nomeLoja || h.lojaLabel || h.loja || "Loja",
      caixas,
      salgados,
      itens,
      fonte:     "loja",
    });
  });

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events;
}

// ── KPIs globais ─────────────────────────────────────────────
function updateKPIs() {
  const events = allEvents();

  let totalProd = 0, totalEnt = 0, hoje = 0;
  const todayKey = dayKey(new Date().toISOString());

  events.forEach((e) => {
    if (e.tipo === "producao") totalProd += e.salgados;
    else                       totalEnt  += e.salgados;
    if (dayKey(e.timestamp) === todayKey) hoje++;
  });

  const saldo = totalProd - totalEnt;

  document.getElementById("kpi-prod-total").textContent = totalProd.toLocaleString("pt-BR");
  document.getElementById("kpi-ent-total").textContent  = totalEnt.toLocaleString("pt-BR");
  document.getElementById("kpi-hoje").textContent       = hoje;

  const saldoEl = document.getElementById("kpi-saldo");
  saldoEl.textContent = saldo.toLocaleString("pt-BR");
  saldoEl.className   = `kpi-value ${saldo >= 0 ? "ok" : "warn"}`;

  const ultimo = events[0];
  if (ultimo) {
    document.getElementById("kpi-ultimo").textContent    = formatDT(ultimo.timestamp);
    document.getElementById("kpi-ultimo-sub").textContent =
      ultimo.tipo === "producao" ? "🏭 Produção" : `🚚 Entrega → ${ultimo.destino}`;
  }
}

// ── Tabela de histórico ───────────────────────────────────────
function renderTabela() {
  const tbody = document.getElementById("hist-tbody");
  let events = allEvents();

  // filtro período
  if (periodoFiltro) {
    events = events.filter(e => isInPeriod(e.timestamp));
  }
  // filtro tipo
  if (typeFiltro !== "all") {
    events = events.filter(e => e.tipo === typeFiltro);
  }

  if (events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="hist-empty">Nenhum registro encontrado para este filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = events.map(e => `
    <tr>
      <td>${formatDT(e.timestamp)}</td>
      <td><span class="type-badge ${e.tipo}">
        ${e.tipo === "producao" ? "🏭 Produção" : "🚚 Entrega"}
      </span></td>
      <td>${e.destino}</td>
      <td>${e.caixas}</td>
      <td>${e.salgados.toLocaleString("pt-BR")}</td>
      <td style="font-size:.72rem;color:var(--muted)">
        ${e.itens.slice(0,3).map(i => `${i.emoji||""} ${i.name||""} ×${i.qty}`).join(" · ")}
        ${e.itens.length > 3 ? ` +${e.itens.length-3}` : ""}
      </td>
    </tr>
  `).join("");
}

// ── Gráficos ─────────────────────────────────────────────────
function renderCharts() {
  // carrega Chart.js dinamicamente se necessário
  if (!window.Chart) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
    s.onload = () => drawCharts();
    document.head.appendChild(s);
  } else {
    drawCharts();
  }
}

function drawCharts() {
  let events = allEvents();
  if (periodoFiltro) events = events.filter(e => isInPeriod(e.timestamp));

  // Agrupa por período
  const buckets = {};
  events.forEach(e => {
    const k = groupKey(e.timestamp);
    if (!buckets[k]) buckets[k] = { prod: 0, ent: 0 };
    if (e.tipo === "producao") buckets[k].prod += e.salgados;
    else                       buckets[k].ent  += e.salgados;
  });

  const labels = Object.keys(buckets).sort();
  const prodData = labels.map(k => buckets[k].prod);
  const entData  = labels.map(k => buckets[k].ent);

  // Saldo acumulado
  let acc = 0;
  const saldoData = labels.map((k, i) => {
    acc += prodData[i] - entData[i];
    return acc;
  });

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
    scales: {
      x: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#6b6870", font: { size: 11 } } },
      y: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#6b6870", font: { size: 11 } } },
    },
  };

  // Gráfico principal
  const ctx1 = document.getElementById("chart-main").getContext("2d");
  if (chartMain) chartMain.destroy();
  chartMain = new window.Chart(ctx1, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Produção",
          data: prodData,
          backgroundColor: "rgba(129,31,59,.7)",
          borderColor: "#811f3b",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Entregue",
          data: entData,
          backgroundColor: "rgba(61,153,112,.55)",
          borderColor: "#3d9970",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: baseOpts,
  });

  // Gráfico saldo
  const ctx2 = document.getElementById("chart-saldo").getContext("2d");
  if (chartSaldo) chartSaldo.destroy();
  chartSaldo = new window.Chart(ctx2, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Saldo",
          data: saldoData,
          borderColor: "#e8a838",
          backgroundColor: "rgba(232,168,56,.12)",
          fill: true,
          tension: .35,
          pointRadius: 3,
          pointBackgroundColor: "#e8a838",
        },
      ],
    },
    options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, beginAtZero: false } } },
  });
}

// ── Por loja ─────────────────────────────────────────────────
function renderLojas() {
  const events = allEvents().filter(e => e.tipo === "entrega");

  // Agrega por loja
  const porLoja = {};
  LOJAS.forEach(l => { porLoja[l.label] = { caixas: 0, salgados: 0 }; });

  events.forEach(e => {
    const k = e.destino;
    if (!porLoja[k]) porLoja[k] = { caixas: 0, salgados: 0 };
    porLoja[k].caixas   += e.caixas;
    porLoja[k].salgados += e.salgados;
  });

  const grid = document.getElementById("loja-grid");
  grid.innerHTML = "";
  Object.entries(porLoja).forEach(([label, data]) => {
    const card = document.createElement("div");
    card.className = "loja-card";
    card.innerHTML = `
      <div class="loja-card-header">${label}</div>
      <div class="loja-card-body">
        <div class="loja-stat">
          <span class="loja-stat-label">Caixas recebidas</span>
          <span class="loja-stat-value">${data.caixas}</span>
        </div>
        <div class="loja-stat">
          <span class="loja-stat-label">Salgados recebidos</span>
          <span class="loja-stat-value" style="font-size:1rem">${data.salgados.toLocaleString("pt-BR")}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Tabela por item
  const porItem = {};
  CATALOG.forEach(c => {
    porItem[c.id] = { item: c, prodCx: 0, entCx: 0 };
  });

  allEvents().forEach(e => {
    e.itens.forEach(i => {
      if (!porItem[i.id]) return;
      if (e.tipo === "producao") porItem[i.id].prodCx += i.qty || 0;
      else                       porItem[i.id].entCx  += i.qty || 0;
    });
  });

  const tbody = document.getElementById("item-tbody");
  tbody.innerHTML = Object.values(porItem).map(({ item, prodCx, entCx }) => {
    const saldo = prodCx - entCx;
    return `
      <tr>
        <td>${item.emoji} ${item.name}${item.sub ? ` <span style="color:var(--muted);font-size:.68rem">${item.sub}</span>` : ""}</td>
        <td style="color:var(--brand)">${prodCx}</td>
        <td style="color:var(--ok)">${entCx}</td>
        <td style="color:${saldo >= 0 ? "var(--warn)" : "var(--ok)"}; font-family:var(--font-display);font-size:1rem">${saldo}</td>
      </tr>
    `;
  }).join("");
}

// ── Firebase: escuta lançamentos ─────────────────────────────
function initFirebase() {
  // Lançamentos manuais da fábrica (novo nó, começa vazio)
  const lancRef = query(
    ref(db, "lancamentos"),
    orderByChild("timestamp"),
    limitToLast(500),
  );
  onValue(lancRef, (snap) => {
    lancamentos = [];
    snap.forEach(child => lancamentos.push(child.val()));
    lancamentos.reverse(); // mais recente primeiro
    updateKPIs();
    renderTabela();
  });

  // Entregas confirmadas pelas lojas (nó historico/ existente)
  let loadsRestantes = LOJAS.length;
  historicoLojas = [];

  LOJAS.forEach((loja) => {
    const hRef = query(
      ref(db, `historico/${loja.key}`),
      orderByChild("entregueEm"),
      limitToLast(200),
    );
    onValue(hRef, (snap) => {
      // Remove registros anteriores desta loja e reinsere
      historicoLojas = historicoLojas.filter(h => h._lojaKey !== loja.key);
      snap.forEach(child => {
        historicoLojas.push({ ...child.val(), _lojaKey: loja.key, lojaLabel: loja.label });
      });
      loadsRestantes = Math.max(0, loadsRestantes - 1);
      if (loadsRestantes === 0) {
        document.getElementById("loading-overlay").classList.add("hidden");
      }
      updateKPIs();
      renderTabela();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────
buildForm();
initFirebase();
