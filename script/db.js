// ============================================================
//  db.js — Módulo Firebase (Banco de Dados)
//  Responsabilidades:
//    - Inicializar o app Firebase
//    - Expor funções para ler e salvar dados no Realtime Database
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  push,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ============================================================
//  🔧 COLE AQUI AS SUAS CREDENCIAIS DO FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyD5WD6H5KDr3cglKW71JRqdgtnKyypwKtc",
  authDomain: "estoque-brodao.firebaseapp.com",
  databaseURL: "https://estoque-brodao-default-rtdb.firebaseio.com",
  projectId: "estoque-brodao",
};
// ============================================================

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Lê o parâmetro ?loja= da URL (necessário para montar o caminho no banco)
const params = new URLSearchParams(window.location.search);
export const loja = params.get("loja") || "Brodão";

const estoqueRef = ref(db, `estoque/${loja}`);

/**
 * Salva a quantidade de caixas de um item no Firebase.
 * Também grava _updatedAt com o horário local (Brasil) da última modificação.
 * @param {number|string} id    - ID do item
 * @param {number}        boxes - Nova quantidade de caixas
 */
export function saveItem(id, boxes) {
  // Horário local formatado: "DD/MM/YYYY HH:MM:SS"
  const agora = new Date();
  const updatedAt = agora.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  update(estoqueRef, {
    [id]: boxes,
    _updatedAt: updatedAt, // ex: "04/05/2026, 14:32:07"
  });
}

/**
 * Registra um callback que será chamado sempre que os dados
 * do estoque desta loja mudarem no Firebase (tempo real).
 * @param {function} callback - Recebe o objeto de dados { id: boxes, ... }
 */
export function onEstoqueChange(callback) {
  onValue(estoqueRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
}

export function savePedido(pedido) {
  const pedidosRef = ref(db, `pedidos/${loja}`);
  return push(pedidosRef, pedido);
}
