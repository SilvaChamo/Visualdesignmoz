<?php
/**
 * TranslatePress — tradução automática gratuita via MyMemory (PT → EN-GB).
 * Uso: wp eval-file vd-trp-mymemory-translate.php [--limit=500]
 */
if (!defined('ABSPATH')) {
    exit(1);
}

$limit = max(1, (int) (getenv('VD_TRP_LIMIT') ?: 500));

function vd_mm_translate(string $text): string {
    $text = trim($text);
    if ($text === '' || strlen($text) > 450) {
        return $text;
    }
    $url = 'https://api.mymemory.translated.net/get?' . http_build_query([
        'q'        => $text,
        'langpair' => 'pt|en-GB',
        'de'       => 'info@visualdesignmoz.com',
    ]);
    $ctx = stream_context_create(['http' => ['timeout' => 20]]);
    $raw = @file_get_contents($url, false, $ctx);
    if (!$raw) {
        return '';
    }
    $data = json_decode($raw, true);
    if (($data['responseStatus'] ?? 0) !== 200) {
        return '';
    }
    $out = trim((string) ($data['responseData']['translatedText'] ?? ''));
    if ($out === '' || strtoupper($out) === 'MYMEMORY WARNING') {
        return '';
    }
    return $out;
}

function vd_trp_translate_table(wpdb $wpdb, string $table, string $col, int $limit): int {
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
        $translated = vd_mm_translate((string) $row->original);
        if ($translated === '') {
            usleep(300000);
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
        usleep(120000);
    }
    return $done;
}

global $wpdb;
$prefix = $wpdb->prefix;

$dict = vd_trp_translate_table($wpdb, "{$prefix}trp_dictionary_pt_pt_en_gb", 'original', $limit);
$gettext = vd_trp_translate_table($wpdb, "{$prefix}trp_gettext_en_gb", 'original', max(0, $limit - $dict));

$remaining_dict = (int) $wpdb->get_var(
    "SELECT COUNT(*) FROM `{$prefix}trp_dictionary_pt_pt_en_gb` WHERE translated IS NULL OR translated = ''"
);
$remaining_gettext = (int) $wpdb->get_var(
    "SELECT COUNT(*) FROM `{$prefix}trp_gettext_en_gb` WHERE translated IS NULL OR translated = ''"
);

echo "OK: traduzidas dict={$dict} gettext={$gettext} restantes dict={$remaining_dict} gettext={$remaining_gettext}\n";
