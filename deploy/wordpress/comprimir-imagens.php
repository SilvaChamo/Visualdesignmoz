<?php
/**
 * Comprime, em silêncio e sem mudar nomes nem extensões, as imagens JPEG e PNG grandes que já estão num WordPress (Silva, 30/10/2026: «comprimir as
 * existentes desde que não percam qualidade»). Lê da entrada, uma por linha, os caminhos dos ficheiros com mais de 250 KB; para cada um grava o
 * resultado numa pasta de saída (nunca no sítio do original) e escreve «OK|caminho|n|antes|depois|psnr»; quem muda o original é o script do servidor,
 * depois de guardar uma cópia. Regras:
 *  - JPEG: reescrito progressivo, sem metadados, qualidade 88 a descer até 78; só serve um resultado com PSNR >= 38 dB em relação ao original
 *    (acima de ~40 dB ninguém vê a diferença), que poupe pelo menos 15%; escolhe o primeiro que fique até 250 KB, ou o mais pequeno que passe no PSNR.
 *    Imagens com orientação EXIF ≠ 1 ficam como estão (sem EXIF a foto viraria).
 *  - PNG: só sem perda (nível 9; a paleta e a transparência ficam), e só se poupar pelo menos 10%.
 *  - Nunca muda as dimensões, o nome nem a extensão. WebP, GIF e SVG não se tocam. Ficheiros mexidos nos últimos 5 minutos não se tocam.
 * Uso: php comprimir-imagens.php <pasta-de-saida> < lista.txt
 */
const COMPR_MAX_BYTES = 256000;
const COMPR_PSNR_MIN = 38.0;

function compr_psnr($a, $b): float
{
	$lado = 400;
	foreach ([&$a, &$b] as &$im) {
		$w = imagesx($im);
		$h = imagesy($im);
		$m = max($w, $h);
		if ($m > $lado) {
			$novo = imagescale($im, max(1, (int) round($w * $lado / $m)), max(1, (int) round($h * $lado / $m)), IMG_BILINEAR_FIXED);
			if ($novo) {
				$im = $novo;
			}
		}
	}
	unset($im);
	$w = min(imagesx($a), imagesx($b));
	$h = min(imagesy($a), imagesy($b));
	$soma = 0.0;
	$n = 0;
	for ($y = 0; $y < $h; $y++) {
		for ($x = 0; $x < $w; $x++) {
			$p = imagecolorat($a, $x, $y);
			$q = imagecolorat($b, $x, $y);
			$dr = (($p >> 16) & 255) - (($q >> 16) & 255);
			$dg = (($p >> 8) & 255) - (($q >> 8) & 255);
			$db = ($p & 255) - ($q & 255);
			$soma += $dr * $dr + $dg * $dg + $db * $db;
			$n += 3;
		}
	}
	$mse = $soma / max(1, $n);
	return $mse <= 0 ? 99.0 : 10 * log10(255 * 255 / $mse);
}

function compr_ficheiro(string $f, string $saida, int $n): ?string
{
	if (!is_file($f) || !is_readable($f) || time() - (int) filemtime($f) < 300) {
		return null;
	}
	$antes = (int) filesize($f);
	if ($antes <= COMPR_MAX_BYTES) {
		return null;
	}
	$info = @getimagesize($f);
	if (!$info || $info[0] * $info[1] > 60000000) {
		return null;
	}
	if ($info[2] === IMAGETYPE_JPEG) {
		if (function_exists('exif_read_data')) {
			$exif = @exif_read_data($f);
			if ($exif && (int) ($exif['Orientation'] ?? 1) !== 1) {
				return null;
			}
		}
		$im = @imagecreatefromjpeg($f);
		if (!$im) {
			return null;
		}
		$melhor = null;
		$melhorPsnr = 0.0;
		foreach ([88, 85, 82, 78] as $q) {
			imageinterlace($im, true);
			ob_start();
			imagejpeg($im, null, $q);
			$blob = (string) ob_get_clean();
			if ($blob === '' || strlen($blob) > $antes * 0.85) {
				continue;
			}
			$dec = @imagecreatefromstring($blob);
			if (!$dec) {
				continue;
			}
			$psnr = compr_psnr($im, $dec);
			imagedestroy($dec);
			if ($psnr < COMPR_PSNR_MIN) {
				continue;
			}
			if ($melhor === null || strlen($blob) < strlen($melhor)) {
				$melhor = $blob;
				$melhorPsnr = $psnr;
			}
			if (strlen($blob) <= COMPR_MAX_BYTES) {
				break;
			}
		}
		imagedestroy($im);
		if ($melhor === null) {
			return null;
		}
		file_put_contents("$saida/$n.dat", $melhor);
		return sprintf('OK|%s|%d|%d|%d|%.1f', $f, $n, $antes, strlen($melhor), $melhorPsnr);
	}
	if ($info[2] === IMAGETYPE_PNG) {
		$im = @imagecreatefrompng($f);
		if (!$im) {
			return null;
		}
		imagealphablending($im, false);
		imagesavealpha($im, true);
		ob_start();
		imagepng($im, null, 9, PNG_ALL_FILTERS);
		$blob = (string) ob_get_clean();
		imagedestroy($im);
		if ($blob === '' || strlen($blob) > $antes * 0.90) {
			return null;
		}
		file_put_contents("$saida/$n.dat", $blob);
		return sprintf('OK|%s|%d|%d|%d|%s', $f, $n, $antes, strlen($blob), 'sem perda');
	}
	return null;
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
	$saida = $argv[1] ?? '';
	if ($saida === '' || !is_dir($saida)) {
		fwrite(STDERR, "uso: php comprimir-imagens.php <pasta-de-saida> < lista.txt\n");
		exit(1);
	}
	@ini_set('memory_limit', '1024M');
	$n = 0;
	$total = 0;
	$ok = 0;
	while (($linha = fgets(STDIN)) !== false) {
		$f = rtrim($linha, "\r\n");
		if ($f === '') {
			continue;
		}
		$total++;
		try {
			$r = compr_ficheiro($f, $saida, $n + 1);
		} catch (\Throwable $e) {
			$r = null;
		}
		if ($r !== null) {
			$n++;
			$ok++;
			echo $r, "\n";
		}
	}
	echo "RESUMO|$total|$ok\n";
}
