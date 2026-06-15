<?php
/**
 * Hetzner Object Storage — S3 Uploads (Human Made).
 * Credenciais em ~/.config/wp-s3-hetzner.php (criado pelo setup no servidor).
 */
defined( 'ABSPATH' ) || exit;

$s3_autoload = WP_CONTENT_DIR . '/plugins/s3-uploads/vendor/autoload.php';
if ( is_readable( $s3_autoload ) ) {
	require_once $s3_autoload;
}

/**
 * Caminho das credenciais do utilizador DirectAdmin (admin, oshercollective, …).
 */
function vd_hetzner_s3_creds_path(): string {
	$parts = array_values( array_filter( explode( '/', ABSPATH ) ) );
	// home/admin/domains/example.com/public_html
	if ( count( $parts ) < 2 ) {
		return '';
	}
	return '/' . $parts[0] . '/' . $parts[1] . '/.config/wp-s3-hetzner.php';
}

$creds_file = vd_hetzner_s3_creds_path();
if ( ! $creds_file || ! is_readable( $creds_file ) ) {
	return;
}

$creds = include $creds_file;
if ( ! is_array( $creds ) || empty( $creds['key'] ) || empty( $creds['secret'] ) ) {
	return;
}

$host = parse_url( home_url(), PHP_URL_HOST );
if ( ! $host ) {
	return;
}

if ( ! defined( 'S3_UPLOADS_BUCKET' ) ) {
	define( 'S3_UPLOADS_BUCKET', 'visualdesign-storage' );
}
if ( ! defined( 'S3_UPLOADS_KEY' ) ) {
	define( 'S3_UPLOADS_KEY', $creds['key'] );
}
if ( ! defined( 'S3_UPLOADS_SECRET' ) ) {
	define( 'S3_UPLOADS_SECRET', $creds['secret'] );
}
if ( ! defined( 'S3_UPLOADS_REGION' ) ) {
	define( 'S3_UPLOADS_REGION', 'us-east-1' );
}
if ( ! defined( 'S3_UPLOADS_BUCKET_URL' ) ) {
	define( 'S3_UPLOADS_BUCKET_URL', 'https://visualdesign-storage.hel1.your-objectstorage.com' );
}
if ( ! defined( 'S3_UPLOADS_OBJECT_PREFIX' ) ) {
	define( 'S3_UPLOADS_OBJECT_PREFIX', 'wp-sites/' . $host . '/' );
}
if ( ! defined( 'S3_UPLOADS_AUTOENABLE' ) ) {
	define( 'S3_UPLOADS_AUTOENABLE', true );
}

add_filter(
	's3_uploads_s3_client_params',
	static function ( array $params ): array {
		$params['endpoint']               = 'https://hel1.your-objectstorage.com';
		$params['use_path_style_endpoint'] = false;
		return $params;
	}
);

add_filter(
	's3_uploads_object_acl',
	static function (): string {
		return 'public-read';
	}
);
