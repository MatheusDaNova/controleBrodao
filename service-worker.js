const CACHE_NAME = 'brodao-estoque-v1';

// Arquivos essenciais para funcionamento offline
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/img/logoBrodao.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap'
];

// Instala e faz cache dos assets principais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Remove caches antigos ao ativar nova versão
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: Network first, fallback para cache
// Firebase (banco de dados) sempre vai pela rede
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Requisições do Firebase sempre pela rede (dados em tempo real)
  if (url.includes('firebasejs') || url.includes('firebaseio') || url.includes('googleapis.com/identitytoolkit')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Salva cópia no cache se for bem-sucedido
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sem internet? Tenta o cache
        return caches.match(event.request);
      })
  );
});
