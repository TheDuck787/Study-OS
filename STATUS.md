# Study OS – Projektstatus

_Stand: 25.10.2026_

## Überblick
Local-first Lern-App (React + TypeScript + Vite, IndexedDB über Dexie) mit optionalem KI-Proxy (Hono) – als Vercel Function oder eigener Node-Server. Veröffentlichung: `DEPLOY.md`.
Plan und Architekturentscheidungen: `docs/PLAN.md`. Setup & Nutzung: `README.md`.

## Meilensteine
| # | Meilenstein | Status |
|---|---|---|
| 1 | Inspektion & Plan | erledigt |
| 2 | Fundament (Design-System, Navigation, Datenmodell, Persistenz) | erledigt |
| 3 | Kern-Lernen (Fächer, Themen, Notizen, Karteikarten, Quiz, Antworthistorie) | erledigt |
| 4 | Adaptives Lernen (Beherrschung, Fehleranalyse, Spaced Repetition, Empfehlungen) | erledigt |
| 5 | KI-Tutor (Provider-Abstraktion, Server-Proxy, Fallback ohne KI) | erledigt |
| 9 | Unabhängige Website: Artifact-Abhängigkeiten entfernt, Vercel + GitHub, PWA-Installation | erledigt (Deployment durch den Nutzer ausstehend) |
| 6 | Prüfungsvorbereitung (Prüfungen, Lernpläne, Probeklausur) | erledigt |
| 7 | Dokumente (PDF, OCR, Struktur, Generierung mit Prüfschritt) | erledigt |
| 8 | Qualitätssicherung | erledigt – siehe „Tests“ |
| 11 | Google-Anmeldung & Synchronisierung (Supabase Auth, `sync_records` mit RLS) | Code fertig und getestet – **Einrichtung in Google/Supabase/Vercel durch dich ausstehend** (siehe unten) |
| 10 | Kalender & Planer (Ansichten, Aufgaben, Prüfungsvorbereitung, Planer, Mein Tag, Wochenplanung) | erledigt – Details unten, Plan: `docs/CALENDAR.md` |

## Wichtige Pfade
- `src/lib/` – reine, getestete Logik: `answerCheck.ts`, `mathcheck.ts`, `mathgen.ts`, `mastery.ts`, `srs.ts`, `recommend.ts`, `studyplan.ts`, `progress.ts`, `grading.ts`, `docs/*`
- `src/db/` – Schema (`index.ts`), Typen (`types.ts`), Repository mit Validierung (`repo.ts`), Seeds (`seed.ts`, `demo.ts`)
- `src/content/` – Beispiel-Lehrplan Kl. 9 (als ungeprüft markiert), Fragenbibliothek, Vokabeln
- `src/features/*` – Seiten und Komponenten je Bereich
- `src/shared/ai.ts` – gemeinsamer KI-Vertrag (Prompts, Ausgabeschemas) für Browser und Server
- `server/app.ts` – KI-Proxy (`/api/ai/*`), gemeinsam für Vercel und Selbsthosting
- `api/index.ts` – Vercel Function; `vercel.json` – Build, Routing, Header
- `server/index.ts` – Selbsthosting: liefert `dist/` und die API aus
- `sw/sw.js` – Service-Worker-Vorlage (der Build fügt Version und Precache-Liste ein)
- `src/lib/calendar/` – reine Kalender-Logik: Zeit, Wiederholungen, gemeinsame Eintragsliste (`items.ts`), Filter, Überlappungs-Layout, Planer (`planner.ts`), Prüfungsvorbereitung (`prep.ts`), Wochenauswertung (`review.ts`)
- `src/db/calendar.ts` – Speichern/Validieren von Terminen, Aufgaben, eigenen Typen, Serien-Bearbeitung, Verschieben über alle Speicher, Rückgängig, Planer-Übernahme
- `src/features/calendar/` – Kalender (Monat, Woche, Tag, Agenda, Halbjahr), Editor, Detailbereich, Seitenleiste, Planer-Dialog, Mein Tag, Wochenplanung, Erinnerungen; `src/features/tasks/` – Aufgaben
- `supabase/migrations/20261025120000_sync_records.sql` – Cloud-Tabelle für die Synchronisierung (RLS); `supabase/archive/` – alte, nie angewendete relationale Entwürfe
- `src/lib/sync/` – Sync-Engine (`engine.ts`, rein und getestet), IndexedDB-Anbindung und Sync-Zustand (`local.ts`); `src/lib/cloud/` – Konfiguration, Supabase-Client (PKCE), Remote-Speicher
- `src/features/account/` – Anmeldung, Sync-Steuerung, Erst-Anmelde-Dialog, Konto-Bereich, Statusanzeige; `server/publicConfig.ts` – `/api/config` (nur öffentliche Werte)
- `tests/unit`, `tests/server` (Vitest), `tests/e2e` (Playwright)

