# EnergyManager — Intelligentes Energiemanagementsystem

> **STATUS: Phase 3 — Absicherung (aktiv)**
>
> Kernfunktionen (Optimierer, Regelung, Prognosen, ML, Lademanagement) sind abgeschlossen.
> Phase 3 haertet das System fuer den Produktivbetrieb auf dem Raspberry Pi.

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
│  │  19 Seiten · Klappbare Sidebar · Dark Theme · Plotly · R.Flow   │    │
│  └──────────────────────────┬──────────────────────────────────────┘    │
│                              │ REST API + WebSocket                     │
│  ┌──────────────────────────┴──────────────────────────────────────┐    │
│  │                    Backend (FastAPI)                              │    │
│  │                                                                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │    │
│  │  │Prognosen │ │Optimierer│ │Controller│ │   Scheduler      │    │    │
│  │  │PV · Last │ │MILP/CBC  │ │Auto/Man. │ │   (15min-Zyklus) │    │    │
│  │  │Thermisch │ │Heuristik │ │Safety    │ │   ML-Retrain 24h │    │    │
│  │  │ML-Korr.  │ │5-Krit.   │ │Setpoints │ │   Device-Sync    │    │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘    │    │
│  │                                                                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │    │
│  │  │Simulator │ │Wetter-API│ │Lade-     │ │  Alarm-Manager   │    │    │
│  │  │PV/WP/Bat │ │Open-Meteo│ │management│ │  Schwellwerte    │    │    │
│  │  │Last/Netz │ │7-Tage    │ │4 Modi    │ │  Device-Offline  │    │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘    │    │
│  │                                                                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────────┐  │    │
│  │  │Selbst-   │ │Geraete-  │ │  Hardware-Anbindung              │  │    │
│  │  │lernung   │ │Manager   │ │  Modbus TCP · SunSpec · MQTT     │  │    │
│  │  │XGBoost   │ │Presets   │ │  REST · BACnet · KNX · OPC UA   │  │    │
│  │  │Readiness │ │Polling   │ │  SML · M-Bus · OCPP             │  │    │
│  │  └──────────┘ └──────────┘ └──────────────────────────────────┘  │    │
│  │                                                                   │    │
│  │  SQLite (Dev) · TimescaleDB (Prod) · Redis · Grafana             │    │
│  └───────────────────────────────────────────────────────────────────┘    │
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
        → Device-Manager → Modbus TCP → Anlage (Realbetrieb)
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

### Selbstlernung

- **3 ML-Modelle:** PV-Korrektur, Last-Korrektur, Thermische Korrektur
- **Aktivierungsmodi:** Passiv (Daten sammeln), Aktiv (Prognose korrigieren), Aus
- **Readiness-Bewertung:** 4 Kriterien (Datenmenge, Genauigkeit, Fehlerrate, Aktualitaet)
- **Thermische Raumparameter:** Automatische Ermittlung von Zeitkonstanten und Heizkurven
- **Activation Gate:** ML-Korrektur nur bei ausreichender Readiness aktiv

### Lademanagement (E-Mobilitaet)

4 intelligente Lademodi mit Solar/Grid-Tracking:

| Modus | Beschreibung |
|---|---|
| **Sofort** | Maximale Ladeleistung (AC bis 11 kW) |
| **PV-Ueberschuss** | Nur Solarstrom — pausiert ohne Ueberschuss |
| **Min+PV** | Garantierte Mindestleistung + PV-Boost |
| **Zielladung** | Ziel-km bis Zeitpunkt, PV-optimiert |

- **Fahrzeugdatenbank:** Fahrzeuge mit Batterie, Verbrauch, SoC-Limit
- **Wallbox-Sync:** Automatische Erkennung aus Verbraucher-Config (type=wallbox)
- **Session-Tracking:** Energie, Solar/Grid-Split, Kosten, Dauer pro Ladevorgang
- **Ladeauswertung:** Aggregierte Analyse ueber beliebige Zeitraeume (Tag/Woche/Monat), Leistungsdiagramme, Modus-Verteilung, CSV-Export

### Alarmsystem

