#!/bin/bash
# Hook DirectAdmin — corre após instalação WordPress.
/root/wp-cache-on-site.sh "/home/${username}/${wp_directory}" "$username" >> /var/log/wp-cache-bootstrap.log 2>&1 &
