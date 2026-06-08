/**
 * zbx-block-user — block_user.js
 *
 * Injeta o botão "Bloquear" na barra de ações da listagem de Usuários do Zabbix 7.0.
 * O botão fica posicionado imediatamente antes do botão nativo "Desbloquear".
 *
 * Comportamento:
 *   - Desabilitado enquanto nenhum usuário estiver selecionado
 *   - Habilitado assim que 1+ checkboxes forem marcados (mesmo evento do Desbloquear nativo)
 *   - Ao clicar, abre diálogo de confirmação antes de executar
 *   - Envia POST para blockuser.block com os userids selecionados
 *   - Exibe mensagem de sucesso/erro usando o sistema de notificações nativo do Zabbix
 *   - Recarrega a lista após operação bem-sucedida
 */

(function () {
    'use strict';

    /**
     * Aguarda o elemento alvo estar disponível no DOM.
     * O Zabbix renderiza o footer da tabela via JS assíncrono.
     */
    function waitForElement(selector, callback, maxWait) {
        const start = Date.now();
        const interval = setInterval(function () {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                callback(el);
            } else if (Date.now() - start > (maxWait || 5000)) {
                clearInterval(interval);
            }
        }, 100);
    }

    /**
     * Localiza o botão "Desbloquear" nativo pelo texto do seu label.
     * Busca dentro do footer da tabela de usuários.
     */
    function findUnblockButton() {
        const buttons = document.querySelectorAll('.table-action-buttons button, .toolbar button, [data-action] button');
        for (const btn of buttons) {
            if (btn.textContent.trim() === 'Desbloquear') {
                return btn;
            }
        }

        // Fallback: busca em qualquer botão da página
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            if (btn.textContent.trim() === 'Desbloquear') {
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
        // Zabbix 7.0 usa addMessage() ou postMessageOk()/postMessageError()
        if (type === 'success') {
            if (typeof postMessageOk === 'function') {
                postMessageOk(title);
            } else {
                // Fallback: insere alerta manual no topo do conteúdo
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
     */
    function blockUsers(userids, button) {
        button.disabled = true;
        button.textContent = 'Bloqueando...';

        const params = new URLSearchParams();
        params.append('action', 'blockuser.block');
        userids.forEach(function (id) {
            params.append('userids[]', id);
        });

        fetch('zabbix.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.success) {
                showMessage('success', data.success.title, data.success.messages || []);
                // Recarrega a lista para refletir os novos estados
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
        // Evita injeção duplicada
        if (document.getElementById('zbx-btn-block-user')) {
            return;
        }

        const blockBtn = document.createElement('button');
        blockBtn.id = 'zbx-btn-block-user';
        blockBtn.type = 'button';
        blockBtn.textContent = 'Bloquear';
        blockBtn.disabled = true; // começa desabilitado, igual ao Desbloquear

        // Copia as classes CSS do botão Desbloquear para manter visual consistente
        // O Zabbix usa classes como "btn-alt" ou "btn-secondary"
        const unblockClasses = Array.from(unblockBtn.classList);
        unblockBtn.classList.forEach(cls => blockBtn.classList.add(cls));

        // Garante que fique visualmente diferente — usa classe de alerta/vermelho se disponível
        // Zabbix 7.0: btn-danger existe em alguns contextos
        if (document.querySelector('.btn-danger')) {
            blockBtn.classList.remove('btn-alt');
            blockBtn.classList.add('btn-danger');
        }

        // Margem para separar visualmente dos outros botões
        blockBtn.style.marginRight = '4px';

        // Insere ANTES do botão Desbloquear
        unblockBtn.parentNode.insertBefore(blockBtn, unblockBtn);

        // ── Listener de clique ──
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

        // ── Sincroniza estado enable/disable com o Desbloquear nativo ──
        // Observa mutações no atributo disabled do botão Desbloquear
        const observer = new MutationObserver(function () {
            blockBtn.disabled = unblockBtn.disabled;
        });

        observer.observe(unblockBtn, { attributes: true, attributeFilter: ['disabled'] });

        // Sincronização inicial
        blockBtn.disabled = unblockBtn.disabled;

        console.log('[zbx-block-user] Botão "Bloquear" injetado com sucesso.');
    }

    // ── Entry point ──
    // Aguarda a página de listagem de usuários estar totalmente renderizada
    function bootstrap() {
        // Só executa na página de lista de usuários
        const isUserList = window.location.search.includes('action=user.list') ||
                            (window.location.pathname.includes('zabbix.php') &&
                             !window.location.search.includes('action='));

        // Aguarda o botão Desbloquear nativo aparecer no DOM
        waitForElement('button', function () {
            const unblockBtn = findUnblockButton();
            if (unblockBtn) {
                injectBlockButton(unblockBtn);
            } else {
                // Se a página tiver navegação SPA, tenta novamente após mudanças de URL
                setTimeout(function () {
                    const btn = findUnblockButton();
                    if (btn) injectBlockButton(btn);
                }, 1500);
            }
        }, 8000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
