#!/usr/bin/env bash
# ============================================================
# EnergyManager – Deinstallation
# Verwendung:
#   sudo bash uninstall.sh          # interaktiv mit Rückfragen
#   sudo bash uninstall.sh --yes    # alles entfernen ohne Rückfragen
# oder remote:
#   curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/uninstall.sh | sudo bash -s -- --yes
# ============================================================
set -uo pipefail

main() {

SERVICE_NAME="energiemanager"
DEFAULT_DIR="/home/${EM_USER:-energiemanager}/energiemanager"
INSTALL_DIR="${EM_DIR:-$DEFAULT_DIR}"

# --yes Flag prüfen
AUTO_YES=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y) AUTO_YES=true ;;
  esac
done

# Versuche Installationsverzeichnis aus Service-Datei zu lesen
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
  DETECTED_DIR=$(grep -oP 'WorkingDirectory=\K[^ ]+' /etc/systemd/system/${SERVICE_NAME}.service 2>/dev/null | head -1 | sed 's|/backend$||')
  if [ -n "${DETECTED_DIR:-}" ] && [ -d "$DETECTED_DIR" ]; then
    INSTALL_DIR="$DETECTED_DIR"
  fi
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
info() { echo -e "\033[0;34m[INFO]${NC}  $*"; }

# Bestätigungsfunktion (respektiert --yes)
confirm() {
  if [ "$AUTO_YES" = true ]; then
    return 0
  fi
  local prompt="$1"
  printf "%s [j/N] " "$prompt"
  local answer=""
  read -r answer <&3 2>/dev/null || answer=""
  [[ "$answer" =~ ^[jJyY]$ ]]
}

echo ""
echo "============================================================"
echo -e "  ${BOLD}EnergyManager – Deinstallation${NC}"
echo "============================================================"
echo ""
echo -e "${YELLOW}Folgendes wird entfernt:${NC}"
echo "  - systemd Services '${SERVICE_NAME}' und '${SERVICE_NAME}-web'"
echo "  - Docker-Container (TimescaleDB, Redis, Grafana)"
echo "  - Installationsverzeichnis: ${INSTALL_DIR}"
echo "  - sudoers-Regel: /etc/sudoers.d/energiemanager"
echo ""

# Terminal-Eingabe vorbereiten (funktioniert auch bei curl | bash)
exec 3</dev/tty 2>/dev/null || exec 3</dev/null

if ! confirm "Fortfahren?"; then
  echo "Abgebrochen."
  exit 0
fi

# ── Services stoppen und entfernen ──────────────────────────
for svc in "${SERVICE_NAME}" "${SERVICE_NAME}-web"; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    sudo systemctl stop "$svc"
    ok "Service '$svc' gestoppt"
  fi

  if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
    sudo systemctl disable "$svc" --quiet
    ok "Service '$svc' deaktiviert"
  fi

  SERVICE_FILE="/etc/systemd/system/${svc}.service"
  if [ -f "$SERVICE_FILE" ]; then
    sudo rm "$SERVICE_FILE"
    ok "Service-Datei '$svc' entfernt"
  fi
done

sudo systemctl daemon-reload

# ── Docker-Container ────────────────────────────────────────
if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
  # Compose-Befehl bestimmen
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  else
    COMPOSE_CMD=""
  fi

  if [ -n "$COMPOSE_CMD" ]; then
    if confirm "Docker-Container und Volumes löschen? (Messdaten gehen verloren!)"; then
      cd "$INSTALL_DIR"
      $COMPOSE_CMD down -v 2>/dev/null || true
      ok "Docker-Container und Volumes entfernt"
    else
      cd "$INSTALL_DIR"
      $COMPOSE_CMD down 2>/dev/null || true
      warn "Container gestoppt, Volumes beibehalten (Daten erhalten)"
    fi
  fi
fi

# ── sudoers-Regel entfernen ─────────────────────────────────
SUDOERS_FILE="/etc/sudoers.d/energiemanager"
if [ -f "$SUDOERS_FILE" ]; then
  sudo rm "$SUDOERS_FILE"
  ok "sudoers-Regel entfernt"
fi

# ── Installationsverzeichnis ────────────────────────────────
if [ -d "$INSTALL_DIR" ]; then
  if confirm "Verzeichnis ${INSTALL_DIR} vollständig löschen?"; then
    sudo rm -rf "$INSTALL_DIR"
    ok "Verzeichnis entfernt"
  else
    warn "Verzeichnis beibehalten: ${INSTALL_DIR}"
  fi
fi

# ── Benutzer ────────────────────────────────────────────────
SERVICE_USER="${EM_USER:-energiemanager}"
if id "$SERVICE_USER" &>/dev/null && [ "$SERVICE_USER" != "pi" ] && [ "$SERVICE_USER" != "root" ]; then
  if confirm "System-Benutzer '${SERVICE_USER}' entfernen?"; then
    sudo userdel -r "$SERVICE_USER" 2>/dev/null || sudo userdel "$SERVICE_USER" 2>/dev/null || true
    ok "Benutzer '$SERVICE_USER' entfernt"
  else
    warn "Benutzer '$SERVICE_USER' beibehalten"
  fi
fi

echo ""
echo "============================================================"
echo -e "  ${GREEN}${BOLD}Deinstallation abgeschlossen.${NC}"
echo ""
echo "  Docker, Node.js und Python wurden NICHT entfernt."
echo "  Falls gewünscht: sudo apt remove docker-ce nodejs python3"
echo "============================================================"
echo ""

} # Ende main()

main "$@"