- **Schwellwert-Alarme:** Konfigurierbare Bedingungen (>, <, >=, <=, ==)
- **System-Alarme:** Geraet offline, Systemfehler
- **3 Schweregrade:** Info, Warnung, Kritisch
- **Cooldown:** Konfigurierbare Wiederholsperre pro Alarm
- **Periodische Auswertung:** Automatische Pruefung im konfigurierbaren Intervall

---

## Web-Frontend

19 Seiten, Dark Theme, React 19 + TypeScript + Tailwind CSS.
Klappbare Sidebar mit 6 Gruppen — Gruppen oeffnen sich automatisch bei Navigation.

### Seiten

| Gruppe | Seite | Beschreibung |
|---|---|---|
| — | **Dashboard** | Live-Metriken (8 Karten), WebSocket-Streaming, Wetter, PV-Prognose, KPIs |
| Visualisierung | **Hydraulikschema** | React-Flow-Editor: 25+ Node-Typen, Kreuzungsboegen, Cross-Schema-Links |
| | **Stromschema** | React-Flow-Editor: 15 Node-Typen, Sammelschiene, UV, LS-Schalter |
| | **Energiefluss** | Interaktives 11-Spalten SVG-Diagramm, animierte Fluesse |
| | **Sankey** | Jahres-Energiebilanz (Plotly.js) |
| | **Trends** | Plotly-Zeitreihen: Dual Y-Achse, Prognose-Overlay, CSV-Export |
| | **Wetter & Prognose** | Aktuelles Wetter, 7-Tage-Vorhersage, PV/Last/Thermik-Prognosen |
| Steuerung | **Optimierer** | Radar-Diagramm (5 Achsen), Fahrplan-Charts, Controller-Dashboard |
| | **Selbstlernung** | ML-Modell-Status, Readiness-Anzeige, Aktivierungssteuerung, Raumparameter |
| E-Mobilitaet | **Lademanagement** | Wallbox-Status, Session-Steuerung, Fahrzeuge, SoC-Tracking, 30-Tage-Statistik |
| | **Ladeauswertung** | Zeitraum-Analyse, Energie-Balken, Leistungs-Liniendiagramm, Modus-Donut, Perioden-Tabelle |
| Anlage | **Standort & Gebaeude** | Gebaeudedaten, Koordinaten, Tarife, Optimierer-Gewichtung |
| | **Erzeuger** | PV, BHKW, Waermepumpe, Heizkessel, Kaeltemaschine, Windrad |
| | **Speicher** | Batterie (LFP/NMC), Waerme-/Kaeltespeicher |
| | **Heiz-/Kaeltekreise** | Fussbodenheizung, Radiatoren, Mischer/Pumpen/Ventile |
| | **Raeume** | Wohneinheiten mit Heizplan, Temperatur-Sollwerten |
| | **Verbraucher** | Haushalte, Wallboxen (OCPP), Beleuchtung, HVAC |
| | **Zaehler** | Energiezaehler mit 6 Kategorien, Zaehlerhierarchie |
| | **Quellen** | Solarthermie, Erdsonden, Brunnen |
| | **Sensoren** | Temperaturfuehler, Drucksensoren, Durchflussmesser |
| System | **Systemverwaltung** | Backend-Status, DAQ, Scheduler, Geraete-Manager, Zeit, Updates |
| | **Alarme** | Alarm-Definitionen, Ereignis-Protokoll, Quittierung |

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
| Diagramme | Plotly.js (Trends, Sankey, Analytics), SVG (Energiefluss, Radar), React Flow (Schemas) |
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
│   │   │       ├── charging.py          # Lademanagement + Analytics
│   │   │       ├── alarms.py            # Alarm-Definitionen + Ereignisse
│   │   │       ├── self_learning.py     # Selbstlernung-Steuerung
│   │   │       ├── devices.py           # Geraete-Manager + Presets
│   │   │       ├── thermal.py           # Thermische Raumparameter
│   │   │       ├── data_acquisition.py  # DAQ Start/Stop/Reload
│   │   │       ├── ml.py               # ML-Status/Train/Delete
│   │   │       ├── trends.py            # Zeitreihen-Abfrage + Statistik
│   │   │       └── settings.py          # SystemSettings CRUD
│   │   ├── models/
│   │   │   ├── config.py               # JSONB-Konfigurationsmodelle (8 Typen)
│   │   │   ├── charging.py             # Vehicle, Wallbox, ChargingSession
│   │   │   ├── alarm.py                # AlarmDefinition, AlarmEvent
│   │   │   ├── user.py                 # User (Auth vorbereitet)
│   │   │   ├── thermal_params.py       # Gelernte thermische Parameter
│   │   │   ├── measurement.py          # Zeitreihen-Messwerte
│   │   │   ├── weather.py              # Wetter-Cache
│   │   │   └── ml_status.py            # ML-Modell-Metadaten
│   │   ├── services/
│   │   │   ├── simulator.py            # Energie-Simulator (PV/WP/Bat/Last/Netz)
│   │   │   ├── optimizer.py            # Multi-Kriterien Heuristik + MILP-Wrapper
│   │   │   ├── optimizer_milp.py       # PuLP/CBC MILP-Solver
│   │   │   ├── controller.py           # Fahrplan → Stellgroessen → Anlage
│   │   │   ├── scheduler.py            # Periodische Optimierung + Device-Sync
│   │   │   ├── charging_manager.py     # 4 Lademodi + Solar/Grid-Tracking
│   │   │   ├── alarm_manager.py        # Alarm-Auswertung + Cooldown
│   │   │   ├── device_manager.py       # Multi-Protokoll Geraete-Polling
│   │   │   ├── room_thermal_model.py   # Thermische Raummodellierung
│   │   │   ├── pv_forecast.py          # PV-Ertragsprognose (Transposition)
│   │   │   ├── load_forecast.py        # Last-Prognose (VDI 4655)
│   │   │   ├── thermal_forecast.py     # Thermische Prognose (U-Wert)
│   │   │   ├── weather.py              # Open-Meteo Wetter-Service
│   │   │   ├── data_acquisition.py     # Multi-Protokoll DAQ
│   │   │   └── ml/
│   │   │       ├── trainer.py           # XGBoost/sklearn Modell-Training
│   │   │       ├── predictor.py         # ML-Inferenz + Activation Gate
│   │   │       ├── features.py          # Feature-Engineering
│   │   │       ├── readiness.py         # 4-Kriterien Readiness-Bewertung
│   │   │       └── thermal_learner.py   # Thermische Raumparameter-Lernung
│   │   ├── drivers/
│   │   │   └── presets/                 # Geraete-Profile (YAML)
│   │   └── core/
│   │       ├── database.py              # SQLAlchemy async Engine
│   │       └── redis.py                 # Redis-Client
│   ├── scripts/
│   │   ├── seed_charging.py             # Lade-Simulationsdaten (90 Tage)
│   │   └── seed_self_learning.py        # ML-Beispieldaten
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
│       │   ├── Layout.tsx               # Klappbare Sidebar (6 Gruppen, 19 Seiten)
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
│       │   ├── SourcesPage.tsx
│       │   ├── SensorsPage.tsx
│       │   ├── EnergyFlowPage.tsx
│       │   ├── SankeyPage.tsx
│       │   ├── HydraulicSchemaPageWrapper.tsx
│       │   ├── ElectricalSchemaPageWrapper.tsx
│       │   ├── OptimizerPage.tsx        # + Controller-Dashboard
│       │   ├── TrendsPage.tsx
│       │   ├── WeatherPage.tsx
│       │   ├── SystemPage.tsx           # + Scheduler + Geraete-Manager
│       │   ├── AlarmsPage.tsx
│       │   ├── SelfLearningPage.tsx
│       │   ├── ChargingPage.tsx         # Lademanagement
│       │   └── ChargingAnalyticsPage.tsx # Ladeauswertung
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
| `/api/v1/sources` | Quellen (Solarthermie, Erdsonde, Brunnen) |
| `/api/v1/sensors` | Sensoren |
| `/api/v1/settings` | Systemeinstellungen (Singleton) |
| `/api/v1/trend-definitions` | Gespeicherte Trend-Ansichten |
| `/api/v1/alarm-definitions` | Alarm-Definitionen |

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

