#!/usr/bin/env bash
# ============================================================
# EnergyManager – Installer
# Verwendung (frischer Pi – kein git/curl nötig):
#   sudo apt-get update -qq && sudo apt-get install -y curl -qq && curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/install.sh | sudo bash
# Non-interaktiv (keine Rückfragen):
#   curl -fsSL ... | sudo bash -s -- --yes
# oder lokal:
#   sudo bash install.sh [--yes]
#
# Voraussetzung: Debian 12 Bookworm / Raspberry Pi OS Bookworm (64-bit)
# ============================================================
set -uo pipefail
# Kein "set -e" — bei komplexen Installationen verursacht es
# mysteriöse Abbrüche. Kritische Fehler werden explizit durch
# die error()-Funktion behandelt.

# Gesamtes Script in main() wrappen, damit bash alles einliest
# BEVOR es ausgeführt wird. Verhindert, dass Befehle wie
# "docker compose" bei "curl | bash" den Rest des Scripts über
# stdin auffressen.
main() {

REPO_URL="https://github.com/daTobi1/Energiemanager.git"
SERVICE_NAME="energiemanager"
BACKEND_PORT="${EM_BACKEND_PORT:-8000}"
FRONTEND_PORT="${EM_FRONTEND_PORT:-8080}"
GRAFANA_PORT="${EM_GRAFANA_PORT:-3001}"
DEFAULT_USER="energiemanager"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
step()    { echo -e "\n${BOLD}$*${NC}"; }
error()   { echo -e "${RED}[FEHLER]${NC} $*"; exit 1; }

echo ""
echo "============================================================"
echo -e "  ${BOLD}EnergyManager – Installation${NC}"
echo -e "  Intelligentes Energiemanagementsystem"
echo "============================================================"
echo ""

# --yes Flag prüfen (überspringt alle interaktiven Abfragen)
AUTO_YES=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y) AUTO_YES=true ;;
  esac
done

# ── Terminal-Eingabe vorbereiten (funktioniert auch bei curl | bash) ──
# /dev/tty existiert auf manchen Systemen, kann aber ohne Terminal
# nicht geöffnet werden → Subshell-Test statt Existenzprüfung
if (exec 3</dev/tty) 2>/dev/null; then
  exec 3</dev/tty
else
  exec 3</dev/null
fi

# ── Root-Rechte prüfen ──────────────────────────────────────
if ! sudo -n true 2>/dev/null; then
  info "sudo-Passwort wird für Systeminstallationen benötigt."
fi

# ── Benutzer abfragen ────────────────────────────────────────
if [ -n "${EM_USER:-}" ]; then
  SERVICE_USER="$EM_USER"
elif [ "$AUTO_YES" = true ]; then
  SERVICE_USER="$DEFAULT_USER"
else
  echo -e "  Unter welchem Benutzer soll der Service laufen?"
  echo -e "  Standard: ${GREEN}${DEFAULT_USER}${NC}"
  echo ""
  KEYPRESS=false
  for i in $(seq 30 -1 1); do
    printf "\r  Drücke eine Taste um den Benutzer einzugeben (automatisch ${GREEN}${DEFAULT_USER}${NC} in %2ds) " "$i"
    if read -rn1 -t1 _ <&3 2>/dev/null; then
      KEYPRESS=true
      break
    fi
  done
  echo ""
  INPUT_USER=""
  if [ "$KEYPRESS" = true ]; then
    printf "  Benutzer: "
    read -r INPUT_USER <&3 2>/dev/null || true
  fi
  SERVICE_USER="${INPUT_USER:-$DEFAULT_USER}"
fi

# Benutzer erstellen falls nötig
if ! id "$SERVICE_USER" &>/dev/null; then
  info "Benutzer '$SERVICE_USER' existiert noch nicht – wird angelegt..."
  sudo useradd -m -s /bin/bash "$SERVICE_USER"
  ok "Benutzer '$SERVICE_USER' angelegt (Home: /home/${SERVICE_USER})"
fi

INSTALL_DIR="${EM_DIR:-/home/${SERVICE_USER}/energiemanager}"

echo ""
echo "  Zielverzeichnis : $INSTALL_DIR"
echo "  Backend-Port    : $BACKEND_PORT"
echo "  Frontend-Port   : $FRONTEND_PORT"
echo "  Grafana-Port    : $GRAFANA_PORT"
echo "  Benutzer        : $SERVICE_USER"
echo "============================================================"
echo ""

