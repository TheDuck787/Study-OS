# Study OS – Implementierungsplan (Milestone 1)

## Ausgangslage (geprüft am 25.10.2026)
- Leeres Arbeitsverzeichnis, kein bestehendes Projekt.
- Node 22, npm, Chromium + Playwright 1.63 vorinstalliert, npm-Registry erreichbar.
- **Keine** Supabase-Zugangsdaten, **keine** eigenen KI-API-Schlüssel des Nutzers.

## Architektur-Entscheidungen
| Bereich | Entscheidung | Begründung |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite, HashRouter | läuft statisch überall (Vercel, eigener Server, beliebiger Webspace – ohne Server-Rewrites) |
| Styling | Tailwind v4 + eigene Design-Tokens (CSS-Variablen) | schnelle, konsistente Komponenten; Dark/Light über Tokens |
| Daten | IndexedDB über Dexie (local-first), zwei getrennte Datenbanken: `studyos-main` (echte Daten) und `studyos-demo` (Demo) | funktioniert ohne Konto/Server; Demo-Daten können echte Lernhistorie nie verfälschen |
| Migrationspfad | `supabase/migrations/0001_init.sql` mit RLS, per PGlite getestet | späterer Umzug auf Supabase (Auth + Postgres) ohne Schema-Neudesign |
| KI | Provider-Abstraktion: (1) KI-Proxy (Hono) als Vercel Function oder eigener Node-Server mit Anthropic / OpenAI / OpenAI-kompatibel (Ollama), Schlüssel nur serverseitig, Zugangscode auf öffentlichen Hosts Pflicht; (2) „Keine KI“ | Kernfunktionen sind nie von KI abhängig |
| Mathe | mathjs (Äquivalenzprüfung, Auswertung), KaTeX (Darstellung), eigene Aufgabengeneratoren mit Lösungsschritten | korrekte Bewertung äquivalenter Formen ohne KI |
| Dokumente | pdf.js (Textebene), tesseract.js (OCR, lädt Sprachdaten bei Bedarf), Heuristiken für Struktur/Begriffe | Extraktion funktioniert ohne KI; Unvollständigkeit wird angezeigt |
| Tests | Vitest (Algorithmen, Bewertung, DB-Flows mit fake-indexeddb), Playwright (End-to-End im echten Browser, Desktop + Android-Viewport) | |

## Kernalgorithmen (einfach, erklärbar, testbar)
- **Beherrschung je Thema**: gewichtete Trefferquote, neuere Antworten zählen stärker (Halbwertszeit 30 Tage), plus zwei „Platzhalter-Fehlversuche“ als Startwert → eine einzelne richtige Antwort ergibt nie „gefestigt“. Stufen benötigen zusätzlich Mindestanzahl Antworten und verschiedene Lerntage.
- **Karteikarten**: vereinfachtes SM-2 (Vergessen / Schwer / Gut / Leicht).
- **Themen-Wiederholung**: Intervall abhängig von der Stufe (1 → 2 → 5 → 14+ Tage).
- **Empfehlungen**: Punktesumme aus (1) wiederholten Fehlern, (2) anstehenden Prüfungen, (3) überfälliger Wiederholung, (4) fehlenden Grundlagen, (5) Abschlag für Beherrschtes – jede Empfehlung zeigt ihre Gründe.
- **Lernplan**: Diagnose → Themenblöcke (schwächste zuerst, Voraussetzungen vorher) → gezielte Übung + verteilte Wiederholung → Probeklausur → Fehleranalyse → Abschluss-Wiederholung am Vortag.
- **Noten**: konfigurierbare Prozent-Schlüssel 1–6, immer als „geschätzte Note“ gekennzeichnet; echte Lehrernoten werden getrennt erfasst.

## Meilensteine
1. Planen (dieses Dokument) · 2. Fundament · 3. Kern-Lernen · 4. Adaptiv · 5. KI-Tutor · 6. Prüfungsvorbereitung · 7. Dokumente · 8. Qualitätssicherung

Fortschritt und offene Punkte: siehe `STATUS.md`.
