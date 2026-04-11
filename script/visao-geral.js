// ============================================================
//  visao-geral.js — Lógica da página de Visão Geral
//  Responsabilidades:
//    - Conectar ao Firebase e escutar todas as lojas
//    - Criar e renderizar os cards por loja
//    - Atualizar resumo global
//    - Relógio ao vivo + timestamps relativos
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
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
  { id: 9, emoji: "🍕", name: "Calabresa", sub: "" },
  { id: 10, emoji: "🍡", name: "Napolitano", sub: "" },
  { id: 11, emoji: "🌭", name: "Dogão", sub: "" },
  { id: 12, emoji: "🥩", name: "Costela", sub: "" },
  { id: 13, emoji: "🥐", name: "Croissant", sub: "Chocolate" },
];

// ── Lojas ────────────────────────────────────────────────────
const LOJAS = [
  { key: "travessa", label: "Loja Travessa", catalog: CATALOG },
  { key: "flamengo", label: "Loja Flamengo", catalog: CATALOG },
  { key: "centro", label: "Loja Centro", catalog: CATALOG },
  {
    key: "aeroporto",
    label: "Aeroporto",
    catalog: [...CATALOG],
  },
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
        <span class="upd-text">Última atualização: <span class="upd-time">—</span></span>*/}
    </div>
    <div class="sc-items">
      <button class="sc-items-toggle" onclick="toggleItems(this)">
        Ver todos os itens
        <em class="chevron">▾</em>
      </button>
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

// ── Inicialização: cria cards e escuta Firebase ──────────────
LOJAS.forEach((loja) => {
  createStoreCard(loja);

  const estoqueRef = ref(db, `estoque/${loja.key}`);
  onValue(estoqueRef, (snapshot) => {
    const data = snapshot.val() || {};

    state[loja.key].boxes = {};
    loja.catalog.forEach((item) => {
      state[loja.key].boxes[item.id] =
        data[item.id] !== undefined ? data[item.id] : 0;
    });
    /*
    if (data._updatedAt && data._updatedAt !== state[loja.key]._updatedAt) {
      state[loja.key]._updatedAt = data._updatedAt;
      state[loja.key].lastUpdated = new Date(data._updatedAt);
    }
*/
    renderStoreCard(loja);

    loadedCount++;
    if (loadedCount >= LOJAS.length) {
      document.getElementById("loading-overlay").classList.add("hidden");
    }
  });
});
