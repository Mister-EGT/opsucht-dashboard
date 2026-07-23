# OPSUCHT Wirtschaft

Eine produktionsreife, inoffizielle Wirtschafts- und Analyseplattform für die öffentlich erreichbaren OPSUCHT-APIs. Die Anwendung verbindet aktive Auktionen, Marktpreise, Preisverläufe und Händlerkurse in einem responsiven Dashboard.

> Inoffizielles Community-Dashboard. Nicht mit OPSUCHT.NET verbunden.

Live: [opsucht-dashboard.vercel.app](opsucht-dashboard.vercel.app)

## Funktionsumfang

- Übersichtsseite mit echten Kennzahlen, Preisextremen, stündlichen Marktbewegungen, API-Zustand, bald endenden Auktionen und Favoriten
- Auktionshaus mit Suche, Kategorien, Preisfiltern, Echtzeit-Countdown, Tabellen- und Kartenansicht, URL-Filtern und Detaildialog
- Marktübersicht mit der vollständigen aktuell erfassten Itemliste, Kategorien, BUY- und SELL-Kursen, Auftragsbeständen, Spreads und mobilen Karten
- Item-Detailseiten mit vier Zeiträumen, fünf Diagrammmetriken, exakten Tooltips und Zeitraumstatistiken
- Händlerseite mit Parser für Minecraft-Komponentenstrings, Custom-Namen, Custom Model Data und OPShards-Rechner
- Vergleichsrechner für mehrere Positionen mit Markt- und Händlerwerten, lokaler Speicherung sowie JSON- und CSV-Export
- Lokale Favoriten für Marktitems, Händleritems und Auktions-Snapshots
- API-Statusseite mit HTTP-Zustand, Antwortzeit, Cache-Quelle, Datenalter und Fehlerzeitpunkten
- Fest begrenzter, ausschließlich lesender API-Explorer mit formatiertem JSON und aufklappbarem Strukturbaum
- Desktop-Sidebar, mobile Bottom-Navigation, globale Suche, Breadcrumbs, Light Mode, Dark Mode und Systemmodus
- Skeleton-, Fehler-, Leer- und veraltete Cache-Zustände für jeden Datenbereich
- Deutsche Zahlen- und Zeitformatierung mit `de-DE` und `Europe/Berlin`

## Technologie

- Next.js 16 mit App Router
- React 19 und TypeScript im Strict Mode
- Tailwind CSS 4 plus eigene Komponentenbibliothek
- TanStack Query und TanStack Table
- Recharts
- Zod
- Lucide Icons
- date-fns
- Vitest

Die Versionen sind in `package.json` exakt festgeschrieben und in `package-lock.json` reproduzierbar aufgelöst.

## Schnellstart

Voraussetzung ist Node.js 20.9 oder neuer.

```bash
npm install
npm run dev
```

Danach ist die Anwendung standardmäßig unter `http://localhost:3000` erreichbar.

Für einen lokalen Produktionslauf mit dem auch auf Sites verwendeten Worker-Build:

```bash
npm run build
npm run start
```

Der unveränderte Next.js-Build bleibt für klassische Next.js-Plattformen zusätzlich über `npm run build:next` und `npm run start:next` verfügbar.

## Qualitätssicherung

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Die vollständigen Prüfberichte mit Befunden, Korrekturen und Laufzeitergebnissen stehen in [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md), [docs/CODE_REVIEW_2.md](docs/CODE_REVIEW_2.md) und [docs/QUALITY_OF_LIFE_PATCH.md](docs/QUALITY_OF_LIFE_PATCH.md).

Die Tests decken insbesondere folgende Fälle ab:

- Zod-Parser für reale Auktions-, Markt-, Verlauf- und Händlerformen
- Toleranz zusätzlicher unbekannter API-Felder
- Zuordnung von BUY und SELL anhand von `orderSide`
- fehlende Kurse bei `price: 0` und `activeOrders: 0`
- absolute und relative Spread-Berechnung
- Zeitraumstatistiken ohne erfundene Nullwerte
- Marktitems ohne eigenen Preisblock als sichtbar unvollständige Datensätze
- kontrollierte Fehler bei beschädigten oder unerwarteten Proxy-Antworten
- Schutz des CSV-Exports vor interpretierbaren Tabellenformeln
- neue und ältere Custom-Model-Data-Syntax
- Extraktion von Custom-Itemnamen
- Aufrundung auf ganze Minecraft-Items
- OPSUCHT-Verlaufstimestamps in `Europe/Berlin`

## Umgebungsvariablen

Für den normalen Betrieb werden keine Geheimnisse oder API-Schlüssel benötigt. Optional können die Basisadresse und der serverseitige User-Agent überschrieben werden.

```bash
cp .env.example .env.local
```

| Variable | Standard | Zweck |
| --- | --- | --- |
| `OPSUCHT_API_BASE_URL` | `https://api.opsucht.net` | Basisadresse der öffentlichen API |
| `OPSUCHT_API_USER_AGENT` | Projektkennung | Aussagekräftiger User-Agent für Upstream-Anfragen |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Öffentliche Deployment-URL für absolute SEO-Metadaten |