## Tests (Stand 25.10.2026, alle grün)
| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` | 0 Fehler |
| `npm run lint` | 0 Fehler, 0 Warnungen |
| `npm test` (Vitest) | 189 Tests bestanden – Lernlogik, Mathe-Generatoren, Fragenbibliothek, Datenbank-Flows, **Kalender & Planer (30)** und API: Zugangscode-Pflicht, Sperre auf Vercel ohne `APP_ACCESS_TOKEN`, Validierung, SSE-Streaming, Rate-Limit, 404, Pfad-Wiederherstellung der Vercel Function |
| `npm run build` | erfolgreich; Geheimnis-Prüfung von `dist/` bestanden |
| `vercel build` (lokal, Vercel CLI) | erfolgreich: statische Ausgabe + Function `api/index` (Node 22); kompilierte Function direkt aufgerufen: `/api/health` 200, Status, 404, Sperre ohne Zugangscode |
| `npm run test:e2e:prod` (Produktions-Build) | 15/15 – Definition-of-Done-Ablauf, Mathe, Demo-Trennung, leerer Start, Installierbarkeit, Offline-Start, Zugangscode, **6 Kalender-Abläufe** und **2 Android-Abläufe (Pixel 7)** |
| `npm run test:e2e` (Dev-Server) | 12/12 (3 nur im Produktions-Build sinnvolle Tests übersprungen) |
| `npm run test:sql` | Migrationen 0001 + 0002 laufen, RLS trennt Nutzer (auch Termine/Aufgaben), Constraints greifen |

**Kalender-Tests im Detail (25.10.2026, alle ausgeführt und grün):**
- Unit (`tests/unit/calendar.test.ts`, 30): echte Kalendertage, Wiederholungen (Wochentage, Intervall, Ende, Anzahl, Ausnahmen, Monatsenden, mehrtägig), Vereinheitlichung aller Quellen, Filter (Fach, Typ, Status, Priorität, Schnellfilter, Suche), Überfällig-Erkennung, Überlappungs-Layout, freie Zeitfenster, Planer-Platzierung (früheste Frist zuerst, Kapazität, Pausen, Ausweichen auf frühere Tage), Termine/Praktikumstage bleiben frei, Prüfungsvorbereitung verteilt auf ≥ 3 Tage und schwache Themen bekommen mehr Zeit, Abschluss-Wiederholung am Vortag, keine Überlappungen und Tagesmaximum eingehalten, Aufgaben in Einheiten vor der Frist, Karteikarten-Blöcke, keine Duplikate bei Neuberechnung, erledigte Aufgaben nicht neu geplant, manuelle Einträge unberührt (auch beim Übernehmen eines manipulierten Vorschlags), nähere Prüfung hat Vorrang, „heute optimieren“ holt Verpasstes nach, Vorbereitung nur aus echten Antworten, Wochenauswertung/Überlastung, Speichern mit Validierung, Serien „nur dieser/folgende/alle“ bearbeiten und löschen, Verschieben über alle Speicher ohne Duplikate, Aufgabe einplanen/erledigen/löschen samt Rückgängig, Sicherung v2 mit Kalenderdaten und Wiederherstellung, v1-Sicherung lesbar, Planer-Einstellungen, Fach löschen behält Termine.
- E2E Desktop (`tests/e2e/calendar.spec.ts`, 6): anlegen → in Monat/Tag/Agenda sichtbar → Neuladen → bearbeiten → verschieben → duplizieren → löschen → Strg+Z; wöchentlicher Unterricht mit Einzeländerung; Aufgabe schnell anlegen, im Kalender abhaken, Status auf der Aufgabenseite; Prüfung über den Kalender anlegen, „Lernplan automatisch erstellen“ prüfen und übernehmen, Einheiten erscheinen, eigener Termin bleibt, Vorbereitungspanel, Filter, JSON-Sicherung enthält Termine und Lernplan; Ziehen verschiebt und Unterkante ändert die Dauer; Einträge überstehen einen Browser-Neustart (neuer Kontext mit gespeichertem IndexedDB-Inhalt).
- E2E Android (`tests/e2e/mobile.spec.ts`): alle fünf Ansichten ohne seitliches Scrollen, Schnell-Hinzufügen-Knopf, Details als Blatt, Verschieben per Formular, Mein Tag/Aufgaben/Wochenplanung ohne seitliches Scrollen.
- Screenshots geprüft (Desktop 1440 × 900 dunkel und hell, Pixel 7): Woche, Monat, Tag, Agenda, Halbjahr, Detailbereich, Editor, Planer-Vorschlag, Mein Tag, Aufgaben, Wochenplanung, Prüfungsseite.

Nicht getestet: echtes Deployment auf Vercel (kein Vercel-Konto in dieser Umgebung – siehe `DEPLOY.md`), Antworten echter KI-Modelle (kein API-Schlüssel), OCR mit Tesseract (lädt Sprachdaten aus dem Internet), physisches Android-Gerät (nur emuliert: Pixel 7).

## In der QA gefundene und behobene Fehler
- Neue Nutzer hingen im Ladebildschirm (useLiveQuery: „nicht vorhanden“ = „lädt noch“) – behoben, auch für alle „nicht gefunden“-Seiten.
- Demo-Daten wurden doppelt angelegt (React StrictMode) – Bootstrap läuft jetzt genau einmal.
- Alle Beispiel-Karteikarten zählten am ersten Tag als „fällig“ – jetzt höchstens 10 neue Karten pro Tag.
- Prüfungsformular per Direktlink ohne vorausgewähltes Fach – behoben.
- Supabase: generierte Spalte mit nicht-immutabler Umwandlung – durch normale Spalte ersetzt.
- Mehrere Darstellungsdetails (Fokusrahmen, Eingabefeldhöhe im Tutor, Zahlenabstände).
- Website-Umstellung: Fotos für die KI-Abschrift werden vor dem Hochladen verkleinert (Vercel-Grenze ~4,5 MB); öffentliche Server ohne Zugangscode sperren die KI.

## Google-Anmeldung & Synchronisierung (25.10.2026)
**Bestand geprüft (über den Supabase-Connector, nur lesend):** Projekt „Study OAS“ (`kqxxrnfoshqenewczguv`, eu-west-1, aktiv). Schema `public` leer, keine Migrationen, 0 Auth-Nutzer, keine Storage-Buckets, Sicherheits-Advisor ohne Befund. Im Code gab es noch keine Supabase-Anbindung (nur unbenutzte Migrationsentwürfe). Die Auth-Einstellungen (Google-Provider, Redirect-URLs) und die Vercel-Variablen kann ich von hier nicht einsehen – der Container darf `*.supabase.co` und `*.vercel.app` nicht erreichen.

**Umgesetzt:**
- Supabase Auth (wiederverwendet, nichts Neues angelegt): „Mit Google anmelden“ per `signInWithOAuth` mit PKCE (laut aktueller Supabase-Doku), Rückkehr zur Ausgangsseite, Fehlermeldungen auf Deutsch, dauerhafte Sitzung (automatische Erneuerung), Abmelden mit Wahl „Daten behalten“ oder „von diesem Gerät entfernen“.
- Datenbank: eine Tabelle `public.sync_records` statt 20+ Einzeltabellen – ein JSON-Dokument pro lokalem Datensatz, Server-Zeitstempel (Trigger), Löschmarken, Größen- und Tabellennamen-Prüfung. RLS erzwungen (`force`), Policies nur für `authenticated` mit `auth.uid() = user_id`, `anon` ohne jedes Recht, Besitzer nicht änderbar. Alte relationale Entwürfe archiviert (nie angewendet → keine Duplikate).
- Synchronisierung: lokal bleibt IndexedDB die Arbeitsgrundlage (offline voll nutzbar). Abgleich bei Anmeldung, beim Zurückkehren zur App, wenn wieder online, nach Änderungen (4 s) und jede Minute; Upload zuerst, dann Download; seitenweise; geräteübergreifend gesperrt (Web Locks). Konflikte: neuere Version gewinnt, Bearbeiten schlägt Löschen, die andere Version bleibt als Kopie und kann wiederhergestellt werden. Schutz: ungewöhnlich viele Löschungen stoppen den Sync vor dem Schreiben.
- Erste Anmeldung: leeres Gerät lädt automatisch; sonst Dialog „Hochladen/Zusammenführen“, „Nur Konto-Daten“, „Nur Gerät-Daten“ (Letzteres nur mit getipptem ERSETZEN). Vor jeder Variante wird automatisch eine Sicherheitskopie gespeichert (herunterladbar, wie jede Sicherung wiederherstellbar). Nach „Sicherung wiederherstellen“ fragt der nächste Sync erneut; „Alles löschen“ fragt, ob auch das Konto geleert werden soll (sonst Abmeldung, Konto bleibt).
- Konfiguration ohne neues Deployment: `/api/config` liest die Variablen der Vercel-Supabase-Integration (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_ANON_KEY`, auch `NEXT_PUBLIC_…`) und gibt nur URL + öffentlichen Schlüssel heraus; geheime/service_role-Schlüssel werden verweigert. Offline wird die letzte Konfiguration genutzt. Demo-Modus synchronisiert nie.
- Sicherheit: Build bricht ab bei geheimen `VITE_`-Variablen; Prüfung von `dist/` jetzt auch auf `sb_secret_`, service_role-JWTs und Werte der Supabase-/Postgres-Geheimnisse. PDF.js auf 6.4 aktualisiert (behebt eine **hohe** Lücke: Code-Ausführung beim Öffnen präparierter PDFs; PDF-Import per E2E-Test geprüft). Verbleibend: KaTeX, niedrige Schwere, Fix nur per Major-Update (0.19) – nicht ausgenutzt, solange KaTeX ohne `trust`-Option läuft (so in Study OS).

