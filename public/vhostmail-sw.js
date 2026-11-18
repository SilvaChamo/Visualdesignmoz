// VhostMail: mostra as notificações de e-mail novo (no telemóvel o navegador só as deixa mostrar por um service worker) e, ao
// tocar numa, volta à janela do painel. Não guarda nada em cache nem muda o resto do site.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
// sem cache: o pedido segue sempre pela rede (o VhostMail é o correio real); o «fetch» existe só para o navegador permitir instalar a app
self.addEventListener('fetch', function () {});
// Aviso de e-mail novo enviado pelo servidor (Web Push) — chega mesmo com o VhostMail fechado. Se o VhostMail estiver aberto e à vista, não
// repete o aviso (a página já avisa e toca sozinha); o aviso de teste (forcar) mostra-se sempre.
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      var aVista = lista.some(function (c) { return c.visibilityState === 'visible' && c.focused; });
      if (aVista && !d.forcar) return;
      return self.registration.showNotification(d.title || 'VhostMail', {
        body: d.body || 'Novo e-mail',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: d.tag || 'vhostmail-novo',
        renotify: true,
        data: { url: d.url || '/api/vhost/vhostmail?app=1' },
      });
    })
  );
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/api/vhost/vhostmail?app=1';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) if (lista[i].url.indexOf('/api/vhost/vhostmail') >= 0 && 'focus' in lista[i]) return lista[i].focus();
      for (var j = 0; j < lista.length; j++) if ('focus' in lista[j]) return lista[j].focus();
      return self.clients.openWindow(url);
    })
  );
});