## Projektstruktur

```text
src/
├── app/
│   ├── api/opsucht/          # Validierte serverseitige Route Handler
│   ├── market/[material]/    # Dynamische Item-Analyse
│   └── ...                   # Alle Anwendungsrouten und Metadaten
├── components/
│   ├── ui/                   # Wiederverwendbare UI-Bausteine
│   └── ...                   # Shell, Navigation, Suche, Theme, Favoriten
├── features/
│   ├── auctions/
│   ├── calculator/
│   ├── explorer/
│   ├── favorites/
│   ├── market/
│   ├── merchant/
│   ├── overview/
│   └── status/
├── hooks/                    # TanStack-Query-Hooks
├── lib/                      # Schemas, Parser, Formatter, Berechnungen
└── server/                   # Upstream-Client, Cache, Retry und API-Antworten
```

## API-Proxy und Cache

Browserkomponenten greifen ausschließlich auf die internen Route Handler zu. Der Proxy bietet:

- feste und erlaubte OPSUCHT-Zielrouten
- Zod-Validierung bei jeder Live-Antwort
- validierte Kategorien und Materialnamen
- sicheres URL-Encoding
- zehn Sekunden Timeout je Versuch
- maximal drei Versuche
- exponentielles Backoff mit kleinem Jitter
- Deduplizierung gleichzeitig laufender identischer Anfragen
- serverseitigen In-Memory-Cache
- begrenzte Cache- und Metrikgrößen für dynamische Materialabfragen
- vorhandene veraltete Daten als sichtbaren Fallback
- kontrollierte, nicht sensitive Fehlerobjekte

Die zentralen Intervalle stehen in `src/server/opsucht-api.ts`:

| Datenbereich | TTL |
| --- | ---: |
| Aktive Auktionen | 30 Sekunden |
| Auktionskategorien | 30 Minuten |
| Alle Marktpreise | 60 Sekunden |
| Marktitems und Kategorien | 30 Minuten |
| Einzelpreis | 60 Sekunden |
| Händlerkurse | 60 Sekunden |
| Preisverlauf | 5 Minuten |

Der Cache lebt im Next.js-Serverprozess. Bei einem Neustart oder bei einer neuen serverlosen Instanz beginnt die Statushistorie neu. Eine Datenbank ist für die aktuelle Funktionalität nicht erforderlich.

## Live-Untersuchung der API

Die Endpunkte wurden am 20. Juli 2026 einzeln mit einem beschreibenden User-Agent und einer nicht aggressiven Einzelabfrage geprüft. Alle acht bekannten Endpunkttypen antworteten mit HTTP 200. Die beobachteten Antwortzeiten lagen ungefähr zwischen 2,5 und 4,4 Sekunden. Ungültige Materialien lieferten HTTP 404 mit leerem Body.

Die vollständigen Beobachtungen stehen in [docs/API_RESEARCH.md](docs/API_RESEARCH.md).

Wesentliche Abweichungen von den zunächst erwarteten Modellen:

- Auktionen besitzen zusätzlich stabile `uid`-Werte, Verkäufer-UUID, Startzeit, optionale Sofortkaufpreise, optionale Höchstbietende, Gebotsmaps, Lore und Verzauberungen.
- Auktionskategorien sind Objekte und keine Strings. Sie enthalten unter anderem `displayName`, `displayMaterial`, `icon`, optional `parentCategory` und `matchTypes`.
- `/market/price/{material}` liefert ein Objekt, das erneut mit dem Materialnamen verschlüsselt ist.
- Verlaufstimestamps besitzen derzeit keinen Offset. Die App interpretiert sie ausdrücklich in `Europe/Berlin`.
- Ein Marktpreis von `0` zusammen mit `0` aktiven Aufträgen wird als fehlender Kurs behandelt.
- Händlerquellen verwenden aktuell sowohl einfache Materialnamen als auch das moderne Komponentenformat mit `custom_model_data={floats: [...]}`.

Die Parser erlauben zusätzliche unbekannte Felder, lehnen aber fehlende oder fachlich ungültige Kernfelder ab.

## Berechnungsregeln

### Marktspread

Der absolute Spread ist eindeutig definiert als:

```text
höherer Kurs - niedrigerer Kurs
```

Der relative Spread verwendet den niedrigeren Kurs als Basis:

```text
(absoluter Spread / niedrigerer Kurs) × 100
```

Ein Prozentwert wird nur ausgegeben, wenn beide Kurse vorhanden sind und die Basis größer als null ist.

### OPShards

Die Vorwärtsrechnung multipliziert eine ganze Itemmenge mit `exchangeRate`. Bei der Rückwärtsrechnung wird der exakte mathematische Wert zusätzlich angezeigt, während das reguläre Minecraft-Ergebnis mit `Math.ceil` auf ganze Items aufgerundet wird. Die öffentliche API dokumentiert keine weitere serverseitige Rundungsregel.

