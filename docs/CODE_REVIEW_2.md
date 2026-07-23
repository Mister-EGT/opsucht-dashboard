# Zweiter Code-Review und Fehlerbehebungen

Stand: 20. Juli 2026

## Prüfumfang

Der zweite Review prüfte den aktuellen Stand unabhängig vom ersten Durchlauf erneut. Im Fokus standen URL- und React-Zustände, Browsernavigation, Query-Lebenszyklen, Teilausfälle einzelner OPSUCHT-Endpunkte, Eingabegrenzen, Zod-Toleranz, Zeitverarbeitung, unnötige Datenabfragen sowie die beiden produktiven Build-Ziele Next.js und Sites Worker.

Die Fachlogik für Preise, Spreads, Händlerkurse und reguläre Nutzerabläufe blieb unverändert. Alle Anpassungen betreffen nachweisbare Randfälle, irreführende Zwischenzustände oder unnötige Arbeit.

## Behobene Befunde

| Priorität | Befund | Korrektur |
| --- | --- | --- |
| Hoch | Markt-, Auktions- und Händlersuche übernahmen URL-Parameter nur beim ersten Laden. Browser-Zurück, Browser-Vor und Links auf dieselbe Route konnten sichtbare Filter und URL auseinanderlaufen lassen. | Parser und URL-Erzeugung wurden zentralisiert. Die drei Ansichten synchronisieren ihren Zustand nun in beide Richtungen und validieren unbekannte Parameter auf sichere Standardwerte. |
| Hoch | Ein Ausfall des Einzelpreis-Endpunkts blockierte die gesamte Item-Detailseite, obwohl der globale Marktfeed weiterhin passende aktuelle Kurse enthielt. | Die Detailseite verwendet in diesem Teilausfall den bereits validierten globalen Preisfeed und kennzeichnet die Quelle sichtbar. Nur wenn beide Preisquellen fehlen, bleibt der Fehlerzustand bestehen. |
| Mittel | Ein ausgefallener Preisverlauf erschien in den Statistik-Karten teilweise als null Items und null Transaktionen. | Fehlende Verlaufsdaten werden als nicht verfügbar ausgewiesen. Es werden keine Nullaktivitäten mehr suggeriert. |
| Mittel | Favoriten lösten immer Markt-, Händler- und Auktionsabfragen aus, auch bei einer vollständig leeren oder nur auf einen Bereich beschränkten Favoritenliste. | Jeder Datenbereich wird nur aktiviert, wenn passende Favoriten vorhanden sind. Der leere Zustand erscheint ohne unnötige Netzwerkwartezeit. |
| Mittel | Mengen wie `Infinity`, exponentiell überlaufende Eingaben oder Werte oberhalb des sicheren JavaScript-Ganzzahlbereichs konnten zu irreführenden Rechnerzuständen führen. | Itemmengen werden zentral auf endliche, nicht negative Ganzzahlen bis `Number.MAX_SAFE_INTEGER` normalisiert. Eingabefelder spiegeln dieselbe Grenze wider. |
| Mittel | Die Auktionsliste wurde auch ohne aktivierten Bald-enden-Filter jede Sekunde vollständig neu gefiltert. Dies konnte Tabellenzustände unnötig zurücksetzen. | Die Uhrzeit ist nur noch dann eine Filterabhängigkeit, wenn der Restzeitfilter aktiv ist. Countdowns aktualisieren sich weiterhin wie zuvor. |
| Mittel | Während Marktbewegungen noch geladen wurden, erschien kurzzeitig die fachliche Aussage, es gebe keine belastbare Vergleichsbasis. | Ein eigener Ladezustand trennt laufende Abfragen von tatsächlich fehlenden Datenpunkten. |
| Mittel | Netzwerkfehler aus dem Browser blieben untypisiert, während Abbrüche nicht ausdrücklich von Verbindungsfehlern getrennt waren. | Verbindungsfehler werden kontrolliert und wiederholbar klassifiziert. Abbruch- und Timeout-Signale bleiben unverändert erkennbar. |
| Niedrig | Kategorieparser verlangten rein darstellende Felder wie Icon oder Materialvorschau zwingend und konnten deshalb einen ganzen Bereich bei einer kleinen API-Änderung ablehnen. | Präsentationsfelder sind optional beziehungsweise nullable. Fachlich erforderliche Namen bleiben weiterhin streng validiert. |
| Niedrig | Unbekannte Zeitstempelformate fielen auf die implementierungsabhängige JavaScript-Datumsinterpretation zurück. | Nur die belegten ISO- und OPSUCHT-Formate werden akzeptiert. Andere Werte ergeben eindeutig ein ungültiges Datum und werden als nicht verfügbar formatiert. |
| Niedrig | Der Vergleichsrechner markierte einen Datensatz mit Markt- und Händlerobjekt nicht als unvollständig, wenn darin ein einzelner Kurs fehlte. | Der Hinweis prüft jetzt die tatsächlich berechneten BUY-, SELL- und Händlerwerte. |

## Ergänzte Regressionstests

- Roundtrip und sichere Standardwerte aller Marktfilter
- Roundtrip aller Auktionsfilter einschließlich Ansicht und Bald-enden-Status
- URL-Kodierung der Händlersuche
- endliche und sichere Ganzzahlgrenzen für Itemmengen
- Erhalt von `AbortError` bei abgebrochenen Anfragen
- kontrollierte Klassifikation echter Netzwerkfehler
- optionale Darstellungsfelder in Markt- und Auktionskategorien
- eindeutige Ablehnung unbekannter Zeitstempelformate

## Abschließende Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript Strict Mode | bestanden |
| ESLint | bestanden |
| Vitest | 8 Dateien, 38 Tests bestanden |
| Next.js Produktions-Build | bestanden |
| Sites Worker Produktions-Build | bestanden |
| Direkter Worker-Lauf | Übersicht, Markt, Item-Detail, Auktionen mit URL-Filtern und Händler mit URL-Suche jeweils HTTP 200 |
| npm Security Audit | 0 bekannte Schwachstellen |
| Diff-Prüfung | keine Whitespace- oder Patchfehler |

Die Warnungen des Sites-Builds betreffen ausschließlich bekannte, wirkungslose Chunk-Aufteilungen innerhalb von Vinext. Der Build selbst schloss vollständig und erfolgreich ab.
