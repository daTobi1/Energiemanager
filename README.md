# EnergyManager — Intelligentes Energiemanagementsystem

> **STATUS: IN ENTWICKLUNG / WORK IN PROGRESS**
>
> Dieses Projekt befindet sich in einer fruehen Entwicklungsphase und ist **noch nicht funktionsfaehig**.
> APIs, Datenmodelle und Schnittstellen koennen sich jederzeit aendern.
> Beitraege und Feedback sind willkommen — siehe [Contributing](#contributing).

---

## Vision

Ein selbstlernendes, prognosebasiertes Energiemanagementsystem für Gebäude und Liegenschaften, das Erzeugung, Speicherung, Verbrauch und E-Mobilität ganzheitlich optimiert.

---

## Systemübersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EnergyManager Core                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Erzeugungs- │  │  Speicher-   │  │     Lademanagement       │  │
│  │  management  │  │  management  │  │     (Wallboxen/EVs)      │  │
│  │              │  │              │  │                          │  │
│  │ • PV-Anlage  │  │ • Batterie   │  │ • Modus 1: Max Speed    │  │
│  │ • Wärmepumpe │  │   (Strom)    │  │ • Modus 2: PV-Überschuss│  │
│  │ • BHKW       │  │ • Wärme-     │  │ • Modus 3: Zielladung   │  │
│  │ • Heizkessel │  │   speicher   │  │                          │  │
│  │ • Kälte-     │  │ • Kälte-     │  │                          │  │
│  │   maschine   │  │   speicher   │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
│  ┌──────┴─────────────────┴────────────────────────┴─────────────┐  │
│  │                    Optimizer / Scheduler                       │  │
│  │         (Prognosebasierte Einsatzplanung & Regelung)          │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────┴────────────────────────────────────┐  │
│  │                     ML / Analytics Engine                      │  │
│  │        (Selbstlernendes Prognose- & Optimierungsmodul)        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────────┐ │
│  │  Daten-       │  │  REST API     │  │   Mobile App (Flutter)  │ │
│  │  sammlung     │  │  (FastAPI)    │  │                         │ │
│  │  (TimescaleDB)│  │               │  │                         │ │
│  └───────────────┘  └───────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module im Detail

### 1. Erzeugungsmanagement

Steuert alle Energieerzeuger prognosebasiert.

| Erzeuger | Energieform | Steuerbar | Beschreibung |
|---|---|---|---|
| PV-Anlage | Strom | Nein (prognostiziert) | Erzeugungsprognose via Wetter-API + ML |
| Wärmepumpe | Wärme/Kälte + Strom(verbrauch) | Ja | Flexibler Einsatz je nach Bedarf & Strompreis |
| BHKW | Strom + Wärme | Ja | Kraft-Wärme-Kopplung, wärme-/stromgeführt |
| Heizkessel | Wärme | Ja | Spitzenlastabdeckung |
| Kältemaschine | Kälte | Ja | Klimatisierung, Prozesskälte |

**Prognosen:**
- **PV-Erzeugung:** Wettervorhersage (Globalstrahlung, Temperatur, Bewölkung) → ML-Modell → kWh/15min
- **Wärmebedarf:** Außentemperaturprognose + Gebäudemodell + Nutzungsprofile → kWh/15min
- **Kältebedarf:** Außentemperatur + Solarstrahlung + interne Lasten → kWh/15min
- **Strombedarf:** Historische Last + Wochentag/Feiertag + Wetter → kWh/15min

### 2. Speichermanagement

Optimiert Lade-/Entladezyklen basierend auf Prognosen.

| Speicher | Medium | Kapazität (konfigurierbar) | Strategie |
|---|---|---|---|
| Batteriespeicher | Strom | z.B. 10–100 kWh | Eigenverbrauch maximieren, Peak-Shaving |
| Warmwasserspeicher | Wärme | z.B. 500–5000 Liter | Wärme puffern, WP-Laufzeiten optimieren |
| Kältespeicher | Kälte | z.B. 500–2000 Liter | Kälteerzeugung in günstige Zeiten verlagern |

**Regelstrategie:**
- State-of-Charge (SoC) Tracking in Echtzeit
- Prognosebasiertes Laden: Speicher laden, wenn Überschuss erwartet wird
- Prognosebasiertes Entladen: Speicher entladen, bevor Bedarf erwartet wird
- Alterungsoptimierung: Batterie-SoC zwischen 20–80% halten wenn möglich

### 3. Lademanagement (Wallboxen / Elektroautos)

Steuert das Laden von Elektrofahrzeugen über Wallboxen mit drei wählbaren Modi.

#### Modus 1 — Maximale Ladeleistung
- Lädt sofort mit maximaler verfügbarer Leistung
- Netzstrombezug erlaubt
- Anwendungsfall: Schnell laden, egal woher der Strom kommt

#### Modus 2 — PV-Überschussladen
- Lädt **nur** wenn erneuerbarer Überschussstrom vorhanden ist
- Dynamische Anpassung der Ladeleistung an verfügbaren Überschuss
- Mindestladeleistung konfigurierbar (z.B. 1,4 kW = 6A einphasig)
- Hysterese, um ständiges An/Aus zu vermeiden

#### Modus 3 — Zielladung
- Nutzer gibt ein:
  - **Aktueller Akkustand** (%) — wird wenn möglich vom Fahrzeug abgefragt
  - **Gewünschte Kilometer** bis Zeitpunkt X
  - **Zielzeitpunkt** (z.B. "Morgen 7:00 Uhr")
- System berechnet:
  - Benötigte Energiemenge (km → kWh via Fahrzeugprofil)
  - Optimalen Ladeplan: bevorzugt PV-Überschuss, Rest in günstigen Zeiten
  - Garantiert Fertigstellung bis zum Zielzeitpunkt

### 4. Prognose-Engine

Alle Entscheidungen basieren auf Prognosen. Das System arbeitet mit einem rollierenden 48h-Horizont in 15-Minuten-Auflösung.

```
Eingabedaten                    Prognosemodell                 Ausgabe
─────────────                   ──────────────                 ───────
Wetter-API (Temperatur,    ─┐
Strahlung, Wind, Bewölkung) │
                             ├─► ML-Pipeline ──────────► PV-Erzeugung [kW/15min]
Historische PV-Daten ───────┘   (Gradient Boosting     Strombedarf  [kW/15min]
                                 + LSTM Fallback)       Wärmebedarf  [kW/15min]
Historische Lastdaten ──────┐                           Kältebedarf  [kW/15min]
                             ├─► Feature Engineering
Kalender (Wochentag,        │   + Training Pipeline
Feiertag, Ferien) ──────────┘
```

**ML-Ansatz:**
- **Phase 1 (Kaltstart):** Regelbasierte Prognosen mit Standardprofilen
- **Phase 2 (nach ~2 Wochen):** Gradient Boosting (XGBoost/LightGBM) auf gesammelten Daten
- **Phase 3 (nach ~3 Monaten):** LSTM/Transformer-Modelle für Zeitreihen, automatisches Retraining

### 5. Optimizer / Scheduler

Zentrale Optimierungslogik, die alle Komponenten koordiniert.

**Optimierungsziel:**
```
Minimiere: Gesamtkosten = Strombezugskosten
                         + Gasbezugskosten
                         - Einspeisevergütung
                         + Verschleißkosten (Batterie, BHKW)

Unter Nebenbedingungen:
  - Wärmebedarf muss zu jeder Zeit gedeckt sein
  - Kältebedarf muss zu jeder Zeit gedeckt sein
  - Strombedarf muss zu jeder Zeit gedeckt sein
  - Alle Lademodi-Anforderungen müssen erfüllt werden
  - Speicher-SoC innerhalb Grenzen
  - Leistungsgrenzen aller Erzeuger einhalten
```

**Algorithmus:**
- Rollierende Optimierung mit 48h Horizont, alle 15 Minuten neu berechnet
- Mixed-Integer Linear Programming (MILP) via PuLP/OR-Tools
- Fallback auf regelbasierte Heuristik bei Solver-Fehlern

### 6. Selbstlernendes System (ML/Analytics Engine)

Das System sammelt kontinuierlich Daten und verbessert sich selbständig.

**Datensammlung:**
- Alle Sensordaten (Temperaturen, Leistungen, SoC) im 1-Sekunden-Takt
- Aggregation auf 1min / 15min / 1h / 1d
- Wetterdaten (Ist + Prognose) für Prognosequalitätsbewertung
- Nutzerverhalten (Lademodi, Zeitpunkte, Fahrstrecken)

**Selbstlernende Regelung:**
1. **Prognose-Verbesserung:** Modelle werden wöchentlich mit neuen Daten nachtrainiert
2. **Regelparameter-Anpassung:** Hysterese-Werte, Schwellwerte, SoC-Grenzen werden optimiert
3. **Nutzerprofil-Lernen:** Typische Ladezeiten, Fahrmuster, Komfortpräferenzen
4. **Anomalie-Erkennung:** Ungewöhnliche Verbräuche oder Erzeugungsmuster melden
5. **A/B-Testing:** Regelstrategien werden verglichen und die bessere übernommen

---

## Technologie-Stack

### Backend
| Komponente | Technologie | Begründung |
|---|---|---|
| API-Server | **Python + FastAPI** | Async, schnell, OpenAPI-Docs automatisch |
| Datenbank | **TimescaleDB** (PostgreSQL) | Optimiert für Zeitreihendaten |
| Message Broker | **Redis** (Pub/Sub + Cache) | Echtzeitkommunikation zwischen Modulen |
| Task Queue | **Celery + Redis** | Periodische Tasks (Prognosen, Retraining) |
| ML Framework | **scikit-learn + XGBoost + PyTorch** | Prognose- und Optimierungsmodelle |
| Optimizer | **PuLP / Google OR-Tools** | MILP-Solver für Einsatzplanung |
| Hardware-Anbindung | **Modbus TCP / MQTT / REST** | Kommunikation mit Wechselrichtern, Wallboxen etc. |

### Mobile App
| Komponente | Technologie | Begründung |
|---|---|---|
| Framework | **Flutter** | Cross-Platform (iOS + Android) |
| State Management | **Riverpod** | Reaktiv, testbar |
| API-Kommunikation | **Dio + WebSocket** | REST + Echtzeit-Updates |

### Infrastruktur
| Komponente | Technologie | Begründung |
|---|---|---|
| Container | **Docker + Docker Compose** | Reproduzierbare Deployments |
| Edge-Gerät | **Raspberry Pi 4/5 oder Mini-PC** | Lokaler Betrieb |
| Monitoring | **Grafana + Prometheus** | System-Überwachung |

---

## Projektstruktur

```
energiemanager/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
│
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/                    # DB-Migrationen
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI App Entry Point
│   │   ├── config.py               # Settings & Environment
│   │   │
│   │   ├── api/                    # REST API Endpoints
│   │   │   ├── __init__.py
│   │   │   ├── router.py           # Zentraler Router
│   │   │   ├── endpoints/
│   │   │   │   ├── dashboard.py    # Übersichtsdaten
│   │   │   │   ├── generators.py   # Erzeuger-Steuerung
│   │   │   │   ├── storage.py      # Speicher-Status & Steuerung
│   │   │   │   ├── charging.py     # Lademanagement & Modi
│   │   │   │   ├── forecasts.py    # Prognosen abrufen
│   │   │   │   └── settings.py     # Systemkonfiguration
│   │   │   └── websocket.py        # Echtzeit-Updates
│   │   │
│   │   ├── models/                 # Datenbank-Modelle (SQLAlchemy)
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── generator.py        # Erzeuger (PV, WP, BHKW...)
│   │   │   ├── storage.py          # Speicher (Batterie, Wärme...)
│   │   │   ├── charging.py         # Wallboxen, Ladesessions
│   │   │   ├── measurement.py      # Messwerte / Zeitreihen
│   │   │   └── forecast.py         # Prognosedaten
│   │   │
│   │   ├── schemas/                # Pydantic Schemas (API DTOs)
│   │   │   ├── __init__.py
│   │   │   ├── generator.py
│   │   │   ├── storage.py
│   │   │   ├── charging.py
│   │   │   └── forecast.py
│   │   │
│   │   ├── services/               # Business-Logik
│   │   │   ├── __init__.py
│   │   │   ├── generation_manager.py    # Erzeugungsmanagement
│   │   │   ├── storage_manager.py       # Speichermanagement
│   │   │   ├── charging_manager.py      # Lademanagement
│   │   │   ├── optimizer.py             # Zentrale Optimierung (MILP)
│   │   │   └── scheduler.py             # Einsatzplanung
│   │   │
│   │   ├── forecasting/            # Prognose-Engine
│   │   │   ├── __init__.py
│   │   │   ├── weather.py          # Wetter-API Anbindung
│   │   │   ├── pv_forecast.py      # PV-Erzeugungsprognose
│   │   │   ├── load_forecast.py    # Lastprognose (Strom)
│   │   │   ├── thermal_forecast.py # Wärme-/Kältebedarfsprognose
│   │   │   └── base.py             # Basis-Klasse für Prognosen
│   │   │
│   │   ├── ml/                     # Machine Learning
│   │   │   ├── __init__.py
│   │   │   ├── trainer.py          # Modell-Training Pipeline
│   │   │   ├── features.py         # Feature Engineering
│   │   │   ├── model_store.py      # Modell-Versionierung & Laden
│   │   │   └── anomaly.py          # Anomalie-Erkennung
│   │   │
│   │   ├── connectors/             # Hardware-Anbindung
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # Abstrakte Connector-Klasse
│   │   │   ├── modbus_connector.py # Modbus TCP (Wechselrichter etc.)
│   │   │   ├── mqtt_connector.py   # MQTT (Sensoren, IoT)
│   │   │   └── wallbox_connector.py # Wallbox-APIs (OCPP, proprietär)
│   │   │
│   │   └── core/                   # Kernfunktionen
│   │       ├── __init__.py
│   │       ├── database.py         # DB-Verbindung
│   │       ├── redis.py            # Redis-Verbindung
│   │       ├── events.py           # Event-Bus (Pub/Sub)
│   │       └── logging.py          # Strukturiertes Logging
│   │
│   └── tests/
│       ├── conftest.py
│       ├── test_generation.py
│       ├── test_storage.py
│       ├── test_charging.py
│       ├── test_forecasting.py
│       └── test_optimizer.py
│
├── mobile/                         # Flutter Mobile App
│   ├── pubspec.yaml
│   ├── lib/
│   │   ├── main.dart
│   │   ├── app.dart
│   │   │
│   │   ├── models/                 # Datenmodelle
│   │   │   ├── generator.dart
│   │   │   ├── storage.dart
│   │   │   ├── charging_session.dart
│   │   │   └── forecast.dart
│   │   │
│   │   ├── providers/              # Riverpod Providers
│   │   │   ├── dashboard_provider.dart
│   │   │   ├── charging_provider.dart
│   │   │   └── settings_provider.dart
│   │   │
│   │   ├── services/               # API-Kommunikation
│   │   │   ├── api_service.dart
│   │   │   └── websocket_service.dart
│   │   │
│   │   └── screens/                # UI Screens
│   │       ├── dashboard_screen.dart    # Übersicht: Energieflüsse
│   │       ├── generation_screen.dart   # Erzeuger-Details
│   │       ├── storage_screen.dart      # Speicher-Details
│   │       ├── charging_screen.dart     # Lademanagement & Modi
│   │       └── settings_screen.dart     # Konfiguration
│   │
│   └── test/
│
└── docs/
    ├── architecture.md             # Detaillierte Architektur
    ├── api.md                      # API-Dokumentation
    └── deployment.md               # Deployment-Anleitung
```

---

## Entwicklungsfortschritt

| Phase | Beschreibung | Status |
|---|---|---|
| Phase 1 | Fundament (Struktur, Models, API) | Abgeschlossen |
| Phase 2 | Kernlogik (Steuerung, Prognosen, Optimierer) | Ausstehend |
| Phase 3 | Intelligenz (ML, MILP, Selbstlernen) | Ausstehend |
| Phase 4 | Mobile App (Flutter) | Ausstehend |
| Phase 5 | Produktion (Hardware, Monitoring, Deployment) | Ausstehend |

---

## Umsetzungsplan

### Phase 1 — Fundament (Wochen 1–2)
1. **Projektstruktur aufsetzen** — Backend (FastAPI), Docker, DB
2. **Datenmodelle definieren** — SQLAlchemy Models, Alembic Migrationen
3. **Basis-API** — CRUD für Erzeuger, Speicher, Wallboxen
4. **Datensammlung** — Messwert-Erfassung und -Speicherung (TimescaleDB)
5. **Konfigurationssystem** — Anlagenkonfiguration via YAML/DB

### Phase 2 — Kernlogik (Wochen 3–5)
6. **Erzeugungsmanagement** — Regelbasierte Steuerung aller Erzeuger
7. **Speichermanagement** — SoC-Tracking, Lade-/Entladelogik
8. **Lademanagement** — Alle 3 Modi implementieren
9. **Regelbasierte Prognosen** — Standardlastprofile, einfache PV-Prognose
10. **Optimierer v1** — Regelbasierte Heuristik für Einsatzplanung

### Phase 3 — Intelligenz (Wochen 6–8)
11. **Wetter-API Integration** — OpenWeatherMap / DWD
12. **ML-Prognosen** — Training Pipeline, Feature Engineering, XGBoost
13. **MILP-Optimierer** — Mathematische Optimierung ersetzt Heuristik
14. **Selbstlernen** — Automatisches Retraining, Parameteroptimierung

### Phase 4 — Mobile App (Wochen 9–11)
15. **Flutter App Grundgerüst** — Navigation, API-Anbindung
16. **Dashboard** — Echtzeit-Energieflussvisualisierung
17. **Lademanagement-UI** — Modi-Auswahl, Zielladung-Eingabe
18. **Benachrichtigungen** — Push-Notifications bei Events

### Phase 5 — Produktion (Wochen 12–14)
19. **Hardware-Connectoren** — Modbus, MQTT, OCPP
20. **Monitoring** — Grafana Dashboards, Alerting
21. **Edge-Deployment** — Raspberry Pi / Mini-PC Setup
22. **Dokumentation & Tests** — Vollständige Testabdeckung

---

## Datenfluss-Beispiel: Zielladung (Modus 3)

```
Nutzer (App)                    Backend                         Hardware
────────────                    ───────                         ────────

1. "Morgen 7 Uhr,        ──►  2. Berechne benötigte
    150km laden,                   Energie:
    Akku bei 30%"                  150km ÷ 6km/kWh = 25kWh
                                   Akku: 30% von 60kWh = 18kWh
                                   Ziel: 18 + 25 = 43kWh (72%)
                                   Zu laden: 25kWh

                                3. Hole Prognosen:
                                   - PV-Überschuss 15:00-18:00
                                   - Strompreis nachts günstig

                                4. Erstelle Ladeplan:
                                   15:00-18:00: 3kW (PV)  = 9kWh
                                   01:00-05:30: 3.5kW     = 16kWh
                                                    Total = 25kWh ✓

5. Zeige Ladeplan         ◄──
   in App mit Grafik

                                6. Zur geplanten Zeit   ──►  7. Wallbox startet
                                   sende Ladebefehl           Laden mit
                                                               Zielleistung

                                8. Überwache SoC,       ◄──  9. Wallbox meldet
                                   passe Plan an               Ladestatus
```

---

## Schnittstellenübersicht (API)

| Methode | Endpoint | Beschreibung |
|---|---|---|
| GET | `/api/v1/dashboard` | Aktuelle Energieflüsse & KPIs |
| GET | `/api/v1/generators` | Alle Erzeuger mit Status |
| POST | `/api/v1/generators/{id}/control` | Erzeuger steuern |
| GET | `/api/v1/storage` | Alle Speicher mit SoC |
| GET | `/api/v1/charging/sessions` | Aktive Ladesessions |
| POST | `/api/v1/charging/sessions` | Neue Ladesession starten |
| PUT | `/api/v1/charging/sessions/{id}/mode` | Lademodus ändern |
| POST | `/api/v1/charging/sessions/{id}/target` | Zielladung setzen |
| GET | `/api/v1/forecasts/{type}` | Prognosen abrufen |
| WS | `/api/v1/ws/live` | WebSocket für Echtzeit-Daten |

---

## Lokale Entwicklung starten

```bash
# Repository klonen
git clone <repo-url>
cd energiemanager

# Backend starten
docker-compose up -d db redis
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload

# Mobile App starten (separates Terminal)
cd mobile
flutter pub get
flutter run
```

---

## Contributing

Dieses Projekt ist in aktiver Entwicklung. Beitraege sind willkommen!

1. Fork erstellen
2. Feature-Branch anlegen (`git checkout -b feature/mein-feature`)
3. Aenderungen committen (`git commit -m 'Feature hinzugefuegt'`)
4. Branch pushen (`git push origin feature/mein-feature`)
5. Pull Request erstellen

Bitte beachten: Die Architektur kann sich noch grundlegend aendern.

---

## Lizenz

MIT License — siehe [LICENSE](LICENSE)
