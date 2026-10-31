<?php
defined('ABSPATH') || exit;

/**
 * vd-contexto-admin (Silva, 30/10/2026): os plugins Jet (Crocoblock) só se iniciam com is_admin() verdadeiro (`jet_dashboard_init`: `is_admin() || $force`), por isso a
 * verificação de actualizações feita pelo cron do servidor ou pelo wp-cli nunca os vê: a lista guardada do WordPress ficava sem o jet-engine, jet-elements,
 * jet-smart-filters… e o painel mostrava «nada para actualizar». Com `VD_CTX_ADMIN=1` no ambiente, o wp-cli corre como o admin-ajax (WP_ADMIN e DOING_AJAX; sem DOING_AJAX
 * o LoginPress «esconder o login» redirecciona e mata o comando). Só vale no wp-cli e só quando o servidor o pede; nunca na web.
 */
if (defined('WP_CLI') && WP_CLI && getenv('VD_CTX_ADMIN') === '1') {
	defined('WP_ADMIN') || define('WP_ADMIN', true);
	defined('DOING_AJAX') || define('DOING_AJAX', true);
}

/**
 * vd-wpo-gzip (Silva, 30/10/2026): o separador «Gzip» do WP-Optimize pede, em PHP, o próprio endereço do site (WP_Optimize_Gzip_Compression::get_headers_information →
 * wp_remote_get) para ver se a compressão está ligada. Neste servidor um site não consegue abrir-se a si próprio de forma fiável (o pedido fica pendurado até ao tempo
 * limite) e a página das definições demorava 15 a 60 s, passava o tempo do Apache («AH01075 … timeout») e dava erro 500. A compressão faz-se no nginx e na Cloudflare, por
 * isso essa verificação não serve; só se corta o pedido vindo dessa classe ao próprio site (nada mais), que devolve logo um erro e a página abre.
 */
add_filter('pre_http_request', static function ($pre, $args, $url) {
	if ($pre !== false) {
		return $pre;
	}
	$host = (string) wp_parse_url((string) $url, PHP_URL_HOST);
	$meu  = (string) wp_parse_url(home_url(), PHP_URL_HOST);
	if ($host === '' || $meu === '' || strcasecmp(preg_replace('/^www\./i', '', $host), preg_replace('/^www\./i', '', $meu)) !== 0) {
		return $pre;
	}
	foreach (debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 16) as $f) {
		if (isset($f['class']) && stripos((string) $f['class'], 'WP_Optimize_Gzip_Compression') !== false) {
			return new WP_Error('vd_pedido_ao_proprio_site', 'Pedido ao próprio site não permitido neste servidor.');
		}
	}
	return $pre;
}, 1, 3);

/**
 * vd-alias-jet-wp-error (Silva, 30/10/2026): o Jet Elements escreve `new WP_Error(...)` dentro do espaço de nomes `Jet_Elements\Endpoints`, sem a barra
 * inicial, e quando a verificação de permissão de um pedido REST falha o PHP procura `Jet_Elements\Endpoints\WP_Error`, que não existe, e dá erro fatal
 * (500; visto em entrecamposblog.com ao abrir as definições do WP-Optimize, elementor-template.php:255). O alias faz esse nome apontar para o WP_Error
 * do WordPress e o pedido volta a responder «sem permissão» em vez de rebentar. Só actua se o plugin não o definir ele próprio.
 */
if (class_exists('WP_Error', false) && !class_exists('Jet_Elements\\Endpoints\\WP_Error', false)) {
	class_alias('WP_Error', 'Jet_Elements\\Endpoints\\WP_Error');
}

const VD_HONEYPOT_PLUGIN = 'honeypot/honeypot.php';
const VD_REDIS_PLUGIN    = 'redis-cache/redis-cache.php';
const VD_WPO_PLUGIN      = 'wp-optimize/wp-optimize.php';

const VD_STACK_MSG = 'Neste servidor, cache e proteção anti-spam já estão configurados. Não é necessário instalar este plugin.';
const VD_FORBIDDEN_MSG = 'Este plugin não é permitido neste servidor. Use as ferramentas nativas (DirectAdmin / stack Visual Design).';
const VD_RISK_MSG = 'Este plugin reduz a protecção do site. Para o instalar ou activar, procure-o em Plugins › Adicionar novo e confirme o aviso de risco do servidor.';

