# Lernpakete für Study OS

Ein **Lernpaket** enthält alles, was du zu **einem Thema eines Fachs** brauchst: Erklärungen, Musterbeispiele, Fachbegriffe, Lernziele, Fragen mit Lösungen und Begründungen, Karteikarten, Übungen in drei Stufen, typische Fehler, einen Lernzettel und optional einen Prüfungsmodus. Das Format funktioniert für **jedes Fach** (Deutsch, Mathe, Biologie, Chemie, Englisch, Geschichte …) und jede Sprache.

| Datei | Inhalt |
|---|---|
| `docs/lernpakete/lernpaket.schema.json` | JSON Schema (Draft 2020-12) – für Editoren mit Autovervollständigung |
| `docs/lernpakete/vorlage.json` | leere, gültige Vorlage mit einem Eintrag pro Abschnitt |
| `public/lernpakete/deutsch-textanalyse-klasse-9.json` | vollständiges Beispiel: Deutsch → Textanalyse, Klasse 9 |
| `scripts/build-example-package.py` | Quelle des Beispielpakets (erzeugt die JSON-Datei) |

## Importieren

1. Study OS öffnen → **Bibliothek** → **Lernpaket** (oder in einem Fach: ⋯ → *Lernpaket importieren*).
2. Datei wählen (`.json`, `.md` oder `.txt`) – oder **Beispiel laden** bzw. Text einfügen.
3. Study OS prüft die Datei sofort und zeigt **Fehler** (mit Stelle, z. B. „Fragen Nr. 4: Die richtige Antwort fehlt“) und **Hinweise**. Bei Fehlern wird nichts importiert.
4. In der **Vorschau** siehst du alle Inhalte. Wähle das **Fach** (vorhanden oder neu) und ob ein **neues Thema** angelegt oder ein **bestehendes Thema** ergänzt wird.
5. **Importieren** → die Zusammenfassung zeigt, wie viele Notizen, Fragen, Übungen und Karteikarten angelegt (bzw. als schon vorhanden übersprungen) wurden. Direkt danach ist alles rückgängig zu machen.

Alles wird lokal gespeichert (bleibt nach dem Neuladen erhalten) und – wenn du mit Google angemeldet bist – wie alle anderen Daten synchronisiert.

### Wohin kommt was?

| Im Paket | In Study OS |
|---|---|
| `subject`, `topic` | Fach (vorhanden oder neu), Thema (neu oder bestehend) |
| `description`, `objectives`, `sources` | Themenbeschreibung + Notiz „Überblick“ mit Lernzielen |
| `notes` | je eine Notiz am Thema |
| `examples` | je eine Notiz „Beispiel: …“ mit Schritten und Begründungen |
| `keyTerms` | Notiz „Fachbegriffe“ (optional zusätzlich als Karteikarten) |
| `questions` | Quiz-Fragen des Themas (Auswahl, Wahr/Falsch, offen, Zahl) |
| `exercises` | Quiz-Fragen mit Schwierigkeit leicht/mittel/schwer + Notiz „Übungsaufgaben“ mit Lösungen |
| `flashcards` | Kartenstapel „<Thema> – Karteikarten“ mit Wiederholungsplan |
| `mistakes` | Notiz „Typische Fehler“ |
| `summary` | Notiz „Lernzettel“ |
| `exam`, `"exam": true` | Prüfungsfragen → Knopf **Prüfungsmodus** auf der Themenseite |
| unbekannte Felder | Notiz „Zusätzliche Angabe“ – nichts wird still verworfen |

Optional kannst du das Thema beim Import einer **anstehenden Prüfung** des Fachs zuordnen – dann berücksichtigt der Lernplaner es.

### Doppelte Importe

Jeder Eintrag bekommt eine feste ID aus **Paket-`id`** und Eintrag (`id` oder Inhalt). Importierst du dasselbe Paket noch einmal, wird nichts doppelt angelegt; eine neuere Paketfassung fügt nur die **neuen** Einträge hinzu. Deine eigenen Änderungen an bereits importierten Inhalten werden nie überschrieben. Vergib deshalb eine **feste `id`** und – wenn möglich – feste `id`s für Notizen, Fragen und Übungen.

## Format (Version 1)

```jsonc
{
  "format": "studyos-learning-package",   // Pflicht, genau so
  "version": 1,                             // Pflicht
  "id": "deutsch-textanalyse-klasse-9",     // Pflicht: a–z, 0–9, Bindestrich
  "title": "Textanalyse – Klasse 9",        // Pflicht
  "subject": "Deutsch",                     // Pflicht
  "topic": "Textanalyse",                   // Pflicht
  "level": "Klasse 9", "grade": 9, "language": "de",
  "description": "…", "author": "…", "createdAt": "2026-10-25", "sources": ["…"],
  "objectives": ["…"],
  "notes":      [{ "id": "…", "title": "…", "content": "Markdown" }],
  "examples":   [{ "id": "…", "title": "…", "task": "…", "steps": [{ "step": "…", "why": "…" }], "result": "…" }],
  "keyTerms":   [{ "term": "…", "definition": "…", "example": "…" }],
  "questions":  [ /* siehe unten */ ],
  "flashcards": [{ "front": "…", "back": "…", "example": "…" }],
  "exercises":  [{ "id": "…", "level": "easy|medium|hard", "prompt": "…", "solution": "…", "explanation": "…", "steps": ["…"], "answer": 12.5, "unit": "cm" }],
  "mistakes":   [{ "mistake": "…", "why": "…", "fix": "…" }],
  "summary": "Markdown-Lernzettel",
  "exam": { "title": "…", "timeLimitMinutes": 30, "questionIds": ["…"] }
}
```

