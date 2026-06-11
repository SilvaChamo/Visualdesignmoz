<?php
/**
 * TranslatePress — tradução offline PT→EN via Argos (fallback gratuito sem quota API).
 * Uso: VD_TRP_LIMIT=500 wp eval-file vd-trp-argos-translate.php
 */
if (!defined('ABSPATH')) {
    exit(1);
}

$limit = max(1, (int) (getenv('VD_TRP_LIMIT') ?: 500));
$batch = max(10, min(100, (int) (getenv('VD_ARGOS_BATCH') ?: 50)));
$python = getenv('VD_ARGOS_PYTHON') ?: '/opt/vd-translate/bin/python';
$wrapper = getenv('VD_ARGOS_BATCH_WRAPPER') ?: '/usr/local/share/wordpress-mu-plugins/vd-argos-batch.py';
$argos_data = getenv('VD_ARGOS_DATA') ?: '/opt/vd-translate/share';
putenv('VD_ARGOS_DATA=' . $argos_data);

function vd_argos_translate_batch(array $rows, string $python, string $wrapper): array {
    if ($rows === [] || !is_executable($wrapper)) {
        return [];
    }

    $payload = [];
    foreach ($rows as $row) {
        $payload[] = [(int) $row->id, (string) $row->original];
    }

    $json = wp_json_encode($payload);
    $tmp = tempnam(sys_get_temp_dir(), 'vdargos');
    if ($tmp === false || file_put_contents($tmp, $json) === false) {
        return [];
    }

    $cmd = 'sh -c ' . escapeshellarg(
        escapeshellarg($python) . ' ' . escapeshellarg($wrapper) . ' < ' . escapeshellarg($tmp) . ' 2>/dev/null'
    );
    $out = shell_exec($cmd);
    @unlink($tmp);
    if (!is_string($out) || $out === '') {
        return [];
    }

    $decoded = json_decode($out, true);
    return is_array($decoded) ? $decoded : [];
}

function vd_trp_translate_table_argos(wpdb $wpdb, string $table, string $col, int $limit, string $python, string $wrapper, int $batch): int {
    if (!$wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table))) {
        return 0;
    }

    $rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT id, `$col` AS original FROM `$table`
             WHERE (translated IS NULL OR translated = '')
               AND `$col` NOT LIKE %s
               AND LENGTH(`$col`) BETWEEN 3 AND 2000
             ORDER BY (CASE WHEN `$col` REGEXP '[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]' THEN 0 ELSE 1 END), id ASC
             LIMIT %d",
            'http%',
            $limit
        )
    );

    $done = 0;
    foreach (array_chunk($rows, $batch) as $chunk) {
        $translations = vd_argos_translate_batch($chunk, $python, $wrapper);
        foreach ($chunk as $row) {
            $id = (string) (int) $row->id;
            if (empty($translations[$id])) {
                continue;
            }
            $wpdb->update(
                $table,
                ['translated' => $translations[$id], 'status' => 2],
                ['id' => (int) $row->id],
                ['%s', '%d'],
                ['%d']
            );
            $done++;
        }
    }

    return $done;
}

if (!is_executable($python) || !is_executable($wrapper)) {
    echo "ERR: Argos não instalado ({$python} / {$wrapper})\n";
    exit(1);
}

global $wpdb;
$prefix = $wpdb->prefix;

$dict = vd_trp_translate_table_argos($wpdb, "{$prefix}trp_dictionary_pt_pt_en_gb", 'original', $limit, $python, $wrapper, $batch);
$gettext = vd_trp_translate_table_argos(
    $wpdb,
    "{$prefix}trp_gettext_en_gb",
    'original',
    max(0, $limit - $dict),
    $python,
    $wrapper,
    $batch
);

$remaining_dict = (int) $wpdb->get_var(
    "SELECT COUNT(*) FROM `{$prefix}trp_dictionary_pt_pt_en_gb` WHERE translated IS NULL OR translated = ''"
);
$remaining_gettext = (int) $wpdb->get_var(
    "SELECT COUNT(*) FROM `{$prefix}trp_gettext_en_gb` WHERE translated IS NULL OR translated = ''"
);

echo "OK: argos dict={$dict} gettext={$gettext} restantes dict={$remaining_dict} gettext={$remaining_gettext}\n";
