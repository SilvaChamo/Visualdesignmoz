<?php
/**
 * Plugin Name: VD Hetzner Media URLs
 * Description: Serve media from Hetzner Object Storage (AS3CF_SETTINGS em wp-config).
 */
defined( 'ABSPATH' ) || exit;

/**
 * @return array<string, mixed>|null
 */
function vd_hetzner_as3cf_settings(): ?array {
	if ( ! defined( 'AS3CF_SETTINGS' ) ) {
		return null;
	}
	$settings = @unserialize( AS3CF_SETTINGS );
	return is_array( $settings ) ? $settings : null;
}

function vd_hetzner_uploads_base_url(): ?string {
	static $cached = null;
	static $resolved = false;

	if ( $resolved ) {
		return $cached;
	}
	$resolved = true;

	$settings = vd_hetzner_as3cf_settings();
	if ( ! $settings || empty( $settings['serve-from-s3'] ) ) {
		$cached = null;
		return null;
	}

	$bucket = (string) ( $settings['bucket'] ?? '' );
	$prefix = (string) ( $settings['object-prefix'] ?? 'uploads/' );
	if ( '' === $bucket ) {
		$cached = null;
		return null;
	}

	$cached = sprintf(
		'https://%s.hel1.your-objectstorage.com/%s',
		$bucket,
		ltrim( $prefix, '/' )
	);

	return $cached;
}

function vd_hetzner_rewrite_uploads_url( string $url ): string {
	$base = vd_hetzner_uploads_base_url();
	if ( ! $base || '' === $url ) {
		return $url;
	}

	$path = (string) parse_url( $url, PHP_URL_PATH );
	if ( '' === $path || false === strpos( $path, '/wp-content/uploads/' ) ) {
		return $url;
	}

	$relative = ltrim( substr( $path, strlen( '/wp-content/uploads/' ) ), '/' );
	if ( '' === $relative ) {
		return $url;
	}

	return trailingslashit( $base ) . $relative;
}

function vd_hetzner_rewrite_uploads_in_html( string $html ): string {
	$base = vd_hetzner_uploads_base_url();
	if ( ! $base || '' === $html ) {
		return $html;
	}

	$site = home_url( '/wp-content/uploads/' );
	$cdn  = trailingslashit( $base );

	return str_replace( $site, $cdn, $html );
}

add_filter( 'wp_get_attachment_url', 'vd_hetzner_rewrite_uploads_url' );
add_filter( 'wp_get_attachment_image_url', 'vd_hetzner_rewrite_uploads_url' );
add_filter( 'wp_get_attachment_thumb_url', 'vd_hetzner_rewrite_uploads_url' );
add_filter( 'get_site_icon_url', 'vd_hetzner_rewrite_uploads_url' );
add_filter( 'wp_calculate_image_srcset', static function ( $sources ) {
	if ( ! is_array( $sources ) ) {
		return $sources;
	}
	foreach ( $sources as $width => $source ) {
		if ( ! empty( $source['url'] ) ) {
			$sources[ $width ]['url'] = vd_hetzner_rewrite_uploads_url( (string) $source['url'] );
		}
	}
	return $sources;
} );
add_filter( 'wp_get_attachment_image_src', static function ( $image ) {
	if ( is_array( $image ) && ! empty( $image[0] ) ) {
		$image[0] = vd_hetzner_rewrite_uploads_url( (string) $image[0] );
	}
	return $image;
} );
add_filter( 'the_content', 'vd_hetzner_rewrite_uploads_in_html', 99 );
add_filter( 'widget_text', 'vd_hetzner_rewrite_uploads_in_html', 99 );
add_filter( 'elementor/frontend/the_content', 'vd_hetzner_rewrite_uploads_in_html', 99 );