**Tests (alle ausgeführt, alle grün):** `npm test` 201 Tests (davon 11 Sync-Engine mit zwei simulierten Geräten: Hoch-/Herunterladen, Bearbeiten und Löschen in beide Richtungen, gleichzeitige Offline-Änderungen mit Konfliktkopie, Bearbeiten schlägt Löschen, Zusammenführen ohne Löschen, „Nur Gerät-Daten“, Lösch-Schutz, Wiederherstellen, Dateien bleiben lokal, inkrementeller Abgleich; 2 Konfig-Tests: geheime Schlüssel werden nie ausgegeben). `npm run test:sql` (Migration zweimal angewendet, RLS-Isolation, kein anonymer Zugriff, kein Fälschen des Besitzers, Server-Zeitstempel, Constraints). E2E 19/19 im Produktions-Build, darunter 3 Anmelde-/Sync-Abläufe gegen ein **simuliertes** Supabase (echter PKCE-Redirect mit Code-Austausch, Rückkehr zur Seite, Erst-Anmelde-Dialog, zweites Gerät lädt Daten, Änderung vom Handy erscheint am PC, Neuladen behält die Sitzung, Abmelden behält Daten, Zusammenführen ohne Datenverlust, Fehlermeldungen) und der PDF-Import. `vercel build` lokal erfolgreich; kompilierte Function liefert unter `/api/config` nur URL + publishable Key, auch wenn ein Service-Role-Schlüssel gesetzt ist. Screenshots geprüft (Einstellungen abgemeldet/angemeldet, Erst-Anmelde-Dialog, Handy-Start).

