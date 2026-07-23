# OPSUCHT-API: Live-Untersuchung

Stand: 20. Juli 2026, Europe/Berlin

Diese Datei dokumentiert eine begrenzte, nicht aggressive Prüfung der vom Auftrag vorgegebenen öffentlichen Endpunkte. Die Zahlen sind Momentaufnahmen und können sich jederzeit ändern.

## Prüfbedingungen

- Methode: ausschließlich `GET`
- User-Agent: `OPSUCHT-Economy-Dashboard/1.0 (+community-dashboard)`
- CORS-Test-Origin: `http://localhost:3000`
- Timeout bei der Erhebung: 30 Sekunden
- keine Endpoint-Suche und kein Scanning
- je Endpunkt eine reguläre Abfrage, ergänzt um einen gültigen und einen ungültigen Materialtest

## Ergebnisse

| Endpunkt | HTTP | ungefährer Umfang | beobachtete Zeit | beobachtete Root-Form |
| --- | ---: | ---: | ---: | --- |
| `/auctions/active` | 200 | 716.693 Byte | 3,35 s | Array, 1.137 Einträge |
| `/auctions/categories` | 200 | 4.426 Byte | 2,74 s | Array, 23 Einträge |
| `/market/categories` | 200 | 545 Byte | 2,52 s | Array, 6 Einträge |
| `/market/items` | 200 | 34.693 Byte | 2,82 s | Array, 444 Einträge |
| `/market/prices` | 200 | 53.744 Byte | 3,35 s | Objekt mit 6 Kategorien und 444 Items |
| `/market/price/ACACIA_LEAVES` | 200 | 121 Byte | 3,70 s | Material-Key auf Preisarray |
| `/market/history/ACACIA_LEAVES` | 200 | 38.846 Byte | 2,95 s | Objekt mit 4 Zeiträumen |
| `/merchant/rates` | 200 | 1.426 Byte | 2,71 s | Array, 5 Einträge |

Zusätzlich wurde `/auctions/active?category=custom_items` mit HTTP 200 und 494 Einträgen beobachtet.

## Header, CORS und Cache

Alle geprüften Endpunkte sendeten zum Prüfzeitpunkt:

```text
cache-control: no-cache, no-store, max-age=0, must-revalidate
pragma: no-cache
expires: 0
vary: Origin
vary: Access-Control-Request-Method
vary: Access-Control-Request-Headers
```

Für den gesetzten localhost-Origin wurde kein `Access-Control-Allow-Origin`-Header beobachtet. Deshalb verwendet die Anwendung serverseitige Next.js-Route-Handler. Das kontrollierte Dashboard-Caching findet im eigenen Serverprozess statt und ignoriert keine vorhandene Upstream-Freigabe, weil der Upstream ausdrücklich nicht cachet.

## Auktionen

Beobachtete Top-Level-Felder:

```ts
interface LiveAuction {
  uid: string;
  seller: string;
  item: {
    material: string;
    icon?: string;
    amount: number;
    displayName?: string;
    lore: string[];
    enchantments: Record<string, number>;
  };
  category: string;
  startBid: number;
  currentBid: number;
  instantBuyPrice?: number | null;
  highestBidder?: string;
  bids: Record<string, number>;
  startTime: string;
  endTime: string;
}
```

In der Momentaufnahme:

- hatten 104 Einträge sowohl `highestBidder` als auch `instantBuyPrice`
- hatten 181 Einträge `highestBidder`, aber keinen Sofortkaufpreis
- hatten 713 Einträge einen Sofortkaufpreis, aber keinen Höchstbietenden
- hatten 139 Einträge keines der beiden optionalen Felder
- waren `uid`-Werte in der Antwort eindeutig
- waren `lore` immer Arrays und `enchantments` sowie `bids` immer Objekte

Die frühere Community-Klasse `Auction` bildet nur einen Teil dieser aktuellen Felder ab. Die App bewahrt die zusätzlichen Live-Felder für Details und Favoriten-Snapshots.

## Auktionskategorien

Das Live-Modell ist ein Objektmodell:

```ts
interface AuctionCategory {
  name: string;
  displayName: string;
  displayMaterial: string;
  icon: string;
  parentCategory?: string;
  matchTypes: string[];
}
```

17 der 23 beobachteten Kategorien besaßen eine `parentCategory`. Die App verwendet den Anzeigenamen für die Oberfläche und den stabilen `name`-Wert als API-Parameter.

## Markt

`/market/items` lieferte 444 eindeutige Materialien mit Icon-URL. `/market/prices` war nach sechs Kategorien gruppiert.

Zum Prüfzeitpunkt enthielten alle 444 Preisarrays genau einen BUY- und einen SELL-Eintrag. Die Anwendung verlässt sich absichtlich nicht auf diese Reihenfolge und sucht nach `orderSide`.

40 Items enthielten mindestens einen Preis von `0`. Wenn derselbe Eintrag gleichzeitig `activeOrders: 0` besitzt, behandelt die Oberfläche ihn als fehlenden Kurs und nicht als echten kostenlosen Handelspreis.

`/market/price/ACACIA_LEAVES` lieferte:

```json
{
  "ACACIA_LEAVES": [
    { "orderSide": "BUY", "activeOrders": 145, "price": 42.9 },
    { "orderSide": "SELL", "activeOrders": 9, "price": 2.3 }
  ]
}
```

## Preisverläufe

Die vier beobachteten Arrays hießen `HOURLY`, `DAILY`, `WEEKLY` und `MONTHLY`. Ein Punkt hatte die Form:

```ts
interface HistoryPoint {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  items: number;
  transactions: number;
  timestamp: string;
}
```

Für `ACACIA_LEAVES` wurden 69 stündliche, 181 tägliche, 58 wöchentliche und 14 monatliche Punkte beobachtet. Die Zeitstempel hatten die Form `2026-07-06T19:00:00` ohne `Z` oder numerischen Offset. Die Anwendung behandelt diese Werte explizit als lokale Zeit in `Europe/Berlin`. Auktionstimestamps enthielten dagegen `Z` und werden als UTC verarbeitet.

## Händlerkurse

Die Live-Antwort enthielt zwei einfache Materialien und drei komplexe Custom-Items:

- `diamond_block`
- `netherite_ingot`
- Papier-Komponenten für `Gräbergemisch`, Custom Model Data 626
- Papier-Komponenten für `Holzbündel`, Custom Model Data 625
- Papier-Komponenten für `Steinplatten`, Custom Model Data 635

Das moderne Komponentenformat war:

```text
minecraft:paper[custom_name={...},custom_model_data={floats: [626.0f]},item_name={...}]
```

Der Parser unterstützt zusätzlich die ältere Form `custom_model_data=626`, entfernt den Namespace nur für die normalisierte Ansicht und bewahrt `source` unverändert für technische Details.

## Fehlerverhalten

Die beiden gezielten ungültigen Anfragen

```text
/market/price/INVALID_MATERIAL_DASHBOARD
/market/history/INVALID_MATERIAL_DASHBOARD
```

lieferten jeweils HTTP 404 und einen leeren Body. Der Dashboard-Proxy wandelt dies in ein stabiles, verständliches JSON-Fehlerobjekt um. Ungültige Zeichen, Schrägstriche, Leerzeichen und zu lange Parameter werden bereits vor der Upstream-Anfrage mit HTTP 400 abgelehnt.

## Community-Referenzen

- `OPSUCHT-Utilities` bestätigte unter anderem die Auktions-, Kategorie-, Markt- und Händlerpfade sowie das frühere 30-Sekunden-Intervall für Auktionen.
- `mwaopsucht/src/utils/api.js` bestätigte die acht öffentlichen GET-Formen und das URL-Encoding dynamischer Parameter.
- `visotaris-opmod` bestätigte die orderSide-basierte Zuordnung, die vier Verlaufsebenen und die Parserstrategie für komplexe Händlerquellen.

Diese Projekte sind Referenzen und keine garantierte offizielle Dokumentation. Im Konfliktfall verwendet das Dashboard die validierte Live-Struktur.
