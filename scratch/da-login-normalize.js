(function () {
  var EMAIL_ALIASES = {
    'silva.chamo@gmail.com': 'admin',
    'servidor@visualdesignmoz.com': 'admin',
  };

  function normalizeUsername(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    var trimmed = raw.trim();
    var lower = trimmed.toLowerCase();
    if (EMAIL_ALIASES[lower]) return EMAIL_ALIASES[lower];
    if (lower.indexOf('@') !== -1) return lower;
    return lower;
  }

  function patchLoginBody(body) {
    if (!body || typeof body !== 'string') return body;
    try {
      var parsed = JSON.parse(body);
      if (parsed && parsed.username) {
        parsed.username = normalizeUsername(parsed.username);
        return JSON.stringify(parsed);
      }
    } catch (e) {}
    return body;
  }

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/api/login') !== -1 && init && init.body) {
        init = Object.assign({}, init, { body: patchLoginBody(init.body) });
      }
      return origFetch.call(this, input, init);
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._daLoginUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this._daLoginUrl && String(this._daLoginUrl).indexOf('/api/login') !== -1 && body) {
      body = patchLoginBody(body);
    }
    return origSend.call(this, body);
  };

  /** Mantém return-to (volta à página anterior) mas esconde o texto técnico do Evolution. */
  function friendlyReturnToMessage() {
    document.querySelectorAll('.Message').forEach(function (el) {
      var text = (el.textContent || '').toLowerCase();
      if (text.indexOf('successful login') === -1 && text.indexOf('redirect') === -1) return;
      el.innerHTML =
        '<span style="font-size:13px;color:#475569">Após o login, voltará à página onde estava.</span>';
      el.style.display = '';
      el.setAttribute('aria-hidden', 'false');
    });
  }

  friendlyReturnToMessage();
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(friendlyReturnToMessage).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