# ── Architektur prüfen ──────────────────────────────────────
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "x86_64" ]; then
  warn "Unbekannte Architektur: $ARCH"
  warn "Getestet auf aarch64 (Raspberry Pi 5) und x86_64."
fi

# ── 0/9 Bootstrap (git & curl sicherstellen) ─────────────────
# Wird VOR allen anderen Schritten ausgeführt, damit das Script
# auch per "wget ... | bash" auf einem frischen Pi funktioniert.
if ! command -v apt-get >/dev/null 2>&1; then
  error "apt-get nicht gefunden – dieses Script benötigt Debian/Raspberry Pi OS."
fi

for boot_pkg in git curl; do
  if ! command -v "$boot_pkg" >/dev/null 2>&1; then
    echo -e "${BLUE}[INFO]${NC}  $boot_pkg nicht gefunden – installiere..."
    sudo apt-get update -qq
    sudo apt-get install -y "$boot_pkg" -qq
  fi
done

# ── 1/9 Basiswerkzeuge ──────────────────────────────────────
step "1/9  Basiswerkzeuge prüfen und installieren"

sudo apt-get update -qq

for pkg in curl git ca-certificates gnupg lsb-release openssl; do
  if ! dpkg -s "$pkg" &>/dev/null; then
    info "Installiere $pkg..."
    sudo apt-get install -y "$pkg" -qq
  fi
done
ok "Basiswerkzeuge vorhanden"

# ── 2/9 Docker ──────────────────────────────────────────────
step "2/9  Docker prüfen und installieren"

if command -v docker >/dev/null 2>&1; then
  DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  ok "Docker $DOCKER_VERSION bereits installiert"
else
  info "Docker wird installiert (kann etwas dauern)..."
  curl -fsSL https://get.docker.com | sudo bash
  ok "Docker installiert"
fi

# Docker Compose (v2 Plugin) prüfen
if docker compose version >/dev/null 2>&1; then
  ok "Docker Compose Plugin vorhanden"
elif command -v docker-compose >/dev/null 2>&1; then
  ok "Docker Compose (standalone) vorhanden"
  # Alias erstellen
  COMPOSE_CMD="docker-compose"
else
  info "Docker Compose Plugin installieren..."
  sudo apt-get install -y docker-compose-plugin -qq 2>/dev/null || \
    sudo apt-get install -y docker-compose -qq 2>/dev/null || \
    error "Docker Compose konnte nicht installiert werden."
  ok "Docker Compose installiert"
fi

# Compose-Befehl bestimmen
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

# Benutzer zur docker-Gruppe hinzufügen
sudo usermod -aG docker "$SERVICE_USER" 2>/dev/null || true
# Auch den aktuellen Benutzer (falls nicht Service-User)
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "$SERVICE_USER" ]; then
  sudo usermod -aG docker "$SUDO_USER" 2>/dev/null || true
fi

sudo systemctl enable docker.service --quiet 2>/dev/null || true
sudo systemctl start docker.service 2>/dev/null || true
ok "Docker-Dienst aktiv, Benutzer '$SERVICE_USER' in Gruppe 'docker'"

# ── 3/9 Node.js ─────────────────────────────────────────────
step "3/9  Node.js prüfen und installieren"

NODE_MIN_VERSION=18
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node -v | grep -oP '\d+' | head -1)
  if [ "$NODE_VERSION" -ge "$NODE_MIN_VERSION" ]; then
    ok "Node.js v$(node -v | tr -d 'v') – OK"
  else
    warn "Node.js $(node -v) ist zu alt (mind. v${NODE_MIN_VERSION} nötig)"
    info "Aktualisiere Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs -qq
    ok "Node.js v$(node -v | tr -d 'v') installiert"
  fi
else
  info "Node.js nicht gefunden – installiere..."
  # Versuche zuerst aus Bookworm-Repos (Node 18)
  if sudo apt-get install -y nodejs npm -qq 2>/dev/null; then
    NODE_VERSION=$(node -v | grep -oP '\d+' | head -1)
    if [ "$NODE_VERSION" -ge "$NODE_MIN_VERSION" ]; then
      ok "Node.js v$(node -v | tr -d 'v') aus System-Repos installiert"
    else
      info "System-Node.js zu alt, installiere via NodeSource..."
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs -qq
      ok "Node.js v$(node -v | tr -d 'v') installiert"
    fi
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs -qq
    ok "Node.js v$(node -v | tr -d 'v') installiert"
  fi
