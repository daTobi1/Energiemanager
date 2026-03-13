# EnergyManager — Intelligentes Energiemanagementsystem

> **STATUS: IN ENTWICKLUNG / WORK IN PROGRESS**
>
> Dieses Projekt befindet sich in aktiver Entwicklung (Phase 2e — Scheduler + Controller-Dashboard abgeschlossen).
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
│  │                    Web-Frontend (React 19)                       │    │
│  │  Dashboard · Erzeuger · Speicher · Heizkreise · Raeume          │    │
│  │  Verbraucher · Zaehler · Energiefluss · Sankey · Optimierer     │    │
│  │  Hydraulikschema · Stromschema · Trends · Wetter · System       │    │
│  └──────────────────────────┬──────────────────────────────────────┘    │
│                              │ REST API + WebSocket                     │
│  ┌──────────────────────────┴──────────────────────────────────────┐    │
│  │                    Backend (FastAPI)                              │    │
│  │                                                                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │    │
│  │  │Prognosen │ │Optimierer│ │Controller│ │   Scheduler      │    │    │
│  │  │PV · Last │ │MILP/CBC  │ │Auto/Man. │ │   (15min-Zyklus) │    │    │
│  │  │Thermisch │ │Heuristik │ │Safety    │ │   ML-Retrain 24h │    │    │
│  │  │ML-Korr.  │ │5-Krit.   │ │Setpoints │ │   Lambda-Sync    │    │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘    │    │
│  │                                                                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │    │
│  │  │Simulator │ │Wetter-API│ │  DAQ     │ │  Lambda Bridge   │    │    │
│  │  │PV/WP/Bat │ │Open-Meteo│ │Modbus/   │ │  Modbus TCP →    │    │    │
│  │  │Last/Netz │ │7-Tage    │ │MQTT/REST │ │  Eureka WP       │    │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘    │    │
│  │                                                                   │    │
│  │  SQLite (Dev) · TimescaleDB (Prod) · Redis · Grafana             │    │
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

## Kernfunktionen

### Autonomer Betrieb (Scheduler)

Das System arbeitet vollstaendig autonom im Regelkreis:

```
Scheduler (alle 15 min)
  → Prognosen erstellen (PV, Last, Thermisch + ML-Korrektur)
    → MILP-Optimierer (24h Fahrplan, 5 Kriterien)
      → Controller (Stellgroessen: Batterie, WP, Kessel, Vorlauftemp.)
        → Simulator (Testbetrieb)
        → Lambda Bridge → Modbus TCP → Waermepumpe (Realbetrieb)
```

### Prognosen

| Prognose | Methode | Horizont |
|---|---|---|
| **PV-Ertrag** | Isotrope Transposition (GHI/DNI/DHI → POA), NOCT-Zelltemperatur | 72h |
| **Haushaltslast** | VDI 4655 Standardlastprofile, temperaturabhaengig | 72h |
| **Thermischer Bedarf** | U-Wert-Methode, COP-Interpolation, Heizkurve | 72h |
| **ML-Korrektur** | XGBoost/scikit-learn Korrekturmodelle (auto-retrain alle 24h) | — |

### Optimierer (MILP + Heuristik)

- **5 gewichtete Kriterien:** Wirtschaftlichkeit, CO2, Komfort, Eigenverbrauch, Netzdienlichkeit
- **MILP-Solver:** PuLP/CBC fuer mathematisch optimale Einsatzplanung (<1s fuer 24h)
- **Heuristik-Fallback:** Wenn MILP nicht verfuegbar
- **Tarif-Modelle:** Festpreis, HT/NT (zeitvariabel), dynamisch

### Regelung (Controller)

| Modus | Beschreibung |
|---|---|
| **Auto** | Fahrplan vom Optimierer wird automatisch ausgefuehrt |
| **Manuell** | Stellgroessen per UI/API direkt setzen |
| **Aus** | Simulator-Heuristik (kein aktiver Eingriff) |

Sicherheitslogik immer aktiv: Batterie-Tiefschutz, Ueberladeschutz, Speicher-Uebertemperatur, Untertemperatur-Notbetrieb.

