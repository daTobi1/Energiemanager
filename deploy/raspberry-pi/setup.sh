#!/usr/bin/env bash
# =============================================================================
# VERALTET — Bitte den Haupt-Installer verwenden:
#
#   curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/install.sh | bash
#
# oder lokal:
#
#   bash install.sh
# =============================================================================
echo ""
echo "Dieses Script ist veraltet."
echo "Bitte den Haupt-Installer verwenden:"
echo ""
echo "  curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/install.sh | bash"
echo ""

# Versuche automatisch den Haupt-Installer auszuführen
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_INSTALLER="$SCRIPT_DIR/../../install.sh"

if [ -f "$MAIN_INSTALLER" ]; then
    read -rp "Haupt-Installer jetzt ausführen? [J/n] " choice
    case "${choice,,}" in
        n|nein|no) exit 0 ;;
        *) exec bash "$MAIN_INSTALLER" ;;
    esac
fi