fi

# npm prüfen
if ! command -v npm >/dev/null 2>&1; then
  sudo apt-get install -y npm -qq 2>/dev/null || true
fi

# ── 4/9 Python ──────────────────────────────────────────────
step "4/9  Python prüfen"

if ! command -v python3 >/dev/null 2>&1; then
  info "Python3 nicht gefunden – installiere..."
  sudo apt-get install -y python3 python3-pip python3-venv python3-dev -qq
fi

PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")

if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]; }; then
  error "Python 3.11 oder neuer wird benötigt (gefunden: $PY_VERSION).

  Raspberry Pi OS Bookworm liefert Python 3.11 standardmässig.
  Bitte auf Bookworm upgraden:
    https://www.raspberrypi.com/software/"
fi

# Build-Abhängigkeiten für Python-Pakete
sudo apt-get install -y python3-pip python3-venv python3-dev build-essential \
  pkg-config libpq-dev -qq 2>/dev/null || true

ok "Python $PY_VERSION – OK"

# ── 5/9 Repository ──────────────────────────────────────────
step "5/9  Repository klonen / aktualisieren"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Vorhandene Installation gefunden – aktualisiere..."
  sudo -u "$SERVICE_USER" git -C "$INSTALL_DIR" fetch origin
  sudo -u "$SERVICE_USER" git -C "$INSTALL_DIR" reset --hard origin/master
  ok "Repository aktualisiert"
else
  # Zielverzeichnis darf nicht existieren oder muss leer sein
  if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    error "Verzeichnis $INSTALL_DIR existiert bereits und ist nicht leer.
  Bitte zuerst löschen: sudo rm -rf $INSTALL_DIR"
  fi
  info "Klone Repository nach $INSTALL_DIR (Shallow Clone)..."
  info "  Dies kann auf dem Pi einige Minuten dauern..."
  if ! sudo -u "$SERVICE_USER" git clone --depth 1 --progress "$REPO_URL" "$INSTALL_DIR" 2>&1; then
    error "Git Clone fehlgeschlagen!
  Mögliche Ursachen:
    - Keine Internetverbindung: ping -c1 github.com
    - Nicht genug Speicher: df -h
    - DNS-Problem: nslookup github.com"
  fi
  ok "Repository geklont"
fi

sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ── 6/9 Umgebungsvariablen & Docker-Infrastruktur ───────────
step "6/9  Umgebungsvariablen und Docker-Infrastruktur"

cd "$INSTALL_DIR"

# .env erstellen falls nicht vorhanden
if [ ! -f "$INSTALL_DIR/.env" ]; then
  info "Erstelle .env Konfiguration..."
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"

  # Sichere Secrets generieren
  SECRET_KEY=$(openssl rand -hex 32)
  API_KEY=$(openssl rand -hex 24)
  DB_PASSWORD=$(openssl rand -hex 16)

  sed -i "s|change-me-in-production|$SECRET_KEY|" "$INSTALL_DIR/.env"
  # API_KEY separat setzen (zweites Vorkommen)
  sed -i "0,/API_KEY=.*/s|API_KEY=.*|API_KEY=$API_KEY|" "$INSTALL_DIR/.env"

  # DB-Passwort in .env und docker-compose aktualisieren
  sed -i "s|POSTGRES_PASSWORD: secret|POSTGRES_PASSWORD: $DB_PASSWORD|" "$INSTALL_DIR/docker-compose.yml"
  sed -i "s|energiemanager:secret@|energiemanager:$DB_PASSWORD@|" "$INSTALL_DIR/.env"

  # Grafana-Port in .env setzen (docker-compose.yml liest ihn aus .env)
  if ! grep -q "^GRAFANA_PORT=" "$INSTALL_DIR/.env"; then
    echo "GRAFANA_PORT=${GRAFANA_PORT}" >> "$INSTALL_DIR/.env"
  fi

  ok ".env erstellt mit sicheren Secrets"
else
  ok ".env bereits vorhanden – wird beibehalten"
fi