### Hardware-Integration: Lambda Waermepumpe

Vollstaendige Modbus-TCP-Integration fuer Lambda Eureka EU-L Waermepumpen:

| Steuerbar | Register | Beschreibung |
|---|---|---|
| Vorlauftemperatur | 1016 | 20–65 °C |
| PV-Ueberschuss | 102 | Leistungsmodulation in Watt |
| WW-Solltemperatur | 2050 | Warmwasserspeicher |
| Puffertemperatur | 3004/3050 | Sollwert + Maximum |
| Raumtemperatur | 5051+100×N | Pro Heizkreis (bis 12 HK) |
| Heizkurven-Offset | 5050+100×N | Pro Heizkreis |

Auto-Erkennung: Bis 3 WP, 5 Boiler, 5 Puffer, 2 Solar, 12 Heizkreise.

---

## Web-Frontend

16 Seiten, Dark Theme, React 19 + TypeScript + Tailwind CSS.

### Seiten

| Seite | Beschreibung |
|---|---|
| **Dashboard** | Uebersicht: Live-Metriken (8 Karten), WebSocket-Streaming, Wetter, PV-Prognose, KPIs |
| **Anlage & Standort** | Gebaeudedaten, Koordinaten (Geocoding), Tarife, Hausanschluss, Wetter-API |
| **Erzeuger** | PV, BHKW, Waermepumpe (COP-Kennlinie), Heizkessel, Kaeltemaschine, Windrad |
| **Speicher** | Batterie (LFP/NMC), Waerme-/Kaeltespeicher mit Temperatursensoren |
| **Heizkreise** | Fussbodenheizung, Radiatoren, WW-Ladekreis, Mischer/Pumpen/Ventile |
| **Raeume** | Wohneinheiten, Technikraeume mit Heizplan, Temperatur-Sollwerten |
| **Verbraucher** | Haushalte, Wallboxen (OCPP), Beleuchtung, HVAC, Warmwasser |
| **Zaehler** | Energiezaehler mit 6 Kategorien, Zaehlerhierarchie |
| **Energiefluss** | Interaktives 11-Spalten SVG-Diagramm, Drag-to-Connect, animierte Fluesse |
| **Sankey-Diagramm** | Jahres-Energiebilanz (Plotly.js) |
| **Hydraulikschema** | React-Flow-Editor: 25+ Node-Typen, Kreuzungsboegen, Cross-Schema-Links |
| **Stromschema** | React-Flow-Editor: 15 Node-Typen, Sammelschiene, UV, LS-Schalter |
| **Optimierer** | Radar-Diagramm (5 Achsen), Fahrplan-Charts, Controller-Dashboard, Manual-Overrides |
| **Trends** | Plotly-Zeitreihen: Dual Y-Achse, Prognose-Overlay, CSV-Export, vordefinierte Ansichten |
| **Wetter & Prognose** | Aktuelles Wetter, 7-Tage-Vorhersage, PV/Last/Thermik-Prognosen, ML-Status |
| **System** | Backend-Status, DAQ, Scheduler, Lambda WP (Modbus), Zeit, WLAN, Updates |

### Optimierer-Seite (Controller-Dashboard)

- **Radar-Diagramm:** Drag-to-Adjust fuer 5 Optimierungsziele + 5 Vorlagen
- **Scheduler-Statusbar:** Ein-Klick Start/Stop, letzte Optimierung
- **Fahrplan-Charts:** Leistungsbilanz (PV/Last/Batterie/Netz), SOC & Kosten, Thermischer Fahrplan
- **Controller-Modus:** Auto/Manuell/Aus Toggle
- **Aktive Stellgroessen:** 6 Kacheln (Batterie, WP-Modulation, WP-Thermisch, Kessel, Vorlauf, Quelle)
- **Manuelle Overrides:** Parameter-Dropdown + Wert setzen (im Manual-Modus)
- **Soll-Ist-Vergleich:** Plotly-Chart mit Abweichungshistorie
- **Stundentabelle:** 24h-Fahrplan mit hervorgehobener aktueller Stunde

---

## Technologie-Stack

### Backend

