<?php
define('ABSPATH', '/home/admin/domains/aamihe.com/public_html/');
require ABSPATH . 'wp-load.php';

if (!function_exists('wp_update_custom_css_post')) {
  require ABSPATH . 'wp-includes/theme.php';
}

function walk_elementor_tree(&$tree, callable $cb): void {
  if (!is_array($tree)) {
    return;
  }
  if (array_is_list($tree)) {
    foreach ($tree as &$node) {
      walk_elementor_tree($node, $cb);
    }
    return;
  }
  $cb($tree);
  if (!empty($tree['elements']) && is_array($tree['elements'])) {
    foreach ($tree['elements'] as &$child) {
      walk_elementor_tree($child, $cb);
    }
  }
}

function patch_fonts(array &$node): void {
  if (($node['elType'] ?? '') !== 'widget') {
    return;
  }
  $s = &$node['settings'];
  if (!is_array($s)) {
    return;
  }
  foreach ($s as $key => &$val) {
    if (!is_string($val)) {
      continue;
    }
    if (
      str_ends_with($key, '_font_family')
      && in_array($val, ['Adamina', 'Arial', 'Montserrat', 'Roboto', 'Helvetica', 'sans-serif'], true)
    ) {
      $val = 'Libre Baskerville';
    }
  }
  if (($s['menu_typography_font_family'] ?? '') !== '') {
    $s['menu_typography_font_family'] = 'Libre Baskerville';
  }
}

function find_widget_in_tree($tree, string $id): ?array {
  $found = null;
  walk_elementor_tree($tree, function (array $node) use ($id, &$found) {
    if (($node['id'] ?? '') === $id) {
      $found = $node;
    }
  });
  return $found;
}

function replace_child_widget_in_tree(&$tree, string $parentId, string $oldWidgetId, array $newWidget): bool {
  $replaced = false;
  walk_elementor_tree($tree, function (array &$node) use ($parentId, $oldWidgetId, $newWidget, &$replaced) {
    if ($replaced || ($node['id'] ?? '') !== $parentId || empty($node['elements'])) {
      return;
    }
    foreach ($node['elements'] as $i => $child) {
      if (($child['id'] ?? '') === $oldWidgetId) {
        $node['elements'][$i] = $newWidget;
        $replaced = true;
        break;
      }
    }
  });
  return $replaced;
}

$header_raw = get_post_meta(967, '_elementor_data', true);
$header_data = json_decode($header_raw, true);
$lang_template = find_widget_in_tree($header_data, 'a294b69');
if (!$lang_template) {
  fwrite(STDERR, "Language menu template not found\n");
  exit(1);
}

$lang_widget = $lang_template;
$lang_widget['id'] = 'aamihe_home_lang';
$lang_widget['settings']['menu_typography_font_family'] = 'Libre Baskerville';

$home_raw = get_post_meta(7996, '_elementor_data', true);
$home_data = json_decode($home_raw, true);
if (!is_array($home_data)) {
  fwrite(STDERR, "Invalid homepage elementor data\n");
  exit(1);
}

if (!replace_child_widget_in_tree($home_data, 'bfbed40', '91bd37c', $lang_widget)) {
  fwrite(STDERR, "Failed to replace social icons with language menu\n");
  exit(1);
}

walk_elementor_tree($home_data, 'patch_fonts');
update_post_meta(7996, '_elementor_data', wp_slash(wp_json_encode($home_data)));

walk_elementor_tree($header_data, 'patch_fonts');
update_post_meta(967, '_elementor_data', wp_slash(wp_json_encode($header_data)));

$css = "@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');\n\n"
  . "body, button, input, select, textarea,\n"
  . ".elementor-widget-text-editor,\n"
  . ".elementor-widget-heading .elementor-heading-title,\n"
  . ".elementor-widget-icon-list .elementor-icon-list-text,\n"
  . ".elementor-widget-nav-menu .elementor-nav-menu--main .elementor-item,\n"
  . ".elementor-widget-nav-menu .elementor-nav-menu--dropdown .elementor-item,\n"
  . "#site-navigation-wrap .dropdown-menu > li > a,\n"
  . "#top-bar-content, #top-bar-content a {\n"
  . "  font-family: 'Libre Baskerville', serif !important;\n"
  . "}\n";

wp_update_custom_css_post($css);

$body_typo = get_theme_mod('ocean_body_typography', []);
if (!is_array($body_typo)) {
  $body_typo = [];
}
$body_typo['font-family'] = 'Libre Baskerville';
$body_typo['font-weight'] = '400';
set_theme_mod('ocean_body_typography', $body_typo);

if (class_exists('\\Elementor\\Plugin')) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

echo "OK\n";
