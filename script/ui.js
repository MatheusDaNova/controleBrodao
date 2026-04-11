// ============================================================
//  ui.js — Módulo de Interface (Exibição de Salgados)
//  Responsabilidades:
//    - Validar a loja e exibir tela de erro se necessário
//    - Definir o catálogo de produtos (defaults)
//    - Renderizar cards de estoque no grid
//    - Controlar os botões +/− e animações
//    - Atualizar o painel de resumo
//    - Exibir toasts de feedback
// ============================================================

import { loja, saveItem, onEstoqueChange } from "./db.js";

// ── Dicionário de nomes de exibição ──────────────────────────
const nomes = {
  travessa: "Loja Travessa",
  flamengo: "Loja Flamengo",
  centro: "Loja Centro",
  aeroporto: "Aeroporto",
};

// ── Validação da loja ─────────────────────────────────────────
if (!(loja in nomes)) {
  document.body.innerHTML = `
    <div style="
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; gap: 1rem;
      font-family: 'DM Sans', sans-serif;
      color: #f0ebe0;
    ">
      <span style="font-size: 3rem;">🚫</span>
      <h2 style="font-family: 'Bebas Neue', sans-serif; font-size: 2rem; letter-spacing: 0.1em;">
        Acesso não autorizado
      </h2>
      <p style="color: #7a7060; font-size: 0.9rem;">
        A filial "<strong style="color:#f0ebe0">${loja}</strong>" não está cadastrada no sistema.
      </p>
    </div>
  `;
  throw new Error(`Filial "${loja}" não encontrada.`);
}

const nomeLoja = nomes[loja];

// ── Atualiza título e cabeçalho da página ────────────────────
document.getElementById("subtitulo-loja").textContent =
  `Controle de salgados · ${nomeLoja}`;
document.title = `Estoque · ${nomeLoja}`;

// ── Catálogo de produtos ──────────────────────────────────────
const PER_BOX = 20;

const defaults = [
  {
    id: 1,
    emoji: "🧅",
    name: "Cebola",
    sub: "Queijo, Presunto e cebola",
    boxes: 8,
  },
  {
    id: 2,
    emoji: "🧀",
    name: "Queijo e Presunto",
    sub: "Tradicional",
    boxes: 4,
  },
  { id: 3, emoji: "🍔", name: "Hamburguer", sub: "Mussarela", boxes: 3 },
  { id: 4, emoji: "🍯", name: "Hamburguer", sub: "Cheddar", boxes: 6 },
  { id: 5, emoji: "🍗", name: "Frango", sub: "Frango com Requeijão", boxes: 2 },
  { id: 6, emoji: "🍖", name: "Carne-Seca", sub: "", boxes: 0 },
  {
    id: 7,
    emoji: "🌿",
    name: "Pastel de Forno",
    sub: "Queijo minas e espinafre",
    boxes: 1,
  },
  { id: 8, emoji: "🍗", name: "Pastel de Forno", sub: "Frango", boxes: 1 },
  { id: 9, emoji: "🥟", name: "Coxinha", sub: "Frango com catupiry", boxes: 5 },
  { id: 10, emoji: "", name: "Coxinha", sub: "SEM", boxes: 0 },
  { id: 11, emoji: "🍕", name: "Calabresa", sub: "", boxes: 4 },
  { id: 12, emoji: "🍡", name: "Napolitano", sub: "", boxes: 1 },
  { id: 13, emoji: "🌭", name: "Dogão", sub: "", boxes: 2 },
  { id: 14, emoji: "🥩", name: "Costela", sub: "", boxes: 5 },
  { id: 15, emoji: "🍇", name: "Açaí", sub: "", boxes: 0 },
  { id: 16, emoji: "🍨", name: "Sorvete", sub: "", boxes: 0 },
  { id: 17, emoji: "", name: "Kibe", sub: "", boxes: 0 },
  { id: 18, emoji: "🥐", name: "Croissant", sub: "Chocolate", boxes: 1 },
  { id: 19, emoji: "🌕", name: "Pão de queijo", sub: "", boxes: 1 },
];

// Itens exclusivos do Aeroporto
if (loja === "aeroporto") {
  defaults.push(
    { id: 20, emoji: "🥔", name: "Pão de Batata", sub: "", boxes: 0 },
    { id: 21, emoji: "🥧", name: "Empadão", sub: "", boxes: 0 },
    { id: 22, emoji: "🍬", name: "Docinho", sub: "", boxes: 0 },
    { id: 23, emoji: "🎂", name: "Bolo", sub: "", boxes: 0 },
    { id: 24, emoji: "🥪", name: "Sanduíche Natural", sub: "", boxes: 0 },
    { id: 25, emoji: "🥪", name: "Sanduíche Natural", sub: "Frango", boxes: 0 },
  );
}