| Komponente | Technologie |
|---|---|
| API-Server | Python 3.12, FastAPI, SQLAlchemy 2.0 (async) |
| Datenbank | SQLite (Dev) / TimescaleDB (Prod) |
| Cache/Broker | Redis |
| ML Framework | scikit-learn, XGBoost |
| Optimizer | PuLP/CBC (MILP), Heuristik-Fallback |
| Hardware | pymodbus 3.7 (Modbus TCP), paho-mqtt (MQTT), httpx (REST) |
| Wetter | Open-Meteo API (kein API-Key noetig) |

### Web-Frontend

| Komponente | Technologie |
|---|---|
| Framework | React 19, TypeScript 5.7, Vite 6 |
| Styling | Tailwind CSS (Dark Theme) |
| State | Zustand 5 + API-Sync (localStorage Fallback) |
| Diagramme | Plotly.js (Trends, Sankey), SVG (Energiefluss, Radar), React Flow (Schemas) |
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
│   │   ├── api/
│   │   │   ├── router.py               # Alle Router registriert
│   │   │   ├── crud.py                  # Generische CRUD-Router-Factory
│   │   │   ├── websocket.py
│   │   │   └── endpoints/
│   │   │       ├── simulator.py         # Start/Stop/Status/Measurements
│   │   │       ├── optimizer.py         # Fahrplan erstellen (MILP/Heuristik)
│   │   │       ├── controller.py        # Modus/Override/History
│   │   │       ├── scheduler.py         # Start/Stop/Trigger/Status
│   │   │       ├── weather.py           # Wetter + PV/Last/Thermik-Prognosen
│   │   │       ├── lambda_hp.py         # Lambda WP Modbus TCP
│   │   │       ├── data_acquisition.py  # DAQ Start/Stop/Reload
│   │   │       ├── ml.py               # ML-Status/Train/Delete
│   │   │       ├── trends.py            # Zeitreihen-Abfrage + Statistik
│   │   │       └── settings.py          # SystemSettings CRUD
│   │   ├── models/
│   │   │   ├── config.py               # JSONB-Konfigurationsmodelle (8 Typen)
│   │   │   ├── measurement.py          # Zeitreihen-Messwerte
│   │   │   ├── weather.py              # Wetter-Cache
│   │   │   └── ml_status.py            # ML-Modell-Metadaten
│   │   ├── services/
│   │   │   ├── simulator.py            # Energie-Simulator (PV/WP/Bat/Last/Netz)
│   │   │   ├── optimizer.py            # Multi-Kriterien Heuristik + MILP-Wrapper
│   │   │   ├── optimizer_milp.py       # PuLP/CBC MILP-Solver
│   │   │   ├── controller.py           # Fahrplan → Stellgroessen → Anlage
│   │   │   ├── scheduler.py            # Periodische Optimierung + Lambda-Sync
│   │   │   ├── pv_forecast.py          # PV-Ertragsprognose (Transposition)
│   │   │   ├── load_forecast.py        # Last-Prognose (VDI 4655)
│   │   │   ├── thermal_forecast.py     # Thermische Prognose (U-Wert)
│   │   │   ├── weather.py              # Open-Meteo Wetter-Service
│   │   │   ├── data_acquisition.py     # Multi-Protokoll DAQ
│   │   │   ├── lambda_bridge.py        # Lambda WP ↔ Controller Bridge
│   │   │   └── ml/
│   │   │       ├── trainer.py           # XGBoost/sklearn Modell-Training
│   │   │       ├── predictor.py         # ML-Inferenz
│   │   │       └── features.py          # Feature-Engineering
│   │   ├── drivers/
│   │   │   └── lambda_hp.py            # Lambda Modbus TCP Treiber (Registerkarte)
│   │   └── core/
│   │       ├── database.py              # SQLAlchemy async Engine
│   │       └── redis.py                 # Redis-Client
│   ├── alembic/                         # DB-Migrationen
│   └── tests/
│
├── frontend/                            # React Web-Frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx                      # Router (React Router v7)
│       ├── api/client.ts               # Typisierter API-Client
│       ├── store/useEnergyStore.ts     # Zustand Store + Sync
│       ├── types/index.ts              # Alle TypeScript-Interfaces
│       ├── components/
│       │   ├── Layout.tsx               # Sidebar (18 Menue-Eintraege)
│       │   ├── LiveDashboard.tsx        # Echtzeit-Metrikkarten
│       │   ├── DashboardWidgets.tsx     # Wetter, PV, KPIs, Sparklines
│       │   ├── ui/                      # FormField, CommunicationForm
│       │   ├── trends/                 # TrendChart, Toolbar, Stats, Modal
│       │   ├── hydraulic/             # 25+ Hydraulik-Nodes (React Flow)
│       │   ├── electrical/            # 15 Strom-Nodes (React Flow)
│       │   └── shared/                # Cross-Schema, Junction, Kreuzungsboegen
│       ├── pages/
│       │   ├── DashboardPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── GeneratorsPage.tsx
│       │   ├── StoragePage.tsx
│       │   ├── CircuitsPage.tsx
│       │   ├── RoomsPage.tsx
│       │   ├── ConsumersPage.tsx
│       │   ├── MetersPage.tsx
│       │   ├── EnergyFlowPage.tsx
│       │   ├── SankeyPage.tsx
│       │   ├── HydraulicSchemaPageWrapper.tsx
│       │   ├── ElectricalSchemaPageWrapper.tsx
│       │   ├── OptimizerPage.tsx        # + Controller-Dashboard
│       │   ├── TrendsPage.tsx
│       │   ├── WeatherPage.tsx
│       │   └── SystemPage.tsx           # + Scheduler + Lambda WP
│       └── data/
│           └── seedBavaria.ts           # Testdaten MFH Bayern
│
└── deploy/
    └── raspberry-pi/                    # systemd Service, config.txt
