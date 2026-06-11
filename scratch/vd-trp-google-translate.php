<?php
/**
 * TranslatePress — tradução automática via Google Cloud Translation API v2 (PT → EN-GB).
 * Uso: VD_TRP_LIMIT=500 wp eval-file vd-trp-google-translate.php
 */
if (!defined('ABSPATH')) {
    exit(1);
}

$limit = max(1, (int) (getenv('VD_TRP_LIMIT') ?: 500));
$delay_ms = max(50, (int) (getenv('VD_TRP_DELAY_MS') ?: 250));

function vd_google_key(): string {
    $settings = get_option('trp_machine_translation_settings', []);
    return trim((string) ($settings['google-translate-key'] ?? ''));
}

function vd_google_translate(string $text, string $key): string {
    $text = trim($text);
    if ($text === '' || strlen($text) > 4500 || $key === '') {
        return '';
    }

    $url = 'https://translation.googleapis.com/language/translate/v2?key=' . rawurlencode($key);
    $body = http_build_query([
        'q'      => $text,
        'source' => 'pt',
        'target' => 'en',
        'format' => 'text',
    ]);

    $ctx = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $body,
            'timeout' => 30,
        ],
    ]);

    $raw = @file_get_contents($url, false, $ctx);
    if (!$raw) {
        return '';
    }

    $data = json_decode($raw, true);
    if (!empty($data['error'])) {
        $msg = (string) ($data['error']['message'] ?? 'unknown');
        if (strpos($msg, 'Rate Limit') !== false || strpos($msg, 'billing') !== false) {
            throw new RuntimeException($msg);
        }
        return '';
    }

    return trim((string) ($data['data']['translations'][0]['translatedText'] ?? ''));
}

function vd_trp_translate_table_google(wpdb $wpdb, string $table, string $col, int $limit, string $key, int $delay_ms): int {
    if (!$wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table))) {
        return 0;
    }

    $rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT id, `$col` AS original FROM `$table` WHERE translated IS NULL OR translated = '' LIMIT %d",
            $limit
        )
    );

    $done = 0;
    foreach ($rows as $row) {
        try {
            $translated = vd_google_translate((string) $row->original, $key);
        } catch (RuntimeException $e) {
            echo "STOP: {$e->getMessage()}\n";
            break;
        }

        if ($translated === '') {
            usleep($delay_ms * 1000);
            continue;
        }

        $wpdb->update(
            $table,
            ['translated' => $translated, 'status' => 2],
            ['id' => (int) $row->id],
            ['%s', '%d'],
            ['%d']
        );
        $done++;
        usleep($delay_ms * 1000);
    }

    return $done;
}

$key = vd_google_key();
if ($key === '') {
    echo "ERR: google-translate-key vazio em trp_machine_translation_settings\n";
    exit(1);
}

global $wpdb;
$prefix = $wpdb->prefix;

$dict = vd_trp_translate_table_google($wpdb, "{$prefix}trp_dictionary_pt_pt_en_gb", 'original', $limit, $key, $delay_ms);
$gettext = vd_trp_translate_table_google(
    $wpdb,
    "{$prefix}trp_gettext_en_gb",
    'original',
    max(0, $limit - $dict),
    $key,
    $delay_ms
);

$remaining_dict = (int) $wpdb->get_var(
    "SELECT COUNT(*) FROM `{$prefix}trp_dictionary_pt_pt_en_gb` WHERE translated IS NULL OR translated = ''"
);
$remaining_gettext = (int) $wpdb->get_var(
    "SELECT COUNT(*) FROM `{$prefix}trp_gettext_en_gb` WHERE translated IS NULL OR translated = ''"
);

echo "OK: google dict={$dict} gettext={$gettext} restantes dict={$remaining_dict} gettext={$remaining_gettext}\n";
