<?php
namespace Modules\BlockUser;

use Zabbix\Core\CModule;
use CView;

class Module extends CModule {

    public function init(): void {
        CView::registerDirectory(__DIR__ . '/views');
    }
}
