#!/usr/bin/env bash
# =============================================================================
# EnergyManager — Raspberry Pi 5 Setup Script
# Zielsystem: Raspberry Pi OS (Bookworm, 64-bit) auf Raspberry Pi 5
# =============================================================================
set -euo pipefail

INSTALL_DIR="/opt/energiemanager"
SERVICE_USER="energiemanager"
REPO_URL="https://github.com/daTobi1/Energiemanager.git"

echo "============================================="
echo "  EnergyManager — Raspberry Pi 5 Setup"
echo "============================================="
echo ""

# --- Prüfe ob Root ---
if [ "$EUID" -ne 0 ]; then
    echo "Bitte als root ausfuehren: sudo bash setup.sh"
    exit 1
fi

# --- Prüfe Architektur ---
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ]; then
    echo "WARNUNG: Erwartet aarch64 (ARM 64-bit), gefunden: $ARCH"
    echo "Dieses Script ist fuer Raspberry Pi 5 mit 64-bit OS optimiert."
    read -p "Trotzdem fortfahren? (j/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Jj]$ ]] && exit 1
fi

echo "[1/7] System aktualisieren..."
apt-get update && apt-get upgrade -y

echo "[2/7] Abhaengigkeiten installieren..."
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    docker.io \
    docker-compose \
    mosquitto \
    mosquitto-clients \
    curl \
    htop \
    vim

# Docker ohne sudo
usermod -aG docker "$SUDO_USER" 2>/dev/null || true

echo "[3/7] Systembenutzer erstellen..."
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --create-home --shell /bin/bash "$SERVICE_USER"
    usermod -aG docker "$SERVICE_USER"
fi

echo "[4/7] Repository klonen..."
if [ -d "$INSTALL_DIR" ]; then
    echo "  Verzeichnis existiert bereits, aktualisiere..."
    cd "$INSTALL_DIR"
    git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

echo "[5/7] Umgebungsvariablen konfigurieren..."
if [ ! -f "$INSTALL_DIR/.env" ]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    # Generiere zufaelligen Secret Key
    SECRET=$(openssl rand -hex 32)
    sed -i "s/change-me-in-production/$SECRET/g" "$INSTALL_DIR/.env"
    echo "  .env erstellt — bitte API-Keys in $INSTALL_DIR/.env eintragen!"
fi

echo "[6/7] Docker-Container starten..."
cd "$INSTALL_DIR"
docker-compose up -d

echo "[7/7] Systemd-Service installieren..."
cp "$INSTALL_DIR/deploy/raspberry-pi/energiemanager.service" \
   /etc/systemd/system/energiemanager.service
systemctl daemon-reload
systemctl enable energiemanager.service
systemctl start energiemanager.service

echo ""
echo "============================================="
echo "  Setup abgeschlossen!"
echo "============================================="
echo ""
echo "  API:     http://$(hostname -I | awk '{print $1}'):8000"
echo "  Grafana: http://$(hostname -I | awk '{print $1}'):3000"
echo "  Docs:    http://$(hostname -I | awk '{print $1}'):8000/docs"
echo ""
echo "  Status:  sudo systemctl status energiemanager"
echo "  Logs:    sudo journalctl -u energiemanager -f"
echo ""
echo "  WICHTIG: API-Keys in $INSTALL_DIR/.env eintragen!"
echo "============================================="
