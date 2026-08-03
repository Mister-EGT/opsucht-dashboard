# AGENTS.md

## Geltungsbereich

Diese Anweisungen gelten für das gesamte Repository. Untergeordnete `AGENTS.md`-Dateien können für ihren jeweiligen Verzeichnisbaum ergänzende oder abweichende Regeln festlegen.

## Projektüberblick

`opsucht-dashboard` ist ein inoffizielles, deutschsprachiges Wirtschafts- und Analyse-Dashboard für die öffentlich erreichbaren OPSUCHT-APIs.

Der zentrale Stack besteht aus:

- Next.js 16 mit App Router
- React 19
- TypeScript im Strict Mode
- Tailwind CSS 4
- TanStack Query und TanStack Table
- Recharts
- Zod
- Vitest
- Vite und vinext für den primären Produktions-Build

Die Anwendung benötigt im normalen Betrieb keine Datenbank und keine geheimen API-Schlüssel.

## Wichtige Verzeichnisse

- `src/app/`: Routen, Layouts, Metadaten und serverseitige Route Handler
- `src/app/api/opsucht/`: ausschließlich lesender Proxy zur OPSUCHT-API
- `src/components/`: anwendungsweite Komponenten und Navigation
- `src/components/ui/`: wiederverwendbare UI-Bausteine
- `src/features/`: fachlich getrennte Funktionen
- `src/hooks/`: TanStack-Query-Hooks
- `src/lib/`: Schemas, Parser, Formatter und Berechnungen
- `src/server/`: Upstream-Client, Cache, Retry-Logik und API-Antworten
- `docs/`: technische Recherche und Prüfberichte

## Arbeitsweise

1. Lies vor einer Änderung die betroffenen Dateien und ihre direkten Aufrufer.
2. Behebe die Ursache eines Problems und nicht nur dessen sichtbares Symptom.
3. Halte Änderungen klein und auf den Auftrag begrenzt.
4. Bewahre bestehendes Verhalten, sofern die Aufgabe keine Änderung verlangt.
5. Aktualisiere Tests und Dokumentation, wenn sich Verhalten oder Schnittstellen ändern.
6. Erfinde keine API-Felder, Preise, Trends oder Fallback-Daten.
7. Entferne oder überschreibe keine fremden Änderungen ohne ausdrücklichen Auftrag.

## Installation und Befehle

Verwende Node.js 20.9 oder neuer.

```bash
npm ci
npm run dev
```

Führe vor dem Abschluss einer Änderung möglichst alle Prüfungen aus:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Weitere unterstützte Befehle:

- `npm run build:next`: klassischer Next.js-Produktions-Build
- `npm run start:next`: klassischer Next.js-Produktionsserver
- `npm run test:watch`: Vitest im Watch-Modus
- `npm run dev:vinext`: vinext-Entwicklungsserver auf Port 3001

Wenn eine Prüfung wegen der Umgebung nicht ausgeführt werden kann, dokumentiere genau, welche Prüfung fehlt und warum.

## TypeScript und React

- Halte `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` und `noFallthroughCasesInSwitch` ein.
- Verwende keine ungesicherten `any`-Typen und keine unnötigen Type Assertions.
- Validiere externe Daten an der Systemgrenze mit Zod.
- Behandle optionale, fehlende und unbekannte API-Felder ausdrücklich.
- Verwende den Alias `@/*` für Importe aus `src/`, wenn dies den Import klarer macht.
- Nutze Server Components standardmäßig. Füge `"use client"` nur hinzu, wenn Browser-APIs, Zustand oder Interaktion es erfordern.
- Halte Komponenten fokussiert. Verschiebe wiederverwendbare Fachlogik in `src/lib/`, Hooks oder das passende Feature.
- Vermeide unnötige Effekte und abgeleiteten Zustand. Berechne ableitbare Werte direkt oder mit `useMemo`, wenn die Berechnung tatsächlich teuer ist.
- Bewahre stabile Query Keys und verhindere, dass Hintergrundaktualisierungen lokale UI-Zustände wie Filter oder Pagination zurücksetzen.

## OPSUCHT-API und Datenmodell

- Browserkomponenten greifen ausschließlich über die internen Route Handler auf OPSUCHT-Daten zu.
- Erweitere den Proxy nur um bekannte, fest erlaubte GET-Ziele.
- Übernimm niemals eine frei eingegebene Ziel-URL in einen serverseitigen Fetch.
- Validiere Pfadparameter, Query-Parameter und Upstream-Antworten.
- Kodiere dynamische URL-Bestandteile sicher.
- Gib keine Stacktraces, internen URLs oder sensitiven Fehlerdetails an den Browser weiter.
- Behalte Timeout, begrenzte Wiederholungen, Deduplizierung und Cache-Fallbacks bei.
- Zusätzliche unbekannte API-Felder dürfen toleriert werden, fachlich notwendige Kernfelder jedoch nicht.
- Ein Preis von `0` bei `0` aktiven Aufträgen gilt als fehlender Kurs.
- Interpretiere OPSUCHT-Verlaufstimestamps weiterhin ausdrücklich in `Europe/Berlin`.
- Die Anwendung bleibt ausschließlich lesend. Implementiere keine Kauf-, Verkaufs-, Gebots- oder Ingame-Automation.