**Nicht verifiziert (braucht deinen Zugang):** echter Google-Login, Google-Provider in Supabase, Redirect-URLs, Vercel-Variablen, die angewendete Tabelle im echten Projekt.

### Was du noch tun musst (Schritt für Schritt in `DEPLOY.md`, Abschnitt 8)
1. **Datenbank-Tabelle anlegen:** Der Supabase-Connector hat beim Anwenden der Migration um deine Bestätigung gebeten; die Anfrage lief ohne Antwort ab, es wurde **nichts** geändert. Entweder mir die Ausführung erlauben oder `supabase/migrations/20261025120000_sync_records.sql` im SQL-Editor von „Study OAS“ ausführen.
2. **Google Cloud Console:** OAuth-Client (Web) anlegen – JavaScript-Ursprung `https://<deine-adresse>.vercel.app`, Redirect-URI `https://kqxxrnfoshqenewczguv.supabase.co/auth/v1/callback`; Zielgruppe „Extern“, dich als Testnutzer eintragen oder App veröffentlichen.
3. **Supabase → Authentication:** Google-Provider aktivieren (Client-ID + Secret), Site URL und Redirect-URL `https://<deine-adresse>.vercel.app/**` eintragen.
4. **Vercel:** prüfen, ob `SUPABASE_URL` und `SUPABASE_ANON_KEY`/`SUPABASE_PUBLISHABLE_KEY` existieren; sonst anlegen (Werte in `DEPLOY.md`), dann Redeploy. Kontrolle: `https://<deine-adresse>.vercel.app/api/config`.
5. Danach am PC anmelden und hochladen, am Handy anmelden – Tests in `DEPLOY.md` 8 E.

