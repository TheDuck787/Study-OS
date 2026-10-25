# Kalender & Planer – Umsetzungsplan

## Bestand (inspiziert)
- Kein Kalender, keine Aufgaben. Prüfungen (`exams`) enthalten ihren Lernplan als `plan: PlanSession[]` (nur Datum + Minuten, keine Uhrzeit), erzeugt von `lib/studyplan.ts` aus echten Beherrschungswerten (`lib/mastery.ts`).
- Lernzeit (`sessions`), Antworten, Karteikarten mit SRS (`lib/srs.ts`), Empfehlungen (`lib/recommend.ts`), Sicherung (`lib/backup.ts`, Tabellenliste), Dexie-Schema Version 1.
- UI-Bausteine in `components/ui.tsx` (Dialog, Menu, Toast, Segmented, Tabs …), Fächerfarben `--s0…--s9`.

## Datenmodell (keine doppelten Quellen)
| Was | Quelle |
|---|---|
| Termine, Stunden, Lernblöcke, Karteikarten-Blöcke, Praktika, Pausen, eigene Typen | **neu** `events` (mit Wiederholung, Ausnahmen, Checkliste) |
| Hausaufgaben, Projekte, To-dos | **neu** `tasks` (Teilaufgaben); geplante Arbeitszeit = `events` mit `taskId` |
| Eigene Eintragstypen | **neu** `eventCategories` |
| Prüfungen | bestehend `exams` (+ optionale Felder: Uhrzeit, Raum, Selbsteinschätzung je Thema, geschätzte Vorbereitungszeit) |
| Lerneinheiten zu Prüfungen | bestehend `exam.plan` (+ optional `start`, `pinned`) |
| Fach-Icon | bestehend `subjects` (+ optional `icon`) |
| Planer-Einstellungen (Lernfenster, Schulzeit, Tagesmaximum) | `meta.plannerSettings` |

Der Kalender rechnet alles zur Laufzeit in eine gemeinsame Liste `CalItem` um (`lib/calendar/items.ts`). Alle Ansichten lesen diese eine Liste → Änderungen erscheinen sofort überall (Dexie liveQuery).

## Planer (ohne KI)
1. Prüfungspläne mit dem bestehenden Generator neu erzeugen (erledigte und manuell verschobene Einheiten bleiben, keine Duplikate).
2. Hausaufgaben/Projekte mit Restaufwand in Blöcke ≤ Sitzungslänge teilen, vor der Frist verteilen.
3. Karteikarten-Wiederholung an Tagen mit fälligen Karten.
4. Uhrzeiten vergeben: nur in Lernfenstern, nicht über Unterricht/Terminen (+ Puffer), mit Pausen, Tagesmaximum; dringendstes zuerst; zu viel → früherer Tag, sonst Warnung.
5. Ergebnis ist ein **Vorschlag** (neu / verschoben / entfernt), der erst nach Bestätigung gespeichert wird. Manuell erstellte Einträge werden nie verändert.

## Meilensteine
1. Daten: Typen, Schema v2, Repository mit Validierung, Wiederholungs-Bearbeitung, Rückgängig, Sicherung v2, Supabase-Migration 0002.
2. Reine Logik + Tests: Zeit, Wiederholung, Vereinheitlichung, Filter, Überlappungs-Layout, Planer, Prüfungsvorbereitung, Wochenauswertung.
3. Kalender-UI: Monat, Woche, Tag, Agenda, Semester; Seitenleiste (Mini-Monat, Filter, Legende), Detailbereich, Editor in Abschnitten, Verschieben/Größe ändern, Suche, Tastenkürzel.
4. Aufgaben, „Mein Tag“, Wochenplanung, Planer-Dialog, Prüfungs-Vorbereitungspanel, Fach-Icons, Navigation, Erinnerungen, Demo-Daten.
5. Tests (Unit, E2E Desktop + Android, Neuladen, Sicherung), Screenshots prüfen, STATUS.md.

## Kompatibilitätsrisiken
- Schema-Upgrade v1→v2: nur neue Tabellen/optionale Felder, keine Migration bestehender Zeilen nötig.
- Sicherungen: Version 2; alte Sicherungen (v1) bleiben einlesbar.
- Bestehende Prüfungs-Lernpläne ohne Uhrzeit erscheinen als „ohne Uhrzeit“ am Tag.
- Lokale Daten: nicht automatisch zwischen Geräten synchronisiert (Hinweis in der App).
