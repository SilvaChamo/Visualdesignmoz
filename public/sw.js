// O site já não é uma aplicação instalável nem funciona sem ligação (Silva, 31/10/2026).
// Quem ainda tem o service worker antigo (de antes de 31/10/2026) recebe este ficheiro, que apaga as caches
// e se desregista sozinho, sem recarregar a página. Não apagar este ficheiro enquanto houver visitantes com o antigo.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (chaves) { return Promise.all(chaves.map(function (c) { return caches.delete(c); })); })
      .then(function () { return self.registration.unregister(); })
  );
});
