// ============================================================
//  visao-geral.js — Lógica da página de Visão Geral
//  Responsabilidades:
//    - Conectar ao Firebase e escutar todas as lojas
//    - Criar e renderizar os cards por loja
//    - Atualizar resumo global
//    - Relógio ao vivo + timestamps relativos
//    - Pedidos pendentes + histórico de entregas
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  remove as fbRemove,
  set,
  query,
  orderByChild,
  limitToLast,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── Config Firebase ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD5WD6H5KDr3cglKW71JRqdgtnKyypwKtc",
  authDomain: "estoque-brodao.firebaseapp.com",
  databaseURL: "https://estoque-brodao-default-rtdb.firebaseio.com",
  projectId: "estoque-brodao",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Chama a função Modificado pela ultima vez

// ── Catálogo de produtos ─────────────────────────────────────
const PER_BOX = 20;

const CATALOG = [
  { id: 1, emoji: "🧅", name: "Cebola", sub: "Queijo, Presunto e cebola" },
  { id: 2, emoji: "🧀", name: "Queijo e Presunto", sub: "Tradicional" },
  { id: 3, emoji: "🍔", name: "Hamburguer", sub: "Mussarela" },
  { id: 4, emoji: "🍯", name: "Hamburguer", sub: "Cheddar" },
  { id: 5, emoji: "🍗", name: "Frango", sub: "Frango com Requeijão" },
  { id: 6, emoji: "🍖", name: "Carne-Seca", sub: "" },
  {
    id: 7,
    emoji: "🌿",
    name: "Pastel de Forno",
    sub: "Queijo minas e espinafre",
  },
  { id: 8, emoji: "🍗", name: "Pastel de Forno", sub: "Frango" },
  { id: 11, emoji: "🍕", name: "Calabresa", sub: "" },
  { id: 12, emoji: "🍡", name: "Napolitano", sub: "" },
  { id: 13, emoji: "🌭", name: "Dogão", sub: "" },
  { id: 14, emoji: "🥩", name: "Costela", sub: "" },
  { id: 18, emoji: "🥐", name: "Croissant", sub: "Chocolate" },
];

// ── Lojas ────────────────────────────────────────────────────
const LOJAS = [
  { key: "travessa", label: "Loja Travessa", catalog: CATALOG },
  { key: "flamengo", label: "Loja Flamengo", catalog: CATALOG },
  { key: "centro", label: "Loja Centro", catalog: CATALOG },
  { key: "aeroporto", label: "Aeroporto", catalog: [...CATALOG] },
];

// Estado de cada loja: { boxes: {id: n}, lastUpdated: Date|null }
const state = {};
LOJAS.forEach((l) => {
  state[l.key] = { boxes: {}, lastUpdated: null };
});

let loadedCount = 0;

// ── Helpers ──────────────────────────────────────────────────
function getBadgeClass(boxes) {
  if (boxes === 0) return "empty";
  if (boxes <= 2) return "low";
  return "ok";
}

