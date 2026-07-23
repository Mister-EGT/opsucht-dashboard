# Code-Review und Fehlerbehebungen

Stand: 20. Juli 2026

## Prüfumfang

Das Review umfasste den Next.js-App-Router, sämtliche Proxy-Routen, Zod-Schemas, Cache- und Retry-Logik, TanStack Query und Table, Markt- und Händlerberechnungen, lokale Persistenz, Navigation, Dialoge, responsive Ansichten, Fehlerzustände, Exporte, Metadaten und Produktionsausführung.

Die fachlichen Berechnungsregeln, Routen und regulären Nutzerabläufe wurden nicht verändert. Korrekturen betreffen fehlerhafte Randfälle, Robustheit, Semantik, Sicherheit und Barrierefreiheit.

## Behobene Befunde

| Priorität | Befund | Korrektur |
| --- | --- | --- |
| Hoch | Dynamische Material- und Kategorieabfragen konnten Cache und Metrikspeicher unbegrenzt vergrößern. | Beide In-Memory-Strukturen besitzen jetzt feste Obergrenzen mit LRU-artiger Verdrängung. |
| Hoch | Nicht lesbare oder formal falsche JSON-Antworten konnten als rohe Parserfehler bis in React Query gelangen. | Der API-Client erzeugt kontrollierte `ApiClientError`-Objekte und prüft das erwartete Envelope. |
| Hoch | Marktitems ohne Eintrag in `/market/prices` verschwanden vollständig aus der Marktübersicht. | `/market/items` und Preisgruppen werden vollständig zusammengeführt. Fehlende Preise bleiben als unvollständige Datensätze sichtbar. |
| Hoch | Ein unbekannter Schlüssel in der Einzelpreisantwort konnte fälschlich als Preis des angefragten Materials dargestellt werden. | Kurse werden nur noch nach normalisiertem, tatsächlich passendem Materialschlüssel übernommen. |
| Hoch | CSV-Textwerte aus API-Daten konnten von Tabellenprogrammen als Formel interpretiert werden. | Potenzielle Formeleinträge werden beim Export neutralisiert, numerische Werte bleiben unverändert. |
| Mittel | Fehlgeschlagene Upstream-Anfragen meldeten auf der Statusseite eine Antwortzeit von null oder die Zeit des alten Cache-Eintrags. | Fehlerantwortzeiten werden pro Versuch erfasst und in Fehler- sowie Stale-Metadaten weitergegeben. |
| Mittel | Browser mit blockiertem oder vollem `localStorage` konnten Theme-, Favoriten- oder Rechner-Effekte abbrechen. | Alle Lese- und Schreibzugriffe besitzen kontrollierte Fallbacks; der aktuelle Sitzungzustand bleibt nutzbar. |
| Mittel | Numerische Tabellensortierung behandelte `null` nicht zuverlässig als fehlenden Wert. | Nullable Spalten liefern explizit `undefined` und werden stets hinter vorhandenen Zahlen sortiert. |
| Mittel | Während die globale Suche noch lud, konnte bereits fälschlich „Keine Ergebnisse“ erscheinen. | Ein eigener Ladezustand verhindert den verfrühten Leerzustand. |
| Mittel | Teilausfälle ergänzender APIs blieben auf zusammengesetzten Seiten teilweise unsichtbar. | Übersicht, Markt, Auktionen, Favoriten, Detailseite und Rechner kennzeichnen betroffene Teilbereiche, ohne funktionierende Daten auszublenden. |
| Mittel | Doppelte Dekodierung oder beschädigte Escape-Sequenzen in dynamischen Pfaden konnten Fehler auslösen. | Dekodierung und Materialvalidierung sind kontrolliert; ungültige Detailpfade führen zur 404-Seite. |
| Mittel | Mobile Navigation besaß keine vollständige Dialog-Fokusführung. | Escape-Schließen, Fokusfalle, Scroll-Sperre und Fokuswiederherstellung wurden ergänzt. |
| Mittel | Links enthielten teilweise verschachtelte `<button>`-Elemente und erzeugten ungültiges interaktives HTML. | Ein semantischer `LinkButton` verwendet direkt ein `<a>` mit identischem Erscheinungsbild. |
| Niedrig | Fehlende Händler-Prozentwerte konnten als `+Nicht verfügbar` erscheinen. | Vorzeichen und Leerwertformatierung sind jetzt gemeinsam und konsistent. |
| Niedrig | Sortierzustände, Ansichtsumschalter und leere Aktionsüberschriften waren für Hilfstechnologien nicht vollständig beschrieben. | `aria-sort`, `aria-pressed`, sichtverdeckte Spaltennamen und mobile Dialogattribute wurden ergänzt. |
| Niedrig | Clipboard- und Download-Aktionen waren in Browsern mit eingeschränkter API-Unterstützung unnötig fragil. | Kopieren besitzt einen sicheren Fallback; Download-URLs werden erst nach ausgelöstem Download freigegeben. |
| Niedrig | Die SEO-Basisadresse verwendete eine feste `.example`-Adresse. | `NEXT_PUBLIC_SITE_URL` steuert die öffentliche Basisadresse mit einem lokalen Entwicklungsfallback. |

## Ergänzte Regressionstests

- kontrollierte Behandlung unlesbarer JSON-Antworten
- Zurückweisung eines fehlenden API-Envelopes
- Erhalt typisierter Proxyfehler
- Marktitems ohne eigenen Preisblock
- fehlende signierte Prozentwerte
- sichere URL-Dekodierung
- Schutz des CSV-Exports vor Tabellenformeln
- Stale-Cache-Fallback nach einem Upstreamfehler
- bereinigter Proxyfehler ohne vorhandenen Cache

## Abschließende Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript Strict Mode | bestanden |
| ESLint mit Next.js Core Web Vitals | bestanden |
| Vitest | 7 Dateien, 29 Tests bestanden |
| Next.js Produktions-Build | bestanden |
| npm Security Audit | 0 bekannte Schwachstellen |
| Anwendungsrouten | 11 geprüfte Seiten und Metarouten mit HTTP 200 |
| Öffentliche Proxy-Endpunkttypen | 8 von 8 erreichbar und als gültiges JSON geparst |
| Ungültige Material- und Kategorieparameter | kontrolliert mit HTTP 400 abgewiesen |
| Ungültige Item-Detailroute | kontrolliert mit HTTP 404 beantwortet |
| Simulierter vollständiger Upstream-Ausfall | Proxy liefert bereinigtes HTTP-502-Fehlerobjekt; Navigation und Seiten bleiben erreichbar |

Beim Live-Lauf wurden 1.102 Auktionen, 23 Auktionskategorien, 444 Marktitems, 6 Marktkategorien und 5 Händlerkurse erfolgreich durch die produktiven Parser verarbeitet. Diese Zahlen sind nur ein Prüfzeitpunkt und werden in der Benutzeroberfläche weiterhin ausschließlich aus den aktuellen API-Antworten ermittelt.