# Docker-Infrastruktur starten (nur DB, Redis, Grafana – NICHT backend)
# Fehler hier sollen nicht die gesamte Installation abbrechen
info "Starte Docker-Infrastruktur (TimescaleDB, Redis, Grafana)..."
info "  Image-Download kann beim ersten Mal einige Minuten dauern..."
DOCKER_OK=true
if ! $COMPOSE_CMD -f "$INSTALL_DIR/docker-compose.yml" up -d db redis grafana 2>&1; then
  warn "Docker Compose als '$SERVICE_USER' fehlgeschlagen – versuche als root..."
  if ! $COMPOSE_CMD -f "$INSTALL_DIR/docker-compose.yml" up -d db redis grafana 2>&1; then
    warn "Docker-Infrastruktur konnte nicht gestartet werden."
    warn "  Manuell starten: cd $INSTALL_DIR && $COMPOSE_CMD up -d"
    DOCKER_OK=false
  fi
fi

if [ "$DOCKER_OK" = true ]; then
  # Warten bis DB bereit ist
  info "Warte auf Datenbank (max. 60s)..."
  DB_READY=false
  for i in $(seq 1 60); do
    if $COMPOSE_CMD -f "$INSTALL_DIR/docker-compose.yml" exec -T db pg_isready -U energiemanager >/dev/null 2>&1; then
      DB_READY=true
      break
    fi
    sleep 1
  done

  if [ "$DB_READY" = true ]; then
    ok "TimescaleDB bereit"
  else
    warn "Datenbank antwortet noch nicht – wird beim nächsten Start verfügbar sein"
    warn "  Logs prüfen: $COMPOSE_CMD -f $INSTALL_DIR/docker-compose.yml logs db"
  fi
  ok "Docker-Infrastruktur gestartet"
else
  warn "Docker-Infrastruktur übersprungen – Installation wird fortgesetzt"
fi

# ── 7/9 Python-Backend ──────────────────────────────────────
step "7/9  Python-Backend einrichten"

VENV_DIR="$INSTALL_DIR/backend/venv"
VENV_PIP="$VENV_DIR/bin/pip"
VENV_PYTHON="$VENV_DIR/bin/python3"

info "Erstelle Virtual Environment..."
# python3-venv sicherstellen (fehlt manchmal auf Minimal-Installationen)
if ! python3 -m venv --help >/dev/null 2>&1; then
  info "python3-venv nachinstallieren..."
  sudo apt-get install -y python3-venv -qq
fi
sudo -u "$SERVICE_USER" python3 -m venv "$VENV_DIR" || error "Virtual Environment konnte nicht erstellt werden."

info "Aktualisiere pip..."
sudo -u "$SERVICE_USER" "$VENV_PIP" install --upgrade pip setuptools wheel || warn "pip-Upgrade fehlgeschlagen"

info "Installiere Python-Abhängigkeiten..."
info "  Dies kann auf dem Pi 10–15 Minuten dauern (numpy, scikit-learn, xgboost)..."
if ! sudo -u "$SERVICE_USER" "$VENV_PIP" install -e "$INSTALL_DIR/backend" 2>&1; then
  warn "pip install fehlgeschlagen – versuche erneut ohne Cache..."
  sudo -u "$SERVICE_USER" "$VENV_PIP" install --no-cache-dir -e "$INSTALL_DIR/backend"
fi

# Importe verifizieren
info "Überprüfe Python-Importe..."
IMPORT_ERRORS=0
for mod in fastapi uvicorn sqlalchemy asyncpg pydantic redis; do
  if sudo -u "$SERVICE_USER" "$VENV_PYTHON" -c "import $mod" 2>/dev/null; then
    ok "  $mod"
  else
    warn "  $mod FEHLT"
    IMPORT_ERRORS=$((IMPORT_ERRORS + 1))
  fi
done
if [ $IMPORT_ERRORS -gt 0 ]; then
  warn "$IMPORT_ERRORS Python-Modul(e) fehlen – ggf. manuell installieren."
fi

