<?php
/*
 * Module: zbx-block-user
 * Action: blockuser.block
 *
 * Seta attempt_failed >= tentativas maximas configuradas para bloquear o usuario
 * na base local do Zabbix, sem necessidade de brute-force manual.
 */

namespace Modules\BlockUser\Actions;

use CController;
use CControllerResponseData;
use CControllerResponseFatal;
use CWebUser;
use CRoleHelper;

class CControllerBlockUserBlock extends CController {

    protected function init(): void {
        $this->disableCsrfValidation();
    }

    protected function checkInput(): bool {
        $fields = [
            'userids' => 'required|array_id'
        ];

        $ret = $this->validateInput($fields);

        if (!$ret) {
            $this->setResponse(new CControllerResponseFatal());
        }

        return $ret;
    }

    protected function checkPermissions(): bool {
        return $this->checkAccess(CRoleHelper::UI_ADMINISTRATION_USERS);
    }

    protected function doAction(): void {
        $userids = $this->getInput('userids', []);

        if (empty($userids)) {
            $this->setResponse(new CControllerResponseData([
                'main_block' => json_encode([
                    'error' => ['title' => 'Nenhum usuário selecionado.']
                ])
            ]));
            return;
        }

        // Não permitir bloquear o próprio usuário logado
        $current_userid = CWebUser::$data['userid'];
        $userids = array_values(array_filter($userids, fn($id) => (int)$id !== (int)$current_userid));

        if (empty($userids)) {
            $this->setResponse(new CControllerResponseData([
                'main_block' => json_encode([
                    'error' => ['title' => 'Você não pode bloquear seu próprio usuário.']
                ])
            ]));
            return;
        }

        // Busca o limite de tentativas configurado (Administration > Authentication > Login attempts)
        // BUG FIX: funções globais de DB precisam de \ dentro de namespace
        $config_row = \DBfetch(\DBselect('SELECT login_attempts FROM config LIMIT 1'));
        $max_attempts = ($config_row && (int)$config_row['login_attempts'] > 0)
            ? (int)$config_row['login_attempts']
            : 5;

        $blocked       = 0;
        $skipped_names = [];

        foreach ($userids as $userid) {
            // BUG FIX: \DBfetch, \DBselect, \DBquote em vez de DBfetch, DBselect, zbx_dbstr
            $user = \DBfetch(\DBselect(
                'SELECT userid, username, attempt_failed FROM users WHERE userid=' . \DBquote($userid)
            ));

            if (!$user) {
                continue;
            }

            // Já está bloqueado — apenas registra para feedback
            if ((int)$user['attempt_failed'] >= $max_attempts) {
                $skipped_names[] = $user['username'];
                continue;
            }

            // BUG FIX: \DBexecute e \DBquote com prefixo de namespace
            \DBexecute(
                'UPDATE users' .
                ' SET attempt_failed=' . \DBquote($max_attempts) .
                ', attempt_clock='    . \DBquote(time()) .
                ', attempt_ip='       . \DBquote('127.0.0.1') .
                ' WHERE userid='      . \DBquote($userid)
            );

            $blocked++;
        }

        $output = [];

        if ($blocked > 0) {
            $output['success']['title'] = $blocked === 1
                ? '1 usuário bloqueado com sucesso.'
                : "{$blocked} usuários bloqueados com sucesso.";
        }

        if (!empty($skipped_names)) {
            $output['success']['messages'][] = 'Já bloqueados (ignorados): ' . implode(', ', $skipped_names);
        }

        if ($blocked === 0 && empty($skipped_names)) {
            $output = ['error' => ['title' => 'Nenhum usuário foi bloqueado.']];
        } elseif ($blocked === 0 && !empty($skipped_names)) {
            $output = [
                'error' => [
                    'title'    => 'Nenhum usuário foi bloqueado.',
                    'messages' => ['Todos os selecionados já estavam bloqueados: ' . implode(', ', $skipped_names)]
                ]
            ];
        }

        $this->setResponse(new CControllerResponseData(['main_block' => json_encode($output)]));
    }
}
