# zbx-block-user

<<<<<<< HEAD
M�dulo para **Zabbix 7.0 LTS** que adiciona um botão **"Bloquear"** na listagem de usuários (`Usuários > Usuários`), permitindo bloquear imediatamente contas locais sem workarounds manuais.
=======
M�dulo para **Zabbix 7.0 LTS** que adiciona um botão **"Bloquear"** na listagem de usuários (`Usuários > Usuários`), permitindo bloquear imediatamente contas locais sem workarounds manuais.
>>>>>>> 6858537 (inclusão do README.md com processo de instalação)

---

## Sumário

- [Contexto e problema](#contexto-e-problema)
- [Como funciona](#como-funciona)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
  - [1. Obter os arquivos](#1-obter-os-arquivos)
  - [2. Criar o diretório de módulos](#2-criar-o-diretório-de-módulos-se-não-existir)
  - [3. Instalar via script](#3-instalar-via-script-recomendado)
  - [4. Instalação manual](#4-instalação-manual-alternativa)
  - [5. Habilitar no Zabbix](#5-habilitar-no-zabbix)
- [Verificação](#verificação)
- [Uso](#uso)
- [Desinstalar](#desinstalar)
- [Atualizar](#atualizar)
- [Solução de problemas](#solução-de-problemas)
- [Estrutura do módulo](#estrutura-do-módulo)
- [Segurança](#segurança)

---

## Contexto e problema

Em ambientes que transitam de autenticação local para LDAP com provisionamento JIT (ex: Authentik como broker OIDC), é comum que um usuário já tenha uma conta local no Zabbix antes de ser provisionado via LDAP. Após o provisionamento, o time de governança de acesso precisa bloquear a conta local original para evitar duplo acesso.

O Zabbix não oferece um botão nativo de **bloqueio** — apenas de desbloqueio. A alternativa manual de forçar logins com senha errada até atingir o limite de tentativas é inaceitável em qualquer ambiente com rastreabilidade de segurança.

Este módulo resolve isso com uma única ação controlada, auditável e reversível.

---

## Como funciona

O Zabbix considera um usuário bloqueado quando o campo `users.attempt_failed` é maior ou igual ao limite configurado em **Administração > Autenticação > Tentativas de login** (padrão: 5).

O módulo lê esse valor configurado e executa diretamente:

```sql
UPDATE users
SET attempt_failed = <login_attempts>,
    attempt_clock  = <unix_timestamp_atual>,
    attempt_ip     = '127.0.0.1'
WHERE userid = <userid>
```

O efeito é idêntico ao bloqueio por excesso de tentativas — sem brute-force, sem logs de falha de autenticação espúrios.

Para reverter, o botão nativo **"Desbloquear"** do Zabbix zera o `attempt_failed`, funcionando normalmente.

---

## Requisitos

| Componente | Versão mínima |
|---|---|
| Zabbix Server + Frontend | 7.0 LTS |
| PHP | 8.0+ |
| Banco de dados | MySQL 8.0+ / MariaDB 10.5+ / PostgreSQL 13+ |
| Perfil no Zabbix | Super Admin |
| Sistema operacional | AlmaLinux 8/9, RHEL 8/9, Rocky Linux, Debian/Ubuntu |

> O módulo atua exclusivamente no frontend PHP. Não requer alterações no Zabbix Server ou Agent.

---

## Instalação

### 1. Obter os arquivos

**Via Git (recomendado):**

```bash
git clone https://github.com/leaoereno/zbx-block-user.git
cd zbx-block-user
```

**Via download direto:**

```bash
wget https://github.com/leaoereno/zbx-block-user/archive/refs/heads/main.tar.gz
tar -xzf main.tar.gz
cd zbx-block-user-main
```

**Via SCP (para transferir ao servidor diretamente):**

```bash
# Na máquina local, após baixar
scp -r zbx-block-user/ root@<ip-do-servidor>:/tmp/
ssh root@<ip-do-servidor>
cd /tmp/zbx-block-user
```

---

### 2. Criar o diretório de módulos (se não existir)

O Zabbix 7.0 espera módulos em `/usr/share/zabbix/modules/`. Verifique se existe:

```bash
ls /usr/share/zabbix/modules/
```

Se não existir, crie:

```bash
mkdir -p /usr/share/zabbix/modules
```

Confirme qual usuário roda o seu servidor web:

```bash
# Apache (AlmaLinux/RHEL/Rocky)
ps aux | grep httpd | grep -v grep | awk '{print $1}' | head -1

# Nginx
ps aux | grep nginx | grep -v grep | awk '{print $1}' | head -1
```

O usuário normalmente é `apache` (RHEL/AlmaLinux) ou `www-data` (Debian/Ubuntu).

---

### 3. Instalar via script (recomendado)

O script `install.sh` copia os arquivos, ajusta permissões e exibe os próximos passos.

```bash
# Dê permissão de execução
chmod +x install.sh

# Execute como root
sudo ./install.sh
```

**Saída esperada:**

```
→ Copiando módulo para /usr/share/zabbix/modules/zbx-block-user ...
→ Ajustando permissões ...

✔  Módulo instalado em: /usr/share/zabbix/modules/zbx-block-user

Próximos passos:
  1. Acesse o Zabbix: Administração > Geral > Módulos
  2. Clique em 'Verificar módulos ausentes'
  3. Habilite o módulo 'Block Local User'
  4. Navegue para Usuários > Usuários — o botão 'Bloquear' estará disponível
```

**Ajuste do usuário web (se necessário):**

Se o seu servidor web usa `www-data` (Debian/Ubuntu) em vez de `apache`, edite a variável no início do script antes de executar:

```bash
# Linha 11 do install.sh
ZABBIX_WEB_USER="www-data"
```

---

### 4. Instalação manual (alternativa)

Caso prefira não usar o script:

```bash
# Variáveis — ajuste conforme seu ambiente
MODULE_DEST="/usr/share/zabbix/modules/zbx-block-user"
WEB_USER="apache"   # ou www-data

# Copia os arquivos
cp -r /tmp/zbx-block-user "$MODULE_DEST"

# Ajusta dono
chown -R "$WEB_USER:$WEB_USER" "$MODULE_DEST"

# Ajusta permissões
find "$MODULE_DEST" -type f -exec chmod 644 {} \;
find "$MODULE_DEST" -type d -exec chmod 755 {} \;
```

Confirme que a estrutura está correta:

```bash
find /usr/share/zabbix/modules/zbx-block-user -type f | sort
```

Resultado esperado:

```
/usr/share/zabbix/modules/zbx-block-user/Module.php
/usr/share/zabbix/modules/zbx-block-user/README.md
/usr/share/zabbix/modules/zbx-block-user/actions/CControllerBlockUserBlock.php
/usr/share/zabbix/modules/zbx-block-user/assets/js/block_user.js
/usr/share/zabbix/modules/zbx-block-user/install.sh
/usr/share/zabbix/modules/zbx-block-user/layout.json
/usr/share/zabbix/modules/zbx-block-user/manifest.json
/usr/share/zabbix/modules/zbx-block-user/views/blockuser.inject.php
```

---

### 5. Habilitar no Zabbix

1. Acesse o Zabbix com uma conta **Super Admin**
2. Navegue até **Administração → Geral → Módulos**
3. Clique no botão **"Verificar módulos ausentes"** no canto superior direito
4. O módulo **"Block Local User"** aparecerá na lista com status `Desabilitado`
5. Clique no link do nome do módulo e depois em **"Habilitar"**, ou use o toggle diretamente na listagem

> Se o módulo não aparecer após clicar em "Verificar módulos ausentes", veja a seção [Solução de problemas](#solução-de-problemas).

---

## Verificação

Após habilitar, confirme que tudo está funcionando:

**1. Verifique o botão na interface:**

- Navegue até **Usuários → Usuários**
- Marque qualquer checkbox de usuário na tabela
- O botão **"Bloquear"** deve aparecer na barra inferior, ao lado do "Desbloquear"
- Com nenhum checkbox marcado, o botão deve estar desabilitado (cinza)

**2. Verifique o estado no banco após bloqueio:**

```sql
-- Execute no banco do Zabbix
SELECT userid, username, attempt_failed, attempt_clock, attempt_ip
FROM users
WHERE username = 'nome_do_usuario_bloqueado';
```

O campo `attempt_failed` deve ser igual ao valor configurado em **Administração → Autenticação → Tentativas de login**.

**3. Verifique os logs do servidor web (opcional):**

```bash
# Apache — AlmaLinux/RHEL
tail -f /var/log/httpd/error_log | grep -i zabbix

# Nginx
tail -f /var/log/nginx/error.log | grep -i zabbix
```

---

## Uso

1. Navegue até **Usuários → Usuários**
2. Marque o checkbox do(s) usuário(s) que deseja bloquear
3. Clique no botão **"Bloquear"** na barra inferior da tabela
4. Confirme a operação no diálogo de confirmação
5. Uma mensagem de sucesso é exibida e a lista é recarregada automaticamente

O usuário bloqueado tentará fazer login e receberá a mensagem padrão do Zabbix:

> *"Sua conta está bloqueada. Por favor, entre em contato com o administrador."*

Para desbloquear, use o botão nativo **"Desbloquear"** do Zabbix normalmente.

---

## Desinstalar

**1. Desabilitar no Zabbix:**

- **Administração → Geral → Módulos**
- Desabilite o módulo "Block Local User"

**2. Remover os arquivos:**

```bash
rm -rf /usr/share/zabbix/modules/zbx-block-user
```

**3. Verificar remoção:**

- Volte em **Administração → Geral → Módulos**
- Clique em "Verificar módulos ausentes"
- O módulo não deve mais aparecer

---

## Atualizar

```bash
# Baixe a nova versão
git pull  # ou baixe novamente via wget/scp

# Rode o install.sh — ele remove a versão anterior antes de copiar
chmod +x install.sh
sudo ./install.sh
```

Não é necessário desabilitar o módulo antes de atualizar. Após o install, recarregue a página do Zabbix.

---

## Solução de problemas

**Módulo não aparece após "Verificar módulos ausentes"**

Verifique se o `manifest.json` está acessível pelo usuário do servidor web:

```bash
sudo -u apache cat /usr/share/zabbix/modules/zbx-block-user/manifest.json
```

Se retornar "Permission denied", corrija as permissões:

```bash
chown -R apache:apache /usr/share/zabbix/modules/zbx-block-user
```

---

**Botão "Bloquear" não aparece na página de usuários**

Abra o console do navegador (F12) e verifique se há erros de carregamento do script:

```
Failed to load resource: modules/zbx-block-user/assets/js/block_user.js
```

Se sim, confirme que o arquivo existe e tem permissão de leitura:

```bash
ls -la /usr/share/zabbix/modules/zbx-block-user/assets/js/block_user.js
```

---

**Erro 403 ao chamar a action `blockuser.block`**

O usuário logado não tem perfil de Super Admin, ou a `role_rule` da action não está registrada. Confirme no banco:

```sql
SELECT * FROM role_rule
WHERE value_str LIKE '%blockuser%';
```

Se vazio, o Zabbix não mapeou a permissão automaticamente. Verifique se o módulo está habilitado e reinicie a sessão.

---

**Erro de sintaxe PHP ao habilitar o módulo**

Teste o PHP diretamente:

```bash
php -l /usr/share/zabbix/modules/zbx-block-user/Module.php
php -l /usr/share/zabbix/modules/zbx-block-user/actions/CControllerBlockUserBlock.php
```

Ambos devem retornar `No syntax errors detected`.

---

**Usuário não é bloqueado após clicar em "Bloquear"**

Verifique o valor de `login_attempts` no banco:

```sql
SELECT login_attempts FROM config LIMIT 1;
```

Se for `0` ou nulo, o módulo usa o fallback de `5`. Confirme também que o UPDATE está sendo executado consultando `attempt_failed` diretamente após a ação.

---

## Estrutura do módulo

```
zbx-block-user/
├── manifest.json
│   └── Declara o módulo, versão, namespace e a action blockuser.block
│
├── Module.php
│   └── Classe principal — hook onBeforeAction injeta o JS
│       somente quando a action ativa for user.list
│
├── install.sh
│   └── Script Bash de instalação — copia arquivos e ajusta permissões
│
├── layout.json
│   └── Define que a resposta da action é JSON puro (sem wrapper HTML)
│
├── actions/
│   └── CControllerBlockUserBlock.php
│       └── Controller da action blockuser.block
│           - Valida input (userids obrigatórios)
│           - Verifica permissão (CRoleHelper::UI_ADMINISTRATION_USERS)
│           - Impede bloqueio do próprio usuário logado
│           - Lê login_attempts da tabela config
│           - Executa UPDATE via DBexecute()
│           - Retorna JSON com resultado da operação
│
├── assets/js/
│   └── block_user.js
│       └── Script injetado na página user.list
│           - Localiza o botão nativo "Desbloquear" no DOM
│           - Insere o botão "Bloquear" imediatamente antes dele
│           - Sincroniza estado enabled/disabled via MutationObserver
│           - Abre diálogo de confirmação antes de executar
│           - Envia POST AJAX para blockuser.block
│           - Exibe feedback via sistema de notificações do Zabbix
│           - Recarrega a lista após operação bem-sucedida
│
└── views/
    └── blockuser.inject.php
        └── View auxiliar para referência futura
```

---

## Segurança

- **Escopo de permissão:** apenas usuários com perfil Super Admin podem executar a action `blockuser.block`. Qualquer outro perfil recebe HTTP 403.
- **Proteção self-lock:** o módulo rejeita qualquer tentativa de bloquear o próprio usuário da sessão ativa.
- **Sem exposição de credenciais:** o módulo não lida com senhas em nenhuma etapa. Opera apenas sobre o campo de controle de tentativas.
- **Reversível:** o bloqueio é revertido pelo botão nativo "Desbloquear" do Zabbix, sem necessidade de acesso direto ao banco.
- **Idempotente:** bloquear um usuário já bloqueado não causa erro — o módulo retorna um aviso informativo e ignora o registro.

---

## Autor

Rafael Leão — [@leaoereno](https://github.com/leaoereno)