function formatRelative(date) {
  if (!date) return "Sem dados";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Renderiza um card de loja ────────────────────────────────
function renderStoreCard(loja) {
  const s = state[loja.key];
  const catalog = loja.catalog;

  const totalBoxes = catalog.reduce(
    (acc, item) => acc + (s.boxes[item.id] || 0),
    0,
  );
  const totalUnits = totalBoxes * PER_BOX;

  let cntOk = 0,
    cntLow = 0,
    cntEmpty = 0;
  catalog.forEach((item) => {
    const b = s.boxes[item.id] || 0;
    if (b === 0) cntEmpty++;
    else if (b <= 2) cntLow++;
    else cntOk++;
  });

  const card = document.getElementById(`store-${loja.key}`);
  if (!card) return;

  card.querySelector(".sc-boxes").textContent = totalBoxes;
  card.querySelector(".sc-units").textContent = totalUnits;

  card.querySelector(".sc-status-bar").innerHTML = `
    <span class="status-pill sp-ok">   <i class="dot"></i>${cntOk} OK</span>
    <span class="status-pill sp-low">  <i class="dot"></i>${cntLow} Baixo</span>
    <span class="status-pill sp-empty"><i class="dot"></i>${cntEmpty} Esgotado</span>
  `;

  card.querySelector(".upd-time").textContent = formatRelative(s.lastUpdated);

  const list = card.querySelector(".items-list");
  list.innerHTML = "";
  catalog.forEach((item) => {
    const boxes = s.boxes[item.id] || 0;
    const cls = getBadgeClass(boxes);
    const label = item.sub
      ? `${item.name} <span class="ir-sub">${item.sub}</span>`
      : item.name;
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <span class="ir-name">${item.emoji} ${label}</span>
      <span class="ir-boxes ${cls}">${boxes}</span>
    `;
    list.appendChild(row);
  });

  updateGlobalBar();
}

// ── Cria o card HTML inicial ─────────────────────────────────
function createStoreCard(loja) {
  const grid = document.getElementById("stores-grid");
  const card = document.createElement("div");
  card.className = "store-card";
  card.id = `store-${loja.key}`;
  card.innerHTML = `
    <div class="sc-header">
      <span class="sc-name">${loja.label}</span>
      <a class="sc-link" href="index.html?loja=${loja.key}">Abrir loja ↗</a>
    </div>
    <div class="sc-counts">
      <div class="sc-count-block">
        <span class="cb-label">Caixas</span>
        <span class="cb-value sc-boxes">—</span>
      </div>
      <div class="sc-count-block">
        <span class="cb-label">Salgados</span>
        <span class="cb-value sc-units">—</span>
      </div>
    </div>
    <div class="sc-status-bar">
      <span class="status-pill sp-ok"><i class="dot"></i>— OK</span>
      <span class="status-pill sp-low"><i class="dot"></i>— Baixo</span>
      <span class="status-pill sp-empty"><i class="dot"></i>— Esgotado</span>
    </div>
    <div class="sc-footer">
      <span class="upd-icon">🕐</span>
      <span class="upd-text">Última atualização: <span class="upd-time">—</span></span>
    </div>
    <div class="sc-items">
      <button class="sc-items-toggle" onclick="toggleItems(this)">
        Ver todos os itens
        <em class="chevron">▾</em>
      </button>
      <span id="footer-updated-at" style="opacity:1"></span>
      <div class="items-list"></div>
    </div>
  `;
  grid.appendChild(card);
}

// ── Resumo global ────────────────────────────────────────────
function updateGlobalBar() {
  let totalBoxes = 0,
    totalOk = 0,
    totalEmpty = 0;

  LOJAS.forEach((loja) => {
    const s = state[loja.key];
    loja.catalog.forEach((item) => {
      const b = s.boxes[item.id] || 0;
      totalBoxes += b;
      if (b === 0) totalEmpty++;
      else totalOk++;
    });
  });

  document.getElementById("g-boxes").textContent = totalBoxes;
  document.getElementById("g-units").textContent = (
    totalBoxes * PER_BOX
  ).toLocaleString("pt-BR");
  document.getElementById("g-ok").textContent = totalOk;
  document.getElementById("g-empty").textContent = totalEmpty;
  document.getElementById("g-stores").textContent = LOJAS.length;
}

// ── Toggle lista de items ────────────────────────────────────
window.toggleItems = function (btn) {
  btn.classList.toggle("open");
  btn.nextElementSibling.classList.toggle("open");
  btn.textContent = btn.classList.contains("open") ? "" : "Ver todos os itens";
  btn.innerHTML += ' <em class="chevron">▾</em>';
};

// ── Relógio ao vivo + refresh de timestamps ──────────────────
setInterval(() => {
  document.getElementById("clock").textContent = new Date().toLocaleTimeString(
    "pt-BR",
  );
  LOJAS.forEach((l) => {
    const el = document.querySelector(`#store-${l.key} .upd-time`);
    if (el) el.textContent = formatRelative(state[l.key].lastUpdated);
  });
}, 1000);

// ── Pedidos pendentes ────────────────────────────────────────
const pedidosState = {};
LOJAS.forEach((l) => {
  pedidosState[l.key] = {};
});