### Marktbewegungen

Eine Bewegung wird nur angezeigt, wenn mindestens zwei echte stündliche Verlaufspunkte vorhanden sind. Es werden keine erfundenen Prozentwerte und keine aus dem aktuellen Snapshot abgeleiteten Pseudotrends verwendet.

## Google Sans

Die Anwendung verwendet durchgehend den verlangten legalen Font-Stack:

```css
font-family:
  "Google Sans",
  "Google Sans Flex",
  "Google Sans Text",
  Inter,
  Arial,
  sans-serif;
```

Google Sans wird nicht frei über Google Fonts angeboten. Deshalb enthält dieses Repository keine kopierten oder aus Google-Webseiten extrahierten Schriftdateien. Auf Systemen mit legal installierter Google Sans wird sie automatisch verwendet, sonst greifen die Fallbacks.

Wenn rechtmäßig bereitgestellte Webfont-Dateien vorliegen, können sie lokal im Projekt abgelegt und in `src/app/globals.css` über `@font-face` registriert werden. Vor einer Veröffentlichung müssen die jeweiligen Lizenz- und Verteilungsrechte geprüft werden.

## Lokale Daten

Folgende Informationen werden ausschließlich im Browser über versionierte `localStorage`-Einträge gespeichert:

- Theme-Präferenz
- Markt-, Händler- und Auktionsfavoriten
- Positionen des Vergleichsrechners

Gespeicherte Objekte werden beim Laden defensiv geprüft. Nicht mehr aktive Auktionen bleiben als beendete Snapshots sichtbar, bis sie ausdrücklich entfernt werden.

## Sicherheit

- Nur bekannte GET-Endpunkte sind erreichbar.
- Es gibt keinen offenen Proxy und keine frei eingebbare Ziel-URL.
- Pfad- und Query-Parameter werden begrenzt und validiert.
- Stacktraces und interne Serverdetails werden nicht an den Browser gesendet.
- Die Anwendung implementiert keine Anmeldung, privaten Spielerabfragen oder Ingame-Automation.
- Es gibt keine Kauf-, Verkaufs-, Biet-, Maus- oder Tastaturautomation.
- Zusätzliche Sicherheitsheader werden über `next.config.ts` gesetzt.

## Barrierefreiheit und Responsive Design

Die Oberfläche verwendet semantische Überschriften, Tabellenüberschriften, beschriftete Formulare, sichtbare Fokuszustände, Skip-Link, tastaturbedienbare native Dialoge, Textkennzeichnungen zusätzlich zu Farben und Alternativzusammenfassungen für Diagramme. `prefers-reduced-motion` deaktiviert nicht notwendige Animationen.

Ab 680 Pixeln und darunter werden breite Markt-, Auktions- und Händlertabellen durch Karten ersetzt. Für etwa 320 Pixel stehen ein einspaltiges Kennzahlenlayout, kompakte Dialoge, eine Bottom-Navigation und sichere Umbrüche zur Verfügung.

## Deployment

### Vercel

1. Repository importieren.
2. Framework-Vorgabe `Next.js` verwenden.
3. Optional die beiden Umgebungsvariablen eintragen.
4. Deploy ausführen.

Die Route Handler benötigen eine Node.js-Runtime mit ausgehendem HTTPS-Zugriff auf `api.opsucht.net`.

### Eigener Node.js-Server

```bash
npm ci
npm run build:next
npm run start:next
```

Ein Reverse Proxy sollte HTTPS terminieren und Anfragen an den Next.js-Port weiterleiten. Für mehrere voneinander unabhängige Instanzen ist der Cache pro Instanz getrennt. Wenn später ein geteilter Cache benötigt wird, kann die Cache-Schicht hinter `fetchOpsucht` durch Redis oder einen vergleichbaren Dienst ersetzt werden, ohne die Browser-API zu verändern.

### Docker

Das Projekt benötigt keine besondere Plattformlogik. Ein übliches mehrstufiges Next.js-Image mit Node.js 20 oder neuer kann `npm ci`, `npm run build:next` und `npm run start:next` ausführen. Eine Datenbank oder ein persistentes Volume ist nicht erforderlich.

## Technische Referenzen

Die Community-Projekte wurden ausschließlich als technische Hinweise genutzt. Live-Antworten haben Vorrang:

- [RappyLabyAddons/OPSUCHT-Utilities](https://github.com/RappyLabyAddons/OPSUCHT-Utilities)
- [flamyamylollala/mwaopsucht, api.js](https://github.com/flamyamylollala/mwaopsucht/blob/fa88f757ad76d9cbdfde627dc70830a989612d60/src/utils/api.js)
- [DiamantTh/visotaris-opmod](https://github.com/DiamantTh/visotaris-opmod)

OPSUCHT- und Minecraft-Marken sowie externe Item-Assets gehören ihren jeweiligen Rechteinhabern.
