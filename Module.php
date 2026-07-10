<?php
namespace Modules\BlockUser;

use Zabbix\Core\CModule;

class Module extends CModule {

    public function init(): void {
        // Guard umbrella Usuarios
        if (defined('ZBX_USUARIOS_ACTIVE') && ZBX_USUARIOS_ACTIVE === true) { return; }
        // O Zabbix 7.0 NÃO injeta views de módulo em actions nativas (user.list).
        // registerDirectory() só funciona para actions declaradas no manifest.
        //
        // Solução: zbx_add_post_js() no init(), filtrado por action=user.list.
        // Executado em todas as páginas — o filtro garante que o JS só vai
        // para a listagem de usuários.

        $action = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';

        // Injeta também quando não há action na URL (Zabbix pode carregar
        // user.list como default em alguns contextos de navegação)
        if ($action !== 'user.list' && $action !== '') {
            return;
        }

        // Mas se não há action, verifica se é a página de usuários pelo PATH_INFO
        // ou pelo referrer — fallback seguro: só injeta em user.list explícito
        if ($action === '') {
            return;
        }

        $js_file = __DIR__ . '/assets/js/block_user.js';

        if (!is_readable($js_file)) {
            return;
        }

        zbx_add_post_js(file_get_contents($js_file));
    }
}
