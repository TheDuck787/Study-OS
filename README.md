# Study OS

Persönliche Lernplattform für Schülerinnen und Schüler (ausgelegt auf Klasse 9, Gesamtschule, Mecklenburg-Vorpommern – erweiterbar auf andere Klassen und Fächer). Komplett auf Deutsch, local-first, funktioniert ohne Konto und ohne KI. Eine KI kann optional angebunden werden.

## Als Website veröffentlichen (Vercel)

Schritt-für-Schritt-Anleitung für Einsteiger: **[DEPLOY.md](DEPLOY.md)** (GitHub → Vercel → Umgebungsvariablen → Test auf PC und Android).

Kurz: Repository bei GitHub anlegen, in Vercel importieren, fertig – `vercel.json` enthält alle Build-Einstellungen. Die Web-App wird statisch ausgeliefert (`dist/`), der KI-Proxy läuft als Vercel Function (`api/index.ts` → `server/app.ts`). Für den Tutor in Vercel `ANTHROPIC_API_KEY` **und** `APP_ACCESS_TOKEN` setzen (ohne Zugangscode bleibt die KI auf Vercel gesperrt). Supabase wird nicht benötigt.

## Schnellstart (Entwicklung)

Voraussetzung: Node.js 22.

```bash
npm install
npm run dev          # Web-App (http://localhost:5173) + KI-Server (Port 8787)
```

Nur die Web-App ohne Server: `npm run dev:web`.

### Produktion / auf dem eigenen Rechner dauerhaft

```bash
npm run build        # Typprüfung, Web-Build (dist/) und Server-Build (dist-server/)
npm start            # liefert App + KI-Proxy auf http://localhost:8787 aus
```

Auf dem Android-Handy im selben WLAN: `http://<IP-des-Rechners>:8787` öffnen und im Browsermenü „Zum Startbildschirm hinzufügen“ wählen. Dann läuft die App auch offline (Service Worker). Wird der Server im Netzwerk erreichbar gemacht, unbedingt `APP_ACCESS_TOKEN` setzen.

Statisches Hosting (ohne KI-Server) ist ebenfalls möglich: Inhalt von `dist/` auf einen beliebigen Webspace legen – die App nutzt Hash-Routing und relative Pfade.

## Umgebungsvariablen (nur für den KI-Proxy)

Lokal: `.env.example` nach `.env` kopieren. Vercel: dieselben Namen unter Project → Settings → Environment Variables. Alle Variablen sind optional. Nie ein `VITE_`-Präfix für Geheimnisse verwenden – `VITE_`-Variablen landen im Browser; der Build bricht bei verdächtigen Namen ab, und `scripts/check-no-secrets.mjs` durchsucht `dist/` nach Schlüsseln.

| Variable | Bedeutung |
|---|---|
| `AI_PROVIDER` | `auto` (Standard), `anthropic`, `openai`, `openai-compatible`, `none` |
| `ANTHROPIC_API_KEY` | API-Schlüssel von console.anthropic.com |
| `ANTHROPIC_MODEL` | Standard `claude-opus-5-5`; günstiger z. B. `claude-sonnet-5-5` oder `claude-haiku-5-5` |
| `ANTHROPIC_FALLBACKS` | `on`/`off` – server-seitiger Ausweich-Mechanismus bei abgelehnten Anfragen |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI (Modellname muss exakt angegeben werden) |
| `OPENAI_BASE_URL` | OpenAI-kompatible Dienste, z. B. Ollama `http://localhost:11434/v1` |
| `OPENAI_SUPPORTS_IMAGES` | `true`, wenn das Modell Bilder lesen kann |
| `PORT` | Server-Port (Standard 8787) |
| `APP_ACCESS_TOKEN` | Zugangscode, den die App mitschicken muss (in der App unter Einstellungen → KI eintragen). **Auf Vercel Pflicht**, sobald ein KI-Schlüssel gesetzt ist |
| `STUDYOS_PUBLIC` | `true` sperrt die KI ohne Zugangscode auch auf selbst gehosteten, öffentlichen Servern |
| `AI_RATE_LIMIT_PER_MIN` | KI-Anfragen pro Minute und Gerät (Standard 20) |
| `ALLOWED_ORIGINS` | Nur nötig, wenn die Web-App von einer anderen Adresse geladen wird |

**Wichtig zu Abos:** Ein ChatGPT-Plus- oder Claude-Pro-Abo enthält keinen API-Zugang. API-Schlüssel werden nach Verbrauch abgerechnet. Schlüssel liegen nur auf dem Server und werden nie an den Browser geschickt. Ohne Schlüssel bleibt die KI aus, alle anderen Funktionen laufen normal.

## Datenbank

Es ist **keine Datenbank-Einrichtung nötig**. Alle Daten liegen im Browser (IndexedDB). Echte Daten (`studyos-main`) und Demo-Daten (`studyos-demo`) sind zwei getrennte Datenbanken.

- Sicherung: Einstellungen → „Sicherung herunterladen (JSON)“, Wiederherstellung über „Sicherung wiederherstellen“.
- Migrationspfad: `supabase/migrations/0001_init.sql` enthält ein vollständiges PostgreSQL-Schema mit Row Level Security (jede Person sieht nur ihre Zeilen). Prüfung: `npm run test:sql` (läuft mit eingebettetem Postgres/PGlite). Die App ist **noch nicht** mit Supabase verbunden.

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklung (Web + Server) |
| `npm run build` / `npm start` | Produktions-Build (Web + Node-Server) / Start |
| `npm run build:web` | Nur Web-Build mit Geheimnis-Prüfung (das nutzt Vercel) |
| `npm test` | Unit- und Integrationstests (Vitest) |
| `npm run test:e2e` | Browser-Tests gegen den Dev-Server (Playwright, Desktop + Android-Viewport) |
| `npm run test:e2e:prod` | Browser-Tests gegen den Produktions-Build, inkl. Installierbarkeit und Offline-Start |
| `npm run icons` | App-Icons aus `public/icon.svg` neu erzeugen |
| `npm run test:sql` | Supabase-Migration prüfen |
| `npm run typecheck`, `npm run lint` | Typprüfung, Linting |

