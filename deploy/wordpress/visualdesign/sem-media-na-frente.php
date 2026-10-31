<?php
/**
 * VisualDesign: não carrega a biblioteca de media do WordPress nas páginas públicas onde não faz falta.
 *
 * O plugin «Custom Upload Buttons» chama wp_enqueue_media() em todas as páginas: cada visitante da página inicial descarrega
 * cerca de 90 KB de modelos no HTML e 17 ficheiros de JavaScript do editor de media, que só o botão «Selecionar da Biblioteca»
 * de um formulário de envio usa (custom-upload.js sai logo se a página não tem um campo `.jet-engine-file-upload`).
 *
 * Só para visitantes (quem tem sessão fica como estava) e só na página inicial, na página dos artigos, nos arquivos e na pesquisa.
 * Nas outras páginas, incluindo as dos formulários de envio, nada muda. Para desfazer basta apagar este ficheiro.
 */
if (!defined('ABSPATH')) {
    return;
}

function vd_sem_media_aqui()
{
    if (is_admin() || is_user_logged_in()) {
        return false;
    }
    return is_front_page() || is_home() || is_archive() || is_search();
}

add_action('wp_enqueue_scripts', function () {
    if (!vd_sem_media_aqui()) {
        return;
    }
    foreach (array('custom-upload-script', 'media-editor', 'media-audiovideo', 'media-views', 'media-models', 'wp-plupload', 'plupload', 'wp-mediaelement', 'mediaelement') as $h) {
        wp_dequeue_script($h);
    }
}, 1000);

add_action('wp_footer', function () {
    if (vd_sem_media_aqui()) {
        remove_action('wp_footer', 'wp_print_media_templates');
    }
}, 1);
