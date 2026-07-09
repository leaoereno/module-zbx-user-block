/**
 * zbx-block-user — block_user.js
 *
 * Injeta o botão "Bloquear" na barra de ações da listagem de Usuários do Zabbix 7.0.
 * O botão fica posicionado imediatamente antes do botão nativo "Desbloquear".
 *
 * BUG FIX (v1.0.1):
 *   1. AJAX: action movida para a query string (não deve estar no body do fetch no Zabbix 7.0)
 *   2. bootstrap(): guard isUserList era falso quando a URL não tinha ?action= nenhum,
 *      impedindo execução na primeira carga da página de usuários.
 *   3. findUnblockButton(): busca agora usa data-action nativo do Zabbix além do texto,
 *      tornando o módulo funcional independente do idioma da interface.
 */

(function () {
    'use strict';

    /**
     * Aguarda o elemento alvo estar disponível no DOM.
     */
    function waitForElement(selector, callback, maxWait) {
        const start = Date.now();
        const interval = setInterval(function () {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                callback(el);
            } else if (Date.now() - start > (maxWait || 8000)) {
                clearInterval(interval);
            }
        }, 150);
    }

    /**
     * Localiza o botão "Desbloquear" nativo.
     *
     * BUG FIX: a versão anterior buscava apenas pelo texto "Desbloquear",
     * quebrando em instalações em inglês ("Unblock") ou outro idioma.
     * Agora busca primeiro pelo atributo data-action nativo do Zabbix, que é
     * invariante de idioma. O fallback por texto é mantido por compatibilidade.
     */
    function findUnblockButton() {
        // Estratégia 1: atributo data-action (mais confiável, independente de idioma)
        const byDataAction = document.querySelector('[data-action="unblock"]');
        if (byDataAction) return byDataAction;

        // Estratégia 2: nome do action no formulário pai
        const byFormAction = document.querySelector('button[name="action"][value*="unblock"]');
        if (byFormAction) return byFormAction;

        // Estratégia 3: texto do botão (fallback, dependente de idioma)
        const unblockTexts = ['Desbloquear', 'Unblock', 'Разблокировать', 'Débloquer'];
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            if (unblockTexts.includes(btn.textContent.trim())) {
                return btn;
            }
        }

        return null;
    }

    /**
     * Retorna os userids selecionados nos checkboxes da tabela.
     */
    function getSelectedUserIds() {
        const checkboxes = document.querySelectorAll(
            'table tbody input[type="checkbox"]:checked, ' +
            '.list-table tbody input[type="checkbox"]:checked'
        );

        return Array.from(checkboxes)
            .map(cb => cb.value || cb.getAttribute('data-id') || cb.name.replace('ids[', '').replace(']', ''))
            .filter(id => id && id !== 'on' && /^\d+$/.test(id));
    }

    /**
     * Exibe mensagem de feedback usando o sistema nativo do Zabbix.
     */
    function showMessage(type, title, messages) {
        if (type === 'success') {
            if (typeof postMessageOk === 'function') {
                postMessageOk(title);
            } else {
                insertAlert('success', title, messages);
            }
        } else {
            if (typeof postMessageError === 'function') {
                postMessageError(title);
            } else {
                insertAlert('error', title, messages);
            }
        }
    }

    function insertAlert(type, title, messages) {
        const existing = document.getElementById('zbx-block-msg');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'zbx-block-msg';
        div.className = type === 'success' ? 'msg-good' : 'msg-bad';
        div.style.cssText = 'margin: 8px 0; padding: 8px 12px; border-radius: 3px;';

        const strong = document.createElement('strong');
        strong.textContent = title;
        div.appendChild(strong);

        if (messages && messages.length) {
            const ul = document.createElement('ul');
            ul.style.margin = '4px 0 0 16px';
            messages.forEach(function (msg) {
                const li = document.createElement('li');
                li.textContent = msg;
                ul.appendChild(li);
            });
            div.appendChild(ul);
        }

        const content = document.querySelector('.content-header') ||
                         document.querySelector('main') ||
                         document.querySelector('#content');
        if (content) {
            content.insertBefore(div, content.firstChild);
            setTimeout(function () { div.remove(); }, 6000);
        }
    }

    /**
     * Executa a chamada AJAX para blockuser.block.
     *
     * BUG FIX: No Zabbix 7.0, o parâmetro "action" DEVE estar na query string da URL.
     * Colocá-lo no body do POST conflita com o roteamento interno do framework e resulta
     * em resposta HTML (página de login ou erro 404) em vez de JSON.
     * A versão anterior enviava "action=blockuser.block" dentro do body — isso quebrava
     * silenciosamente: o fetch recebia HTML e o .json() lançava SyntaxError.
     */
    function blockUsers(userids, button) {
        button.disabled = true;
        button.textContent = 'Bloqueando...';

        // BUG FIX: action na query string, NÃO no body
        const url = 'zabbix.php?action=blockuser.block';

        const params = new URLSearchParams();
        userids.forEach(function (id) {
            params.append('userids[]', id);
        });

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: params.toString()
        })
        .then(function (res) {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                // Resposta não-JSON indica erro de roteamento
                return Promise.reject(new Error('Resposta inesperada do servidor (não-JSON). Verifique se o módulo está habilitado.'));
            }
            return res.json();
        })
        .then(function (data) {
            if (data.success) {
                showMessage('success', data.success.title, data.success.messages || []);
                setTimeout(function () { location.reload(); }, 800);
            } else if (data.error) {
                showMessage('error', data.error.title, data.error.messages || []);
                button.disabled = false;
                button.textContent = 'Bloquear';
            }
        })
        .catch(function (err) {
            showMessage('error', 'Erro ao comunicar com o servidor.', [err.message]);
            button.disabled = false;
            button.textContent = 'Bloquear';
        });
    }

    /**
     * Cria o botão "Bloquear" e o insere antes do botão "Desbloquear".
     */
    function injectBlockButton(unblockBtn) {
        if (document.getElementById('zbx-btn-block-user')) {
            return;
        }

        const blockBtn = document.createElement('button');
        blockBtn.id = 'zbx-btn-block-user';
        blockBtn.type = 'button';
        blockBtn.textContent = 'Bloquear';
        blockBtn.disabled = true;

        // Copia classes CSS do botão Desbloquear para manter visual consistente
        unblockBtn.classList.forEach(cls => blockBtn.classList.add(cls));

        blockBtn.style.marginRight = '4px';

        unblockBtn.parentNode.insertBefore(blockBtn, unblockBtn);

        blockBtn.addEventListener('click', function () {
            const userids = getSelectedUserIds();

            if (userids.length === 0) {
                showMessage('error', 'Nenhum usuário selecionado.', []);
                return;
            }

            const noun = userids.length === 1 ? 'este usuário' : `estes ${userids.length} usuários`;
            const confirmed = confirm(
                `Tem certeza que deseja BLOQUEAR ${noun}?\n\n` +
                'O acesso será bloqueado imediatamente.\n' +
                'Use o botão "Desbloquear" para reverter.'
            );

            if (!confirmed) return;

            blockUsers(userids, blockBtn);
        });

        // Sincroniza estado enable/disable com o Desbloquear nativo
        const observer = new MutationObserver(function () {
            blockBtn.disabled = unblockBtn.disabled;
        });

        observer.observe(unblockBtn, { attributes: true, attributeFilter: ['disabled'] });
        blockBtn.disabled = unblockBtn.disabled;

        console.log('[zbx-block-user] Botão "Bloquear" injetado com sucesso.');
    }

    /**
     * Entry point.
     *
     * BUG FIX: a verificação isUserList anterior bloqueava a execução quando a
     * URL era /zabbix.php sem nenhum ?action= (ex: primeiro acesso à página de
     * usuários via menu lateral). A condição correta é verificar se estamos em
     * zabbix.php E se action=user.list está presente OU se não há action algum
     * (Zabbix redireciona para user.list como padrão em alguns contextos).
     * Simplificado: executa sempre que o botão Desbloquear existir no DOM.
     */
    function bootstrap() {
        // Aguarda qualquer botão aparecer e então procura o Desbloquear
        waitForElement('button', function () {
            const unblockBtn = findUnblockButton();
            if (unblockBtn) {
                injectBlockButton(unblockBtn);
            } else {
                // SPA / renderização assíncrona — tenta novamente
                setTimeout(function () {
                    const btn = findUnblockButton();
                    if (btn) injectBlockButton(btn);
                }, 2000);
            }
        }, 10000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
