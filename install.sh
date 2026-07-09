#!/bin/bash
# zbx-block-user — install.sh (v1.0.1)
#
# Instala o módulo no diretório de módulos do Zabbix 7.0.
# Compatível com: AlmaLinux / RHEL / Rocky (apache) e Debian/Ubuntu/Docker (www-data)
#
# Uso:
#   chmod +x install.sh
#   sudo ./install.sh

set -e

MODULE_ID="zbx-block-user"
ZABBIX_MODULES_DIR="/usr/share/zabbix/modules"
MODULE_SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Detecta automaticamente o usuário do servidor web ───────────────────────
detect_web_user() {
    # Docker com imagem oficial Zabbix usa www-data
    if id "www-data" &>/dev/null && ps aux 2>/dev/null | grep -q -E 'apache2|nginx|php-fpm' ; then
        echo "www-data"
        return
    fi
    # AlmaLinux / RHEL / Rocky
    if id "apache" &>/dev/null; then
        echo "apache"
        return
    fi
    # Debian / Ubuntu / Docker (Zabbix official images)
    if id "www-data" &>/dev/null; then
        echo "www-data"
        return
    fi
    # Nginx standalone
    if id "nginx" &>/dev/null; then
        echo "nginx"
        return
    fi
    echo "www-data"  # fallback seguro para Docker
}

ZABBIX_WEB_USER="${ZABBIX_WEB_USER:-$(detect_web_user)}"
echo "→ Usuário do servidor web detectado: $ZABBIX_WEB_USER"

# ── Validações ───────────────────────────────────────────────────────────────

if [ ! -d "$ZABBIX_MODULES_DIR" ]; then
    echo "→ Diretório $ZABBIX_MODULES_DIR não existe. Criando..."
    mkdir -p "$ZABBIX_MODULES_DIR"
fi

if [ ! -f "$MODULE_SRC_DIR/manifest.json" ]; then
    echo "[ERRO] Rode o script a partir do diretório do módulo (onde está o manifest.json)."
    exit 1
fi

# ── Instalação ───────────────────────────────────────────────────────────────

DEST="$ZABBIX_MODULES_DIR/$MODULE_ID"

echo "→ Copiando módulo para $DEST ..."
rm -rf "$DEST"
mkdir -p "$DEST"

# Copia apenas os arquivos necessários (exclui .git, install.sh, README.md, *.zip)
rsync -a --exclude='.git' \
         --exclude='install.sh' \
         --exclude='*.zip' \
         --exclude='README.md' \
         --exclude='block_user.js' \
         "$MODULE_SRC_DIR/" "$DEST/" 2>/dev/null || \
cp -r "$MODULE_SRC_DIR/." "$DEST/"

# Remove arquivos desnecessários se rsync não estava disponível
rm -rf "$DEST/.git" "$DEST"/*.zip "$DEST/block_user.js" 2>/dev/null || true

echo "→ Ajustando permissões para $ZABBIX_WEB_USER ..."
chown -R "$ZABBIX_WEB_USER:$ZABBIX_WEB_USER" "$DEST"
find "$DEST" -type f -exec chmod 644 {} \;
find "$DEST" -type d -exec chmod 755 {} \;

# ── Limpa OPcache se disponível ──────────────────────────────────────────────
if command -v php &>/dev/null; then
    php -r "if (function_exists('opcache_reset')) { opcache_reset(); echo '→ OPcache limpo.' . PHP_EOL; }" 2>/dev/null || true
fi

echo ""
echo "✔  Módulo instalado em: $DEST"
echo ""
echo "Próximos passos:"
echo "  1. Acesse o Zabbix: Administração > Geral > Módulos"
echo "  2. Clique em 'Verificar módulos ausentes'"
echo "  3. Habilite o módulo 'Block Local User'"
echo "  4. Navegue para Usuários > Usuários — o botão 'Bloquear' estará disponível"
echo ""
echo "Em ambientes Docker, se o módulo não aparecer:"
echo "  docker exec <container_zabbix_web> chown -R www-data:www-data /usr/share/zabbix/modules/$MODULE_ID"
echo ""
