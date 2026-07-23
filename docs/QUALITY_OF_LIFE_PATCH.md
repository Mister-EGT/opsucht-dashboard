# Quality-of-Life-Patch und dritter Review

Stand: 21. Juli 2026

## Ziel

Dieser Patch ergänzt häufig benötigte Bedienhilfen und behebt weitere Randfälle. Routen, Filtersemantik, API-Verträge sowie Preis-, Spread- und Händlerberechnungen für gültige Daten bleiben unverändert.

## Verbesserungen

- Manuelle Aktualisierung für Markt, Auktionen, Händler und Itemdetails
- Teilen der aktuellen Ansicht mit Web Share oder Clipboard-Fallback
- Toast-Rückmeldungen für Kopieren, Teilen, Export und Löschaktionen
- Zuletzt angesehene Marktitems in der globalen Suche mit löschbarem Verlauf
- Kopieren von Materialnamen in Itemdetails und Auktionen
- Duplizieren einzelner Vergleichspositionen
- Bestätigungsdialog vor dem Löschen des gesamten Vergleichs
- Eindeutige Anzeige nicht verfügbarer Summen statt irreführender Nullwerte

## Behobene Randfälle

- Favoriten werden unabhängig von Großschreibung und `minecraft:`-Namespace erkannt.
- Beschädigte oder doppelte lokale Favoriten und Vergleichspositionen werden sicher normalisiert.
- Dasselbe Standarditem erscheint nicht doppelt als Markt- und Händleroption.
- BUY-minus-SELL-Gesamtdifferenzen enthalten nur tatsächlich vergleichbare Positionen.
- Ungültige Zeitstempel werden vor Statistiken und Diagrammsortierung entfernt.
- Browserseitige Wiederholungen vervielfachen die bereits serverseitig kontrollierten API-Versuche nicht mehr.
- Die globale Suche lädt API-Bereiche erst ab zwei Zeichen und kann bereits vorhandene Teilergebnisse sofort anzeigen.

## Regressionstests

Ergänzt wurden Tests für Materialnormalisierung, robuste Verlaufsdaten, zuletzt angesehene Items, Options-Deduplizierung und Summen aus nur teilweise verfügbaren Kursen. Der vollständige Prüfstand wird vor jeder Veröffentlichung erneut mit TypeScript, ESLint, Vitest, Produktions-Build und Diff-Kontrolle ausgeführt.

## Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript Strict Mode | bestanden |
| ESLint | bestanden |
| Vitest | 11 Dateien, 45 Tests bestanden |
| Sites Worker Produktions-Build | bestanden |
| Klassischer Next.js Produktions-Build | bestanden |
| Lokaler Sites-Worker | alle neun Anwendungsrouten HTTP 200 |
| Öffentliche OPSUCHT-Proxybereiche | acht Endpunkttypen und Health-Status HTTP 200 |
| Diff-Prüfung | keine Whitespace- oder Patchfehler |
