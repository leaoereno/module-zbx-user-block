<?php
/**
 * Esta view é carregada automaticamente pelo Zabbix quando action=user.list.
 * Injeta o JavaScript do módulo de forma inline para garantir compatibilidade
 * com Docker, proxies reversos e ambientes que bloqueiam arquivos .js estáticos.
 *
 * BUG FIX: A abordagem anterior usava <script src="..."> apontando para o
 * arquivo .js estático dentro do diretório do módulo. Isso falha em ambientes
 * Docker (sem virtualhost configurado para servir /modules/*) e ambientes com
 * proxy reverso (ex: F5 BIG-IP) que bloqueiam requisições a arquivos .js.
 *
 * Solução: ler o JS do disco via file_get_contents() e injetá-lo inline.
 */

$js_file = __DIR__ . '/../assets/js/block_user.js';

if (is_readable($js_file)) {
    $js_content = file_get_contents($js_file);
    // Injeta o JS no final do body, após todo o JS nativo do Zabbix
    zbx_add_post_js($js_content);
}