Texte sind **Markdown** (Tabellen, Listen, Fettdruck); Formeln schreibst du als `$…$`.

### Fragetypen

| `type` | Pflichtfelder | Hinweis |
|---|---|---|
| `multiple-choice` | `prompt`, `options` (2–10), `correct` (Index **ab 0**), `explanation` | optional `optionExplanations` – eine Erklärung pro Antwort |
| `true-false` | `prompt` (Aussage), `correct` (`true`/`false`), `explanation` | |
| `open` | `prompt`, `solution` (Musterlösung), `explanation` | optional `keywords` für automatische Prüfung, z. B. `[["Präsens"], ["Ich-Erzähler", "Ich-Erzählerin"]]`; ohne `keywords` vergleichst du selbst mit der Musterlösung |
| `number` | `prompt`, `answer` (Zahl), `explanation` | optional `unit`, `tolerance`, `steps` |

Alle Fragen: optional `id`, `difficulty` (`easy`/`medium`/`hard`), `hints`, `exam: true` (Prüfungsmodus).
**Jede Lösung braucht eine `explanation`** – Study OS lehnt Fragen ohne Begründung ab.

### Prüfung beim Import

Fehler (blockieren den Import): fehlende Pflichtfelder, falsches `format`, neuere `version`, ungültiges JSON (mit Zeile/Spalte), `correct` außerhalb der Antworten, doppelte IDs, zu lange Texte (es wird nie still gekürzt), Prüfungs-IDs, die es nicht gibt, leeres Paket.
Hinweise (Import möglich): fehlende `id` (wird aus Fach + Thema gebildet), Umwandlungen wie `"wahr"` → `true`, `"3,5"` → `3.5`, `"mittel"` → `"medium"`, unbekannte Felder (werden als Notiz aufbewahrt).

## Markdown- / TXT-Format

Gut lesbar und ebenfalls importierbar. Über **Exportieren → Markdown** erzeugt Study OS genau dieses Format.

```markdown
---
format: studyos-learning-package
version: 1
id: biologie-fotosynthese-klasse-8
subject: Biologie
topic: Fotosynthese
level: Klasse 8
---
# Fotosynthese – Klasse 8
Kurze Beschreibung.

## Lernziele
- Ich kann die Wortgleichung der Fotosynthese nennen.

## Notizen
### Was ist Fotosynthese?
Erklärung in Markdown …

## Fachbegriffe
- **Chlorophyll:** grüner Blattfarbstoff, der Licht aufnimmt.

## Fragen
### MC: Welcher Stoff entsteht bei der Fotosynthese?
- [ ] Kohlenstoffdioxid
- [x] Sauerstoff
Erklärung: Sauerstoff wird als Nebenprodukt abgegeben …
Schwierigkeit: leicht
Prüfung: ja

### WF: Pflanzen brauchen für die Fotosynthese Licht.
Lösung: wahr
Erklärung: …

### Offen: Nenne die Ausgangsstoffe der Fotosynthese.
Lösung: Kohlenstoffdioxid und Wasser (sowie Lichtenergie).
Erklärung: …

## Karteikarten
- Chlorophyll :: grüner Blattfarbstoff

## Übungen
### Leicht: Notiere die Wortgleichung.
Lösung: Kohlenstoffdioxid + Wasser → Traubenzucker + Sauerstoff
Erklärung: …

## Typische Fehler
- **Fehler:** … **So vermeidest du ihn:** …

## Zusammenfassung
- …
```

Erkannte Überschriften (deutsch/englisch): Lernziele/Objectives, Notizen/Notes, Beispiele/Examples, Fachbegriffe/Key terms, Fragen/Questions, Prüfung/Exam, Karteikarten/Flashcards, Übungen/Exercises, Typische Fehler/Common mistakes, Zusammenfassung/Summary, Quellen/Sources. **Unbekannte Abschnitte werden als Notiz übernommen.**
Feldnamen in Fragen/Übungen: `Lösung/Solution`, `Erklärung/Explanation`, `Schwierigkeit/Difficulty`, `Prüfung/Exam`, `Hinweis/Hint`, `Schlüsselwörter/Keywords` (`a | b; c`), `Einheit/Unit`, `Toleranz/Tolerance`, `Schritte/Steps`, `ID`.

## Neue Pakete erstellen

- **Vorlage:** In Study OS → Lernpaket → *Vorlage herunterladen* (oder `docs/lernpakete/vorlage.json`).
- **Aus vorhandenem Thema:** Themenseite → *Als Lernpaket exportieren* (JSON oder Markdown). Exportierte Pakete lassen sich auf anderen Geräten oder bei Mitschülern importieren.
- **Mit einer KI erzeugen:** Lernpaket-Seite → *KI-Prompt kopieren* – Fach, Thema und Klasse eintragen, Prompt in einen KI-Chat einfügen, die Antwort als `.json` speichern und importieren. Prüfe KI-Inhalte immer auf fachliche Richtigkeit, bevor du damit lernst.
