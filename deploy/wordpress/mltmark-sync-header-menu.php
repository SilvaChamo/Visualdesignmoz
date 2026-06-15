<?php
/**
 * Sincroniza widget burger do header (1585) com o da home (32).
 * Uso: wp eval-file mltmark-sync-header-menu.php --path=...
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

$home_id   = 32;
$header_id = 1585;
$src_id    = 'c8ffea3';
$tgt_id    = '52f84fd';

/**
 * @param array<int, array<string, mixed>> $elements
 * @return array<string, mixed>|null
 */
function mlt_find_widget( array $elements, string $id ): ?array {
	foreach ( $elements as $el ) {
		if ( ( $el['id'] ?? '' ) === $id ) {
			return $el;
		}
		if ( ! empty( $el['elements'] ) && is_array( $el['elements'] ) ) {
			$found = mlt_find_widget( $el['elements'], $id );
			if ( $found ) {
				return $found;
			}
		}
	}
	return null;
}

/**
 * @param array<int, array<string, mixed>> $elements
 */
function mlt_patch_widget( array &$elements, string $id, array $settings ): bool {
	foreach ( $elements as &$el ) {
		if ( ( $el['id'] ?? '' ) === $id ) {
			$el['settings'] = $settings;
			return true;
		}
		if ( ! empty( $el['elements'] ) && is_array( $el['elements'] ) ) {
			if ( mlt_patch_widget( $el['elements'], $id, $settings ) ) {
				return true;
			}
		}
	}
	return false;
}

$home_raw = get_post_meta( $home_id, '_elementor_data', true );
$hdr_raw  = get_post_meta( $header_id, '_elementor_data', true );
if ( ! is_string( $home_raw ) || ! is_string( $hdr_raw ) ) {
	fwrite( STDERR, "elementor_data em falta\n" );
	exit( 1 );
}

$home_data = json_decode( $home_raw, true );
$hdr_data  = json_decode( $hdr_raw, true );
if ( ! is_array( $home_data ) || ! is_array( $hdr_data ) ) {
	fwrite( STDERR, "JSON inválido\n" );
	exit( 1 );
}

$src = mlt_find_widget( $home_data, $src_id );
if ( ! $src || empty( $src['settings'] ) || ! is_array( $src['settings'] ) ) {
	fwrite( STDERR, "Widget origem {$src_id} não encontrado\n" );
	exit( 1 );
}

if ( ! mlt_patch_widget( $hdr_data, $tgt_id, $src['settings'] ) ) {
	fwrite( STDERR, "Widget destino {$tgt_id} não encontrado\n" );
	exit( 1 );
}

$encoded = wp_slash( wp_json_encode( $hdr_data ) );
update_post_meta( $header_id, '_elementor_data', $encoded );

if ( class_exists( '\Elementor\Plugin' ) ) {
	\Elementor\Plugin::$instance->files_manager->clear_cache();
}

echo "ok header_menu_synced post={$header_id} widget={$tgt_id}\n";
