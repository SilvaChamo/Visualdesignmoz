<?php
/**
 * TranslatePress — manter inglês em todo o site após clicar EN.
 * Usa cookie + redirect TRP para /en/ em todos os links internos.
 */
if (!defined('ABSPATH')) {
    exit;
}

const VD_TRP_LANG_COOKIE = 'vd_trp_lang';

function vd_trp_set_lang_cookie(string $lang): void {
    if (headers_sent()) {
        return;
    }
    $secure = is_ssl();
    setcookie(
        VD_TRP_LANG_COOKIE,
        $lang,
        time() + YEAR_IN_SECONDS,
        COOKIEPATH ?: '/',
        COOKIE_DOMAIN ?: '',
        $secure,
        true
    );
    $_COOKIE[VD_TRP_LANG_COOKIE] = $lang;
}

function vd_trp_is_system_path(string $path): bool {
    return (bool) preg_match('#^/(wp-admin|wp-login\.php|wp-json|wp-cron\.php|xmlrpc\.php|feed|wp-content|wp-includes)#', $path);
}

add_action('init', function () {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }

    if (isset($_GET['vd_set_lang'])) {
        $lang = sanitize_key(wp_unslash($_GET['vd_set_lang']));
        if (in_array($lang, ['en', 'pt'], true)) {
            vd_trp_set_lang_cookie($lang);
        }
    }

    $path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

    if (preg_match('#^/en(/|$)#', $path)) {
        vd_trp_set_lang_cookie('en');
        return;
    }

    if (vd_trp_is_system_path($path)) {
        return;
    }

    $ref = isset($_SERVER['HTTP_REFERER']) ? (string) $_SERVER['HTTP_REFERER'] : '';
    if ($ref !== '' && preg_match('#/en(/|$)#', wp_parse_url($ref, PHP_URL_PATH) ?: '')) {
        vd_trp_set_lang_cookie('pt');
    }
}, 1);

add_filter('trp_needed_language', function ($needed_language, $lang_from_url, $settings, $trp) {
    if ($lang_from_url !== null) {
        return $needed_language;
    }
    if (!empty($_COOKIE[VD_TRP_LANG_COOKIE]) && $_COOKIE[VD_TRP_LANG_COOKIE] === 'en') {
        return 'en_GB';
    }
    return $needed_language;
}, 20, 4);

add_filter('trp_allow_language_redirect', function ($allow, $needed_language, $url) {
    if (!empty($_COOKIE[VD_TRP_LANG_COOKIE]) && $_COOKIE[VD_TRP_LANG_COOKIE] === 'en' && $needed_language === 'en_GB') {
        return true;
    }
    return $allow;
}, 20, 3);

add_action('wp_footer', function () {
    if (is_admin()) {
        return;
    }
    $path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    if (!preg_match('#^/en(/|$)#', $path)) {
        return;
    }
    ?>
    <script>
    (function () {
      var host = "https://msdnmoz.org";
      var skip = ["/wp-admin", "/wp-login", "/wp-json", "/wp-content", "/wp-includes", "/feed", "/en/"];
      function fix(href) {
        if (!href || href.indexOf(host) !== 0) return href;
        var p = href.slice(host.length) || "/";
        if (p.indexOf("/en/") === 0 || p === "/en") return href;
        for (var i = 0; i < skip.length; i++) {
          if (p.indexOf(skip[i]) === 0) return href;
        }
        if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js)(\?|$)/i.test(p)) return href;
        return host + "/en" + (p === "/" ? "/" : p);
      }
      document.querySelectorAll("a[href]").forEach(function (a) {
        var nh = fix(a.getAttribute("href"));
        if (nh !== a.getAttribute("href")) a.setAttribute("href", nh);
      });
      document.addEventListener("click", function (e) {
        var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!a) return;
        var nh = fix(a.getAttribute("href"));
        if (nh !== a.getAttribute("href")) a.setAttribute("href", nh);
      }, true);
    })();
    </script>
    <?php
}, 99);