/** Slugs alternativos (WP Armour / versões). */
const VD_HONEYPOT_SLUGS = [
	'honeypot/honeypot.php',
	'honeypot/wp-armour.php',
	'wp-armour/wp-armour.php',
];

/**
 * Ocultos no painel — apenas plugins geridos pelo stack (não desactivar manualmente).
 * Diferente de VD_BLOCKED_*: estes ficam activos, só não aparecem na lista.
 */
const VD_HIDDEN_PLUGINS = [
	VD_REDIS_PLUGIN,
];

/** Bundled WordPress — removidos na instalação e bloqueados se reaparecerem. */
const VD_DEFAULT_BUNDLED_PLUGINS = [
	'akismet/akismet.php',
	'hello-dolly/hello.php',
];

/**
 * Plugins que o servidor mantém activos. O WP-Optimize já não está aqui (Silva, 31/10/2026): cada site escolhe a sua cache de páginas; o WP-Optimize
 * continua a ser o que o servidor instala num site novo, mas quem o desactiva não o vê reactivado a cada visita ao painel.
 */
const VD_STACK_PLUGINS = [
	VD_HONEYPOT_PLUGIN,
	VD_REDIS_PLUGIN,
];

const VD_AUTO_UPDATE_PLUGINS = [
	VD_HONEYPOT_PLUGIN,
	VD_REDIS_PLUGIN,
	VD_WPO_PLUGIN,
	'cache-enabler/cache-enabler.php',
];

const VD_BLOCKED_SPAM_PLUGINS = [
	'akismet/akismet.php',
	'hello-dolly/hello.php',
	'antispam-bee/antispam_bee.php',
	'wp-spamshield/wp-spamshield.php',
	'stop-spammer-registrations-plugin/stop-spammer-registrations-plugin.php',
	'cleantalk-spam-protect/cleantalk.php',
	'contact-form-7-honeypot/honeypot.php',
	'samurai-honeypot-for-forms/samurai-honeypot-for-forms.php',
	'honeypot-guard-silent-anti-spam/honeypot-guard.php',
	'zero-spam/zero-spam.php',
];

/** File managers WordPress — risco de segurança; usar DirectAdmin File Manager. */
const VD_BLOCKED_FILE_MANAGER_PLUGINS = [
	'wp-file-manager/file_folder_manager.php',
	'file-manager-advanced/file-manager-advanced.php',
	'advanced-file-manager/advanced-file-manager.php',
	'wp-file-manager-pro/wp-file-manager-pro.php',
	'simple-file-manager/simple-file-manager.php',
	'file-manager/file-manager.php',
	'wp-media-file-manager/wp-media-file-manager.php',
	'manager-for-ftp-and-sftp/fmanager.php',
];

/**
 * Jetpack e os plugins da família — bloqueados (Silva, 30/10/2026): usam o xmlrpc.php, que o servidor fecha no nginx em todos os sites WordPress
 * (os robôs eram 13% dos pedidos do entrecamposblog.com). Não se instalam, não se activam e, se aparecerem por FTP, apagam-se.
 */
const VD_BLOCKED_JETPACK_PLUGINS = [
	'jetpack/jetpack.php',
	'jetpack-boost/jetpack-boost.php',
	'jetpack-protect/jetpack-protect.php',
	'jetpack-backup/jetpack-backup.php',
	'jetpack-search/jetpack-search.php',
	'jetpack-social/jetpack-social.php',
	'jetpack-videopress/jetpack-videopress.php',
	'jetpack-crm/ZeroBSCRM.php',
];

/** Slugs wordpress.org bloqueados (instalação via repositório). */
const VD_BLOCKED_PLUGIN_SLUGS = [
	'akismet',
	'jetpack',
	'jetpack-boost',
	'jetpack-protect',
	'jetpack-backup',
	'jetpack-search',
	'jetpack-social',
	'jetpack-videopress',
	'jetpack-crm',
	'hello-dolly',
	'antispam-bee',
	'wp-spamshield',
	'cleantalk-spam-protect',
	'zero-spam',
	'wp-file-manager',
	'file-manager-advanced',
	'advanced-file-manager',
	'wp-file-manager-pro',
	'simple-file-manager',
	'file-manager',
	'wp-media-file-manager',
];

