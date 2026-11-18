// VhostMail: mostra as notificações de e-mail novo (no telemóvel o navegador só as deixa mostrar por um service worker) e, ao
// tocar numa, volta à janela do painel. Não guarda nada em cache nem muda o resto do site.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) if ('focus' in lista[i]) return lista[i].focus();
      return self.clients.openWindow('/');
    })
  );
});
