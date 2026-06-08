# zbx-block-user

Modulo para **Zabbix 7.0 LTS** que adiciona um botao **"Bloquear"** na listagem de usuarios
(`Usuarios > Usuarios`), permitindo bloquear imediatamente contas locais sem workarounds manuais.

---

## Sumario

- [Contexto e problema](#contexto-e-problema)
- [Como funciona](#como-funciona)
- [Requisitos](#requisitos)
- [Instalacao](#instalacao)
  - [1. Obter os arquivos](#1-obter-os-arquivos)
  - [2. Criar o diretorio de modulos](#2-criar-o-diretorio-de-modulos-se-nao-existir)
  - [3. Instalar via script](#3-instalar-via-script-recomendado)
  - [4. Instalacao manual](#4-instalacao-manual-alternativa)
  - [5. Habilitar no Zabbix](#5-habilitar-no-zabbix)
- [Verificacao](#verificacao)
- [Uso](#uso)
- [Desinstalar](#desinstalar)
- [Atualizar](#atualizar)
- [Solucao de problemas](#solucao-de-problemas)
- [Estrutura do modulo](#estrutura-do-modulo)
- [Seguranca](#seguranca)

---

## Contexto e problema

Em ambientes que transitam de autenticacao local para LDAP com provisionamento JIT (ex: Authentik
como broker OIDC), e comum que um usuario ja tenha uma conta local no Zabbix antes de ser
provisionado via LDAP. Apos o provisionamento, o time de governanca de acesso precisa bloquear a
conta local original para evitar duplo acesso.

O Zabbix nao oferece um botao nativo de **bloqueio** -- apenas de desbloqueio. A alternativa manual
de forcara logins com senha errada ate atingir o limite de tentativas e inaceitavel em qualquer
ambiente com rastreabilidade de seguranca.

Este modulo resolve isso com uma unica acao controlada, auditavel e reversivel.

---

## Como funciona

O Zabbix considera um usuario bloqueado quando o campo `users.attempt_failed` e maior ou igual ao
limite configurado em **Administracao > Autenticacao > Tentativas de login** (padrao: 5).

O modulo le esse valor configurado e executa diretamente:

```sql
UPDATE users
SET attempt_failed = <login_attempts>,
    attempt_clock  = <unix_timestamp_atual>,
    attempt_ip     = '127.0.0.1'
WHERE userid = <userid>
```

O efeito e identico ao bloqueio por excesso de tentativas -- sem brute-force, sem logs de falha
de autenticacao spurios.

Para reverter, o botao nativo **"Desbloquear"** do Zabbix zera o `attempt_failed`, funcionando
normalmente.

---

## Requisitos

| Componente            | Versao minima                                    |
|-----------------------|--------------------------------------------------|
| Zabbix Server + Frontend | 7.0 LTS                                       |
| PHP                   | 8.0+                                             |
| Banco de dados        | MySQL 8.0+ / MariaDB 10.5+ / PostgreSQL 13+      |
| Perfil no Zabbix      | Super Admin                                      |
| Sistema operacional   | AlmaLinux 8/9, RHEL 8/9, Rocky Linux, Debian/Ubuntu |

> O modulo atua exclusivamente no frontend PHP. Nao requer alteracoes no Zabbix Server ou Agent.

---

## Instalacao

### 1. Obter os arquivos

**Via Git (recomendado):**

```bash
git clone https://github.com/leaoereno/zbx-user-block.git
cd zbx-user-block
```

**Via SCP (para transferir ao servidor diretamente):**

```bash
# Na maquina local, apos baixar
scp -r zbx-user-block/ root@<ip-do-servidor>:/tmp/
ssh root@<ip-do-servidor>
cd /tmp/zbx-user-block
```

---

### 2. Criar o diretorio de modulos (se nao existir)

O Zabbix 7.0 espera modulos em `/usr/share/zabbix/modules/`. Verifique se existe:

```bash
ls /usr/share/zabbix/modules/
```

Se nao existir, crie:

```bash
mkdir -p /usr/share/zabbix/modules
```

Confirme qual usuario roda o seu servidor web:

```bash
# Apache (AlmaLinux/RHEL/Rocky)
ps aux | grep httpd | grep -v grep | awk '{print $1}' | head -1

# Nginx
ps aux | grep nginx | grep -v grep | awk '{print $1}' | head -1
```

O usuario normalmente e `apache` (RHEL/AlmaLinux) ou `www-data` (Debian/Ubuntu).

---

### 3. Instalar via script (recomendado)

O script `install.sh` copia os arquivos, ajusta permissoes e exibe os proximos passos.

```bash
chmod +x install.sh
sudo ./install.sh
```

**Saida esperada:**

```
-> Copiando modulo para /usr/share/zabbix/modules/zbx-user-block ...
-> Ajustando permissoes ...

OK  Modulo instalado em: /usr/share/zabbix/modules/zbx-user-block

Proximos passos:
  1. Acesse o Zabbix: Administracao > Geral > Modulos
  2. Clique em 'Verificar modulos ausentes'
  3. Habilite o modulo 'Block Local User'
  4. Navegue para Usuarios > Usuarios - o botao 'Bloquear' estara disponivel
```

**Ajuste do usuario web (se necessario):**

Se o seu servidor web usa `www-data` (Debian/Ubuntu) em vez de `apache`, edite a variavel no
inicio do script antes de executar:

```bash
# Linha 11 do install.sh
ZABBIX_WEB_USER="www-data"
```

---

### 4. Instalacao manual (alternativa)

Caso prefira nao usar o script:

```bash
MODULE_DEST="/usr/share/zabbix/modules/zbx-user-block"
WEB_USER="apache"   # ou www-data

cp -r /tmp/zbx-user-block "$MODULE_DEST"
chown -R "$WEB_USER:$WEB_USER" "$MODULE_DEST"
find "$MODULE_DEST" -type f -exec chmod 644 {} \;
find "$MODULE_DEST" -type d -exec chmod 755 {} \;
```

Confirme que a estrutura esta correta:

```bash
find /usr/share/zabbix/modules/zbx-user-block -type f | sort
```

Resultado esperado:

```
/usr/share/zabbix/modules/zbx-user-block/Module.php
/usr/share/zabbix/modules/zbx-user-block/README.md
/usr/share/zabbix/modules/zbx-user-block/actions/CControllerBlockUserBlock.php
/usr/share/zabbix/modules/zbx-user-block/assets/js/block_user.js
/usr/share/zabbix/modules/zbx-user-block/install.sh
/usr/share/zabbix/modules/zbx-user-block/manifest.json
/usr/share/zabbix/modules/zbx-user-block/views/user.list.php
```

---

### 5. Habilitar no Zabbix

1. Acesse o Zabbix com uma conta **Super Admin**
2. Navegue ate **Administracao > Geral > Modulos**
3. Clique no botao **"Verificar modulos ausentes"** no canto superior direito
4. O modulo **"Block Local User"** aparecera na lista com status `Desabilitado`
5. Clique no toggle para habilitar

> Se o modulo nao aparecer apos clicar em "Verificar modulos ausentes", veja a secao
> [Solucao de problemas](#solucao-de-problemas).

---

## Verificacao

Apos habilitar, confirme que tudo esta funcionando:

**1. Verifique o botao na interface:**

- Navegue ate **Usuarios > Usuarios**
- Marque qualquer checkbox de usuario na tabela
- O botao **"Bloquear"** deve aparecer na barra inferior, ao lado do "Desbloquear"
- Com nenhum checkbox marcado, o botao deve estar desabilitado (cinza)

**2. Verifique o estado no banco apos bloqueio:**

```sql
SELECT userid, username, attempt_failed, attempt_clock, attempt_ip
FROM users
WHERE username = 'nome_do_usuario_bloqueado';
```

O campo `attempt_failed` deve ser igual ao valor configurado em
**Administracao > Autenticacao > Tentativas de login**.

**3. Verifique os logs do servidor web (opcional):**

```bash
# Apache - AlmaLinux/RHEL
tail -f /var/log/httpd/error_log

# Nginx
tail -f /var/log/nginx/error.log
```

---

## Uso

1. Navegue ate **Usuarios > Usuarios**
2. Marque o checkbox do(s) usuario(s) que deseja bloquear
3. Clique no botao **"Bloquear"** na barra inferior da tabela
4. Confirme a operacao no dialogo de confirmacao
5. Uma mensagem de sucesso e exibida e a lista e recarregada automaticamente

O usuario bloqueado tentara fazer login e recebera a mensagem padrao do Zabbix:

> "Sua conta esta bloqueada. Por favor, entre em contato com o administrador."

Para desbloquear, use o botao nativo **"Desbloquear"** do Zabbix normalmente.

---

## Desinstalar

**1. Desabilitar no Zabbix:**

- **Administracao > Geral > Modulos**
- Desabilite o modulo "Block Local User"

**2. Remover os arquivos:**

```bash
rm -rf /usr/share/zabbix/modules/zbx-user-block
```

**3. Verificar remocao:**

- Volte em **Administracao > Geral > Modulos**
- Clique em "Verificar modulos ausentes"
- O modulo nao deve mais aparecer

---

## Atualizar

```bash
cd /usr/share/zabbix/modules/zbx-user-block
git pull origin main
chown -R apache:apache .
systemctl restart php-fpm
```

Nao e necessario desabilitar o modulo antes de atualizar. Apos o pull, recarregue a pagina
do Zabbix.

---

## Solucao de problemas

**Modulo nao aparece apos "Verificar modulos ausentes"**

Verifique se o `manifest.json` esta acessivel pelo usuario do servidor web:

```bash
sudo -u apache cat /usr/share/zabbix/modules/zbx-user-block/manifest.json
```

Se retornar "Permission denied", corrija as permissoes:

```bash
chown -R apache:apache /usr/share/zabbix/modules/zbx-user-block
```

---

**Botao "Bloquear" nao aparece na pagina de usuarios**

Abra o console do navegador (F12) e verifique se ha erros de carregamento do script:

```
Failed to load resource: modules/zbx-user-block/assets/js/block_user.js
```

Se sim, confirme que o arquivo existe e tem permissao de leitura:

```bash
ls -la /usr/share/zabbix/modules/zbx-user-block/assets/js/block_user.js
```

---

**Zabbix nao carrega apos habilitar o modulo**

Verifique o log do Apache imediatamente:

```bash
tail -20 /var/log/httpd/error_log | grep -i "fatal\|error"
```

Desabilite o modulo via banco para recuperar o acesso:

```bash
mysql -u root zabbix -e "UPDATE module SET status=0 WHERE relative_path='modules/zbx-user-block';"
systemctl restart php-fpm
```

---

**Erro de sintaxe PHP ao habilitar o modulo**

Teste o PHP diretamente:

```bash
php -l /usr/share/zabbix/modules/zbx-user-block/Module.php
php -l /usr/share/zabbix/modules/zbx-user-block/actions/CControllerBlockUserBlock.php
```

Ambos devem retornar `No syntax errors detected`.

---

**Usuario nao e bloqueado apos clicar em "Bloquear"**

Verifique o valor de `login_attempts` no banco:

```sql
SELECT login_attempts FROM config LIMIT 1;
```

Se for `0` ou nulo, o modulo usa o fallback de `5`. Confirme tambem que o UPDATE esta sendo
executado consultando `attempt_failed` diretamente apos a acao.

---

## Estrutura do modulo

```
zbx-user-block/
|
|-- manifest.json
|   Declara o modulo, versao, namespace e a action blockuser.block
|
|-- Module.php
|   Classe principal. Registra o diretorio de views via CView::registerDirectory()
|
|-- install.sh
|   Script Bash de instalacao -- copia arquivos e ajusta permissoes
|
|-- actions/
|   `-- CControllerBlockUserBlock.php
|       Controller da action blockuser.block
|       - Valida input (userids obrigatorios)
|       - Verifica permissao (CRoleHelper::UI_ADMINISTRATION_USERS)
|       - Impede bloqueio do proprio usuario logado
|       - Le login_attempts da tabela config
|       - Executa UPDATE via DBexecute()
|       - Retorna JSON com resultado da operacao
|
|-- assets/js/
|   `-- block_user.js
|       Script carregado na pagina user.list
|       - Localiza o botao nativo "Desbloquear" no DOM
|       - Insere o botao "Bloquear" imediatamente antes dele
|       - Sincroniza estado enabled/disabled via MutationObserver
|       - Abre dialogo de confirmacao antes de executar
|       - Envia POST AJAX para blockuser.block
|       - Exibe feedback via sistema de notificacoes do Zabbix
|       - Recarrega a lista apos operacao bem-sucedida
|
`-- views/
    `-- user.list.php
        View parcial carregada automaticamente pelo Zabbix quando
        action=user.list. Injeta o block_user.js na pagina.
```

---

## Seguranca

- **Escopo de permissao:** apenas usuarios com perfil Super Admin podem executar a action
  `blockuser.block`. Qualquer outro perfil recebe HTTP 403.
- **Protecao self-lock:** o modulo rejeita qualquer tentativa de bloquear o proprio usuario
  da sessao ativa.
- **Sem exposicao de credenciais:** o modulo nao lida com senhas em nenhuma etapa. Opera
  apenas sobre o campo de controle de tentativas.
- **Reversivel:** o bloqueio e revertido pelo botao nativo "Desbloquear" do Zabbix, sem
  necessidade de acesso direto ao banco.
- **Idempotente:** bloquear um usuario ja bloqueado nao causa erro -- o modulo retorna um
  aviso informativo e ignora o registro.

---

## Autor

Rafael Leao -- [@leaoereno](https://github.com/leaoereno)