function vd_honeypot_slugs(): array
{
	return VD_HONEYPOT_SLUGS;
}

function vd_all_hidden_from_list(): array
{
	return array_merge(VD_HIDDEN_PLUGINS, vd_honeypot_slugs());
}

function vd_all_blocked_plugins(): array
{
	return array_values(array_filter(vd_all_blocked_plugins_brutos(), static function ($p) {
		return !vd_risco_aceite(strtok((string) $p, '/'));
	}));
}

function vd_all_blocked_plugins_brutos(): array
{
	return array_merge(
		VD_DEFAULT_BUNDLED_PLUGINS,
		VD_BLOCKED_SPAM_PLUGINS,
		VD_BLOCKED_FILE_MANAGER_PLUGINS,
		VD_BLOCKED_JETPACK_PLUGINS,
	);
}

function vd_is_blocked_slug(string $slug): bool
{
	$slug = sanitize_key($slug);
	return in_array($slug, VD_BLOCKED_PLUGIN_SLUGS, true) && !vd_risco_aceite($slug);
}

/**
 * Plugins que reduzem a protecção do site (Silva, 31/10/2026): gestores de ficheiros dentro do WordPress e a família Jetpack (precisa do xmlrpc.php, fechado no
 * nginx). Já não são proibidos à força: quem os quiser instalar recebe um aviso do servidor com o risco e decide (o aviso fica registado em `vd_riscos_aceites`,
 * com quem aceitou e quando). Sem essa aceitação continuam bloqueados, também por wp-cli e por envio de ficheiro. As caches de páginas são livres.
 */
function vd_risco_info(string $slug): ?array
{
	$slug = sanitize_key($slug);
	$ficheiros = [];
	foreach (VD_BLOCKED_FILE_MANAGER_PLUGINS as $p) {
		$ficheiros[] = (string) strtok($p, '/');
	}
	if (in_array($slug, $ficheiros, true)) {
		return [
			'titulo' => 'Este plugin pode deixar o seu site vulnerável',
			'texto'  => 'Um gestor de ficheiros dentro do WordPress é das portas de entrada mais usadas para invadir sites: uma falha nele dá acesso a todos os ficheiros e à base de dados do site. O servidor já tem um gestor de ficheiros seguro no painel. Só continue se souber o que está a fazer e aceitar o risco.',
		];
	}
	$jet = [];
	foreach (VD_BLOCKED_JETPACK_PLUGINS as $p) {
		$jet[] = (string) strtok($p, '/');
	}
	if (in_array($slug, $jet, true)) {
		return [
			'titulo' => 'Este plugin não funciona sem retirar uma protecção do servidor',
			'texto'  => 'O Jetpack precisa do ficheiro xmlrpc.php, que este servidor mantém fechado porque os robôs o usam para tentar entrar nos sites (era 13% dos pedidos do entrecamposblog.com). Com o ficheiro fechado o plugin não funciona; para o abrir é preciso retirar essa protecção, o que expõe o site a ataques de força bruta. Só continue se aceitar o risco.',
		];
	}
	return null;
}

function vd_risco_aceite(string $slug): bool
{
	$slug = sanitize_key($slug);
	if ($slug === '' || !function_exists('get_option')) {
		return false;
	}
	$a = get_option('vd_riscos_aceites', []);
	return is_array($a) && isset($a[$slug]);
}

/** Mensagem de recusa certa para cada plugin (aviso de risco ou lista do servidor) */
function vd_msg_bloqueio(string $plugin_ou_slug): string
{
	return vd_risco_info((string) strtok($plugin_ou_slug, '/')) !== null ? VD_RISK_MSG : VD_FORBIDDEN_MSG;
}

add_filter('auto_update_plugin', static function ($update, $item) {
	if (isset($item->plugin) && in_array($item->plugin, VD_AUTO_UPDATE_PLUGINS, true)) {
		return true;
	}
	return $update;
}, 10, 2);

add_filter('all_plugins', static function (array $plugins): array {
	foreach (vd_all_hidden_from_list() as $slug) {
		unset($plugins[$slug]);
	}
	return $plugins;
}, 9999);