## Kalender & Planer – Umsetzung (25.10.2026)
**Datenmodell (eine Quelle je Information):** neue Tabellen `events` (Termine, Unterricht, Lernblöcke, Karteikarten-Blöcke, Praktika, Pausen, eigene Typen – mit Wiederholung, Ausnahmen, Checkliste, Erinnerung), `tasks` (Hausaufgaben, Projekte, To-dos mit Teilaufgaben) und `eventCategories`. Prüfungen bleiben in `exams` (neu: Uhrzeit, Raum, Selbsteinschätzung je Thema, geschätzte Vorbereitungszeit), ihre Lerneinheiten in `exam.plan` (neu: Uhrzeit, „von dir festgelegt“). Geplante Arbeitszeit für eine Aufgabe ist ein Termin mit `taskId` – die Aufgabe wird nie kopiert. Der Kalender berechnet daraus zur Laufzeit eine Liste; alle Ansichten lesen dieselben Daten live. Schema-Version 2, Sicherung Version 2 (alte Sicherungen bleiben lesbar), Supabase-Migration 0002.

**Funktionen:**
- Ansichten Monat (Unterricht als Zusammenfassung, damit Prüfungen/Fristen sichtbar bleiben), Woche (Zeitraster, Überlappungen nebeneinander, Schulzeit schraffiert, Lernfenster markiert, Jetzt-Linie; am Handy 3 Tage), Tag (große Karten mit Notizen/Priorität, Fristen-Spalte), Agenda (nach Datum, Überfälliges oben), Halbjahr (Belastung pro Woche, Prüfungen mit echtem Vorbereitungsstand, große Fristen).
- Anlegen per Klick/Ziehen in freie Zeit, Bearbeiten im Editor mit Abschnitten (Allgemein, Zeit, Details, Lernen, Checkliste), Detailbereich ohne Seitenwechsel, Verschieben per Ziehen oder per Formular (Touch-Alternative), Dauer ändern an der Unterkante, Duplizieren, Erledigt-Haken auf Karten, Löschen mit Bestätigung, Serien: „Nur dieser / Dieser und folgende / Alle“, Rückgängig (Strg+Z und in Meldungen), Suche, Tastenkürzel (T, ←/→, M/W/D/A/H, N, E, F).
- Filter nach Fach, Typ, Priorität, Status und Schnellfilter (Prüfungen, Fristen, Lernen, Privat) mit Legende; Fachfarbe und -symbol überall gleich; eigene Typen mit Farbe.
- Aufgaben: Schnell-Eingabe, Eingang, Heute & morgen, Demnächst, Überfällig, Erledigt, Nach Fach; Einplanen per Dialog oder Ziehen (Wochenleiste, Kalender-Eingang).
- Prüfungsvorbereitung: Tage bis zur Prüfung, Vorbereitung aus gemessener Beherrschung (Gefühl getrennt angezeigt, nie eingerechnet), offene Themen, Lernplan-Fortschritt, Restaufwand, Karten bis zur Prüfung, Quizze/Probeklausuren, schwächste Bereiche, Abschluss-Wiederholung, nächste Einheiten.
- Planer ohne KI: „Lernplan automatisch erstellen“, „Plan neu berechnen“, „Plan für heute optimieren“ – Vorschlag mit Neu/Verschoben/Entfällt zum Prüfen und Abwählen, erst „Übernehmen“ speichert. Regeln: dringendste Frist zuerst, schwache Themen mehr Zeit, fällige Karteikarten, Unterricht/Termine + Puffer frei, Lernfenster und Tagesmaximum, Ruhetage, große Aufgaben in Einheiten geteilt, Pausen, keine Überlappungen, erledigte Aufgaben nie erneut, manuelle und von dir verschobene Einträge nie verändert, keine Duplikate bei Neuberechnung.
- „Mein Tag“ (was jetzt dran ist, Ablauf mit freien Lücken, Fristen, Hausaufgaben, Karten, Prüfungsvorbereitung, Überfälliges, freie Lernzeit, erledigt/offen, Morgen-Vorschau, Tagesrückblick) und „Wochenplanung“ (geplant/erledigt/gemessen, Belastung je Tag, Überlastung, freie Zeit, Prüfungen, offene Aufgaben, Schwachstellen, Empfehlungen, Verschieben auf andere Tage).
- Erinnerungen für Termine und Aufgaben (bei geöffneter App, mit Systembenachrichtigung wenn erlaubt), Kalender und Aufgaben in der globalen Suche, Demo-Daten mit Stundenplan.