## Benutzeroberfläche

- Die sichtbare Oberfläche und ihre Texte bleiben grundsätzlich deutsch.
- Formatiere Zahlen und Zeitangaben mit `de-DE` und `Europe/Berlin`.
- Erhalte Light Mode, Dark Mode und Systemmodus.
- Verwende bestehende UI-Bausteine und Lucide Icons, bevor neue Muster oder eigene SVG-Symbole eingeführt werden.
- Bewahre das bestehende responsive Verhalten. Prüfe besonders Breiten um 320 Pixel sowie den Wechsel zu mobilen Karten bei 680 Pixeln.
- Verhindere horizontales Überlaufen, unbeabsichtigtes Herauszoomen und schwarze Leerbereiche auf Mobilgeräten.
- Desktop-Anpassungen dürfen nicht unbeabsichtigt die mobile Navigation beeinträchtigen und umgekehrt.
- Verwende semantisches HTML, sichtbare Fokuszustände, zugängliche Beschriftungen und Tastaturbedienung.
- Vermittlere Zustände nicht ausschließlich über Farbe.
- Respektiere `prefers-reduced-motion`.
- Kopiere keine nicht frei verteilbaren Schriftdateien oder externen Markenassets in das Repository.

## Berechnungen und Formatierung

- Verwende für Geld- und Mengenwerte die zentralen Formatter.
- Berechne den absoluten Spread als höherer Kurs minus niedrigerer Kurs.
- Berechne den relativen Spread nur bei zwei vorhandenen Kursen und einer Basis größer als null.
- Zeige Marktbewegungen nur mit mindestens zwei echten Verlaufspunkten.
- Runde Minecraft-Itemmengen nach den bestehenden fachlichen Regeln und nicht über reine Darstellungsformatierung.
- Schütze CSV-Exporte weiterhin vor interpretierbaren Tabellenformeln.

## Tests

Ergänze oder aktualisiere Tests insbesondere bei Änderungen an:

- Zod-Schemas und Parsern
- BUY- und SELL-Zuordnung
- Preis-, Spread- und OPShard-Berechnungen
- Datums- und Zeitzonenlogik
- Cache- und Fehlerverhalten
- URL- oder Filterzustand
- Pagination bei automatischen und manuellen Aktualisierungen
- Custom-Itemnamen und Custom Model Data
- Exporten und lokaler Speicherung

Tests sollen reale Randfälle abbilden und dürfen keine fachlich unmöglichen Daten als Normalfall festschreiben.

## Sicherheit und Datenschutz

- Füge keine Geheimnisse, Tokens oder echte lokale `.env`-Dateien hinzu.
- Dokumentiere neue optionale Variablen in `.env.example` und `README.md`.
- Verwende keine dynamische Codeausführung für API-Daten oder Benutzereingaben.
- Behalte Sicherheitsheader und die Allowlist des Proxys bei.
- Speichere clientseitig nur die bereits vorgesehenen lokalen Präferenzen und Nutzdaten.
- Prüfe neue Abhängigkeiten auf Notwendigkeit, Wartungszustand und Lizenzverträglichkeit.

## Abhängigkeiten

- Verwende npm und halte `package-lock.json` synchron zu `package.json`.
- Füge keine neue Abhängigkeit hinzu, wenn die vorhandenen Werkzeuge die Aufgabe sauber lösen.
- Ändere festgeschriebene Versionen nur bewusst und dokumentiere relevante Auswirkungen.
- Führe nach Änderungen an Abhängigkeiten mindestens Typecheck, Tests und Produktions-Build aus.

## Dokumentation und Lizenz

- Halte `README.md` aktuell, wenn sich Einrichtung, Befehle, Umgebungsvariablen, Architektur oder sichtbare Funktionen ändern.
- Halte technische Detailberichte in `docs/` konsistent mit dem tatsächlichen Verhalten.
- Dieses Repository steht unter der GNU Affero General Public License Version 3. Bewahre Lizenz- und Copyright-Hinweise.
- Stelle bei übernommenem Code oder Assets sicher, dass Herkunft und Lizenz mit AGPL-3.0 vereinbar sind.

## Definition of Done

Eine Änderung ist erst abgeschlossen, wenn:

- die angeforderte Funktion oder Korrektur vollständig umgesetzt ist,
- TypeScript ohne neue Fehler prüft,
- relevante Tests vorhanden sind und bestehen,
- Lint und Produktions-Build keine neuen Fehler zeigen,
- Lade-, Fehler-, Leer- und veraltete Zustände berücksichtigt wurden,
- Desktop und Mobilansicht geprüft wurden,
- Barrierefreiheit und Sicherheit nicht verschlechtert wurden,
- geänderte Dokumentation dem tatsächlichen Verhalten entspricht.
