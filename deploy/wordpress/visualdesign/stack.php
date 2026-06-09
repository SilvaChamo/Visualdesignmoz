<?php
defined('ABSPATH') || exit;

const VD_HONEYPOT_PLUGIN = 'honeypot/honeypot.php';
const VD_REDIS_PLUGIN    = 'redis-cache/redis-cache.php';
const VD_WPO_PLUGIN      = 'wp-optimize/wp-optimize.php';

const VD_STACK_MSG = 'Neste servidor, cache e proteção anti-spam já estão configurados. Não é necessário instalar este plugin.';
const VD_FORBIDDEN_MSG = 'Este plugin não é permitido neste servidor. Use as ferramentas nativas (DirectAdmin / stack Visual Design).';

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

const VD_STACK_PLUGINS = [
	VD_HONEYPOT_PLUGIN,
	VD_REDIS_PLUGIN,
	VD_WPO_PLUGIN,
];

const VD_AUTO_UPDATE_PLUGINS = [
	VD_HONEYPOT_PLUGIN,
	VD_REDIS_PLUGIN,
	VD_WPO_PLUGIN,
];

const VD_BLOCKED_CACHE_PLUGINS = [
	'wp-super-cache/wp-cache.php',
	'w3-total-cache/w3-total-cache.php',
	'litespeed-cache/litespeed-cache.php',
	'wp-fastest-cache/wpFastestCache.php',
	'cache-enabler/cache-enabler.php',
	'hummingbird-performance/wp-hummingbird.php',
	'sg-cachepress/sg-cachepress.php',
	'breeze/breeze.php',
	'wp-rocket/wp-rocket.php',
	'comet-cache/comet-cache.php',
	'hyper-cache/plugin.php',
	'wp-cloudflare-page-cache/wp-cloudflare-page-cache.php',
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

/** Slugs wordpress.org bloqueados (instalação via repositório). */
const VD_BLOCKED_PLUGIN_SLUGS = [
	'akismet',
	'hello-dolly',
	'wp-super-cache',
	'w3-total-cache',
	'litespeed-cache',
	'wp-fastest-cache',
	'cache-enabler',
	'hummingbird-performance',
	'sg-cachepress',
	'breeze',
	'wp-rocket',
	'comet-cache',
	'hyper-cache',
	'wp-cloudflare-page-cache',
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
	return array_merge(
		VD_DEFAULT_BUNDLED_PLUGINS,
		VD_BLOCKED_CACHE_PLUGINS,
		VD_BLOCKED_SPAM_PLUGINS,
		VD_BLOCKED_FILE_MANAGER_PLUGINS,
	);
}

function vd_is_blocked_slug(string $slug): bool
{
	return in_array(sanitize_key($slug), VD_BLOCKED_PLUGIN_SLUGS, true);
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
		return new WP_Error('vd_plugin_forbidden', VD_FORBIDDEN_MSG);
	}
	return $result;
}, 10, 3);

add_filter('upgrader_pre_install', static function ($return, $hook_extra) {
	$plugin = isset($hook_extra['plugin']) ? (string) $hook_extra['plugin'] : '';
	if ($plugin && vd_is_blocked_plugin($plugin)) {
		return new WP_Error('vd_plugin_forbidden', VD_FORBIDDEN_MSG);
	}
	return $return;
}, 10, 2);

add_filter('upgrader_pre_download', static function ($reply, $package, $upgrader, $hook_extra) {
	if (!is_array($hook_extra)) {
		return $reply;
	}
	$plugin = isset($hook_extra['plugin']) ? (string) $hook_extra['plugin'] : '';
	if ($plugin && vd_is_blocked_plugin($plugin)) {
		return new WP_Error('vd_plugin_forbidden', VD_FORBIDDEN_MSG);
	}
	if (($hook_extra['type'] ?? '') === 'plugin' && !empty($hook_extra['plugin'])) {
		foreach (VD_BLOCKED_PLUGIN_SLUGS as $slug) {
			if (str_contains($package, $slug)) {
				return new WP_Error('vd_plugin_forbidden', VD_FORBIDDEN_MSG);
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
	echo esc_html(VD_FORBIDDEN_MSG);
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
