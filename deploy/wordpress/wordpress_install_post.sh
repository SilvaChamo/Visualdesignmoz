#!/bin/bash
# Hook DirectAdmin — após instalação WordPress.
WP_PATH="/home/${username}/${wp_directory}"
DOMAIN="${domain:-}"

# Cache (async)
/root/wp-cache-on-site.sh "$WP_PATH" "$username" >> /var/log/wp-cache-bootstrap.log 2>&1 &

# S3 Hetzner — uploads directos para o balde
if [[ -f "$WP_PATH/wp-config.php" ]]; then
	[[ -z "$DOMAIN" ]] && DOMAIN="$(basename "$(dirname "$WP_PATH")")"
	/root/aamihe-server-scripts/wp-as3cf-bootstrap.sh "$WP_PATH" "$DOMAIN" "$username" \
		>> /var/log/wp-s3-bootstrap.log 2>&1 &
fi