```

---

## API-Uebersicht

### Konfiguration (CRUD)

| Prefix | Beschreibung |
|---|---|
| `/api/v1/generators` | Erzeuger (PV, WP, Kessel, BHKW, ...) |
| `/api/v1/storages` | Speicher (Batterie, Waerme, Kaelte) |
| `/api/v1/consumers` | Verbraucher + Wallboxen |
| `/api/v1/meters` | Zaehler (6 Kategorien) |
| `/api/v1/rooms` | Raeume |
| `/api/v1/circuits` | Heiz-/Kuehlkreise |
| `/api/v1/settings` | Systemeinstellungen (Singleton) |
| `/api/v1/trend-definitions` | Gespeicherte Trend-Ansichten |

### Kernfunktionen

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/v1/scheduler/status` | GET | Scheduler-Status + Statistiken |
| `/api/v1/scheduler/start` | POST | Scheduler starten (Intervall, Auto-Modus) |
| `/api/v1/scheduler/stop` | POST | Scheduler stoppen |
| `/api/v1/scheduler/trigger` | POST | Manuell Optimierung ausloesen |
| `/api/v1/optimizer/schedule` | GET | Fahrplan erstellen (24-72h, MILP/Heuristik) |
| `/api/v1/controller/status` | GET | Controller-Modus + Stellgroessen |
| `/api/v1/controller/mode` | POST | Modus umschalten (auto/manual/off) |
| `/api/v1/controller/override` | POST | Manuellen Stellwert setzen |
| `/api/v1/controller/history` | GET | Soll-Ist-Abweichung (24h) |
| `/api/v1/simulator/start` | POST | Simulator starten (Intervall, Speed) |
| `/api/v1/simulator/stop` | POST | Simulator stoppen |

