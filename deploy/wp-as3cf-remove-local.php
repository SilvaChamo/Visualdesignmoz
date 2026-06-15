<?php
/**
 * Remove ficheiros locais de media já offload para S3 (WP Offload Media).
 * Uso: wp eval-file wp-as3cf-remove-local.php --path=/path/to/public_html
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

global $as3cf;
if ( ! $as3cf || ! is_object( $as3cf ) ) {
	fwrite( STDERR, "AS3CF não disponível\n" );
	exit( 1 );
}

if ( ! $as3cf->get_setting( 'remove-local-file', false ) ) {
	fwrite( STDERR, "remove-local-file ainda false — actualize wp-config primeiro\n" );
	exit( 1 );
}

use DeliciousBrains\WP_Offload_Media\Items\Media_Library_Item;
use DeliciousBrains\WP_Offload_Media\Items\Remove_Local_Handler;

$handler = $as3cf->get_item_handler( Remove_Local_Handler::get_item_handler_key_name() );
if ( ! $handler ) {
	fwrite( STDERR, "Remove_Local_Handler indisponível\n" );
	exit( 1 );
}

$batch   = 500;
$upper   = 0;
$removed = 0;
$errors  = 0;

while ( true ) {
	$source_ids = Media_Library_Item::get_source_ids( $upper ?: null, $batch, false, null, true );
	if ( empty( $source_ids ) ) {
		break;
	}

	foreach ( $source_ids as $source_id ) {
		$item = Media_Library_Item::get_by_source_id( $source_id );
		if ( ! $item || ! $item->id() || ! $item->exists_locally() ) {
			continue;
		}

		$result = $handler->handle(
			$item,
			array(
				'verify_exists_on_provider' => true,
			)
		);

		if ( is_wp_error( $result ) ) {
			++$errors;
			fwrite( STDERR, "Erro source_id={$source_id}: " . $result->get_error_message() . "\n" );
			continue;
		}

		++$removed;
	}

	$upper = (int) end( $source_ids );
	if ( count( $source_ids ) < $batch ) {
		break;
	}
}

echo "remove_local_ok removed={$removed} errors={$errors}\n";
