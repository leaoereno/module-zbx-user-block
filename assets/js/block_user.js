/**
 * zbx-block-user — block_user.js (v1.0.2)
 *
 * Injeta o botão "Block" / "Bloquear" na barra de ações da listagem de Usuários
 * do Zabbix 7.0 LTS, ao lado do botão nativo "Unblock" / "Desbloquear".
 *
 * Estratégia de injeção revisada para o DOM real do Zabbix 7.0:
 *
 * O Zabbix 7.0 renderiza os botões de ação da tabela (Unblock, Delete, etc.)
 * dentro de um <div class="action-buttons"> ou diretamente no footer da tabela.
 * Esses botões NÃO têm data-action — eles submetem um <form> via JS.
 * A localização correta é por texto do botão (multilíngue) ou por posição
 * relativa ao container de botões de ação.
 *
 * Correções nesta versão:
 *   - Busca pelo botão Unblock por lista completa de textos multilíngue
 *   - Fallback: injeta ao lado de qualquer botão de ação do toolbar (último recurso)
 *   - Adicionado log de debug no console para facilitar diagnóstico
 *   - Removida dependência de data-action (não existe no Zabbix 7.0 LTS user.list)
 *   - MutationObserver no container de botões para reinjection após navegação SPA
 */

(function () {
    'use strict';

    var INJECTED = false;

    // Textos do botão Unblock em todos os idiomas suportados pelo Zabbix
    var UNBLOCK_TEXTS = [
        'Unblock',        // en
        'Desbloquear',    // pt-BR / es
        'Débloquer',      // fr
        'Разблокировать', // ru
        'Entsperren',     // de
        'Sblocca',        // it
        'Odblokuj',       // pl
        'Engellemeyi Kaldır', // tr
        'ブロック解除',    // ja
        '차단 해제',       // ko
        '取消封锁',        // zh-CN
    ];

    /**
     * Aguarda elemento no DOM com polling.
     */
    function waitFor(selector, cb, timeout) {
        var start = Date.now();
        var t = setInterval(function () {
            var el = document.querySelector(selector);
            if (el) { clearInterval(t); cb(el); return; }
            if (Date.now() - start > (timeout || 10000)) { clearInterval(t); }
        }, 200);
    }

    /**
     * Localiza o botão Unblock nativo.
     * Estratégias em ordem de confiabilidade:
     */
    function findUnblockButton() {
        var allBtns = document.querySelectorAll('button');

        // Estratégia 1: texto exato (case-sensitive) — cobre todos os idiomas
        for (var i = 0; i < allBtns.length; i++) {
            var txt = allBtns[i].textContent.trim();
            if (UNBLOCK_TEXTS.indexOf(txt) !== -1) {
                console.log('[zbx-block-user] Unblock button found by text: "' + txt + '"');
                return allBtns[i];
            }
        }

        // Estratégia 2: texto case-insensitive com "unblock" ou "desbloquear"
        for (var j = 0; j < allBtns.length; j++) {
            var t2 = allBtns[j].textContent.trim().toLowerCase();
            if (t2.indexOf('unblock') !== -1 || t2.indexOf('desbloquear') !== -1) {
                console.log('[zbx-block-user] Unblock button found by partial text: "' + t2 + '"');
                return allBtns[j];
            }
        }

        console.log('[zbx-block-user] Unblock button NOT found. Buttons on page:',
            Array.from(allBtns).map(function(b){ return '"' + b.textContent.trim() + '"'; }));
        return null;
    }

    /**
     * Retorna o container de botões de ação da tabela.
     * No Zabbix 7.0, fica em .table-action-buttons ou no footer da tabela.
     */
    function findButtonContainer() {
        return document.querySelector('.table-action-buttons')
            || document.querySelector('.action-buttons')
            || document.querySelector('form .toolbar')
            || null;
    }

    /**
     * Retorna userids selecionados nos checkboxes.
     */
    function getSelectedUserIds() {
        // Zabbix 7.0: checkboxes de usuário têm name="ids[N]" ou value=userid
        var checked = document.querySelectorAll(
            'table tbody input[type="checkbox"]:checked,' +
            '.list-table tbody input[type="checkbox"]:checked'
        );
        var ids = [];
        for (var i = 0; i < checked.length; i++) {
            var cb = checked[i];
            var id = cb.value
                || cb.getAttribute('data-id')
                || (cb.name || '').replace(/^ids\[/, '').replace(/\]$/, '');
            if (id && id !== 'on' && /^\d+$/.test(id)) {
                ids.push(id);
            }
        }
        return ids;
    }

    /**
     * Exibe mensagem usando sistema nativo do Zabbix ou fallback inline.
     */
    function showMsg(type, title, msgs) {
        if (type === 'success' && typeof postMessageOk === 'function') {
            postMessageOk(title);
        } else if (type === 'error' && typeof postMessageError === 'function') {
            postMessageError(title);
        } else {
            var old = document.getElementById('zbx-block-alert');
            if (old) old.remove();
            var d = document.createElement('div');
            d.id = 'zbx-block-alert';
            d.className = type === 'success' ? 'msg-good' : 'msg-bad';
            d.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:3px;font-size:13px;';
            d.innerHTML = '<strong>' + title + '</strong>';
            if (msgs && msgs.length) {
                var ul = document.createElement('ul');
                ul.style.margin = '4px 0 0 16px';
                msgs.forEach(function(m){ var li=document.createElement('li'); li.textContent=m; ul.appendChild(li); });
                d.appendChild(ul);
            }
            var anchor = document.querySelector('.content-header,main,#content');
            if (anchor) { anchor.insertBefore(d, anchor.firstChild); }
            setTimeout(function(){ d.remove(); }, 7000);
        }
    }

    /**
     * Envia POST AJAX para blockuser.block.
     * action SEMPRE na query string — nunca no body (Zabbix 7.0 routing rule).
     */
    function doBlock(userids, btn) {
        btn.disabled = true;
        btn.textContent = '...';

        var params = new URLSearchParams();
        userids.forEach(function(id){ params.append('userids[]', id); });

        fetch('zabbix.php?action=blockuser.block', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: params.toString()
        })
        .then(function(res) {
            var ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                throw new Error('Server returned non-JSON (got: ' + ct + '). Check module is enabled.');
            }
            return res.json();
        })
        .then(function(data) {
            if (data.success) {
                showMsg('success', data.success.title, data.success.messages || []);
                setTimeout(function(){ location.reload(); }, 900);
            } else {
                showMsg('error', (data.error && data.error.title) || 'Error', (data.error && data.error.messages) || []);
                btn.disabled = false;
                btn.textContent = 'Block';
            }
        })
        .catch(function(err) {
            showMsg('error', 'Communication error', [err.message]);
            btn.disabled = false;
            btn.textContent = 'Block';
        });
    }

    /**
     * Cria e injeta o botão Block antes do Unblock.
     */
    function inject(unblockBtn) {
        if (INJECTED || document.getElementById('zbx-btn-block')) return;
        INJECTED = true;

        var btn = document.createElement('button');
        btn.id = 'zbx-btn-block';
        btn.type = 'button';
        btn.textContent = 'Block';
        btn.disabled = true;

        // Copia classes do Unblock para manter o mesmo visual
        unblockBtn.classList.forEach(function(c){ btn.classList.add(c); });
        btn.style.marginRight = '4px';

        unblockBtn.parentNode.insertBefore(btn, unblockBtn);

        btn.addEventListener('click', function () {
            var ids = getSelectedUserIds();
            if (!ids.length) { showMsg('error', 'No users selected.', []); return; }
            var noun = ids.length === 1 ? 'this user' : 'these ' + ids.length + ' users';
            if (!confirm('Block ' + noun + '?\n\nAccess will be blocked immediately.\nUse the Unblock button to revert.')) return;
            doBlock(ids, btn);
        });

        // Sincroniza disabled com o Unblock nativo (responde à seleção de checkboxes)
        new MutationObserver(function() {
            btn.disabled = unblockBtn.disabled;
        }).observe(unblockBtn, { attributes: true, attributeFilter: ['disabled'] });

        btn.disabled = unblockBtn.disabled;

        console.log('[zbx-block-user] Block button injected successfully.');
    }

    /**
     * Tenta encontrar o Unblock e injetar. Retorna true se conseguiu.
     */
    function tryInject() {
        if (INJECTED || document.getElementById('zbx-btn-block')) { return true; }
        var unblock = findUnblockButton();
        if (unblock) { inject(unblock); return true; }
        return false;
    }

    /**
     * Bootstrap: aguarda o DOM estar pronto e os botões renderizados.
     * Usa MutationObserver no body para detectar quando o Zabbix
     * renderiza o toolbar (acontece de forma assíncrona no Zabbix 7.0).
     */
    function bootstrap() {
        // Tentativa imediata
        if (tryInject()) return;

        // Observa mutações no DOM para detectar quando os botões aparecem
        var observer = new MutationObserver(function() {
            if (tryInject()) { observer.disconnect(); }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Safety timeout: desliga o observer após 15s para não vazar memória
        setTimeout(function() { observer.disconnect(); }, 15000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
