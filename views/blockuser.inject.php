<?php
/**
 * zbx-block-user — views/blockuser.inject.php
 *
 * Esta view é registrada para ser carregada junto com a action user.list.
 * Injeta o script block_user.js como recurso da página via zbx_add_post_js().
 *
 * O Zabbix 7.0 exige que módulos registrem seus assets via CView::registerDirectory()
 * e então referenciem via zbx_add_post_js() ou insertBefore no layout.
 */

// Caminho absoluto para o JS do módulo
$module_js_url = 'modules/zbx-block-user/assets/js/block_user.js';

// zbx_add_post_js injeta o script no final do body, após o JS nativo do Zabbix
zbx_add_post_js('const __zbxBlockUserScriptUrl = ' . json_encode($module_js_url) . ';');

// Carrega o script diretamente via tag script
echo '<script src="' . $module_js_url . '?v=1.0.0" defer></script>';