### Lademanagement

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/v1/charging/status` | GET | Wallboxen + aktive Sessions + 30-Tage-Statistik |
| `/api/v1/charging/sessions` | GET/POST | Sessions auflisten / erstellen |
| `/api/v1/charging/sessions/{id}/start` | POST | Ladevorgang starten |
| `/api/v1/charging/sessions/{id}/stop` | POST | Ladevorgang stoppen |
| `/api/v1/charging/sessions/{id}/mode` | PUT | Lademodus wechseln |
| `/api/v1/charging/analytics` | GET | Aggregierte Auswertung (Zeitraum, Gruppierung) |
| `/api/v1/charging/vehicles` | GET/POST | Fahrzeug-Verwaltung |
| `/api/v1/charging/sync-wallboxes` | POST | Wallboxen aus Verbraucher-Config synchronisieren |

### Selbstlernung & Alarme

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/v1/self-learning/status` | GET | ML-Modelle + Readiness + Thermische Raumparameter |
| `/api/v1/self-learning/models/{type}/mode` | PUT | Aktivierungsmodus setzen (passiv/aktiv/aus) |
| `/api/v1/self-learning/thermal/learn` | POST | Thermische Raumparameter lernen |
| `/api/v1/alarms/events` | GET | Alarm-Ereignis-Protokoll |
| `/api/v1/alarms/events/active` | GET | Aktive (unquittierte) Alarme |
| `/api/v1/alarms/events/{id}/acknowledge` | POST | Alarm quittieren |
| `/api/v1/alarms/evaluate` | POST | Manuell Alarm-Auswertung ausloesen |