# Datenbank-Migration (Alembic)
if [ -f "$INSTALL_DIR/backend/alembic.ini" ]; then
  info "Führe Datenbank-Migration aus..."
  # Alembic braucht die DB-URL aus der .env
  export $(grep -v '^#' "$INSTALL_DIR/.env" | xargs 2>/dev/null) 2>/dev/null || true
  sudo -u "$SERVICE_USER" bash -c "cd '$INSTALL_DIR/backend' && '$VENV_PYTHON' -m alembic upgrade head" 2>/dev/null \
    && ok "Migration erfolgreich" \
    || warn "Migration übersprungen (wird beim ersten Start ausgeführt)"
fi

ok "Python-Backend eingerichtet"

# ── 8/9 Frontend ────────────────────────────────────────────
step "8/9  Frontend bauen"

cd "$INSTALL_DIR/frontend"

info "Installiere Frontend-Abhängigkeiten..."
sudo -u "$SERVICE_USER" npm install 2>/dev/null || npm install

info "Baue Frontend für Produktion..."
# VITE_API_URL leer = Frontend nutzt window.location.hostname automatisch
sudo -u "$SERVICE_USER" VITE_API_URL="" npm run build 2>/dev/null || VITE_API_URL="" npm run build

if [ -d "$INSTALL_DIR/frontend/dist" ]; then
  ok "Frontend gebaut ($(du -sh "$INSTALL_DIR/frontend/dist" | cut -f1))"
else
  warn "Frontend-Build fehlgeschlagen – manuell mit 'npm run build' im frontend-Verzeichnis ausführen"
fi

cd "$INSTALL_DIR"

# ── 9/9 systemd Services ────────────────────────────────────
step "9/9  systemd Services einrichten"

if ! command -v systemctl >/dev/null 2>&1; then
  warn "systemd nicht gefunden – Services werden nicht eingerichtet."
  warn "Manuell starten:"
  warn "  Backend:  cd $INSTALL_DIR/backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT"
  warn "  Frontend: cd $INSTALL_DIR/frontend && npx serve dist -l $FRONTEND_PORT"
else
  # Autostart-Abfrage
  AUTOSTART=true
  if [ "$AUTO_YES" != true ]; then
    echo ""
    echo -e "  Soll EnergyManager bei jedem Systemstart"
    echo -e "  automatisch gestartet werden?"
    echo ""
    echo -e "  ${GREEN}[j]${NC} Ja, automatisch starten  ${YELLOW}(empfohlen)${NC}"
    echo -e "  ${YELLOW}[n]${NC} Nein, nur manuell starten"
    echo ""
    AUTOSTART_CHOICE=""
    for i in $(seq 30 -1 1); do
      printf "\r  Auswahl [J/n] (automatisch Ja in %2ds): " "$i"
      if read -rn1 -t1 AUTOSTART_CHOICE <&3 2>/dev/null; then
        echo ""
        break
      fi
    done
    if [ -z "$AUTOSTART_CHOICE" ]; then
      echo ""
      echo "  → Zeitüberschreitung – Autostart wird aktiviert"
      AUTOSTART_CHOICE="j"
    fi

    case "${AUTOSTART_CHOICE,,}" in
      n|nein|no) AUTOSTART=false ;;
      *)         AUTOSTART=true  ;;
    esac
  fi

  # Absolute Pfade für systemd ermitteln
  DOCKER_BIN=$(command -v docker)
  NPX_BIN=$(command -v npx)

  # Compose-Befehl für systemd (braucht absoluten Pfad)
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_EXEC="${DOCKER_BIN} compose"
  else
    COMPOSE_EXEC="$(command -v docker-compose)"
  fi

  # --- Backend-Service ---
  sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=EnergyManager – Backend (API + Energiemanagement)
Documentation=https://github.com/daTobi1/Energiemanager
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/backend
EnvironmentFile=${INSTALL_DIR}/.env
ExecStartPre=${COMPOSE_EXEC} -f ${INSTALL_DIR}/docker-compose.yml up -d db redis grafana
ExecStart=${INSTALL_DIR}/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT}
Restart=on-failure
RestartSec=10
TimeoutStartSec=120

# Sicherheit
NoNewPrivileges=true
ProtectHome=read-only
ReadWritePaths=${INSTALL_DIR}

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

  # --- Frontend-Service ---
  sudo tee /etc/systemd/system/${SERVICE_NAME}-web.service > /dev/null <<EOF
[Unit]
Description=EnergyManager – Web-Frontend
After=network-online.target ${SERVICE_NAME}.service
Wants=${SERVICE_NAME}.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/frontend
ExecStart=${NPX_BIN} serve dist -l ${FRONTEND_PORT} -s
Restart=on-failure
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}-web