**In der Kalender-QA gefunden und behoben:** Detailbereich quetschte die Wochenspalten (jetzt Schublade über dem Raster); Unterricht verdrängte im Monat Prüfungen und Fristen (jetzt Zusammenfassung); Neuberechnung tauschte Teile eines Projekts (alte Blöcke jetzt nach Datum zugeordnet); Karteikarten-Blöcke auf Ruhetagen; Zeitleiste in „Mein Tag“ zeigte an Ruhetagen freie Zeit; Breitenangaben bei Eingabefeldern wurden von `w-full` überschrieben; zwei gleich beschriftete „Verschieben“-Knöpfe.

## Bekannte Grenzen / offen
- Kalender: Ziehen und Größe ändern mit Maus/Stift; am Touchscreen über „Verschieben“ und den Editor (bewusst, weil Ziehen dort unzuverlässig ist). Rückgängig gilt bis zum Neuladen der Seite. Schulferien/Feiertage werden nicht automatisch eingetragen (als ganztägiger Eintrag mit „nicht lernen“ möglich).
- Die KI wird vom Planer nicht verwendet; der Planer arbeitet vollständig lokal.
- Synchronisierung nur mit Anmeldung; ohne Anmeldung bleiben Daten im jeweiligen Browser (Sicherung per JSON-Export). Originaldateien (PDFs, Fotos) werden nicht synchronisiert, nur ihr erkannter Text. Kein Echtzeit-Push zwischen Geräten (Abgleich nach Änderungen, beim Öffnen und minütlich).
- OCR (tesseract.js) lädt Sprachdaten beim ersten Einsatz aus dem Internet.
- Rate-Limit auf Vercel nur pro Function-Instanz (grober Schutz; der Zugangscode ist der eigentliche Schutz).
- Erinnerungen nur bei geöffneter App (kein Push-Server).
- Der Beispiel-Lehrplan ist nicht mit den offiziellen MV-Rahmenplänen abgeglichen.
- Keine Word-Dokumente (.docx) – Hinweis in der App: als PDF speichern.

## Nächste Schritte (Vorschläge)
1. Optional: Originaldateien über Supabase Storage synchronisieren (Bucket mit RLS pro Nutzer).
2. Mehr Aufgaben für Deutsch/Gesellschaftsfächer ergänzen oder mit KI generieren und prüfen.
3. Lehrplan mit dem Unterricht abgleichen und Themen als „abgeglichen“ markieren.
