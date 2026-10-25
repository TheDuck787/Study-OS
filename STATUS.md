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
| 11 | Google-Anmeldung & Synchronisierung (Supabase Auth, `sync_records` mit RLS) | erledigt – Vercel-Variablen gesetzt, `/api/config` liefert die Supabase-Konfiguration, Tabelle `sync_records` mit RLS angelegt (geprüft 25.10.2026) |
| 10 | Kalender & Planer (Ansichten, Aufgaben, Prüfungsvorbereitung, Planer, Mein Tag, Wochenplanung) | erledigt – Details unten, Plan: `docs/CALENDAR.md` |
| 13 | Design & Bewegung (Motion-System, geschichtete Flächen, Mikro-Interaktionen, Skeletons, Erfolgs-Feedback) | erledigt – Details unten |
| 12 | Stundenplan im WebUntis-Stil (Woche/Tag/Liste, Entfall/Vertretung, Hausaufgaben, Prüfungen, CSV/ICS) | erledigt – Details unten |

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
- `src/lib/timetable/` – reine Stundenplan-Logik: Stundenraster, A/B-Wochen, nächste Stunde, Schulzeiten, Tagesstatus (`core.ts`), CSV (`csv.ts`), ICS (`ics.ts`); `src/db/timetable.ts` – Stunden, Änderungen je Tag, Hausaufgaben/Prüfungen, Import; `src/features/timetable/` – Seite `/stundenplan`, Woche/Tag/Liste, Editor, Detailblatt, Stammdaten, Import, Tagesübersicht
- `tests/unit`, `tests/server` (Vitest), `tests/e2e` (Playwright)