add_action('admin_head-plugins', static function () {
	echo '<style>
		tr[data-plugin="redis-cache/redis-cache.php"],
		tr[data-plugin="honeypot/honeypot.php"],
		tr[data-plugin="honeypot/wp-armour.php"],
		tr[data-plugin="wp-armour/wp-armour.php"] { display: none !important; }
	</style>';
});

add_filter('plugins_api_result', static function ($result, $action, $args) {
	if ($action !== 'plugin_information') {
		return $result;
	}
	$slug = isset($args->slug) ? sanitize_key((string) $args->slug) : '';
	if ($slug && vd_is_blocked_slug($slug)) {
		return new WP_Error('vd_plugin_forbidden', vd_msg_bloqueio($slug));
	}
	return $result;
}, 10, 3);

add_filter('upgrader_pre_install', static function ($return, $hook_extra) {
	$plugin = isset($hook_extra['plugin']) ? (string) $hook_extra['plugin'] : '';
	if ($plugin && vd_is_blocked_plugin($plugin)) {
		return new WP_Error('vd_plugin_forbidden', vd_msg_bloqueio($plugin));
	}
	return $return;
}, 10, 2);

add_filter('upgrader_pre_download', static function ($reply, $package, $upgrader, $hook_extra) {
	if (!is_array($hook_extra)) {
		return $reply;
	}
	$plugin = isset($hook_extra['plugin']) ? (string) $hook_extra['plugin'] : '';
	if ($plugin && vd_is_blocked_plugin($plugin)) {
		return new WP_Error('vd_plugin_forbidden', vd_msg_bloqueio($plugin));
	}
	if (($hook_extra['type'] ?? '') === 'plugin' && !empty($hook_extra['plugin'])) {
		foreach (VD_BLOCKED_PLUGIN_SLUGS as $slug) {
			if (str_contains($package, $slug) && !vd_risco_aceite($slug)) {
				return new WP_Error('vd_plugin_forbidden', vd_msg_bloqueio($slug));
			}
		}
	}
	return $reply;
}, 10, 4);

add_action('admin_init', 'vd_ensure_stack_plugins', 1);
add_action('activated_plugin', 'vd_on_plugin_activated', 20, 1);
add_action('upgrader_process_complete', 'vd_on_plugin_installed', 20, 2);

add_action('admin_init', static function () {
	if (get_transient('vd_stack_sync')) {
		return;
	}
	set_transient('vd_stack_sync', 1, 12 * HOUR_IN_SECONDS);
	vd_block_extra_plugins();
	vd_purge_forbidden_plugin_files();
	vd_disable_competing_honeypots();
	vd_configure_wp_armour();
}, 100);

function vd_purge_forbidden_plugin_files(): void
{
	if (!function_exists('get_plugins')) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	if (!function_exists('delete_plugins')) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	$all = get_plugins();
	foreach (vd_all_blocked_plugins() as $slug) {
		if (!isset($all[$slug])) {
			continue;
		}
		deactivate_plugins($slug, true);
		delete_plugins([$slug]);
	}
}

/** WP Armour: honeypot activo — sem interferir no admin nativo (Screen Options, Help). */
add_action('plugins_loaded', 'vd_boot_wp_armour_stealth', 5);

function vd_boot_wp_armour_stealth(): void
{
	vd_configure_wp_armour();

	add_filter('wpa_show_test_widget', '__return_false', 999);
	add_filter('wpa_disable_test_widget', '__return_true', 999);

	add_action('admin_menu', 'vd_remove_wp_armour_menus', 999);
	add_action('admin_bar_menu', 'vd_remove_wp_armour_admin_bar', 999);

	add_action('wp_head', 'vd_wp_armour_hide_css', 999);
	add_action('admin_head', 'vd_wp_armour_hide_css', 999);
	add_action('login_head', 'vd_wp_armour_hide_css', 999);

	// Só front-end e login — nunca admin_footer (quebrava Screen Options / Help).
	add_action('wp_footer', 'vd_wp_armour_strip_ui', 9999);
	add_action('login_footer', 'vd_wp_armour_strip_ui', 9999);
}

function vd_remove_wp_armour_menus(): void
{
	remove_menu_page('wp-armour');
	remove_submenu_page('wp-armour', 'wp-armour');
	remove_submenu_page('options-general.php', 'wp-armour');
}

function vd_remove_wp_armour_admin_bar($bar): void
{
	if (!is_object($bar) || !method_exists($bar, 'remove_node')) {
		return;
	}
	$bar->remove_node('wp-armour');
}

