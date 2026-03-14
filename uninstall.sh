#!/usr/bin/env bash
# ============================================================
# EnergyManager – Deinstallation
# Verwendung:
#   curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/uninstall.sh | bash
# oder lokal:
#   bash uninstall.sh
# ============================================================
set -euo pipefail

SERVICE_NAME="energiemanager"
DEFAULT_DIR="/home/${EM_USER:-energiemanager}/energiemanager"
INSTALL_DIR="${EM_DIR:-$DEFAULT_DIR}"

# Versuche Installationsverzeichnis aus Service-Datei zu lesen
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
  DETECTED_DIR=$(grep -oP 'WorkingDirectory=\K[^ ]+' /etc/systemd/system/${SERVICE_NAME}.service 2>/dev/null | head -1 | sed 's|/backend$||')
  if [ -n "$DETECTED_DIR" ] && [ -d "$DETECTED_DIR" ]; then
    INSTALL_DIR="$DETECTED_DIR"
  fi
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
info() { echo -e "\033[0;34m[INFO]${NC}  $*"; }

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

printf "Fortfahren? [j/N] "
read -r confirm <&3 2>/dev/null || confirm=""
[[ "$confirm" =~ ^[jJyY]$ ]] || { echo "Abgebrochen."; exit 0; }

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
  echo ""
  echo -e "${YELLOW}Docker-Container und Volumes:${NC}"
  echo "  Dies umfasst die Datenbank (TimescaleDB), Redis und Grafana."
  echo "  Alle gespeicherten Messdaten gehen dabei verloren!"
  echo ""
  printf "Docker-Container und Volumes löschen? [j/N] "
  read -r confirm_docker <&3 2>/dev/null || confirm_docker=""
  if [[ "$confirm_docker" =~ ^[jJyY]$ ]]; then
    cd "$INSTALL_DIR"
    # Compose-Befehl bestimmen
    if docker compose version >/dev/null 2>&1; then
      docker compose down -v 2>/dev/null || true
    elif command -v docker-compose >/dev/null 2>&1; then
      docker-compose down -v 2>/dev/null || true
    fi
    ok "Docker-Container und Volumes entfernt"
  else
    # Nur Container stoppen, Volumes behalten
    if [ -d "$INSTALL_DIR" ]; then
      cd "$INSTALL_DIR"
      if docker compose version >/dev/null 2>&1; then
        docker compose down 2>/dev/null || true
      elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose down 2>/dev/null || true
      fi
    fi
    warn "Container gestoppt, Volumes beibehalten (Daten erhalten)"
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
  echo ""
  echo -e "  Verzeichnis: ${BOLD}${INSTALL_DIR}${NC}"
  echo "  Enthält: Quellcode, Python-venv, Frontend-Build, .env"
  echo ""
  printf "Verzeichnis vollständig löschen? [j/N] "
  read -r confirm_dir <&3 2>/dev/null || confirm_dir=""
  if [[ "$confirm_dir" =~ ^[jJyY]$ ]]; then
    sudo rm -rf "$INSTALL_DIR"
    ok "Verzeichnis entfernt"
  else
    warn "Verzeichnis beibehalten: ${INSTALL_DIR}"
  fi
fi

# ── Benutzer ────────────────────────────────────────────────
SERVICE_USER="${EM_USER:-energiemanager}"
if id "$SERVICE_USER" &>/dev/null && [ "$SERVICE_USER" != "pi" ] && [ "$SERVICE_USER" != "root" ]; then
  echo ""
  printf "System-Benutzer '${SERVICE_USER}' entfernen? [j/N] "
  read -r confirm_user <&3 2>/dev/null || confirm_user=""
  if [[ "$confirm_user" =~ ^[jJyY]$ ]]; then
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