### Prognosen & Wetter

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/v1/weather/current` | GET | Aktuelles Wetter (Open-Meteo) |
| `/api/v1/weather/forecast` | GET | 7-Tage Wettervorhersage |
| `/api/v1/weather/pv-forecast` | GET | PV-Ertragsprognose (72h) |
| `/api/v1/weather/load-forecast` | GET | Lastprognose VDI 4655 (72h) |
| `/api/v1/weather/thermal-forecast` | GET | Thermische Prognose (72h) |
| `/api/v1/ml/status` | GET | ML-Modell-Status |
| `/api/v1/ml/train` | POST | ML-Modelle trainieren |

### Hardware

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/v1/lambda-hp/connect` | POST | Lambda WP Modbus-Verbindung |
| `/api/v1/lambda-hp/status` | GET | Lambda WP Status + Module |
| `/api/v1/lambda-hp/values` | GET | Alle Modbus-Werte lesen |
| `/api/v1/lambda-hp/write` | POST | Stellwert schreiben (Register) |
| `/api/v1/lambda-hp/pv-surplus` | POST | PV-Ueberschuss melden |
| `/api/v1/daq/start` | POST | Datenerfassung starten |
| `/api/v1/trends/data` | GET | Zeitreihen-Abfrage (Aggregation) |

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
| Verbraucher | 6 Haushalte (2600–3500 kWh/a), 2 Wallboxen 11 kW (OCPP), Allgemeinstrom |
| Zaehler | 11 Zaehler in allen 6 Kategorien |

---

## Entwicklungsfortschritt

| Phase | Beschreibung | Status |
|---|---|---|
| Phase 1 | Fundament (Backend + Web-Frontend + Install-Script) | Abgeschlossen |
| Phase 1b | Backend-Anbindung (JSONB + API + Alembic) | Abgeschlossen |
| Phase 1c | Optimierer-UI (Radar-Diagramm, Gewichtungen) | Abgeschlossen |
| Phase 2a | Simulator + Hydraulik-/Stromschema | Abgeschlossen |
| Phase 2b | Trend-Erfassung & Zeitreihen-Analyse | Abgeschlossen |
| Phase 2c | Wetter-API + PV/Last/Thermik-Prognosen + Dashboard-Upgrade | Abgeschlossen |
| Phase 2d | MILP-Optimierer + ML-Prognosekorrektur + Auto-Retrain | Abgeschlossen |
| Phase 2e | Controller + Scheduler + Lambda WP + Controller-Dashboard | Abgeschlossen |
| Phase 3 | Authentifizierung, Tests, weitere Treiber | Ausstehend |
| Phase 4 | Mobile App (Flutter) | Ausstehend |
| Phase 5 | Produktion (Edge-Deployment, Monitoring) | Ausstehend |

---

## Installation

### Automatische Installation (Raspberry Pi)

```bash
git clone https://github.com/daTobi1/Energiemanager.git
cd Energiemanager
sudo bash install.sh
```

Das Script fuehrt 9 Schritte aus: Basistools, Docker, Node.js, Python, Repository, .env + Docker-Infrastruktur, Backend-venv, Frontend-Build, systemd-Services.

### Deinstallation

```bash
sudo bash uninstall.sh
```

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
npm run dev                      # -> http://localhost:3000

# Testdaten laden
npx vite-node scripts/seed-backend.ts

# Simulator starten (5s Intervall, 60x Zeitraffer)
curl -X POST "http://localhost:8000/api/v1/simulator/start?interval=5&speed=60"

# Scheduler starten (automatische Optimierung alle 15 min)
curl -X POST "http://localhost:8000/api/v1/scheduler/start?optimization_interval=900&auto_mode=true"
```

### Lokale Entwicklung (mit Docker/PostgreSQL)

```bash
docker-compose up -d db redis

DATABASE_URL=postgresql+asyncpg://energiemanager:secret@localhost:5432/energiemanager \
  uvicorn app.main:app --reload
```

### Nach der Installation

| Dienst | URL | Beschreibung |
|---|---|---|
| Web-Frontend | `http://<ip>:3000` (Dev) / `http://<ip>:8080` (Prod) | Konfigurationsoberflaeche |
| API | `http://<ip>:8000` | FastAPI Backend |
| API Docs | `http://<ip>:8000/docs` | Swagger UI |
| Grafana | `http://<ip>:3000` | Monitoring Dashboards |

---

## Kommunikationsprotokolle

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

## Contributing

Dieses Projekt ist in aktiver Entwicklung. Beitraege sind willkommen!

1. Fork erstellen
2. Feature-Branch anlegen (`git checkout -b feature/mein-feature`)
3. Aenderungen committen
4. Branch pushen (`git push origin feature/mein-feature`)
5. Pull Request erstellen

---

## Lizenz

MIT License — siehe [LICENSE](LICENSE)
