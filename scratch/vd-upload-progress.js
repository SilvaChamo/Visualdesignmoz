(function () {
  var panel = null;
  var startAt = 0;
  var active = 0;
  var lastLoaded = 0;
  var lastTick = 0;
  var totalHint = 0;

  function fmtBytes(n) {
    if (!n || n < 0) return '0 B';
    var u = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(i ? 1 : 0) + ' ' + u[i];
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h) return h + 'h ' + m + 'm';
    return (m ? m + 'm ' : '') + s + 's';
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'vd-upload-progress';
    panel.innerHTML =
      '<div class="vd-up-inner">' +
      '<div class="vd-up-title">A carregar ficheiros…</div>' +
      '<div class="vd-up-bar"><div class="vd-up-fill"></div></div>' +
      '<div class="vd-up-meta">' +
      '<span class="vd-up-pct">0%</span>' +
      '<span class="vd-up-size"></span>' +
      '<span class="vd-up-speed"></span>' +
      '<span class="vd-up-eta"></span>' +
      '</div></div>';
    var css = document.createElement('style');
    css.textContent =
      '#vd-upload-progress{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;font-family:system-ui,sans-serif}' +
      '#vd-upload-progress .vd-up-inner{background:#0f172a;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 12px 30px rgba(0,0,0,.25)}' +
      '#vd-upload-progress .vd-up-title{font-weight:700;font-size:14px;margin-bottom:8px}' +
      '#vd-upload-progress .vd-up-bar{height:10px;background:#334155;border-radius:999px;overflow:hidden}' +
      '#vd-upload-progress .vd-up-fill{height:100%;width:0;background:linear-gradient(90deg,#2563eb,#38bdf8);transition:width .25s ease}' +
      '#vd-upload-progress .vd-up-meta{display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:8px;font-size:12px;color:#cbd5e1}' +
      '#vd-upload-progress .vd-up-pct{font-weight:700;color:#fff;font-size:13px}' +
      '#vd-upload-progress .vd-up-eta{color:#7dd3fc;font-weight:600}';
    document.head.appendChild(css);
    document.body.appendChild(panel);
    return panel;
  }

  function show() {
    ensurePanel();
    panel.style.display = 'block';
    if (!startAt) {
      startAt = Date.now();
      lastTick = startAt;
      lastLoaded = 0;
    }
  }

  function hideSoon() {
    if (active > 0) return;
    setTimeout(function () {
      if (active === 0 && panel) panel.style.display = 'none';
      startAt = 0;
      totalHint = 0;
      lastLoaded = 0;
    }, 2000);
  }

  function update(loaded, total) {
    show();
    if (total > 0) totalHint = total;
    var totalUse = total > 0 ? total : totalHint;
    var now = Date.now();
    var elapsed = (now - startAt) / 1000;
    var dt = (now - lastTick) / 1000;
    var instant = dt > 0.2 ? (loaded - lastLoaded) / dt : 0;
    if (dt > 0.2) {
      lastTick = now;
      lastLoaded = loaded;
    }
    var avgSpeed = elapsed > 0 ? loaded / elapsed : 0;
    var speed = instant > 0 ? instant * 0.4 + avgSpeed * 0.6 : avgSpeed;
    var pct = totalUse > 0 ? Math.min(100, Math.round((loaded / totalUse) * 100)) : 0;
    var eta = speed > 0 && totalUse > loaded ? (totalUse - loaded) / speed : 0;

    panel.querySelector('.vd-up-fill').style.width = (pct || (loaded ? 8 : 0)) + '%';
    panel.querySelector('.vd-up-pct').textContent = totalUse > 0 ? pct + '%' : 'A carregar…';
    panel.querySelector('.vd-up-size').textContent =
      fmtBytes(loaded) + (totalUse > 0 ? ' / ' + fmtBytes(totalUse) : '');
    panel.querySelector('.vd-up-speed').textContent =
      speed > 0 ? fmtBytes(speed) + '/s' : '';
    panel.querySelector('.vd-up-eta').textContent =
      eta > 0 ? 'Restante: ~' + fmtTime(eta) : (pct >= 100 ? 'A concluir…' : '');
    if (pct >= 100) {
      panel.querySelector('.vd-up-title').textContent = 'Upload quase concluído…';
    }
  }

  function trackXhr(xhr) {
    if (!xhr || xhr._vdTracked || !xhr.upload) return;
    xhr._vdTracked = true;
    active++;
    show();
    xhr.upload.addEventListener('progress', function (ev) {
      update(ev.loaded, ev.lengthComputable ? ev.total : 0);
    });
    xhr.addEventListener('loadend', function () {
      active = Math.max(0, active - 1);
      hideSoon();
    });
  }

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function () {
    this._vdUpload = true;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (body && this._vdUpload) trackXhr(this);
    return origSend.apply(this, arguments);
  };
})();
