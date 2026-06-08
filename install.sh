#!/bin/bash
# zbx-block-user — install.sh
#
# Instala o módulo no diretório de módulos do Zabbix 7.0 (AlmaLinux / RHEL / Rocky)
# Ajuste ZABBIX_MODULES_DIR se o seu caminho for diferente.
#
# Uso:
#   chmod +x install.sh
#   sudo ./install.sh

set -e

MODULE_ID="zbx-block-user"
ZABBIX_MODULES_DIR="/usr/share/zabbix/modules"
ZABBIX_WEB_USER="apache"   # ou "nginx" dependendo do seu setup
MODULE_SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Validações ──────────────────────────────────────────────────────────────

if [ ! -d "$ZABBIX_MODULES_DIR" ]; then
    echo "[ERRO] Diretório de módulos não encontrado: $ZABBIX_MODULES_DIR"
    echo "       Ajuste a variável ZABBIX_MODULES_DIR neste script."
    exit 1
fi

if [ ! -f "$MODULE_SRC_DIR/manifest.json" ]; then
    echo "[ERRO] Rode o script a partir do diretório do módulo (onde está o manifest.json)."
    exit 1
fi

# ── Instalação ───────────────────────────────────────────────────────────────

DEST="$ZABBIX_MODULES_DIR/$MODULE_ID"

echo "→ Copiando módulo para $DEST ..."
rm -rf "$DEST"
cp -r "$MODULE_SRC_DIR" "$DEST"

echo "→ Ajustando permissões ..."
chown -R "$ZABBIX_WEB_USER:$ZABBIX_WEB_USER" "$DEST"
find "$DEST" -type f -exec chmod 644 {} \;
find "$DEST" -type d -exec chmod 755 {} \;

echo ""
echo "✔  Módulo instalado em: $DEST"
echo ""
echo "Próximos passos:"
echo "  1. Acesse o Zabbix: Administração > Geral > Módulos"
echo "  2. Clique em 'Verificar módulos ausentes'"
echo "  3. Habilite o módulo 'Block Local User'"
echo "  4. Navegue para Usuários > Usuários — o botão 'Bloquear' estará disponível"
echo ""
