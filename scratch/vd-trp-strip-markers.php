<?php
/**
 * Remove marcadores internos TranslatePress (#!trpst#) do HTML público.
 */
add_action('template_redirect', function () {
    if (is_admin() || (isset($_GET['trp-edit-translation']) && $_GET['trp-edit-translation'] === 'preview')) {
        return;
    }
    ob_start(function ($html) {
        if (!is_string($html) || strpos($html, '#!trpst#') === false) {
            return $html;
        }
        if (class_exists('TRP_Gettext_Manager')) {
            return TRP_Gettext_Manager::strip_gettext_tags($html);
        }
        $html = preg_replace('/#!trpst#trp-gettext[^#]*#!trpen#/i', '', $html);
        $html = preg_replace('/#!trpst#\/trp-gettext#!trpen#/i', '', $html);
        return str_replace('#!trpen#', '', $html);
    }, 0);
}, 0);