function vd_wp_armour_hide_css(): void
{
	echo '<style id="vd-hide-wpa">
		.wpa-test-widget,.wpae-test-widget,.wpa_armour_test_widget,
		[class*="wpa-test"],[class*="wpae-test"],[id*="wpa-test"],
		.wpa-stats-widget,.wpa_admin_notice{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;border:0!important}
	</style>';
}

function vd_wp_armour_strip_ui(): void
{
	static $done = false;
	if ($done) {
		return;
	}
	$done = true;
	?>
	<script id="vd-strip-wpa">
	(function(){
		var selectors='.wpa-test-widget,.wpae-test-widget,.wpa_armour_test_widget,[class*="wpa-test"],[class*="wpae-test"],[id*="wpa-test"],.wpa-stats-widget,.wpa_admin_notice';
		function run(){
			document.querySelectorAll(selectors).forEach(function(el){ el.remove(); });
		}
		run();
		if(window.MutationObserver&&document.body){
			new MutationObserver(function(mutations){
				for(var i=0;i<mutations.length;i++){
					if(mutations[i].addedNodes.length){ run(); break; }
				}
			}).observe(document.body,{childList:true,subtree:true});
		}
	})();
	</script>
	<?php
}

add_action('admin_notices', static function () {
	if (!current_user_can('activate_plugins')) {
		return;
	}
	$blocked = get_transient('vd_blocked_plugin_notice');
	if (!$blocked) {
		return;
	}
	delete_transient('vd_blocked_plugin_notice');
	echo '<div class="notice notice-warning is-dismissible"><p><strong>';
	echo esc_html(vd_msg_bloqueio((string) $blocked));
	echo '</strong></p></div>';
});

function vd_ensure_stack_plugins(): void
{
	if (!current_user_can('activate_plugins')) {
		return;
	}
	if (!function_exists('get_plugins')) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	$all    = get_plugins();
	$active = (array) get_option('active_plugins', []);

	foreach (VD_STACK_PLUGINS as $slug) {
		if (!isset($all[$slug])) {
			continue;
		}
		if (!in_array($slug, $active, true)) {
			activate_plugin($slug, '', false, true);
		}
	}

	foreach (vd_honeypot_slugs() as $slug) {
		if (isset($all[$slug]) && !in_array($slug, $active, true)) {
			activate_plugin($slug, '', false, true);
		}
	}
}

function vd_on_plugin_activated(string $plugin): void
{
	if (vd_is_blocked_plugin($plugin)) {
		vd_reject_plugin($plugin);
	}
	vd_block_extra_plugins();
	vd_disable_competing_honeypots();
}

function vd_on_plugin_installed($upgrader, array $options): void
{
	if (($options['action'] ?? '') !== 'install' || ($options['type'] ?? '') !== 'plugin') {
		return;
	}
	$plugin = $options['plugin'] ?? '';
	if ($plugin && vd_is_blocked_plugin($plugin)) {
		vd_reject_plugin($plugin);
	}
}

function vd_is_blocked_plugin(string $plugin): bool
{
	return in_array($plugin, vd_all_blocked_plugins(), true);
}

function vd_reject_plugin(string $plugin): void
{
	if (!function_exists('deactivate_plugins')) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	deactivate_plugins($plugin, true);
	if (function_exists('delete_plugins')) {
		delete_plugins([$plugin]);
	}
	set_transient('vd_blocked_plugin_notice', $plugin, 60);
}

function vd_block_extra_plugins(): void
{
	if (!function_exists('deactivate_plugins')) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	$active = (array) get_option('active_plugins', []);
	foreach (vd_all_blocked_plugins() as $slug) {
		if (in_array($slug, $active, true)) {
			deactivate_plugins($slug, true);
		}
	}
}

function vd_disable_competing_honeypots(): void
{
	if (defined('AIO_WP_SECURITY_VERSION')) {
		vd_set_option('aiowps_enable_login_honeypot', '0');
		vd_set_option('aiowps_enable_registration_honeypot', '0');
	}
}

