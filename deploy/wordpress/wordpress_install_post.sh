#!/bin/bash
# Hook DirectAdmin — após instalação WordPress.
WP_PATH="/home/${username}/${wp_directory}"
DOMAIN="${domain:-}"

# Cache (async)
/root/wp-cache-on-site.sh "$WP_PATH" "$username" >> /var/log/wp-cache-bootstrap.log 2>&1 &
