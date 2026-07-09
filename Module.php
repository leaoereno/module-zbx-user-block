<?php
namespace Modules\BlockUser;

use Zabbix\Core\CModule;

class Module extends CModule {

    public function init(): void {
        // Registra o diretório de views do módulo para que user.list.php
        // seja injetado automaticamente pelo Zabbix quando action=user.list
        try {
            \APP::Component()->get('view')->registerDirectory(__DIR__ . '/views');
        } catch (\Throwable $e) {
            // Contexto sem UI (ex: CLI, cronjob) — falha silenciosa
        }
    }
}