function renderPedidosSection() {
  let section = document.getElementById("pedidos-section");
  if (!section) {
    section = document.createElement("section");
    section.id = "pedidos-section";
    section.style.cssText =
      "margin-top: 2.5rem; opacity:0; animation: fadeUp .5s .4s forwards;";
    document.querySelector("main").appendChild(section);
  }

  const lojaComPedidos = LOJAS.filter(
    (l) => Object.keys(pedidosState[l.key]).length > 0,
  );

  if (lojaComPedidos.length === 0) {
    section.innerHTML = `
      <div class="pedidos-section-title">
        <span class="pedidos-count-badge">0</span>
        <span>PEDIDOS PENDENTES</span>
      </div>
      <div style="
        padding: 1.8rem;
        text-align: center;
        color: var(--muted);
        font-size: 0.82rem;
        letter-spacing: 0.06em;
        border: 1px dashed var(--border);
        border-radius: 12px;
      ">
        ✅ Nenhum pedido pendente no momento
      </div>
    `;
    return;
  }

  const totalPedidos = lojaComPedidos.reduce(
    (a, l) => a + Object.keys(pedidosState[l.key]).length,
    0,
  );

  section.innerHTML = `
    <div class="pedidos-section-title">
      <span class="pedidos-count-badge">${totalPedidos}</span>
      <span>PEDIDOS PENDENTES</span>
    </div>
    <div class="pedidos-grid" id="pedidos-grid"></div>
  `;

  const grid = document.getElementById("pedidos-grid");

  lojaComPedidos.forEach((loja) => {
    const pedidos = Object.entries(pedidosState[loja.key]);
    pedidos.sort((a, b) => b[1].timestamp - a[1].timestamp);

    pedidos.forEach(([pid, pedido]) => {
      const totalCaixas = (pedido.itens || []).reduce(
        (s, i) => s + (i.qty || 0),
        0,
      );
      const totalSalgados = totalCaixas * PER_BOX;
      const ts = pedido.timestamp ? new Date(pedido.timestamp) : null;
      const timeStr = ts
        ? ts.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";

      const card = document.createElement("div");
      card.className = "pedido-card";
      card.innerHTML = `
        <div class="pedido-card-header">
          <div class="pedido-card-loja">${pedido.nomeLoja || loja.label}</div>
          <span class="pedido-status-badge">⏳ Pendente</span>
        </div>
        <div class="pedido-card-stats">
          <div class="pedido-stat">
            <span class="pedido-stat-label">Caixas</span>
            <span class="pedido-stat-value">${totalCaixas}</span>
          </div>
          <div class="pedido-stat">
            <span class="pedido-stat-label">Salgados</span>
            <span class="pedido-stat-value">${totalSalgados.toLocaleString("pt-BR")}</span>
          </div>
          <div class="pedido-stat">
            <span class="pedido-stat-label">Itens</span>
            <span class="pedido-stat-value">${(pedido.itens || []).length}</span>
          </div>
        </div>
        <div class="pedido-card-items">
          ${(pedido.itens || [])
            .map(
              (item) => `
            <div class="pedido-card-item">
              <span>${item.emoji || ""} ${item.name}${item.sub ? ` <em style="color:var(--muted);font-style:normal;font-size:.65rem">${item.sub}</em>` : ""}</span>
              <span class="pedido-card-qty">${item.qty} cx · ${item.qty * PER_BOX} unt</span>
            </div>
          `,
            )
            .join("")}
        </div>
        <div class="pedido-card-footer">
          <span class="pedido-card-time">🕐 ${timeStr}</span>
          <button class="pedido-card-confirm-btn" onclick="confirmarEntrega('${loja.key}', '${pid}')">
            ✓ Confirmar entrega
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
  });
}

// ── Confirmar entrega: move para histórico ───────────────────
//
//  Estrutura gravada em  historico/<lojaKey>/<pedidoId>:
//  {
//    ...dadosOriginaisDoP edido,
//    entregueEm: "2025-04-28T14:32:00.000Z"   ← momento da confirmação
//  }
//
window.confirmarEntrega = async function (lojaKey, pedidoId) {
  const pedidoRef = ref(db, `pedidos/${lojaKey}/${pedidoId}`);
  const historicoRef = ref(db, `historico/${lojaKey}/${pedidoId}`);

  // Pega os dados do pedido que está em memória
  const pedido = pedidosState[lojaKey][pedidoId];
  if (!pedido) return;

  // Salva no histórico com o timestamp de entrega
  await set(historicoRef, {
    ...pedido,
    entregueEm: new Date().toISOString(),
  });

  // Remove dos pedidos pendentes
  await fbRemove(pedidoRef);

  delete pedidosState[lojaKey][pedidoId];
  renderPedidosSection();
};

// ── Histórico de entregas ────────────────────────────────────
//
//  Escuta historico/<lojaKey> em tempo real.
//  Mantém os últimos 50 registros de cada loja em memória.
//  Renderiza a seção de histórico abaixo dos pedidos pendentes.
//
const historicoState = {};
LOJAS.forEach((l) => {
  historicoState[l.key] = {};
});

function renderHistoricoSection() {
  let section = document.getElementById("historico-section");
  if (!section) {
    section = document.createElement("section");
    section.id = "historico-section";
    section.style.cssText =
      "margin-top: 2.5rem; opacity:0; animation: fadeUp .5s .6s forwards;";
    document.querySelector("main").appendChild(section);
  }

  // Junta todos os registros de todas as lojas em um array plano
  const todos = [];
  LOJAS.forEach((loja) => {
    Object.entries(historicoState[loja.key]).forEach(([id, pedido]) => {
      todos.push({ id, lojaLabel: loja.label, lojaKey: loja.key, ...pedido });
    });
  });

  // Mais recente primeiro (pela data de entrega)
  todos.sort((a, b) => {
    const ta = a.entregueEm ? new Date(a.entregueEm).getTime() : 0;
    const tb = b.entregueEm ? new Date(b.entregueEm).getTime() : 0;
    return tb - ta;
  });

  if (todos.length === 0) {
    section.innerHTML = `
      <div class="pedidos-section-title">
        <span class="pedidos-count-badge">0</span>
        <span>HISTÓRICO DE ENTREGAS</span>
      </div>
      <div style="
        padding: 1.8rem;
        text-align: center;
        color: var(--muted);
        font-size: 0.82rem;
        letter-spacing: 0.06em;
        border: 1px dashed var(--border);
        border-radius: 12px;
      ">
        📦 Nenhuma entrega registrada ainda
      </div>
    `;
    return;
  }

  section.innerHTML = `
    <div class="pedidos-section-title">
      <span class="pedidos-count-badge">${todos.length}</span>
      <span>HISTÓRICO DE ENTREGAS</span>
    </div>
    <div class="historico-grid" id="historico-grid"></div>
  `;

  const grid = document.getElementById("historico-grid");

  todos.forEach((pedido) => {
    const totalCaixas = (pedido.itens || []).reduce(
      (s, i) => s + (i.qty || 0),
      0,
    );
    const totalSalgados = totalCaixas * PER_BOX;

    const card = document.createElement("div");
    card.className = "historico-card";
    card.innerHTML = `
      <div class="pedido-card-header">
        <div class="pedido-card-loja">${pedido.nomeLoja || pedido.lojaLabel}</div>
        <span class="historico-status-badge">✅ Entregue</span>
      </div>
      <div class="pedido-card-stats">
        <div class="pedido-stat">
          <span class="pedido-stat-label">Caixas</span>
          <span class="pedido-stat-value">${totalCaixas}</span>
        </div>
        <div class="pedido-stat">
          <span class="pedido-stat-label">Salgados</span>
          <span class="pedido-stat-value">${totalSalgados.toLocaleString("pt-BR")}</span>
        </div>
        <div class="pedido-stat">
          <span class="pedido-stat-label">Itens</span>
          <span class="pedido-stat-value">${(pedido.itens || []).length}</span>
        </div>
      </div>
      <div class="pedido-card-items">
        ${(pedido.itens || [])
          .map(
            (item) => `
          <div class="pedido-card-item">
            <span>${item.emoji || ""} ${item.name}${item.sub ? ` <em style="color:var(--muted);font-style:normal;font-size:.65rem">${item.sub}</em>` : ""}</span>
            <span class="pedido-card-qty">${item.qty} cx · ${item.qty * PER_BOX} unt</span>
          </div>
        `,
          )
          .join("")}
      </div>
      <div class="pedido-card-footer historico-footer">
        <div class="historico-timestamps">
          <span class="pedido-card-time">📋 Pedido: ${formatDateTime(pedido.timestamp)}</span>
          <span class="pedido-card-time">✅ Entregue: ${formatDateTime(pedido.entregueEm)}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ── CSS adicional (pedidos + histórico) ──────────────────────
(function injectPedidosCSS() {
  const style = document.createElement("style");
  style.textContent = `
    .pedidos-section-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.1rem;
      letter-spacing: 0.14em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 1.2rem;
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }
    .pedidos-section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .pedidos-count-badge {
      background: rgba(129,31,59,.25);
      color: var(--brand);
      border: 1px solid rgba(129,31,59,.4);
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1rem;
      padding: 0.1rem 0.55rem;
      border-radius: 20px;
      letter-spacing: 0.06em;
    }
    .pedidos-grid,
    .historico-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.1rem;
    }
    .pedido-card,
    .historico-card {
      background: var(--card);
      border: 1px solid rgba(129,31,59,.3);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: fadeUp .4s forwards;
      transition: box-shadow .2s;
    }
    .historico-card {
      border-color: rgba(61,153,112,.2);
      opacity: 0.85;
    }
    .pedido-card:hover,
    .historico-card:hover {
      box-shadow: 0 6px 24px rgba(0,0,0,.35), 0 0 0 1px rgba(129,31,59,.2);
    }
    .pedido-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.9rem 1.1rem 0.7rem;
      border-bottom: 1px solid var(--border);
    }
    .pedido-card-loja {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.1rem;
      letter-spacing: 0.07em;
      color: var(--text);
    }
    .pedido-status-badge {
      font-size: 0.62rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.22rem 0.55rem;
      border-radius: 20px;
      background: rgba(232,168,56,.15);
      color: #e8a838;
      border: 1px solid rgba(232,168,56,.3);
    }
    .historico-status-badge {
      font-size: 0.62rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.22rem 0.55rem;
      border-radius: 20px;
      background: rgba(61,153,112,.15);
      color: var(--ok);
      border: 1px solid rgba(61,153,112,.3);
    }
    .pedido-card-stats {
      display: flex;
      gap: 1px;
      background: var(--border);
      border-bottom: 1px solid var(--border);
    }
    .pedido-stat {
      flex: 1;
      background: var(--card);
      padding: 0.65rem 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .pedido-stat-label {
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }
    .pedido-stat-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.6rem;
      line-height: 1;
      color: var(--brand);
    }
    .pedido-card-items {
      padding: 0.7rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      max-height: 160px;
      overflow-y: auto;
      flex: 1;
    }
    .pedido-card-items::-webkit-scrollbar { width: 2px; }
    .pedido-card-items::-webkit-scrollbar-thumb { background: var(--border); }
    .pedido-card-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.78rem;
      color: var(--text);
      padding: 0.22rem 0;
      border-bottom: 1px solid rgba(255,255,255,.04);
    }
    .pedido-card-item:last-child { border-bottom: none; }
    .pedido-card-qty {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 0.95rem;
      color: var(--brand);
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }
    .pedido-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 1.1rem;
      border-top: 1px solid var(--border);
      gap: 0.5rem;
    }
    .historico-footer {
      justify-content: flex-start;
    }
    .historico-timestamps {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .pedido-card-time { font-size: 0.68rem; color: var(--muted); }
    .pedido-card-confirm-btn {
      background: rgba(61,153,112,.15);
      border: 1px solid rgba(61,153,112,.3);
      color: var(--ok);
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      padding: 0.3rem 0.7rem;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
      font-family: 'DM Sans', sans-serif;
    }
    .pedido-card-confirm-btn:hover { background: rgba(61,153,112,.28); }
  `;
  document.head.appendChild(style);
})();

// ── Inicialização: cria cards e escuta Firebase ──────────────
LOJAS.forEach((loja) => {
  createStoreCard(loja);

  // Estoque em tempo real
  const estoqueRef = ref(db, `estoque/${loja.key}`);
  onValue(estoqueRef, (snapshot) => {
    const data = snapshot.val() || {};

    state[loja.key].boxes = {};
    loja.catalog.forEach((item) => {
      state[loja.key].boxes[item.id] =
        data[item.id] !== undefined ? data[item.id] : 0;
    });

    renderStoreCard(loja);

    loadedCount++;
    if (loadedCount >= LOJAS.length) {
      document.getElementById("loading-overlay").classList.add("hidden");
    }
  });

  // Pedidos pendentes em tempo real
  const pedidosRef = ref(db, `pedidos/${loja.key}`);
  onValue(pedidosRef, (snapshot) => {
    pedidosState[loja.key] = snapshot.val() || {};
    renderPedidosSection();
  });

  // Histórico de entregas em tempo real (últimas 50 por loja)
  const historicoRef = query(
    ref(db, `historico/${loja.key}`),
    orderByChild("entregueEm"),
    limitToLast(50),
  );
  onValue(historicoRef, (snapshot) => {
    historicoState[loja.key] = snapshot.val() || {};
    renderHistoricoSection();
  });
});