function vd_configure_wp_armour(): void
{
	if (!function_exists('is_plugin_active') && defined('ABSPATH')) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	$active = false;
	foreach (vd_honeypot_slugs() as $slug) {
		if (function_exists('is_plugin_active') && is_plugin_active($slug)) {
			$active = true;
			break;
		}
	}
	if (!$active) {
		return;
	}
	vd_set_option('wpa_disable_test_widget', 'yes');
}

function vd_set_option(string $key, $value): void
{
	if (get_option($key) !== $value) {
		update_option($key, $value, false);
	}
}

/**
 * Actualizações de plugins vistas já com o administrador carregado (Silva, 28/10/2026). Muitos plugins pagos (PRO Elements, LoginPress Pro,
 * JetSmartFilters…) só registam o seu actualizador no administrador, por isso o wp-cli do painel não via as actualizações que o WordPress
 * mostra em Plugins. Aqui guarda-se, no máximo de 10 em 10 minutos, a lista que o administrador vê; o painel lê-a com
 * `wp option get vd_plugin_updates` (ficheiro do plugin → versão nova) e compara com a versão instalada.
 */
add_action('admin_init', 'vd_guardar_actualizacoes_plugins', 99);

/** Verificação completa, chamada pelo servidor com `VD_CTX_ADMIN=1 wp eval 'vd_verificar_actualizacoes_admin();'` (ver acima): renova a lista do WordPress já com os plugins Jet e guarda-a. */
function vd_verificar_actualizacoes_admin(): void
{
	delete_site_transient('update_plugins');
	wp_update_plugins();
	delete_option('vd_plugin_updates');
	vd_guardar_actualizacoes_plugins();
}

function vd_guardar_actualizacoes_plugins(): void
{
	$antigo = get_option('vd_plugin_updates');
	if (is_array($antigo) && isset($antigo['em']) && (time() - (int) $antigo['em']) < 10 * MINUTE_IN_SECONDS) {
		return;
	}
	$t = get_site_transient('update_plugins');
	if (!is_object($t)) {
		return;
	}
	$lista = [];
	if (!empty($t->response) && is_array($t->response)) {
		foreach ($t->response as $ficheiro => $o) {
			$lista[(string) $ficheiro] = (is_object($o) && isset($o->new_version)) ? (string) $o->new_version : '';
		}
	}
	update_option('vd_plugin_updates', ['em' => time(), 'plugins' => $lista], false);
}

/**
 * Imagens: comprimidas e convertidas em WebP ao subir, em todos os sites WordPress do servidor (Silva, 30/10/2026).
 * Nada é recusado: uma imagem JPEG, PNG ou WebP, de qualquer tamanho, é redimensionada (lado maior até 2560 px), comprimida sem perda visível
 * (WebP, qualidade 82 a descer até 58) até ficar com no máximo 250 KB, e grava-se como .webp. Se mesmo assim passar de 250 KB, reduz-se 15% de cada
 * vez até caber (nunca abaixo de 800 px no lado maior). Imagens animadas, SVG, GIF e ficheiros que não sejam imagem ficam como estão. Qualquer erro
 * deixa o ficheiro original: o envio nunca falha por causa disto.
 */
const VD_IMG_MAX_BYTES = 256000;
const VD_IMG_MAX_LADO = 2560;
const VD_IMG_MIN_LADO = 800;

add_filter('wp_handle_upload', 'vd_img_otimizar_upload', 20, 1);

function vd_img_otimizar_upload($upload)
{
	try {
		return vd_img_otimizar_upload_interno($upload);
	} catch (\Throwable $e) {
		return $upload;
	}
}

function vd_img_codificar($im, int $qualidade): string
{
	ob_start();
	imagewebp($im, null, $qualidade);
	return (string) ob_get_clean();
}