// Estado local (espelho do Firebase)
const items = defaults.map((i) => ({ ...i }));

// ── Indicador de carregamento ─────────────────────────────────
function setLoading(on) {
  document.getElementById("grid").style.opacity = on ? "0.4" : "1";
}
setLoading(true);

// ── Escuta mudanças em tempo real vindas do Firebase ──────────
onEstoqueChange((data) => {
  items.forEach((item) => {
    if (data[item.id] !== undefined) {
      item.boxes = data[item.id];
    }
  });
  render();
  setLoading(false);
});

// ── Helpers de badge ──────────────────────────────────────────
function getBadge(boxes) {
  if (boxes === 0) return ["badge-empty", "Esgotado"];
  if (boxes <= 2) return ["badge-low", "Baixo"];
  return ["badge-ok", "OK"];
}

// ── Renderização completa do grid ─────────────────────────────
function render() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  items.forEach((item) => {
    const [badgeClass, badgeLabel] = getBadge(item.boxes);
    const units = item.boxes * PER_BOX;
    const div = document.createElement("div");
    div.className = "card";
    div.id = `card-${item.id}`;
    div.innerHTML = `
      <div class="card-top">
        <div>
          <div style="display:flex;align-items:center;gap:0.6rem">
            <span class="card-emoji">${item.emoji}</span>
            <div>
              <div class="card-name">${item.name}</div>
              <div class="card-sub">${item.sub}</div>
            </div>
          </div>
        </div>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="card-counts">
        <div class="count-block">
          <div class="cb-label">Caixas</div>
          <div class="cb-value highlight" id="boxes-${item.id}">${item.boxes}</div>
        </div>
        <div class="count-block">
          <div class="cb-label">Salgados</div>
          <div class="cb-value" id="units-${item.id}">${units}</div>
        </div>
      </div>
      <div class="card-controls">
        <button class="ctrl-btn minus" onclick="change(${item.id}, -1)" ${item.boxes === 0 ? "disabled" : ""} title="Remover caixa">−</button>
        <span class="ctrl-label">caixas</span>
        <button class="ctrl-btn plus"  onclick="change(${item.id}, +1)" title="Adicionar caixa">+</button>
      </div>
    `;
    grid.appendChild(div);
  });

  updateSummary();
}

// ── Altera quantidade de caixas (chamado pelo onclick dos botões) ─
window.change = function change(id, delta) {
  const item = items.find((i) => i.id === id);
  if (!item) return;

  const newVal = item.boxes + delta;
  if (newVal < 0) return;
  item.boxes = newVal;

  // Atualiza apenas os elementos afetados (sem re-renderizar tudo)
  const [badgeClass, badgeLabel] = getBadge(item.boxes);
  const card = document.getElementById(`card-${item.id}`);
  const boxEl = document.getElementById(`boxes-${item.id}`);
  const unitEl = document.getElementById(`units-${item.id}`);
  const badge = card.querySelector(".badge");
  const minusBtn = card.querySelector(".ctrl-btn.minus");

  boxEl.textContent = item.boxes;
  unitEl.textContent = item.boxes * PER_BOX;
  badge.className = `badge ${badgeClass}`;
  badge.textContent = badgeLabel;
  minusBtn.disabled = item.boxes === 0;

  // Animação "pop" no número de caixas
  boxEl.classList.remove("pop");
  void boxEl.offsetWidth; // força reflow para reiniciar a animação
  boxEl.classList.add("pop");

  showToast(delta > 0 ? "📦" : "🗑️", item.name, delta);
  saveItem(item.id, item.boxes);
  updateSummary();
};

// ── Painel de resumo ──────────────────────────────────────────
function updateSummary() {
  const totalBoxes = items.reduce((s, i) => s + i.boxes, 0);
  const totalUnits = totalBoxes * PER_BOX;
  const empty = items.filter((i) => i.boxes === 0).length;

  document.getElementById("total-boxes").textContent = totalBoxes;
  document.getElementById("total-units").textContent = totalUnits;
  document.getElementById("total-empty").textContent = empty;
}

// ── Toast de feedback ─────────────────────────────────────────
let toastTimer;
function showToast(icon, name, delta) {
  const el = document.getElementById("toast");
  const action = delta > 0 ? "adicionada ao" : "removida do";
  el.innerHTML = `<span class="toast-icon">${icon}</span> 1 caixa ${action} estoque de <strong>${name}</strong>`;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}
