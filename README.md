# EnergyManager — Intelligentes Energiemanagementsystem

> **STATUS: IN ENTWICKLUNG / WORK IN PROGRESS**
>
> Dieses Projekt befindet sich in aktiver Entwicklung (Phase 1b).
> APIs, Datenmodelle und Schnittstellen koennen sich jederzeit aendern.
> Beitraege und Feedback sind willkommen — siehe [Contributing](#contributing).

---

## Vision

Ein selbstlernendes, prognosebasiertes Energiemanagementsystem fuer Gebaeude und Liegenschaften, das Erzeugung, Speicherung, Verbrauch und E-Mobilitaet ganzheitlich optimiert.

---

## Systemuebersicht

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EnergyManager                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Web-Frontend (React)                          │    │
│  │  Dashboard · Erzeuger · Speicher · Heizkreise · Raeume          │    │
│  │  Verbraucher · Zaehler · Energiefluss · Sankey · System         │    │
│  └──────────────────────────┬──────────────────────────────────────┘    │
│                              │ REST API                                 │
│  ┌──────────────────────────┴──────────────────────────────────────┐    │
│  │                    Backend (FastAPI)                              │    │
│  │                                                                   │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │    │
│  │  │ Erzeugungs-  │  │  Speicher-   │  │   Lademanagement       │  │    │
│  │  │ management   │  │  management  │  │   (Wallboxen/EVs)      │  │    │
│  │  │              │  │              │  │                        │  │    │
│  │  │ PV · BHKW    │  │ Batterie     │  │ Max · PV-Ueberschuss  │  │    │
│  │  │ Waermepumpe  │  │ Waerme-/     │  │ Zielladung+PV         │  │    │
│  │  │ Heizkessel   │  │ Kaeltespeich.│  │                        │  │    │
│  │  │ Kaeltemasch. │  │              │  │                        │  │    │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬───────────────┘  │    │
│  │         └─────────────────┼───────────────────┘                   │    │
│  │  ┌────────────────────────┴─────────────────────────────────────┐ │    │
│  │  │              Optimizer / Scheduler / ML Engine                │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  │                                                                   │    │
│  │  TimescaleDB · Redis · Grafana                                    │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│  ┌──────────────────────────┴──────────────────────────────────────┐    │
│  │              Hardware-Anbindung (Connectoren)                    │    │
│  │  Modbus TCP · SunSpec · MQTT · REST · BACnet/IP · KNX/IP       │    │
│  │  OPC UA · SML/TCP · M-Bus/TCP · OCPP                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Web-Frontend

Das Frontend ist eine vollstaendige Konfigurationsoberflaeche fuer das Energiesystem. Alle Eingaben folgen dem Energiefluss von links nach rechts.

### Seiten

| Seite | Beschreibung |
|---|---|
| **Dashboard** | Uebersicht: Konfigurationsfortschritt, Schnellstatus, Testdaten laden |
| **Anlage & Standort** | Gebaeudedaten, Koordinaten, Tarife, Hausanschluss, Wetter-API |
| **Erzeuger** | PV, BHKW, Waermepumpe (mit COP-Kennlinie), Heizkessel, Kaeltemaschine |
| **Speicher** | Batterie (LFP/NMC/...), Waermespeicher, Kaeltespeicher mit Temperatursensoren |
| **Heizkreise** | Fussbodenheizung, Radiatoren, Warmwasser-Ladekreis, Mischer/Pumpen/Ventile |
| **Raeume** | Wohneinheiten, Technikraeume mit Heizplan, Temperatur-Sollwerten, Zuordnungen |
| **Verbraucher** | Haushalte, Wallboxen (OCPP), Beleuchtung, HVAC, Warmwasser etc. |
| **Zaehler** | Alle Energiezaehler mit 6 Kategorien (Spalten im Energiefluss) |
| **Energiefluss** | Interaktives SVG-Diagramm mit 11 Spalten — Drag-to-Connect, Click-to-Delete, bidirektionale Verbindungen |
| **Sankey-Diagramm** | Jahres-Energiebilanz (Plotly.js), geschaetzte Werte aus Nennleistungen |
| **Systemverwaltung** | Systemzeit, WLAN, Bluetooth, Updates, Neustart/Herunterfahren |

### Energiefluss — Interaktives 11-Spalten-Diagramm

Das Energiefluss-Diagramm bildet den gesamten Energiepfad als interaktives SVG ab:

- **Drag-to-Connect:** Verbindungen grafisch ziehen (Port-zu-Port)
- **Click-to-Delete:** Verbindungen per Klick loeschen
- **Bidirektionale Ports:** Jeder Node hat Ein- und Ausgangsport (beide richtungsfrei)
- **Smart-Meter-Logik:** Durchverbindungen (z.B. Netz → Zaehler → Batterie) werden automatisch erkannt
- **Bidirektionale Batterie:** Batteriespeicher laden vom Netz/Erzeugern und speisen an Verbraucher
- **Kollisionserkennung:** Zaehler in gleichen Spalten ueberlappen nicht
- **Animierte Energiefluesse:** Gestrichelte, animierte Linien zeigen Flussrichtung

```
Quellen-  Erzeuger  Erzeuger-  Speicher  Heiz-/Kuehl-  Heiz-/    Raum-    Raeume  Verbraucher-  Verbraucher  End-
zaehler             zaehler              kreiszaehler   Kuehlkr.  zaehler          gruppenz.                  zaehler
───────── ───────── ───────── ───────── ───────────── ───────── ───────── ──────── ───────────── ─────────── ─────────
Gaszaehl. PV Sued   PV-Zaehl. Batterie  WMZ Heizung   FBH EG    WMZ WE1  WE 1    Allg.Strom-   WE 1        Endzaehl.
                                                                                   zaehler                   WB 1
WP-Quell. Gaskessel HA-Zaehl. Puffer    WMZ Warmw.    HK OG              WE 2    WB-Zaehler    WE 2
          WP        Bat.Zaehl WW-Spch.                WW-Lade.           ...                    Wallbox 1
          Hausanschl.                                  HK Treph.         TG                     Wallbox 2
                                                                                                ...
```

### Zaehlerkategorien

Jeder Zaehler wird einer Kategorie zugeordnet, die seiner Spalte im Energiefluss entspricht:

| Kategorie | Spalte | Beschreibung | Beispiele |
|---|---|---|---|
| **Quellenzaehler** | 1 | Energiequellen-Messung | Gaszaehler, WP-Quellenzaehler |
| **Erzeugerzaehler** | 3 | Erzeuger-Ausgangsleistung | Hausanschluss-Zaehler, PV-Zaehler, Batteriezaehler |
| **Heiz-/Kuehlkreiszaehler** | 5 | Waerme-/Kaelteverteilung | WMZ Heizung, WMZ Warmwasser |
| **Raumzaehler** | 7 | Raum-/Wohnungsmessung | Heizkostenverteiler WE 1 |
| **Verbrauchergruppenzaehler** | 9 | Verbrauchergruppen | Allgemeinstromzaehler, Wallbox-Zaehler |
| **Endzaehler** | 11 | Endverbraucher-Messung | Endzaehler Wallbox 1 |

### Kommunikationsprotokolle

Jedes Geraet und jeder Zaehler kann ueber eines von 10 Netzwerkprotokollen angebunden werden:

| Protokoll | Typische Anwendung |
|---|---|
| Modbus TCP | Wechselrichter, Waermepumpen, Heizkessel, Energiezaehler |
| SunSpec | PV-Wechselrichter (standardisiertes Modbus-Profil) |
| MQTT | IoT-Sensoren, ESP32-Gateways, Smart-Home-Geraete |
| HTTP/REST | Cloud-APIs, proprietaere Geraete-Schnittstellen |
| BACnet/IP | Gebaeudeleittechnik, HLK-Anlagen |
| KNX/IP | Gebaeudeautomation, Beleuchtung, Jalousien |
| OPC UA | Industrielle Steuerungen, SPS |
| SML/TCP | Elektronische Stromzaehler (IR-Lesekopf) |
| M-Bus/TCP | Waermemengenzaehler, Wasserzaehler |
| OCPP | Wallboxen (Open Charge Point Protocol) |

---

## Module im Detail

### Erzeugungsmanagement

| Erzeuger | Energieform | Steuerbar | Beschreibung |
|---|---|---|---|
| PV-Anlage | Strom | Nein (prognostiziert) | Erzeugungsprognose via Wetter-API + ML |
| Waermepumpe | Waerme + Strom(verbrauch) | Ja | Flexibler Einsatz, COP-Kennlinie, SG Ready |
| BHKW | Strom + Waerme | Ja | Kraft-Waerme-Kopplung, waerme-/stromgefuehrt |
| Heizkessel | Waerme | Ja | Spitzenlastabdeckung, Brennwert, Modulation |
| Kaeltemaschine | Kaelte | Ja | Klimatisierung, Prozesskaelte |

### Speichermanagement

| Speicher | Medium | Strategie |
|---|---|---|
| Batteriespeicher | Strom | Eigenverbrauch maximieren, Peak-Shaving |
| Waermespeicher | Waerme | Waerme puffern, WP-Laufzeiten optimieren, Schichtenspeicher |
| Kaeltespeicher | Kaelte | Kaelteerzeugung in guenstige Zeiten verlagern |

### Lademanagement (Wallboxen)

| Modus | Beschreibung |
|---|---|
| Max. Ladeleistung | Sofort mit maximaler Leistung laden |
| PV-Ueberschuss | Nur bei erneuerbarem Ueberschuss laden |
| Zielladung+PV | Zielzeitpunkt + km-Bedarf, System optimiert Ladeplan |

---

## Technologie-Stack

### Backend

| Komponente | Technologie |
|---|---|
| API-Server | Python 3.12, FastAPI, SQLAlchemy 2.0 (async) |
| Datenbank | TimescaleDB (PostgreSQL) — Zeitreihendaten |
| Cache/Broker | Redis (Pub/Sub + Cache) |
| ML Framework | scikit-learn, XGBoost (Phase 2), PyTorch (Phase 3) |
| Optimizer | Regelbasierte Heuristik (Phase 1), PuLP/OR-Tools MILP (Phase 3) |

### Web-Frontend

| Komponente | Technologie |
|---|---|
| Framework | React 19, TypeScript, Vite |
| Styling | Tailwind CSS (Dark Theme) |
| State | Zustand + API-Sync (localStorage Fallback) |
| Diagramme | Plotly.js (Sankey), SVG (Energiefluss) |
| Icons | Lucide React |

### Zielsystem

| Komponente | Technologie |
|---|---|
| Hardware | Raspberry Pi 5 (4/8 GB RAM) |
| OS | Raspberry Pi OS Bookworm (64-bit, ARM64) |
| Deployment | Docker (DB/Redis/Grafana) + nativ (Backend venv + Frontend serve) |
| Services | 2 systemd Services: `energiemanager` (Backend) + `energiemanager-web` (Frontend) |

---

## Projektstruktur

```
energiemanager/
├── README.md
├── install.sh                           # Automatische Installation (Raspberry Pi)
├── uninstall.sh                         # Deinstallation mit Rueckfragen
├── docker-compose.yml
├── .env.example
│
├── backend/                             # Python FastAPI Backend
│   ├── app/
│   │   ├── main.py                      # FastAPI App Entry Point
│   │   ├── config.py                    # Settings & Environment
│   │   ├── api/                         # REST API Endpoints
│   │   │   ├── router.py
│   │   │   ├── crud.py                  # Generische CRUD-Router-Factory
│   │   │   ├── endpoints/               # dashboard, generators, storage,
│   │   │   │                            # charging, settings, seed, simulator
│   │   │   └── websocket.py
│   │   ├── models/                      # SQLAlchemy DB-Modelle
│   │   │   ├── config.py               # JSONB-Konfigurationsmodelle (7 Entitaeten)
│   │   │   ├── generator.py            # Runtime-Generator-Modell (Phase 2)
│   │   │   └── ...
│   │   ├── schemas/                     # Pydantic DTOs
│   │   ├── services/                    # Business-Logik + Simulator
│   │   ├── forecasting/                 # Prognose-Engine (Wetter, PV, Last, Thermisch)
│   │   ├── ml/                          # ML-Pipeline (Training, Features, Anomalie)
│   │   ├── connectors/                  # Hardware-Anbindung (Modbus, MQTT, Wallbox)
│   │   └── core/                        # DB, Redis, Events, Logging
│   └── tests/
│
├── frontend/                            # React Web-Frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx                     # Entry Point
│       ├── App.tsx                      # Router (React Router v7)
│       ├── components/
│       │   ├── Layout.tsx               # Sidebar-Navigation
│       │   └── ui/                      # FormField, CommunicationForm, ConfirmDelete
│       ├── pages/
│       │   ├── DashboardPage.tsx        # Uebersicht + Testdaten-Button
│       │   ├── SettingsPage.tsx         # Anlage, Standort, Tarife, Hausanschluss
│       │   ├── GeneratorsPage.tsx       # PV, BHKW, WP, Kessel, Kaeltemaschine
│       │   ├── StoragePage.tsx          # Batterie, Waerme-/Kaeltespeicher
│       │   ├── CircuitsPage.tsx         # Heiz-/Kuehlkreise
│       │   ├── RoomsPage.tsx            # Raeume mit Heizplan
│       │   ├── ConsumersPage.tsx        # Verbraucher + Wallboxen
│       │   ├── MetersPage.tsx           # Zaehler (6 Kategorien)
│       │   ├── EnergyFlowPage.tsx       # SVG-Energieflussdiagramm (11 Spalten)
│       │   ├── SankeyPage.tsx           # Sankey-Diagramm (Plotly.js)
│       │   ├── OptimizerPage.tsx       # Optimierer-Ziele (Radar-Diagramm)
│       │   └── SystemPage.tsx           # Systemverwaltung
│       ├── hooks/
│       │   └── useCreateNavigation.ts   # Seitenuebergreifende Erstellung + Flow-Edit
│       ├── api/
│       │   └── client.ts               # API-Client (CRUD + Seed + Health)
│       ├── store/
│       │   └── useEnergyStore.ts        # Zustand Store + API-Sync
│       ├── types/
│       │   └── index.ts                 # Alle TypeScript-Typen
│       └── data/
│           └── seedBavaria.ts           # Testdaten MFH Bayern
│
└── deploy/
    └── raspberry-pi/                    # systemd Service, config.txt
```

---

## Testdaten (MFH Bayern)

Ueber den Dashboard-Button "Testdaten laden" wird ein komplettes Mehrfamilienhaus-Szenario geladen:

**Szenario: MFH Ahornweg 12, 85748 Garching bei Muenchen**
- 6 Wohneinheiten (2 pro Stockwerk, EG + 1.OG + 2.OG)
- Baujahr 2008, EnEV-Standard, 720 m² BGF

| Kategorie | Komponenten |
|---|---|
| Erzeuger | PV Sueddach 29.6 kWp, Gas-Brennwertkessel 60 kW, Luft-Wasser-WP 13 kW |
| Speicher | Batterie BYD HVS 20.5 kWh, Pufferspeicher 1500 L, WW-Speicher 500 L |
| Heizkreise | Fussbodenheizung EG, Heizkoerper OG, WW-Ladekreis, HK Treppenhaus |
| Raeume | 6 Wohneinheiten + Treppenhaus + Technikraum + Tiefgarage |
| Verbraucher | 6 Haushalte (2600–3500 kWh/a), 2 Wallboxen 11 kW (OCPP), Allgemeinstrom, Zirkpumpe |
| Zaehler | 11 Zaehler in allen 6 Kategorien (Quellen-, Erzeuger-, Heiz-/Kuehlkreis-, Raum-, Verbrauchergruppen-, Endzaehler) |

---

## Entwicklungsfortschritt

| Phase | Beschreibung | Status |
|---|---|---|
| Phase 1 | Fundament (Backend + Web-Frontend + Install-Script) | Abgeschlossen |
| Phase 1b | Backend-Anbindung (JSONB + API + Alembic) | Abgeschlossen |
| Phase 1c | Optimierer-UI (Radar-Diagramm, Gewichtungen) | Abgeschlossen |
| Phase 2 | Kernlogik (Regelung, Prognosen, Optimierer v1) | Ausstehend |
| Phase 3 | Intelligenz (Wetter-API, ML, MILP, Selbstlernen) | Ausstehend |
| Phase 4 | Mobile App (Flutter) | Ausstehend |
| Phase 5 | Produktion (Edge-Deployment, Monitoring) | Ausstehend |

### Bisherige Arbeiten

**Erledigt (Phase 1):**
- 12 Frontend-Seiten komplett (Dashboard, Einstellungen, Erzeuger, Speicher, Heizkreise, Raeume, Verbraucher, Zaehler, Energiefluss, Sankey, Optimierer, System)
- Interaktives Energiefluss-Diagramm mit Drag-to-Connect und Click-to-Delete
- Bidirektionale Batteriespeicher-Verbindungen (Laden/Entladen)
- Smart-Meter-Logik (Durchverbindungen ueber Zaehler)
- Heiz-/Kuehlkreise mit regelbaren Komponenten (Mischer, Pumpen, Ventile)
- Raeume mit Heizplan und Temperatur-Zeitprogrammen
- Systemverwaltungsseite (Platzhalter fuer Backend-Anbindung)
- Loeschbestaetigung (ConfirmDelete-Komponente)
- Seitenuebergreifende Erstellungs-Navigation (useCreateNavigation Hook)
- Konsistente Terminologie (Spalten-basierte Zaehlerkategorien)
- Testdaten MFH Bayern vollstaendig mit allen Zuordnungen

**Erledigt (Backend-Anbindung):**
- JSONB-Konfigurationsmodelle: Frontend-JSON wird 1:1 in PostgreSQL gespeichert
- Generische CRUD-Factory: Ein Router-Generator fuer alle 7 Entitaetstypen
- API-Endpoints: GET/POST/PUT/DELETE fuer Generators, Meters, Consumers, Storages, Rooms, Circuits
- Settings-Endpoint: GET/PUT fuer SystemSettings (Singleton)
- Seed/Clear-Endpoints: POST /data/seed (Testdaten) + DELETE /data/all (Reset)
- Frontend API-Client: Typisierter fetch-Wrapper mit CRUD-Factory
- Zustand Store: Optimistischer Sync (lokales Update + API-Call im Hintergrund)
- Offline-Modus: localStorage-Fallback wenn Backend nicht erreichbar
- Verbindungsstatus: Sidebar-Indikator + SystemPage Backend-Sektion
- E2E-Test mit SQLite erfolgreich (alle CRUD-Endpoints + Seed/Clear)
- Alembic-Migration fuer alle Config- und Runtime-Tabellen

**Erledigt (Optimierer-UI):**
- Interaktives Radar-/Spinnennetzdiagramm (SVG, Drag-to-Adjust)
- 5 Optimierungsachsen: CO2-Einsparung, Wirtschaftlichkeit, Komfort, Eigenverbrauch, Netzdienlich
- Feineinstellung per Slider (0-100% pro Achse)
- 5 Vorlagen: Ausgewogen, Kostenoptimiert, Klimafreundlich, Maximaler Komfort, Autark
- Gewichtungen als Teil der SystemSettings (API-sync + localStorage)

**Erledigt (Simulator):**
- Energie-Simulator: Erzeugt realistische Messwerte ohne Hardware
- Simulationsmodelle: PV (Sonnenstand), Waermepumpe (COP/Aussentemp), Gaskessel (Hysterese), Last (VDI 4655), Batterie (Ueberschuss/Defizit), Netz (Bilanz)
- API-Endpoints: Start/Stop/Status/Measurements + Latest-Aggregation
- WebSocket-Streaming: Echtzeit-Updates an alle verbundenen Clients
- LiveDashboard-Komponente: 8 Metrikkarten mit Echtzeit-Werten
- Fallback-Polling wenn kein WebSocket verfuegbar

**Naechste Schritte:**
- Phase 2: Prognosen, Optimierer-Kernlogik, Regelung

---

## Installation

### Automatische Installation (Raspberry Pi)

```bash
# Repository klonen
git clone https://github.com/daTobi1/Energiemanager.git
cd Energiemanager

# Installations-Script ausfuehren
sudo bash install.sh
```

Das Script fuehrt 9 Schritte aus: Basistools, Docker, Node.js, Python, Repository, .env + Docker-Infrastruktur, Backend-venv, Frontend-Build, systemd-Services.

### Deinstallation

```bash
sudo bash uninstall.sh
```

Schrittweise mit Rueckfragen (Services, Docker-Volumes, Verzeichnis, User).

### Lokale Entwicklung (PC/Laptop, ohne Docker)

```bash
git clone https://github.com/daTobi1/Energiemanager.git
cd Energiemanager

# Backend (SQLite, kein Docker noetig)
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload    # -> http://localhost:8000

# Frontend (in neuem Terminal)
cd frontend
npm install
npm run dev                      # -> http://localhost:5173

# Testdaten laden + Simulator starten
npx vite-node scripts/seed-backend.ts
curl -X POST "http://localhost:8000/api/v1/simulator/start?interval=5&speed=1"
```

### Lokale Entwicklung (mit Docker/PostgreSQL)

```bash
# DB + Redis starten
docker-compose up -d db redis

# Backend mit PostgreSQL
DATABASE_URL=postgresql+asyncpg://energiemanager:secret@localhost:5432/energiemanager \
  uvicorn app.main:app --reload
```

### Nach der Installation

| Dienst | URL | Beschreibung |
|---|---|---|
| Web-Frontend | `http://<ip>:5173` (Dev) / `http://<ip>:3001` (Prod) | Konfigurationsoberflaeche |
| API | `http://<ip>:8000` | FastAPI Backend |
| API Docs | `http://<ip>:8000/docs` | Swagger UI |
| Grafana | `http://<ip>:3000` | Monitoring Dashboards |

---

## Contributing

Dieses Projekt ist in aktiver Entwicklung. Beitraege sind willkommen!

1. Fork erstellen
2. Feature-Branch anlegen (`git checkout -b feature/mein-feature`)
3. Aenderungen committen
4. Branch pushen (`git push origin feature/mein-feature`)
5. Pull Request erstellen

Bitte beachten: Die Architektur kann sich noch grundlegend aendern.

---

## Lizenz

MIT License — siehe [LICENSE](LICENSE)
