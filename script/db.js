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
 * @param {number|string} id    - ID do item
 * @param {number}        boxes - Nova quantidade de caixas
 */
export function saveItem(id, boxes) {
  update(estoqueRef, {
    [id]: boxes,
    _updatedAt: new Date().toISOString(), // timestamp gravado pelo funcionário
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
