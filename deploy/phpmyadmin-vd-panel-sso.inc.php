<?php
$cfg['Servers'][$i]['hide_db'] = '^(information_schema|performance_schema|mysql|sys|phpmyadmin|roundcube)$';
if (!empty($_GET['n']) || !empty($_COOKIE['SignonSession']) || !empty($_COOKIE['vd_pma_sso'])) {
	$cfg['Servers'][$i]['auth_type'] = 'signon';
	$cfg['Servers'][$i]['SignonSession'] = 'SignonSession';
	$cfg['Servers'][$i]['SignonURL'] = 'vd-panel-sso.php';
	$cfg['Servers'][$i]['LogoutURL'] = 'vd-panel-sso.php?logout=1';
}