## Funktionen

- **Heute-Ansicht:** „Was soll ich heute lernen?“ mit begründeten Aufgaben (Lernplan, offene Fehler, fällige Karten, dringende Themen), Lernserie, Wochenzeit, Prüfungen, Stand je Thema, letzte Fehler, anstehende Wiederholungen, 5-Minuten-Runde, Prüfungssimulation. Ohne Daten: Einstiegsschritte statt erfundener Statistik.
- **Fächer-Arbeitsbereiche:** Themen und Unterthemen (anlegen, umbenennen, sortieren, verschachteln, löschen mit Folgenanzeige), Voraussetzungen, Notizen, Material, Karteikarten, Quiz, Fehler, Prüfungen, Tutor. Beispiel-Lehrplan Klasse 9 – deutlich als „nicht amtlich geprüft“ gekennzeichnet.
- **Quiz:** Auswahl, Wahr/Falsch, Freitext (Schlüsselwörter, Selbstbewertung oder KI-Bewertung), Zahl (Komma, Einheit, Rundung), Rechnung (gleichwertige Formen, Lösungsmengen, Gleichungssysteme, verlangte Form nur wenn gefordert), Vokabeln (Tippfehler, Artikel, mehrere Bedeutungen). Übungsmodus mit sofortigem Feedback und gestuften Hinweisen, Prüfungsmodus mit verzögertem Feedback, Zeitlimit und automatischem Zwischenspeichern. Punkte, Prozent, geschätzte Note (konfigurierbarer Schlüssel, klar von echten Noten getrennt), Erklärungen, Verlauf, wiederkehrende Fehler.
- **Adaptives Lernen:** Beherrschung pro Thema (erklärbar, nie „gefestigt“ nach einer Antwort), Themen-Wiederholung, Empfehlungen in der Reihenfolge: wiederholte Fehler → Prüfungsthemen → überfällig → fehlende Grundlagen → Beherrschtes seltener.
- **Mathe-Modus:** 15 Aufgabengeneratoren × 4 Schwierigkeiten mit Lösungsweg und Hinweisen, Training der schwächsten Fertigkeit, Rechenweg-Prüfung (findet den falschen Schritt), Funktionsplotter mit Wertetabelle, Formeldarstellung mit KaTeX.
- **Karteikarten:** Stapel, Beispielsätze, Aussprache (Sprachausgabe des Geräts), CSV-Import/-Export, Tastenkürzel, Wiederholungsplan (Vergessen/Schwer/Gut/Leicht), Behaltensquote, Karten aus Notizen und Material (mit Prüfschritt).
- **Prüfungen:** Termin, Themen, Material, Schwierigkeit, verfügbare Zeit und Wochentage → Lernplan mit Diagnose, Themenblöcken, verteilter Wiederholung, Probeklausur, Fehleranalyse und Abschluss. Warnung bei Zeitmangel, Neuberechnung nach der Probeklausur, Analyse der schwächsten Themen. Keine Notengarantie.
- **Bibliothek:** PDF (Textebene), Bilder und gescannte PDFs (OCR, optional KI-Abschrift), Text/Markdown, eingefügter Text; Unvollständigkeit wird angezeigt, Text kann korrigiert werden; Volltextsuche, Schlagwörter, Fächer; Zusammenfassung, Karten und Fragen mit Prüfung vor dem Speichern; Quelle bleibt verknüpft.
- **Tutor:** fünf Erklärmodi, trennt „Aus deinem Material“ und „Zusätzlich erklärt“, gibt Unsicherheit zu, Hinweise vor Lösungen. Ohne KI: ehrliche Meldung und Suche in den eigenen Materialien.
- **Motivation ohne Druck:** Lern-XP nur für echtes Lernen, Lernserie mit Ruhetagen und Pausen, Wochenziel, Bestwerte, Abzeichen, Lernkalender.
- **Daten:** JSON-Sicherung (optional mit Originaldateien), Wiederherstellung mit Prüfung, CSV-Export der Antworten, Demo getrennt, alles löschen mit Bestätigung.

## So lernst du damit am besten

1. **Jeden Tag kurz statt selten lange.** Öffne „Heute“ und arbeite die vorgeschlagenen Aufgaben von oben nach unten ab. 15–25 Minuten reichen.
2. **Fehler sind dein bestes Material.** Falsche Antworten kommen automatisch wieder, bis du sie zweimal richtig hast. Lies bei jedem Fehler das „Warum?“.
3. **Ehrlich bewerten.** Bei Karteikarten lieber „Vergessen“ drücken als raten – dann kommt die Karte rechtzeitig wieder.
4. **Hinweise vor Lösungen.** Nutze erst den Hinweis-Knopf; den Lösungsweg erst danach.
5. **Prüfung früh eintragen.** Zwei bis drei Wochen vorher. Mach den Diagnosetest, folge dem Plan und schreib die Probeklausur unter echten Bedingungen.
6. **Material importieren.** Fotografiere Arbeitsblätter, prüfe den erkannten Text und lass dir Karten und Fragen daraus erstellen.
7. **Pausen sind erlaubt.** Lege Ruhetage fest. Die Serie bricht dadurch nicht.
8. **Sicherung machen.** Einmal pro Woche unter Einstellungen → Daten.
