// ============================================================
//  pwa.js — Módulo PWA
//  Responsabilidades:
//    - Registrar o Service Worker
//    - Capturar e exibir o banner de instalação (beforeinstallprompt)
//    - Esconder o banner após instalação confirmada
// ============================================================

// ── Registro do Service Worker ────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.warn("SW não registrado:", err));
  });
}

// ── Banner de instalação PWA ──────────────────────────────────
let deferredPrompt;

const banner = document.getElementById("pwa-banner");
const btnInstall = document.getElementById("pwa-btn-install");
const btnClose = document.getElementById("pwa-btn-close");

// Captura o evento nativo antes de ele ser descartado pelo browser
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Mostra o banner após 3 s para não aparecer de imediato
  setTimeout(() => {
    banner.style.display = "flex";
  }, 3000);
});

// Botão "Instalar"
btnInstall.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`PWA install outcome: ${outcome}`);
  deferredPrompt = null;
  banner.style.display = "none";
});

// Botão "Fechar / Ignorar"
btnClose.addEventListener("click", () => {
  banner.style.display = "none";
  deferredPrompt = null;
});

// Esconde o banner se o app já estiver instalado
window.addEventListener("appinstalled", () => {
  banner.style.display = "none";
  console.log("PWA instalado com sucesso.");
});