[Install]
WantedBy=multi-user.target
EOF

  # Serve-Paket installieren (für statisches Frontend-Hosting)
  sudo -u "$SERVICE_USER" npm install --global serve 2>/dev/null || npm install --global serve 2>/dev/null || true

  sudo systemctl daemon-reload

  if [ "$AUTOSTART" = true ]; then
    sudo systemctl enable "${SERVICE_NAME}.service" --quiet
    sudo systemctl enable "${SERVICE_NAME}-web.service" --quiet
    ok "Autostart aktiviert"
  else
    sudo systemctl disable "${SERVICE_NAME}.service" --quiet 2>/dev/null || true
    sudo systemctl disable "${SERVICE_NAME}-web.service" --quiet 2>/dev/null || true
    ok "Autostart deaktiviert"
    info "Manuell starten: sudo systemctl start ${SERVICE_NAME} ${SERVICE_NAME}-web"
  fi

  # Services starten
  sudo systemctl restart "${SERVICE_NAME}.service"
  sudo systemctl restart "${SERVICE_NAME}-web.service"

  sleep 3

  if sudo systemctl is-active --quiet "${SERVICE_NAME}"; then
    ok "Backend-Service läuft"
  else
    warn "Backend nicht gestartet – Logs prüfen:"
    warn "  sudo journalctl -u ${SERVICE_NAME} -n 20 --no-pager"
  fi

  if sudo systemctl is-active --quiet "${SERVICE_NAME}-web"; then
    ok "Frontend-Service läuft"
  else
    warn "Frontend nicht gestartet – Logs prüfen:"
    warn "  sudo journalctl -u ${SERVICE_NAME}-web -n 20 --no-pager"
  fi
fi

# ── sudoers-Regel ────────────────────────────────────────────
SUDOERS_FILE="/etc/sudoers.d/energiemanager"
sudo tee "$SUDOERS_FILE" > /dev/null <<EOF
# EnergyManager – erlaubt dem Service-User System-Operationen
${SERVICE_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart ${SERVICE_NAME}
${SERVICE_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart ${SERVICE_NAME}.service
${SERVICE_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart ${SERVICE_NAME}-web
${SERVICE_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart ${SERVICE_NAME}-web.service
${SERVICE_USER} ALL=(ALL) NOPASSWD: /sbin/reboot
${SERVICE_USER} ALL=(ALL) NOPASSWD: /sbin/shutdown
EOF
sudo chmod 440 "$SUDOERS_FILE"
ok "sudo-Rechte für Service-Neustart eingerichtet"

# ── Eigentümer setzen ────────────────────────────────────────
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ── Fertig ───────────────────────────────────────────────────
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo ""
echo "============================================================"
echo -e "  ${GREEN}${BOLD}Installation abgeschlossen!${NC}"
echo ""
echo "  Frontend:   http://${IP}:${FRONTEND_PORT}"
echo "  Backend:    http://${IP}:${BACKEND_PORT}"
echo "  API-Docs:   http://${IP}:${BACKEND_PORT}/docs"
echo "  Grafana:    http://${IP}:${GRAFANA_PORT}  (admin/admin)"
echo ""
echo "  Befehle:"
echo "    Status:     sudo systemctl status ${SERVICE_NAME}"
echo "    Logs:       sudo journalctl -u ${SERVICE_NAME} -f"
echo "    Neustart:   sudo systemctl restart ${SERVICE_NAME} ${SERVICE_NAME}-web"
echo "    Stopp:      sudo systemctl stop ${SERVICE_NAME} ${SERVICE_NAME}-web"
echo ""
echo "  Docker-Infra:"
echo "    Status:     cd ${INSTALL_DIR} && ${COMPOSE_CMD} ps"
echo "    Logs:       cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f"
echo ""
echo "  Konfiguration:  ${INSTALL_DIR}/.env"
echo ""
echo -e "  ${YELLOW}Hinweis:${NC} Standort-Koordinaten in .env prüfen:"
echo "    sudo nano ${INSTALL_DIR}/.env"
echo "    (Wetter-API: Open-Meteo, kein API-Key nötig)"
echo "============================================================"
echo ""

} # Ende main()

main "$@"