function vd_img_otimizar_upload_interno($upload)
{
	if (!is_array($upload) || !empty($upload['error']) || empty($upload['file']) || empty($upload['url'])) {
		return $upload;
	}
	if (!function_exists('imagewebp') || !function_exists('imagecreatetruecolor')) {
		return $upload;
	}
	$tipo = (string) ($upload['type'] ?? '');
	$carregar = ['image/jpeg' => 'imagecreatefromjpeg', 'image/png' => 'imagecreatefrompng', 'image/webp' => 'imagecreatefromwebp'];
	if (!isset($carregar[$tipo]) || !function_exists($carregar[$tipo])) {
		return $upload;
	}
	$ficheiro = (string) $upload['file'];
	if (!is_file($ficheiro) || !is_readable($ficheiro)) {
		return $upload;
	}
	$cabeca = (string) @file_get_contents($ficheiro, false, null, 0, 4096);
	if (str_contains($cabeca, 'ANIM') || str_contains($cabeca, 'acTL')) {
		return $upload; // WebP ou PNG animado
	}
	$info = @getimagesize($ficheiro);
	if (!$info || empty($info[0]) || empty($info[1]) || $info[0] * $info[1] > 80000000) {
		return $upload;
	}
	@ini_set('memory_limit', '1024M');
	@set_time_limit(120);

	$im = @($carregar[$tipo])($ficheiro);
	if (!$im) {
		return $upload;
	}
	if ($tipo === 'image/jpeg' && function_exists('exif_read_data') && function_exists('imagerotate')) {
		$exif = @exif_read_data($ficheiro);
		$o = (int) ($exif['Orientation'] ?? 1);
		$graus = [3 => 180, 6 => -90, 8 => 90][$o] ?? 0;
		if ($graus) {
			$rodada = @imagerotate($im, $graus, 0);
			if ($rodada) {
				$im = $rodada;
			}
		}
	}
	if (function_exists('imagepalettetotruecolor')) {
		@imagepalettetotruecolor($im);
	}
	imagealphablending($im, false);
	imagesavealpha($im, true);

	$redimensionar = static function ($im, int $lado) {
		$w = imagesx($im);
		$h = imagesy($im);
		$maior = max($w, $h);
		if ($maior <= $lado) {
			return $im;
		}
		$nw = max(1, (int) round($w * $lado / $maior));
		$nh = max(1, (int) round($h * $lado / $maior));
		$novo = @imagescale($im, $nw, $nh, IMG_BICUBIC);
		if (!$novo) {
			return $im;
		}
		imagealphablending($novo, false);
		imagesavealpha($novo, true);
		return $novo;
	};
	$im = $redimensionar($im, VD_IMG_MAX_LADO);

	$blob = '';
	for ($ronda = 0; $ronda < 6; $ronda++) {
		foreach ([82, 78, 74, 70, 66, 62, 58] as $q) {
			$blob = vd_img_codificar($im, $q);
			if ($blob !== '' && strlen($blob) <= VD_IMG_MAX_BYTES) {
				break 2;
			}
		}
		$lado = (int) round(max(imagesx($im), imagesy($im)) * 0.85);
		if ($lado < VD_IMG_MIN_LADO) {
			break;
		}
		$im = $redimensionar($im, $lado);
	}
	imagedestroy($im);
	if ($blob === '') {
		return $upload;
	}
	$original = (int) filesize($ficheiro);
	// nunca piorar: se o original já era pequeno e o resultado não é menor, fica o original
	if ($original <= VD_IMG_MAX_BYTES && strlen($blob) >= $original) {
		return $upload;
	}

	$dir = dirname($ficheiro);
	$base = preg_replace('/\.[^.]+$/', '', basename($ficheiro));
	$nome = $tipo === 'image/webp' ? basename($ficheiro) : wp_unique_filename($dir, $base . '.webp');
	$novo = $dir . '/' . $nome;
	if (@file_put_contents($novo, $blob) === false) {
		return $upload;
	}
	@chmod($novo, 0644);
	if ($novo !== $ficheiro) {
		@unlink($ficheiro);
	}
	$upload['file'] = $novo;
	$upload['url'] = substr((string) $upload['url'], 0, (int) strrpos((string) $upload['url'], '/') + 1) . $nome;
	$upload['type'] = 'image/webp';
	return $upload;
}


/**
 * Aviso do servidor antes de instalar ou activar um plugin que reduz a protecção do site (Silva, 31/10/2026). Janela por cima da página, com o risco explicado; só
 * depois de «Instalar/Activar mesmo assim» o pedido segue (fica gravado quem aceitou e quando). Cobre os botões «Instalar agora» e «Activar» de Plugins e de
 * Plugins › Adicionar novo.
 */
