// Script para limpar Service Workers antigos que causam tela branca
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      registration.unregister().then(function() {
        console.log('Service Worker antigo removido:', registration.scope);
      });
    }
  });
  
  // Limpar caches também
  if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
      cacheNames.forEach(function(cacheName) {
        caches.delete(cacheName).then(function() {
          console.log('Cache removido:', cacheName);
        });
      });
    });
  }
}
