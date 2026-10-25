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
- `supabase/migrations/0001_init.sql` – Migrationspfad mit RLS (nicht angebunden)
- `tests/unit`, `tests/server` (Vitest), `tests/e2e` (Playwright)

## Tests (Stand 25.10.2026, alle grün)
| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` | 0 Fehler |
| `npm run lint` | 0 Fehler, 0 Warnungen |
| `npm test` (Vitest) | 158 Tests bestanden – Lernlogik, Mathe-Generatoren, Fragenbibliothek, Datenbank-Flows **und** API: Zugangscode-Pflicht, Sperre auf Vercel ohne `APP_ACCESS_TOKEN`, Validierung, SSE-Streaming, Rate-Limit, 404, Pfad-Wiederherstellung der Vercel Function |
| `npm run build` | erfolgreich; Geheimnis-Prüfung von `dist/` bestanden |
| `vercel build` (lokal, Vercel CLI) | erfolgreich: statische Ausgabe + Function `api/index` (Node 22); kompilierte Function direkt aufgerufen: `/api/health` 200, Status, 404, Sperre ohne Zugangscode |
| `npm run test:e2e:prod` (Produktions-Build) | 7/7 – kompletter Definition-of-Done-Ablauf, Mathe, Demo-Trennung, Android (Pixel 7), Manifest + Icons + Service Worker, Offline-Start nach erstem Besuch, Zugangscode-Ablauf in den Einstellungen |
| `npm run test:e2e` (Dev-Server) | 4/4 |
| `npm run test:sql` | Migration läuft, RLS trennt Nutzer, Constraints greifen |

Nicht getestet: echtes Deployment auf Vercel (kein Vercel-Konto in dieser Umgebung – siehe `DEPLOY.md`), Antworten echter KI-Modelle (kein API-Schlüssel), OCR mit Tesseract (lädt Sprachdaten aus dem Internet), physisches Android-Gerät (nur emuliert: Pixel 7).

## In der QA gefundene und behobene Fehler
- Neue Nutzer hingen im Ladebildschirm (useLiveQuery: „nicht vorhanden“ = „lädt noch“) – behoben, auch für alle „nicht gefunden“-Seiten.
- Demo-Daten wurden doppelt angelegt (React StrictMode) – Bootstrap läuft jetzt genau einmal.
- Alle Beispiel-Karteikarten zählten am ersten Tag als „fällig“ – jetzt höchstens 10 neue Karten pro Tag.
- Prüfungsformular per Direktlink ohne vorausgewähltes Fach – behoben.
- Supabase: generierte Spalte mit nicht-immutabler Umwandlung – durch normale Spalte ersetzt.
- Mehrere Darstellungsdetails (Fokusrahmen, Eingabefeldhöhe im Tutor, Zahlenabstände).
- Website-Umstellung: Fotos für die KI-Abschrift werden vor dem Hochladen verkleinert (Vercel-Grenze ~4,5 MB); öffentliche Server ohne Zugangscode sperren die KI.

## Bekannte Grenzen / offen
- Keine Cloud-Synchronisation: Daten liegen nur im jeweiligen Browser (Sicherung per JSON-Export). Supabase-Schema liegt bereit, Sync ist nicht implementiert.
- OCR (tesseract.js) lädt Sprachdaten beim ersten Einsatz aus dem Internet.
- Rate-Limit auf Vercel nur pro Function-Instanz (grober Schutz; der Zugangscode ist der eigentliche Schutz).
- Erinnerungen nur bei geöffneter App (kein Push-Server).
- Der Beispiel-Lehrplan ist nicht mit den offiziellen MV-Rahmenplänen abgeglichen.
- Keine Word-Dokumente (.docx) – Hinweis in der App: als PDF speichern.

## Nächste Schritte (Vorschläge)
1. Optional Supabase-Sync implementieren (Repository-Schicht in `src/db/repo.ts` ist die einzige Stelle mit Schreibzugriffen).
2. Mehr Aufgaben für Deutsch/Gesellschaftsfächer ergänzen oder mit KI generieren und prüfen.
3. Lehrplan mit dem Unterricht abgleichen und Themen als „abgeglichen“ markieren.