add_action('wp_ajax_vd_aceitar_risco', static function () {
	check_ajax_referer('vd_aceitar_risco', 'n');
	if (!current_user_can('install_plugins')) {
		wp_send_json_error(['m' => 'Sem permissão.'], 403);
	}
	$slug = sanitize_key((string) ($_POST['slug'] ?? ''));
	if ($slug === '' || vd_risco_info($slug) === null) {
		wp_send_json_error(['m' => 'Este plugin não tem aviso de risco.'], 400);
	}
	$a = get_option('vd_riscos_aceites', []);
	if (!is_array($a)) {
		$a = [];
	}
	$u = wp_get_current_user();
	$a[$slug] = ['utilizador' => (string) $u->user_login, 'em' => gmdate('c')];
	update_option('vd_riscos_aceites', $a, false);
	wp_send_json_success();
});

add_action('admin_print_footer_scripts', static function () {
	$ecra = function_exists('get_current_screen') ? get_current_screen() : null;
	if (!$ecra || !in_array($ecra->id, ['plugins', 'plugin-install'], true) || !current_user_can('install_plugins')) {
		return;
	}
	$riscos = [];
	$slugs  = [];
	foreach (array_merge(VD_BLOCKED_FILE_MANAGER_PLUGINS, VD_BLOCKED_JETPACK_PLUGINS) as $p) {
		$slugs[(string) strtok($p, '/')] = true;
	}
	foreach (array_keys($slugs) as $slug) {
		$i = vd_risco_info($slug);
		if ($i !== null && !vd_risco_aceite($slug)) {
			$riscos[$slug] = $i;
		}
	}
	if (!$riscos) {
		return;
	}
	$dados = wp_json_encode(['r' => $riscos, 'n' => wp_create_nonce('vd_aceitar_risco'), 'a' => admin_url('admin-ajax.php')]);
	?>
	<script id="vd-aviso-risco">
	(function(){
		var D=<?php echo $dados; ?>;
		function slugDe(el){
			var s=el.getAttribute('data-slug');
			if(s){return s;}
			var h=el.getAttribute('href')||'';
			var m=h.match(/[?&]plugin=([^&%\/]+)(?:%2F|\/)/i);
			return m?decodeURIComponent(m[1]):'';
		}
		function janela(info,acao,seguir){
			var f=document.createElement('div');
			f.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';
			var c=document.createElement('div');
			c.style.cssText='background:#fff;max-width:520px;width:100%;border-radius:4px;padding:22px 24px;box-shadow:0 10px 40px rgba(0,0,0,.35);font-size:14px;line-height:1.5;color:#1d2327';
			var t=document.createElement('h2');t.textContent='Aviso do servidor: '+info.titulo;t.style.cssText='margin:0 0 10px;font-size:17px;color:#b32d2e';
			var p=document.createElement('p');p.textContent=info.texto;p.style.cssText='margin:0 0 18px';
			var b=document.createElement('div');b.style.cssText='display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap';
			var n=document.createElement('button');n.type='button';n.className='button';n.textContent='Cancelar';
			var s=document.createElement('button');s.type='button';s.className='button button-primary';s.textContent=(acao==='activar'?'Activar':'Instalar')+' mesmo assim';
			n.onclick=function(){f.remove();};
			s.onclick=function(){s.disabled=true;f.remove();seguir();};
			b.appendChild(n);b.appendChild(s);c.appendChild(t);c.appendChild(p);c.appendChild(b);f.appendChild(c);document.body.appendChild(f);
		}
		document.addEventListener('click',function(e){
			var el=e.target.closest?e.target.closest('a.install-now,a.button[data-slug],a[href*="action=activate"]'):null;
			if(!el||el.getAttribute('data-vd-ok')){return;}
			var slug=slugDe(el);
			if(!slug||!D.r[slug]){return;}
			e.preventDefault();e.stopImmediatePropagation();
			var acao=el.classList.contains('install-now')?'instalar':'activar';
			janela(D.r[slug],acao,function(){
				var x=new XMLHttpRequest();
				x.open('POST',D.a);
				x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
				x.onload=function(){
					var j=null;try{j=JSON.parse(x.responseText);}catch(_){}
					if(j&&j.success){el.setAttribute('data-vd-ok','1');el.click();}
					else{alert('Não foi possível registar a sua decisão. Tente outra vez.');}
				};
				x.send('action=vd_aceitar_risco&n='+encodeURIComponent(D.n)+'&slug='+encodeURIComponent(slug));
			});
		},true);
	})();
	</script>
	<?php
}, 99);