### Hardware & Geraete

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/v1/devices/presets` | GET | Geraete-Profile (YAML-Katalog) |
| `/api/v1/devices/status` | GET | Geraete-Manager Status + verbundene Geraete |
| `/api/v1/devices/{id}/values` | GET | Aktuelle Werte eines Geraets |
| `/api/v1/devices/{id}/write` | POST | Stellwert schreiben |
| `/api/v1/daq/start` | POST | Datenerfassung starten |
| `/api/v1/trends/data` | GET | Zeitreihen-Abfrage (Aggregation) |

---

## Testdaten

### MFH Bayern (Seed via Dashboard)

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

### Lade-Simulationsdaten (Seed-Script)

```bash
cd backend && .venv/Scripts/python scripts/seed_charging.py
```

Erzeugt ~48 realistische Ladesessions ueber 90 Tage:
- 2 Fahrzeuge (Tesla Model 3 LR, VW ID.4 Pro)
- 4 Lademodi mit realistischen Energiewerten, Solar/Grid-Split und Kosten
- Leistung 2.5–11 kW je nach Modus, Dauer 30 min – 8h

### ML-Beispieldaten

```bash
cd backend && .venv/Scripts/python scripts/seed_self_learning.py
```

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
| Phase 3 | Absicherung: Alarme, Lademanagement, Selbstlernung, Geraete-Manager, Auth | **In Arbeit** |
| Phase 4 | Mobile App (Flutter / PWA-Ausbau) | Ausstehend |
| Phase 5 | Produktion (Edge-Deployment, Monitoring) | Ausstehend |

---

## Installation

### Automatische Installation (Raspberry Pi)

Ein-Befehl-Installation — kein `git` oder `curl` noetig:

```bash
sudo apt-get update -qq && sudo apt-get install -y curl -qq
curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/install.sh | sudo bash
```

Non-interaktiv (z.B. fuer Automatisierung):

```bash
curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/install.sh | sudo bash -s -- --yes
```

Das Script fuehrt 9 Schritte aus: Basistools, Docker, Node.js, Python, Repository, .env + Docker-Infrastruktur, Backend-venv, Frontend-Build, systemd-Services.

### Deinstallation

```bash
curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/uninstall.sh | sudo bash
```

Non-interaktiv (alles entfernen):

```bash
curl -fsSL https://raw.githubusercontent.com/daTobi1/Energiemanager/master/uninstall.sh | sudo bash -s -- --yes
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
npm run dev                      # -> http://localhost:5173

# Testdaten laden
npx vite-node scripts/seed-backend.ts

# Lade-Simulationsdaten
cd ../backend && python scripts/seed_charging.py

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
| Web-Frontend | `http://<ip>:5173` (Dev) / `http://<ip>:8080` (Prod) | Konfigurationsoberflaeche |
| API | `http://<ip>:8000` | FastAPI Backend |
| API Docs | `http://<ip>:8000/docs` | Swagger UI |
| Grafana | `http://<ip>:3001` (Prod) | Monitoring Dashboards (admin/admin) |

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