## Tests (Stand 25.10.2026, alle grün)
| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` | 0 Fehler |
| `npm run lint` | 0 Fehler, 0 Warnungen |
| `npm test` (Vitest) | 217 Tests bestanden (davon Stundenplan 15 + 1 Sync) – Lernlogik, Mathe-Generatoren, Fragenbibliothek, Datenbank-Flows, **Kalender & Planer (30)** und API: Zugangscode-Pflicht, Sperre auf Vercel ohne `APP_ACCESS_TOKEN`, Validierung, SSE-Streaming, Rate-Limit, 404, Pfad-Wiederherstellung der Vercel Function |
| `npm run build` | erfolgreich; Geheimnis-Prüfung von `dist/` bestanden |
| `vercel build` (lokal, Vercel CLI) | erfolgreich: statische Ausgabe + Function `api/index` (Node 22); kompilierte Function direkt aufgerufen: `/api/health` 200, Status, 404, Sperre ohne Zugangscode |
| `npm run test:e2e` (Dev-Server, 25.10.2026 nach Design-Überarbeitung) | 21/21 bestanden (3 nur im Produktions-Build sinnvolle Tests übersprungen); gegen den Produktions-Build zusätzlich Deploy- und Stundenplan-Tests 5/5 |
| `npm run test:e2e:prod` (Produktions-Build, vor dem Stundenplan) | 15/15 – Definition-of-Done-Ablauf, Mathe, Demo-Trennung, leerer Start, Installierbarkeit, Offline-Start, Zugangscode, **6 Kalender-Abläufe** und **2 Android-Abläufe (Pixel 7)** |
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

### Einrichtung (Stand 25.10.2026)
- Erledigt und geprüft: Vercel-Variablen `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` (Production), `/api/config` liefert URL und Publishable Key; Tabelle `public.sync_records` mit erzwungener RLS, 4 Policies, Trigger, kein Zugriff für `anon`; Supabase-Sicherheitshinweise: keine.
- Google-Provider, Site URL und Redirect-URLs hast du in Supabase eingetragen; Anmeldung PC ↔ Handy laut dir funktionsfähig.

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

## Stundenplan – Umsetzung (25.10.2026)
**Datenmodell ohne Migration:** Eine regelmäßige Stunde ist ein wöchentlicher Termin (`events`, Kategorie `lesson`, Wiederholung jede Woche bzw. alle 2 Wochen bei A/B) mit den neuen optionalen Feldern `period`/`periodEnd` (Stundenraster), `weekType` (A/B) und `lessonChange` (Entfall, Vertretung, Raumänderung, Zusatzstunde, Hinweis – mit dem regulären Stand zum Hervorheben). Eine Änderung für einen Tag ersetzt genau dieses Vorkommen (wie „nur diesen Termin ändern“ im Kalender) und lässt sich wieder aufheben. Stundenraster, Lehrkräfte, Räume, Schultage und A/B-Bezug liegen in `meta.timetable`; Fächer haben optional ein Kürzel. Dadurch zeigen Kalender, Planer, Sicherung und Google-Synchronisierung den Stundenplan ohne Sonderfälle; die Supabase-Tabelle bleibt unverändert. Schon im Kalender eingetragener Unterricht erscheint automatisch im Stundenplan.

**Funktionen:** Seite „Stundenplan“ (Desktop-Navigation und untere Handy-Leiste; „Fächer“ liegt am Handy jetzt unter „Mehr“). Woche Mo–Fr (optional Sa) mit Stundennummern und -zeiten, farbigen Karten (Fach, Raum, Lehrkraft), Doppelstunden, Überlappungen nebeneinander, heutiger Spalte, Jetzt-Linie, Tippen auf freie Stunde zum Anlegen; Tag (Standard am Handy) mit freien Stunden, Pausen, „Jetzt/Nächste Stunde“ mit Fortschritt, fälligen Hausaufgaben/Prüfungen, Wischen für den nächsten Tag; Liste der kommenden zwei Wochen; Wochen-Navigation mit KW und A/B-Woche. Stunden anlegen, bearbeiten (alle Wochen oder ab dieser Woche), duplizieren, löschen (ab dieser Woche / alle), Rückgängig. Entfall/Vertretung/Raum/Hinweis je Tag. Hausaufgabe aus der Stunde (Fälligkeit standardmäßig zur nächsten Stunde des Fachs, Entfall wird übersprungen) → normale Aufgabe; Prüfung aus der Stunde → normale Prüfung, danach Themen wählen, der Lernplaner bereitet vor. „Lernzeiten vorschlagen“ öffnet den vorhandenen Planer (Unterricht ist belegt, Entfall gibt Zeit frei); „Schulzeiten an den Lernplaner übergeben“. Stammdaten: Stundenraster (Generator aus eigenen Zeiten + Einzelbearbeitung), Fächer (Name, Kürzel, Farbe), Lehrkräfte, Räume (Umbenennen ändert alle Stunden), Samstag, A/B-Wochen (Korrektur verschiebt vorhandene A/B-Stunden mit). Tagesübersicht „Heute in der Schule“ auch auf der Startseite. Import CSV/ICS mit Vorschau, Fehlern je Zeile, Duplikat-Erkennung und Rückgängig (ICS: Serien bleiben Serien, Einzeltermine z. B. aus WebUntis werden zu wöchentlichen bzw. A/B-Stunden zusammengefasst, Ferienwochen werden Ausnahmen); Export CSV (Excel, Formel-Schutz) und ICS (Serien, Ausnahmen, Änderungen, abgesagte Stunden).

**Bewusst nicht enthalten:** keine erfundenen Stundenpläne oder Klingelzeiten (der Raster-Generator nutzt nur deine Eingaben), keine Live-Vertretungspläne/WebUntis-Anmeldung – Änderungen trägst du selbst ein oder importierst eine Datei.

**In der Stundenplan-QA gefunden und behoben:** Editor konnte schnelle Eingaben mit dem nachgeladenen Stand überschreiben (Formular erscheint jetzt erst nach dem Laden); A/B-Einstellung bezog sich sonntags auf die vergangene statt die angezeigte Woche; Raster begann eine Stunde zu früh; „Lernzeiten vorschlagen“ am Handy doppelt.

**Tests:** Unit `tests/unit/timetable.test.ts` (15: Raster, A/B, Kürzel, Serien, Entfall/Vertretung + Aufheben, „ab dieser Woche“ mit mitwandernden Änderungen, Duplizieren/Löschen, nächste Stunde, Hausaufgabe/Prüfung, Planer nutzt Entfall-Zeit, Schulzeiten, CSV-Rundreise + Formel-Schutz + Fehler je Zeile, Import ohne Duplikate + Rückgängig, ICS-Rundreise, WebUntis-ähnliche Einzeltermine, UTC/Zeilenumbruch) und `tests/unit/sync.test.ts` (Stundenplan inkl. Entfall PC → Handy → PC). E2E Desktop `tests/e2e/timetable.spec.ts` (2 komplette Abläufe inkl. Export/Import) und Android `tests/e2e/timetable-mobile.spec.ts` (Tag/Woche/Blatt ohne seitliches Scrollen, Wischen). Screenshots geprüft (Desktop dunkel, Pixel 7).

## Design & Bewegung (25.10.2026)
**Ohne neue Bibliothek** – CSS-Transforms/Opacity, `@starting-style` für Dialoge, Web Animations API für Konfetti. Presets an einer Stelle: Tokens `--ease-out`, `--ease-spring`, `--dur-1…4`, Schatten `--shadow-sm/md/lg`, `--surface-sheen`, `--glass` in `src/styles/index.css` (hell und dunkel), dieselben Werte in `src/lib/motion.ts`; React-Helfer in `src/components/motion.tsx` (`useMounted`, `useCountUp`, `AnimatedNumber`, `CountUpText`, `Celebrate`).

**Umgesetzt:** gestaffelte Seiten-Einblendung (jede Seite automatisch, ≤ 0,5 s) und gestaffelte Listen; Dialoge blenden weich ein und aus, am Handy als Bottom-Sheet mit Griff; Menüs, Suche und „Mehr“-Blatt animiert; Toasts gleiten mit Symbol herein/heraus und lassen sich schließen; Tabs und Umschalter mit gleitender Markierung; Fortschrittsbalken (scaleX) und Ringe laufen beim Erscheinen hoch; Kennzahlen, Serie und XP zählen hoch; Lernkalender spaltenweise, Lernzeit-Balken wachsen; Skeletons statt Spinner (erst nach 140 ms, kein Flackern); animierte Checkboxen/Radios (weiter native Eingaben), Schalter mit Feder, aufklappbare Abschnitte mit Höhen-Animation und drehendem Pfeil, Tooltips für Symbol-Knöpfe (Maus und Tastatur-Fokus); Knöpfe mit Druck-Rückmeldung, Primär-Knopf mit Tiefe, anklickbare Karten heben sich an; geschichtete Flächen mit Lichtkante, dezenter Farbschimmer im Hintergrund, Glas-Kopf/-Fußleiste am Handy, Navigation mit Akzentstreifen bzw. Feder-Pille; Startseite mit Tagesziel-Ring, Serie und XP aus echten Daten; Erfolgs-Feedback (Pop, kleines Konfetti, kurze Vibration auf Android) beim Erledigen von Aufgaben/Hausaufgaben, Runde geschafft, Quiz ab 60 % (nur direkt nach dem Abschluss), neue Abzeichen, Tagesziel (einmal pro Tag); Quiz-Optionen reagieren, falsche Antwort schüttelt leicht.

**Leistung & Barrierefreiheit:** nur Transform/Opacity, keine Dauer-Animationen (außer Skeleton während des Ladens), kein Blur auf bewegten Elementen; Einblend-Animationen enden ohne bleibenden Zustand (`fill-mode: backwards`), damit keine Stapel-Kontexte Dropdowns überdecken. `prefers-reduced-motion` schaltet alles ab (auch Konfetti, Zählen, Vibration). Messung auf emuliertem Pixel 7 mit 4-fach gedrosselter CPU: Abhaken mit Konfetti im Median 60 FPS; Ruckler beim Seitenaufbau stammen aus der Datenberechnung und bestanden schon vorher (Vergleichsmessung). Haupt-Bundle +≈ 3 KB gzip.

**In der QA gefunden und behoben:** Dropdown-Menüs wurden von der nächsten Seiten-Sektion überdeckt (bleibende Stapel-Kontexte durch `fill-mode: both`); Glas-Effekt hinter einfliegenden Toasts und 126 einzeln animierte Kalender-Kacheln kosteten auf langsamen Geräten Bilder (jetzt feste Fläche bzw. eine Animation pro Spalte).

**Tests:** neuer E2E-Test `tests/e2e/motion.spec.ts` (Toast mit Schließen, Konfetti erscheint und räumt sich auf, Umschalter-Markierung gleitet, Dialog öffnet/schließt, reduzierte Bewegung: keine Animationszeit, kein Konfetti); alle bestehenden Tests unverändert grün.

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
