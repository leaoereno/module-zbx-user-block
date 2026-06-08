<?php
/**
 * zbx-block-user — Module.php
 *
 * Ponto de entrada do módulo. Registra o diretório de views e injeta
 * o script JavaScript na action user.list do Zabbix 7.0.
 */

namespace Modules\BlockUser;

use Zabbix\Core\CModule;
use CView;

class Module extends CModule {

    /**
     * Inicialização do módulo.
     * Registra o diretório de views para que o Zabbix encontre os templates.
     */
    public function init(): void {
        $views_dir = __DIR__ . '/views';
        if (is_dir($views_dir)) {
            CView::registerDirectory($views_dir);
        }
    }

    /**
     * Hook chamado antes de qualquer action ser executada.
     * Injeta o script JS apenas na página user.list.
     *
     * @param string $action  Nome da action em execução
     */
    public function onBeforeAction(string $action): void {
        if ($action !== 'user.list') {
            return;
        }

        // Injeta o script no final do body via zbx_add_post_js
        $js_path = 'modules/' . $this->getId() . '/assets/js/block_user.js';

        zbx_add_post_js(
            '(function() {' .
            '  var s = document.createElement("script");' .
            '  s.src = ' . json_encode($js_path . '?v=' . $this->getVersion()) . ';' .
            '  s.defer = true;' .
            '  document.body.appendChild(s);' .
            '})();'
        );
    }
}
