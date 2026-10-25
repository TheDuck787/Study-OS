#!/usr/bin/env python3
"""Builds the example learning package public/lernpakete/deutsch-textanalyse-klasse-9.json.
The short story "Grüne Ampel" is an original text written for Study OS (no textbook material)."""
import json, pathlib

STORY = [
    "Die Ampel sprang auf Rot, als Jonas den Bus um die Ecke biegen sah.",
    "Er blieb stehen. Natürlich. Heute lief ja alles schief.",
    "Seit dem Morgen trug er den Zettel in der Jackentasche, zweimal gefaltet,",
    "die Ecken schon weich vom vielen Anfassen. Eine Vier minus in Mathe.",
    "Unterschreiben lassen bis Freitag. Heute war Donnerstag.",
    "Neben ihm wartete eine alte Frau mit einem Einkaufsnetz, aus dem",
    "eine Lauchstange ragte wie eine grüne Fahne. Sie summte leise vor sich hin.",
    "Jonas starrte auf das rote Männchen. Rot, dachte er, wie der Stift",
    "von Frau Albers. Rot wie das Gesicht seines Vaters, wenn er die Note sähe.",
    "Auf der anderen Straßenseite hielt der Bus. Die Türen öffneten sich zischend.",
    "„Den kriegst du noch“, sagte die Frau plötzlich, ohne ihn anzusehen.",
    "„Der Fahrer wartet immer, bis die Ampel umspringt. Ich kenne ihn seit Jahren.“",
    "Jonas antwortete nicht. Er hätte rennen können, quer über die Straße,",
    "aber seine Beine fühlten sich an wie aus Blei.",
    "Dann wurde es grün. Die Frau ging los, langsam, Schritt für Schritt,",
    "und der Bus wartete tatsächlich. Jonas folgte ihr.",
    "An der Tür drehte sie sich um und lächelte. „Siehst du? Manchmal",
    "wartet die Welt auf einen. Man muss nur losgehen.“",
    "Im Bus setzte sich Jonas ans Fenster. Er zog den Zettel aus der Tasche,",
    "faltete ihn auseinander und strich ihn auf dem Knie glatt.",
    "Draußen zog die Stadt vorbei. Er sah die Vier minus an,",
    "lange. Zum ersten Mal an diesem Tag atmete er tief durch.",
]
STORY_MD = "**„Grüne Ampel“** – Originaltext für Übungszwecke (Study OS, 2026)\n\n" + "\n".join(f"`{i:>2}`  {line}" for i, line in enumerate(STORY, 1))

notes = [
 {"id": "was-ist-eine-textanalyse", "title": "Was ist eine Textanalyse?", "content": """In einer **Textanalyse** untersuchst du, *wie* ein Text gemacht ist und *was* er damit ausdrückt. Du erzählst den Text also nicht nach, sondern erklärst, mit welchen Mitteln (Aufbau, Erzähler, Figuren, Sprache) eine bestimmte Wirkung oder Aussage entsteht.

| | Inhaltsangabe | Textanalyse |
|---|---|---|
| Frage | *Was* passiert? | *Wie* ist der Text gestaltet und *warum*? |
| Inhalt | Handlung knapp in eigenen Worten | Gestaltungsmittel + Wirkung + Deutung |
| Zitate | keine | Belege mit Zeilenangabe |

**Grundregeln**
- Tempus: **Präsens** („Der Erzähler beschreibt …“), Vorzeitiges im Perfekt.
- Stil: sachlich, keine Umgangssprache, keine Ich-Erzählung des Inhalts.
- Jede Behauptung über den Text wird **am Text belegt** (Zitat oder Verweis mit Zeilenangabe).
- Unterscheide immer **Autor/in** (reale Person, die den Text geschrieben hat) und **Erzähler/in** (die vom Autor geschaffene Stimme im Text).

**Die drei Leitfragen jeder Analyse**
1. *Was fällt auf?* (z. B. viele kurze Sätze, ein Vergleich, ein Perspektivwechsel)
2. *Wie wirkt das?* (z. B. hektisch, bedrückend, spannend)
3. *Was bedeutet das für die Aussage des Textes?* (Deutung)"""},
 {"id": "aufbau", "title": "Aufbau: Einleitung, Hauptteil, Schluss", "content": """### Einleitung
Die Einleitung informiert kurz über den Text und nennt deine **Deutungshypothese**.
Merkhilfe **TATTE**: **T**itel, **A**utor/in, **T**extsorte, **T**hema, **E**rscheinungsjahr.

> *Formulierungshilfe:* In der Kurzgeschichte „…“ von … aus dem Jahr … geht es um … . Vermutlich will der Text zeigen, dass … .

Die **Deutungshypothese** ist eine begründete, vorläufige Annahme über die Aussage des Textes. Sie wird im Hauptteil überprüft – und darf sich am Ende auch als nur teilweise richtig erweisen.

### Hauptteil
1. **Knappe Inhaltszusammenfassung** (3–6 Sätze, Präsens, eigene Worte) – nur so viel, wie zum Verständnis nötig ist.
2. **Analyse** – sinnvoll gegliedert, z. B.:
   - Aufbau und Handlungsverlauf (Einstieg, Wendepunkt, Ende, Zeitgestaltung)
   - Erzählinstanz (Erzählform, Erzählverhalten, Innen-/Außensicht)
   - Figuren (Charakterisierung, Beziehung, Entwicklung)
   - Sprache und Stilmittel (immer mit **Wirkung**)
3. Jeder Analysepunkt folgt dem **Dreischritt**: *Behauptung → Beleg → Deutung*.

> *Formulierungshilfen:* Auffällig ist … · Dies zeigt sich an … (Z. …) · Dadurch wird deutlich, dass … · Diese Gestaltung unterstreicht …

### Schluss
- Ergebnisse knapp **zusammenfassen** (keine neuen Belege mehr).
- **Deutungshypothese überprüfen**: bestätigt, ergänzt oder widerlegt?
- Optional: begründete **eigene Stellungnahme** oder Bezug zur heutigen Lebenswelt.

> *Formulierungshilfe:* Insgesamt bestätigt die Analyse die anfängliche Vermutung, dass … . Besonders die … machen deutlich, … ."""},
 {"id": "erzaehltexte-kurzgeschichten", "title": "Erzähltexte und Kurzgeschichten untersuchen", "content": """### Typische Merkmale einer Kurzgeschichte
- **Unvermittelter Einstieg**: Die Handlung beginnt mitten im Geschehen, ohne lange Vorgeschichte.
- **Alltagssituation** und Alltagsfiguren; wenige Figuren, oft ohne genaue Beschreibung.
- **Kurze erzählte Zeit** (Minuten bis wenige Stunden), meist ein Ort.
- **Wendepunkt**: Ein Moment, in dem sich etwas für die Hauptfigur verändert.
- **Offenes Ende**: Die Leserin/der Leser muss selbst weiterdenken.
- Oft **Alltagssprache**, kurze Sätze, Andeutungen statt Erklärungen; Gegenstände können **symbolisch** sein.

### Zeitgestaltung
- **Erzählzeit**: Zeit, die man zum Lesen braucht. **Erzählte Zeit**: Zeitraum, über den die Handlung geht.
- **Zeitraffung** (erzählte Zeit > Erzählzeit, z. B. „Die Wochen vergingen.“), **zeitdeckendes Erzählen** (etwa gleich lang, z. B. Dialoge), **Zeitdehnung** (Erzählzeit > erzählte Zeit, z. B. viele Gedanken in einer Sekunde).
- **Rückblende**: Ein früheres Ereignis wird nachträglich erzählt. **Vorausdeutung**: Späteres wird angedeutet.

### So gehst du vor
1. Text zweimal lesen, beim zweiten Mal markieren (Figuren, Ort, Zeit, Wendepunkt, Auffälliges).
2. Handlungsschritte notieren und den **Wendepunkt** bestimmen.
3. Fragen stellen: Wer erzählt? Was erfährt man über die Figuren? Welche sprachlichen Auffälligkeiten gibt es – und wozu?
4. Deutungshypothese formulieren und Belege sammeln."""},
 {"id": "erzaehlperspektive", "title": "Erzähler: Erzählform und Erzählverhalten", "content": """Der **Erzähler** ist nicht der Autor, sondern eine Stimme im Text. Man beschreibt ihn mit zwei Fragen:

### 1. Erzählform – *In welcher Person wird erzählt?*
- **Ich-Erzähler/in**: Eine Figur erzählt selbst („Ich packte meine Tasche.“). Man erfährt nur, was diese Figur weiß, denkt und fühlt.
- **Er-/Sie-Erzähler/in**: Erzählt wird in der dritten Person („Er blieb stehen.“).

### 2. Erzählverhalten – *Wie nah ist der Erzähler den Figuren?*
| Erzählverhalten | Erkennungszeichen | Wirkung |
|---|---|---|
| **auktorial** | weiß mehr als die Figuren, kommentiert, deutet voraus, kennt mehrere Innenwelten | Überblick, Distanz, Lenkung der Leser |
| **personal** | erzählt aus der Sicht *einer* Figur, Innensicht (Gedanken, Gefühle), kein Kommentar | Nähe, Identifikation, oft eingeschränkte Sicht |
| **neutral** | nur Außensicht: Handlungen und Gespräche wie mit einer Kamera, keine Gedanken | Sachlichkeit, Leser muss selbst deuten |

### Wiedergabe von Gedanken
- **Erlebte Rede**: Gedanken einer Figur in der 3. Person und im Präteritum, ohne „dachte er“ („Natürlich. Heute lief ja alles schief.“).
- **Innerer Monolog**: Gedanken in der 1. Person und im Präsens („Warum passiert das immer mir?“).
- **Gedankenbericht**: Der Erzähler fasst zusammen („Er dachte an seinen Vater.“).

> **Tipp:** Belege das Erzählverhalten immer mit einer Textstelle, z. B. „Die Innensicht zeigt sich in ‚dachte er‘ (Z. 8).“"""},
 {"id": "figuren", "title": "Figuren charakterisieren", "content": """Eine **Figurencharakterisierung** beschreibt, wie eine Figur ist – und woran man das erkennt.

### Direkte und indirekte Charakterisierung
- **Direkt**: Eigenschaften werden ausdrücklich genannt – vom Erzähler, von anderen Figuren oder der Figur selbst („Sie war geduldig.“).
- **Indirekt**: Man erschließt Eigenschaften aus **Handeln, Sprechen, Denken, Aussehen** oder Umgebung (Jemand summt beim Warten → gelassen).

### Was du untersuchen kannst
- äußere Merkmale (Alter, Aussehen), Lebenssituation
- Verhalten, Sprache, Gedanken und Gefühle
- Beziehung zu anderen Figuren (**Figurenkonstellation**: z. B. Gegenfigur/Kontrastfigur)
- **Entwicklung**: Verändert sich die Figur vom Anfang bis zum Ende?

### Dreischritt für Charakterisierungen
*Behauptung:* Jonas ist zu Beginn angespannt und mutlos. → *Beleg:* „Heute lief ja alles schief“ (Z. 2) → *Deutung:* Die resignierte erlebte Rede zeigt, dass er die schlechte Note als Teil eines rundum misslungenen Tages empfindet."""},
 {"id": "sprache-stilmittel", "title": "Sprache und Stilmittel – immer mit Wirkung", "content": """Ein Stilmittel nur zu **benennen** reicht nie. Erst die **Wirkung** und die **Funktion** für die Aussage machen eine Analyse aus.

| Stilmittel | Erklärung | Beispiel | mögliche Wirkung |
|---|---|---|---|
| **Vergleich** | Verbindung zweier Bereiche mit „wie“/„als ob“ | „wie aus Blei“ | macht Gefühle anschaulich |
| **Metapher** | bildlicher Ausdruck ohne „wie“ | „ein Meer aus Tränen“ | verdichtet, veranschaulicht |
| **Personifikation** | Dinge/Abstraktes handeln wie Menschen | „die Welt wartet“ | lebendig, nahbar |
| **Ellipse** | unvollständiger Satz | „Natürlich.“ | Gedankenfetzen, Anspannung, Tempo |
| **Anapher** | Wiederholung am Satz- oder Versanfang | „Rot … Rot …“ | Eindringlichkeit, Gedankenkreisen |
| **Wiederholung** | gleiches Wort/Motiv mehrfach | „wartet … wartet“ | Betonung, Leitmotiv |
| **Symbol** | Gegenstand steht für etwas Abstraktes | grüne Ampel = Aufbruch | Tiefe, Deutungsebene |
| **Hyperbel** | starke Übertreibung | „tausendmal gesagt“ | Verstärkung |
| **Antithese** | Gegensatz | „Rot“ – „grün“ | Spannung, Kontrast |
| **rhetorische Frage** | Frage ohne erwartete Antwort | „Siehst du?“ | Zustimmung, Nachdruck |
| **Alliteration** | gleicher Anfangslaut | „mit Kind und Kegel“ | Klang, Einprägsamkeit |

### Satzbau und Wortwahl
- **Parataxe** (viele Hauptsätze, kurz) wirkt oft knapp, gehetzt oder nüchtern; **Hypotaxe** (verschachtelte Sätze) wirkt ruhiger, nachdenklicher oder kompliziert.
- **Wortwahl**: Umgangssprache (Nähe, Alltag), Fachsprache (Sachlichkeit), wertende Adjektive (Stimmung).
- **Konjunktiv** drückt Möglichkeiten, Wünsche oder Befürchtungen aus („wenn er die Note sähe“).

> **So formulierst du:** „Der Vergleich ‚wie aus Blei‘ (Z. 14) veranschaulicht, dass Jonas sich vor Angst wie gelähmt fühlt.“"""},
 {"id": "textbelege", "title": "Deutungen am Text belegen (Zitieren)", "content": """### Direktes Zitat
- Wörtlich, in **Anführungszeichen**, mit **Zeilenangabe**: „wie aus Blei“ (Z. 14).
- Geht ein Zitat über zwei Zeilen: (Z. 17 f.), über mehrere: (Z. 17 ff.) oder genauer (Z. 15–18).
- **Auslassungen** kennzeichnest du mit […]: „Die Frau ging los, […] Schritt für Schritt“ (Z. 15).
- **Anpassungen** an deinen Satz (z. B. Groß-/Kleinschreibung) setzt du in eckige Klammern: Der Erzähler schildert: „[S]eine Beine fühlten sich an wie aus Blei“ (Z. 14).
- Zitate **einbauen**, nicht unverbunden hinstellen: *Dass Jonas sich wie gelähmt fühlt, zeigt der Vergleich „wie aus Blei“ (Z. 14).*

### Indirektes Zitat (Paraphrase)
- Sinngemäß in eigenen Worten, **ohne** Anführungszeichen, mit **„vgl.“**: Die Frau erklärt, der Fahrer warte immer, bis die Ampel umspringe (vgl. Z. 12).
- Wiedergegebene Aussagen stehen im **Konjunktiv I** (warte, sei, habe).

### Der Dreischritt
1. **Behauptung** (These): Was zeigt die Stelle?
2. **Beleg**: Zitat oder Verweis mit Zeilenangabe.
3. **Deutung**: Wie wirkt das, was bedeutet es für die Aussage?

> Kurze Zitate (wenige Wörter) sind meist besser als lange – sie zeigen genau, worauf du dich beziehst."""},
 {"id": "uebungstext", "title": "Übungstext: „Grüne Ampel“", "content": STORY_MD + "\n\n*Zu diesem Text gehören das Musterbeispiel, die Fragen und die Übungen dieses Lernpakets.*"},
]

MUSTER = """**Einleitung**
In der Kurzgeschichte „Grüne Ampel“, einem Übungstext aus dem Jahr 2026, geht es um einen Jugendlichen, der mit einer schlechten Mathenote nach Hause fährt und an einer Ampel einer älteren Frau begegnet. Vermutlich will der Text zeigen, dass man Ängsten nicht ausweichen kann, sondern ihnen – manchmal mit Hilfe einer kleinen Begegnung – mutig entgegengehen muss.

**Inhalt**
Jonas wartet an einer roten Ampel, während auf der anderen Straßenseite sein Bus hält. Er hat eine Vier minus in Mathe geschrieben und muss die Arbeit bis zum nächsten Tag unterschreiben lassen. Eine alte Frau neben ihm sagt ihm, der Fahrer warte immer, bis die Ampel umspringe. Als es grün wird, folgt Jonas der Frau, erreicht den Bus und betrachtet dort zum ersten Mal in Ruhe seine Note.

**Aufbau und Gattung**
Typisch für eine Kurzgeschichte beginnt der Text unvermittelt mitten in der Situation: „Die Ampel sprang auf Rot“ (Z. 1). Die erzählte Zeit umfasst nur wenige Minuten; die Vorgeschichte wird in einer kurzen Rückblende nachgereicht (vgl. Z. 3–5). Den Wendepunkt bildet der Moment, in dem es grün wird und die Frau losgeht (vgl. Z. 15 f.). Das Ende bleibt offen: Man erfährt nicht, wie das Gespräch mit dem Vater verläuft, sondern nur, dass Jonas „[z]um ersten Mal an diesem Tag“ (Z. 22) tief durchatmet. So rückt nicht die Lösung des Problems, sondern Jonas’ innere Veränderung in den Mittelpunkt.

**Erzählweise**
Erzählt wird von einem Er-Erzähler mit personalem Erzählverhalten. Die Leser erfahren Jonas’ Gedanken, etwa in der erlebten Rede „Natürlich. Heute lief ja alles schief“ (Z. 2) oder in „Rot, dachte er“ (Z. 8). Die Gedanken der Frau bleiben dagegen verborgen; sie wird nur von außen gezeigt. Dadurch erleben die Leser die Situation aus Jonas’ eingeschränkter, ängstlicher Sicht und können seine Erleichterung am Ende besonders gut nachvollziehen.

**Figuren**
Jonas ist zu Beginn angespannt und mutlos. Dass er den Zettel seit dem Morgen ständig anfasst, zeigen die Ecken, die „schon weich vom vielen Anfassen“ (Z. 4) sind – eine indirekte Charakterisierung seiner Unruhe. Er fürchtet vor allem die Reaktion seines Vaters (vgl. Z. 9). Die alte Frau wirkt dagegen gelassen und zuversichtlich: Sie „summte leise vor sich hin“ (Z. 7) und geht „langsam, Schritt für Schritt“ (Z. 15). Sie ist eine Kontrastfigur, deren Ruhe sich am Ende auf Jonas überträgt. Seine Entwicklung zeigt sich im Umgang mit dem Zettel: Erst trägt er ihn versteckt und „zweimal gefaltet“ (Z. 3), am Ende „strich [er] ihn auf dem Knie glatt“ (Z. 20) – er nimmt die schlechte Note an.

**Sprache und Stilmittel**
Kurze Sätze und Ellipsen wie „Natürlich.“ (Z. 2) oder „Unterschreiben lassen bis Freitag.“ (Z. 5) wirken wie Gedankenfetzen und machen Jonas’ Anspannung spürbar. Die Anapher „Rot […]. Rot wie das Gesicht seines Vaters“ (Z. 8 f.) zeigt, wie seine Gedanken immer wieder um die Note und die befürchtete Wut kreisen; der Konjunktiv „sähe“ (Z. 9) macht deutlich, dass es sich um eine Befürchtung handelt. Der Vergleich „seine Beine fühlten sich an wie aus Blei“ (Z. 14) veranschaulicht, dass die Angst ihn regelrecht lähmt. Dem steht die Farbsymbolik gegenüber: Rot steht für Stillstand, Fehler und Strafe, Grün – angedeutet schon in der Lauchstange „wie eine grüne Fahne“ (Z. 7) – für Hoffnung und Aufbruch. Die Personifikation „Manchmal wartet die Welt auf einen“ (Z. 17 f.) fasst die Kernaussage zusammen: Wer den ersten Schritt wagt, stellt oft fest, dass die Lage weniger aussichtslos ist als befürchtet.

**Schluss**
Insgesamt bestätigt die Analyse die Deutungshypothese. Durch die personale Erzählweise, die Kontrastfigur der alten Frau und die Farbsymbolik von Rot und Grün zeigt der Text, wie Jonas seine lähmende Angst überwindet und bereit wird, sich seinem Problem zu stellen. Die Geschichte macht deutlich, dass schon eine kleine, freundliche Begegnung Mut machen kann – eine Erfahrung, die viele Jugendliche aus dem eigenen Schulalltag kennen."""

examples = [{
  "id": "musteranalyse-gruene-ampel",
  "title": "Komplette Textanalyse zu „Grüne Ampel“",
  "task": "Analysiere die Kurzgeschichte „Grüne Ampel“. Berücksichtige Aufbau, Erzählweise, Figuren sowie sprachliche Mittel und ihre Wirkung.\n\n" + STORY_MD,
  "steps": [
    {"step": "Text zweimal lesen; beim zweiten Lesen Figuren, Ort, Zeit, Wendepunkt und auffällige Wörter markieren (z. B. „Rot“, „grün“, „wie aus Blei“).", "why": "Erst wenn du den Text verstanden hast, kannst du Gestaltungsmittel gezielt erkennen. Markierungen sind später deine Belege."},
    {"step": "Deutungshypothese formulieren: Der Text zeigt, dass man Ängsten nicht ausweichen kann, sondern ihnen mutig entgegengehen muss.", "why": "Die Hypothese gibt der Analyse eine Richtung. Jede spätere Beobachtung prüft, ob sie stimmt."},
    {"step": "Einleitung nach TATTE schreiben (Titel, Autor/Quelle, Textsorte, Thema, Jahr) und die Hypothese anschließen.", "why": "Die Leser deiner Analyse wissen sofort, worum es geht und welche These du belegen willst."},
    {"step": "Inhalt in wenigen Sätzen im Präsens zusammenfassen.", "why": "Die Zusammenfassung schafft die Grundlage; sie bleibt kurz, weil die Analyse – nicht das Nacherzählen – im Mittelpunkt steht."},
    {"step": "Aufbau untersuchen: unvermittelter Einstieg (Z. 1), Rückblende (Z. 3–5), Wendepunkt (Z. 15 f.), offenes Ende (Z. 21 f.).", "why": "Diese Merkmale belegen die Textsorte Kurzgeschichte und zeigen, dass die innere Veränderung wichtiger ist als die äußere Handlung."},
    {"step": "Erzählweise bestimmen: Er-Erzähler, personal; Belege: erlebte Rede (Z. 2), „dachte er“ (Z. 8); Frau nur Außensicht.", "why": "Ein Erzählverhalten gilt erst als nachgewiesen, wenn du es mit Textstellen belegst. Die Wirkung (Nähe zu Jonas) verbindet die Beobachtung mit der Deutung."},
    {"step": "Figuren charakterisieren: Jonas (angespannt → erleichtert), Frau (gelassene Kontrastfigur); Entwicklung am Zettel zeigen (Z. 3 → Z. 20).", "why": "Die Entwicklung der Hauptfigur ist der Kern der Geschichte und stützt die Hypothese direkt."},
    {"step": "Sprache analysieren: Ellipsen (Z. 2, 5), Anapher „Rot […] Rot“ (Z. 8 f.), Vergleich „wie aus Blei“ (Z. 14), Farbsymbolik, Personifikation „wartet die Welt“ (Z. 17 f.) – jeweils mit Wirkung.", "why": "Stilmittel zählen nur mit Wirkung und Funktion. So zeigst du, wie die Sprache die Aussage des Textes trägt."},
    {"step": "Schluss: Ergebnisse bündeln, Hypothese bestätigen, kurzer Bezug zur eigenen Lebenswelt.", "why": "Der Schluss rundet ab, ohne neue Belege einzuführen, und zeigt, dass du die Hypothese überprüft hast."},
  ],
  "result": MUSTER,
}]

key_terms = [
 ("Deutungshypothese", "Begründete, vorläufige Annahme über die Aussage eines Textes; steht in der Einleitung und wird im Hauptteil überprüft.", "Der Text zeigt, dass man Ängsten mutig begegnen sollte."),
 ("Erzähler/in", "Die vom Autor geschaffene Stimme, die im Text erzählt – nicht identisch mit dem Autor.", None),
 ("Ich-Erzähler/in", "Eine Figur der Geschichte erzählt selbst in der 1. Person.", "„Ich packte meine Tasche und ging.“"),
 ("Er-/Sie-Erzähler/in", "Erzählt wird in der 3. Person.", "„Er blieb stehen.“ (Z. 2)"),
 ("Auktoriales Erzählverhalten", "Der Erzähler weiß mehr als die Figuren, kommentiert, deutet voraus und kann in mehrere Figuren hineinsehen.", "„Niemand ahnte, dass dies sein letzter Arbeitstag sein würde.“"),
 ("Personales Erzählverhalten", "Erzählt wird aus der Sicht einer Figur mit Innensicht, ohne Kommentar des Erzählers.", "„Rot, dachte er“ (Z. 8)"),
 ("Neutrales Erzählverhalten", "Nur Außensicht wie durch eine Kamera: Handlungen und Gespräche, keine Gedanken.", None),
 ("Erlebte Rede", "Gedanken einer Figur in der 3. Person und im Präteritum, ohne Redebegleitsatz.", "„Natürlich. Heute lief ja alles schief.“ (Z. 2)"),
 ("Innerer Monolog", "Gedanken einer Figur in der 1. Person und im Präsens.", "„Warum passiert das immer mir?“"),
 ("Direkte Charakterisierung", "Eigenschaften einer Figur werden ausdrücklich genannt.", "„Sie war geduldig.“"),
 ("Indirekte Charakterisierung", "Eigenschaften werden aus Handeln, Sprechen, Denken oder Aussehen erschlossen.", "Die Frau summt beim Warten → sie ist gelassen."),
 ("Erzählzeit / erzählte Zeit", "Erzählzeit: Lesedauer. Erzählte Zeit: Zeitraum der Handlung.", "Einige Minuten Handlung, etwa eine Minute Lesezeit."),
 ("Wendepunkt", "Stelle, an der sich die Situation oder die Haltung der Hauptfigur entscheidend ändert.", "Die Ampel wird grün, die Frau geht los (Z. 15 f.)."),
 ("Offenes Ende", "Der Text endet, ohne alle Fragen zu beantworten; Leser denken selbst weiter.", None),
 ("Ellipse", "Unvollständiger Satz, in dem Satzteile fehlen.", "„Natürlich.“ (Z. 2)"),
 ("Vergleich", "Bildliche Verbindung zweier Bereiche mit „wie“ oder „als ob“.", "„wie aus Blei“ (Z. 14)"),
 ("Symbol", "Konkreter Gegenstand, der für etwas Abstraktes steht.", "Die grüne Ampel steht für Aufbruch."),
 ("Textbeleg", "Zitat oder Verweis mit Zeilenangabe, der eine Behauptung über den Text stützt.", "„wie aus Blei“ (Z. 14)"),
]

Q = []
def mc(id, prompt, options, correct, explanation, diff="easy", exam=False, optexp=None):
    q = {"id": id, "type": "multiple-choice", "prompt": prompt, "options": options, "correct": correct, "explanation": explanation, "difficulty": diff}
    if optexp: q["optionExplanations"] = optexp
    if exam: q["exam"] = True
    Q.append(q)
def tf(id, prompt, correct, explanation, diff="easy", exam=False):
    q = {"id": id, "type": "true-false", "prompt": prompt, "correct": correct, "explanation": explanation, "difficulty": diff}
    if exam: q["exam"] = True
    Q.append(q)
def op(id, prompt, solution, explanation, diff="medium", exam=False, keywords=None, hints=None):
    q = {"id": id, "type": "open", "prompt": prompt, "solution": solution, "explanation": explanation, "difficulty": diff}
    if keywords: q["keywords"] = keywords
    if hints: q["hints"] = hints
    if exam: q["exam"] = True
    Q.append(q)

mc("einleitung", "Was gehört in die Einleitung einer Textanalyse?",
   ["Titel, Autor/in, Textsorte, Thema, Erscheinungsjahr und eine Deutungshypothese", "Eine ausführliche Nacherzählung der Handlung", "Deine persönliche Meinung zum Text", "Alle Stilmittel mit Zeilenangaben"], 0,
   "Die Einleitung informiert knapp über den Text (TATTE) und nennt die Deutungshypothese, die der Hauptteil überprüft. Nacherzählung, Stilmittel und Meinung gehören in Hauptteil bzw. Schluss.", exam=True,
   optexp=["Richtig: TATTE plus Deutungshypothese.", "Falsch: Der Inhalt wird im Hauptteil nur knapp zusammengefasst – nacherzählt wird gar nicht.", "Falsch: Eine eigene Stellungnahme gehört, wenn überhaupt, in den Schluss.", "Falsch: Stilmittel werden im Hauptteil mit Wirkung analysiert."])
mc("tempus", "In welchem Tempus schreibst du eine Textanalyse?", ["Präsens", "Präteritum", "Perfekt", "Futur I"], 0,
   "Analysen und Inhaltsangaben stehen im Präsens („Der Erzähler beschreibt …“). Was vor der Handlung liegt, steht im Perfekt.",
   optexp=["Richtig: Präsens ist das Tempus der Analyse.", "Falsch: Das Präteritum ist das Erzähltempus vieler Geschichten – nicht der Analyse.", "Falsch: Das Perfekt nutzt du nur für Vorzeitiges.", "Falsch: Das Futur passt nicht zur Beschreibung eines vorliegenden Textes."])
mc("erzaehlverhalten-z2", "„Er blieb stehen. Natürlich. Heute lief ja alles schief.“ (Z. 2) – Welches Erzählverhalten zeigt sich hier?",
   ["personal – Jonas’ Gedanken werden in erlebter Rede wiedergegeben", "auktorial – der Erzähler kommentiert das Geschehen von oben", "neutral – nur äußere Handlung wird gezeigt", "Es gibt keinen Erzähler, weil Jonas selbst spricht"], 0,
   "„Natürlich. Heute lief ja alles schief.“ sind Jonas’ Gedanken in der 3. Person und im Präteritum, ohne „dachte er“ – also erlebte Rede. Das ist typisch für personales Erzählverhalten mit Innensicht.", diff="medium", exam=True)
mc("ellipse", "Was ist eine Ellipse?", ["Ein unvollständiger Satz, in dem Satzteile fehlen", "Eine Wiederholung am Satzanfang", "Eine starke Übertreibung", "Ein Vergleich mit „wie“"], 0,
   "Bei einer Ellipse fehlen Satzteile, z. B. „Natürlich.“ (Z. 2). Sie wirkt oft wie ein Gedankenfetzen und erzeugt Tempo oder Anspannung. Wiederholung am Satzanfang = Anapher, Übertreibung = Hyperbel.")
mc("vergleich-fahne", "„[…] aus dem eine Lauchstange ragte wie eine grüne Fahne“ (Z. 6 f.) – Welches Stilmittel liegt vor?", ["Vergleich", "Metapher", "Personifikation", "Alliteration"], 0,
   "Das Vergleichswort „wie“ verbindet Lauchstange und Fahne – also ein Vergleich (eine Metapher käme ohne „wie“ aus). Die grüne „Fahne“ deutet bereits Hoffnung an und bildet einen Gegensatz zum Rot der Ampel.", diff="easy", exam=True)
mc("zitierweise", "Welche Zitierweise ist korrekt?", ["Jonas fühlt sich wie gelähmt: „seine Beine fühlten sich an wie aus Blei“ (Z. 14).", "Jonas fühlt sich wie gelähmt: seine Beine fühlten sich an wie aus Blei.", "Jonas fühlt sich wie gelähmt: „seine Beine fühlten sich an wie aus Blei“.", "Jonas fühlt sich wie gelähmt (Z. 14): ‚Beine Blei‘."], 0,
   "Ein direktes Zitat steht wörtlich in Anführungszeichen und mit Zeilenangabe. Ohne Anführungszeichen ist es kein erkennbares Zitat, ohne Zeilenangabe fehlt der Beleg, und Wörter dürfen nicht verändert oder zusammengekürzt werden, ohne es zu kennzeichnen.", diff="medium")
mc("kurzgeschichte", "Welches Merkmal ist typisch für eine Kurzgeschichte?", ["Unvermittelter Einstieg und offenes Ende", "Eine ausführliche Vorgeschichte über mehrere Generationen", "Viele Figuren und Handlungsorte über Jahre hinweg", "Eine ausdrücklich formulierte Lehre am Ende"], 0,
   "Kurzgeschichten beginnen mitten im Geschehen und enden offen. Lange Vorgeschichten und viele Schauplätze passen eher zum Roman, eine formulierte Lehre zur Fabel.")
mc("indirekte-charakterisierung", "Was bedeutet „indirekte Charakterisierung“?", ["Eigenschaften einer Figur werden aus ihrem Verhalten, Sprechen oder Denken erschlossen", "Der Erzähler nennt die Eigenschaften einer Figur ausdrücklich", "Eine Figur wird nur in einem Nebensatz erwähnt", "Die Figur stellt sich selbst mit Namen vor"], 0,
   "Indirekt heißt: Die Eigenschaft steht nicht im Text, man erschließt sie. Beispiel: Die Frau summt beim Warten (Z. 7) → sie wirkt gelassen. Wird die Eigenschaft ausdrücklich genannt, ist die Charakterisierung direkt.", diff="medium")

tf("autor-erzaehler", "Der Erzähler einer Geschichte ist immer der Autor.", False,
   "Falsch. Der Erzähler ist eine vom Autor geschaffene Stimme im Text. Auch ein Ich-Erzähler ist nicht automatisch der Autor – deshalb schreibst du „der Erzähler“, nicht „der Autor erzählt“.", exam=True)
tf("stilmittel-nennen", "In einer Textanalyse reicht es, die Stilmittel richtig zu benennen.", False,
   "Falsch. Entscheidend ist die Wirkung und die Funktion für die Aussage des Textes. „Hier ist ein Vergleich“ ohne Erklärung bringt kaum Punkte.")
tf("auktorial", "Ein auktorialer Erzähler kann das Geschehen kommentieren und weiß mehr als die Figuren.", True,
   "Wahr. Das ist typisch für auktoriales Erzählverhalten, z. B. durch Vorausdeutungen oder Einblicke in mehrere Figuren.", diff="medium", exam=True)
tf("indirektes-zitat", "Indirekte Zitate stehen ohne Anführungszeichen und werden mit „vgl.“ und Zeilenangabe belegt.", True,
   "Wahr. Bei einer sinngemäßen Wiedergabe (Paraphrase) fallen die Anführungszeichen weg, der Beleg „(vgl. Z. …)“ bleibt. Wiedergegebene Aussagen stehen im Konjunktiv I.")
tf("schluss-neue-belege", "Im Schluss führst du neue Textbelege ein, die im Hauptteil noch nicht vorkamen.", False,
   "Falsch. Der Schluss bündelt die Ergebnisse, überprüft die Deutungshypothese und enthält höchstens eine Stellungnahme – neue Belege gehören in den Hauptteil.", diff="medium")
tf("hypothese", "Die Deutungshypothese ist eine vorläufige Annahme, die im Hauptteil überprüft wird.", True,
   "Wahr. Sie gibt der Analyse eine Richtung. Im Schluss sagst du, ob sie sich bestätigt, ergänzt oder als falsch erwiesen hat.", exam=True)

op("hypothese-formulieren", "Formuliere eine eigene Deutungshypothese zur Kurzgeschichte „Grüne Ampel“ (1–2 Sätze).",
   "Zum Beispiel: Die Kurzgeschichte zeigt, dass man Ängsten nicht ausweichen kann, sondern ihnen mutig entgegengehen muss – und dass dabei schon die Ermutigung eines fremden Menschen helfen kann.",
   "Eine gute Hypothese nennt die mögliche Aussage des ganzen Textes (nicht nur den Inhalt) und lässt sich am Text überprüfen: Jonas’ Angst (Z. 8–14), die ermutigende Frau (Z. 11 f., 17 f.) und seine Erleichterung am Ende (Z. 19–22) stützen sie. Andere Hypothesen sind richtig, wenn sie ebenso begründbar sind.",
   exam=True, hints=["Was verändert sich bei Jonas vom Anfang bis zum Ende?", "Welche Rolle spielt die alte Frau?"])
op("zeit", "Erkläre den Unterschied zwischen Erzählzeit und erzählter Zeit am Beispiel von „Grüne Ampel“.",
   "Die erzählte Zeit umfasst nur wenige Minuten – vom Warten an der Ampel bis zur Busfahrt. Die Erzählzeit, also die Lesedauer, beträgt etwa eine Minute. Der Text erzählt daher annähernd zeitdeckend; nur am Ende wird gerafft („Draußen zog die Stadt vorbei“, Z. 21), und in Z. 3–5 wird kurz zurückgeblendet.",
   "Erzählzeit = Zeit zum Lesen, erzählte Zeit = Zeitraum der Handlung. Die kurze erzählte Zeit ist typisch für Kurzgeschichten; die Rückblende liefert die nötige Vorgeschichte, ohne den unvermittelten Einstieg aufzugeben.")
op("blei-dreischritt", "Analysiere den Vergleich „seine Beine fühlten sich an wie aus Blei“ (Z. 14) im Dreischritt (Behauptung – Beleg – Deutung).",
   "Behauptung: Jonas ist vor Angst wie gelähmt. Beleg: „seine Beine fühlten sich an wie aus Blei“ (Z. 14). Deutung: Blei ist schwer und unbeweglich; der Vergleich macht anschaulich, dass die Angst vor der Reaktion seines Vaters ihn regelrecht festhält – obwohl er den Bus noch erreichen könnte (vgl. Z. 13).",
   "Volle Punktzahl gibt es nur mit allen drei Schritten. Die Deutung muss über „das ist ein Vergleich“ hinausgehen und erklären, was das Bild über Jonas’ Zustand aussagt und wie es zur Aussage des Textes passt.",
   diff="medium", exam=True)
op("frau-charakterisieren", "Charakterisiere die alte Frau. Nutze mindestens zwei Textbelege.",
   "Die alte Frau wirkt gelassen und zuversichtlich: Sie „summte leise vor sich hin“ (Z. 7) und geht „langsam, Schritt für Schritt“ (Z. 15), obwohl der Bus wartet. Sie ist erfahren („Ich kenne ihn seit Jahren“, Z. 12) und freundlich zugewandt, denn sie ermutigt Jonas ungefragt (vgl. Z. 11) und lächelt ihm zu (Z. 17). Als Kontrastfigur zu dem angespannten Jonas verkörpert sie die Haltung, die er am Ende übernimmt.",
   "Eine Charakterisierung nennt Eigenschaften und belegt jede mit dem Text. Die Frau wird indirekt charakterisiert – durch Verhalten und Rede. Ihre Funktion als Kontrastfigur zu benennen, zeigt, dass du die Figurenkonstellation verstanden hast.",
   diff="hard")
op("farbsymbolik", "Erkläre die Bedeutung der Farben Rot und Grün in „Grüne Ampel“.",
   "Rot steht für Stillstand, Fehler und Angst: die rote Ampel (Z. 1, 8), der rote Korrekturstift und das befürchtete rote Gesicht des Vaters (Z. 8 f.). Grün steht für Hoffnung und Aufbruch: die Lauchstange „wie eine grüne Fahne“ (Z. 7) und die grüne Ampel, bei der Jonas losgeht (Z. 15). Der Wechsel von Rot zu Grün spiegelt Jonas’ innere Entwicklung von der Lähmung zum Mut.",
   "Farben werden hier zu Symbolen: Ein konkretes Detail steht für etwas Abstraktes. Der Titel „Grüne Ampel“ betont, dass der Aufbruch das Ziel der Geschichte ist.", diff="hard")
op("indirekt-umformen", "Wandle in ein indirektes Zitat um: Die Frau sagt: „Der Fahrer wartet immer, bis die Ampel umspringt.“ (Z. 12)",
   "Die Frau sagt, der Fahrer warte immer, bis die Ampel umspringe (vgl. Z. 12).",
   "Indirekte Rede steht im Konjunktiv I (wartet → warte, umspringt → umspringe), ohne Anführungszeichen und mit „vgl.“ vor der Zeilenangabe.",
   diff="medium", keywords=[["warte"], ["umspringe"], ["vgl"]])

flashcards = [
 ("Wofür steht TATTE?", "Titel, Autor/in, Textsorte, Thema, Erscheinungsjahr – die Angaben der Einleitung."),
 ("Was ist eine Deutungshypothese?", "Eine begründete, vorläufige Annahme über die Aussage des Textes; sie wird im Hauptteil überprüft."),
 ("Tempus der Textanalyse?", "Präsens (Vorzeitiges im Perfekt)."),
 ("Was ist der Dreischritt?", "Behauptung → Beleg (Zitat mit Zeilenangabe) → Deutung (Wirkung/Bedeutung)."),
 ("Personales Erzählverhalten – Kennzeichen?", "Erzählt aus der Sicht einer Figur, mit Innensicht (Gedanken, Gefühle), ohne Kommentar des Erzählers."),
 ("Auktoriales Erzählverhalten – Kennzeichen?", "Erzähler weiß mehr als die Figuren, kommentiert, deutet voraus, kennt mehrere Innenwelten."),
 ("Neutrales Erzählverhalten – Kennzeichen?", "Nur Außensicht wie eine Kamera: Handlungen und Dialoge, keine Gedanken."),
 ("Erlebte Rede vs. innerer Monolog", "Erlebte Rede: 3. Person, Präteritum. Innerer Monolog: 1. Person, Präsens."),
 ("Direkte vs. indirekte Charakterisierung", "Direkt: Eigenschaft wird genannt. Indirekt: Eigenschaft wird aus Verhalten, Rede, Denken erschlossen."),
 ("Merkmale einer Kurzgeschichte", "Unvermittelter Einstieg, Alltagssituation, wenige Figuren, kurze erzählte Zeit, Wendepunkt, offenes Ende."),
 ("Ellipse – Wirkung?", "Unvollständiger Satz; wirkt wie ein Gedankenfetzen, erzeugt Tempo oder Anspannung."),
 ("Vergleich vs. Metapher", "Vergleich mit „wie/als ob“ („wie aus Blei“), Metapher ohne Vergleichswort („ein Herz aus Stein“)."),
 ("Wie zitiert man über zwei Zeilen?", "Mit „f.“: (Z. 17 f.); über mehrere Zeilen „ff.“ oder genau (Z. 15–18)."),
 ("Wie kennzeichnet man Auslassungen im Zitat?", "Mit eckigen Klammern und drei Punkten: […]"),
 ("Was gehört in den Schluss?", "Ergebnisse bündeln, Deutungshypothese überprüfen, ggf. begründete Stellungnahme – keine neuen Belege."),
]

exercises = [
 {"id": "u-erzaehlform", "level": "easy", "prompt": "Bestimme die Erzählform: „Ich packte meine Tasche und lief hinaus in den Regen.“",
  "solution": "Ich-Erzähler (Erzählform: Ich-Form).", "explanation": "Die Figur erzählt selbst in der 1. Person („Ich packte“). Man erfährt nur, was diese Figur wahrnimmt, denkt und fühlt."},
 {"id": "u-ellipsen", "level": "easy", "prompt": "Finde in den Zeilen 1–5 von „Grüne Ampel“ zwei Ellipsen und zitiere sie mit Zeilenangabe.",
  "solution": "Zum Beispiel: „Natürlich.“ (Z. 2) und „Unterschreiben lassen bis Freitag.“ (Z. 5); auch „Eine Vier minus in Mathe.“ (Z. 4) ist richtig.",
  "explanation": "In allen drei Sätzen fehlen Satzteile (z. B. Subjekt oder Prädikat). Sie wirken wie Jonas’ abgehackte, besorgte Gedanken."},
 {"id": "u-einleitung", "level": "easy", "prompt": "Schreibe eine Einleitung zu „Grüne Ampel“ (Originaltext für Übungszwecke, 2026) nach dem TATTE-Schema mit Deutungshypothese.",
  "solution": "In der Kurzgeschichte „Grüne Ampel“, einem Übungstext aus dem Jahr 2026, geht es um einen Jugendlichen, der mit einer schlechten Mathenote nach Hause fährt und an einer Ampel einer alten Frau begegnet. Vermutlich zeigt der Text, dass man seinen Ängsten mutig begegnen sollte.",
  "explanation": "Alle fünf Angaben (Titel, Autor/Quelle, Textsorte, Thema, Jahr) sind enthalten; die Hypothese ist als Vermutung formuliert und lässt sich am Text überprüfen."},
 {"id": "u-vater-beleg", "level": "medium", "prompt": "Belege mit einem Zitat, dass Jonas Angst vor der Reaktion seines Vaters hat, und erkläre den Beleg.",
  "solution": "„Rot wie das Gesicht seines Vaters, wenn er die Note sähe“ (Z. 9). Jonas stellt sich das wütende, rote Gesicht seines Vaters vor; der Konjunktiv „sähe“ zeigt, dass es sich um eine Befürchtung handelt.",
  "explanation": "Ein Beleg braucht das wörtliche Zitat mit Zeilenangabe und eine Erklärung, was es zeigt. Der Konjunktiv ist hier ein wichtiges sprachliches Signal."},
 {"id": "u-auktorial", "level": "medium", "prompt": "Bestimme das Erzählverhalten und begründe: „Niemand im Dorf ahnte, dass der alte Bäcker an diesem Abend zum letzten Mal seine Tür abschließen würde.“",
  "solution": "Auktoriales Erzählverhalten.", "explanation": "Der Erzähler weiß mehr als alle Figuren („Niemand … ahnte“) und deutet ein späteres Ereignis voraus („zum letzten Mal“). Beides ist typisch auktorial."},
 {"id": "u-anapher", "level": "medium", "prompt": "Analysiere die Wiederholung von „Rot“ in den Zeilen 8–9: Nenne das Stilmittel und seine Wirkung.",
  "solution": "Anapher: Zwei Sätze beginnen mit „Rot“ („Rot, dachte er, wie der Stift … Rot wie das Gesicht seines Vaters“, Z. 8 f.). Sie zeigt, wie Jonas’ Gedanken von der roten Ampel zum Korrekturstift und zum wütenden Vater springen und immer wieder um die Note kreisen.",
  "explanation": "Die Anapher verstärkt die Eindringlichkeit; zusammen mit den Vergleichen macht sie Jonas’ Gedankenkreisen und seine wachsende Angst sichtbar."},
 {"id": "u-wendepunkt", "level": "hard", "prompt": "Schreibe einen Analyseabsatz (Dreischritt) zum Wendepunkt der Geschichte (Z. 15–18).",
  "solution": "Den Wendepunkt bildet der Moment, in dem die Ampel grün wird und die Frau losgeht (vgl. Z. 15 f.). Jonas, der zuvor wie gelähmt war, „folgte ihr“ (Z. 16) und erreicht den Bus doch noch. Die Worte der Frau „Manchmal wartet die Welt auf einen. Man muss nur losgehen“ (Z. 17 f.) – eine Personifikation – fassen die Erfahrung zusammen: Wer den ersten Schritt wagt, findet die Lage weniger aussichtslos als befürchtet. Damit beginnt Jonas’ innere Veränderung, die sich am Ende in seinem tiefen Durchatmen zeigt (vgl. Z. 22).",
  "explanation": "Ein guter Absatz benennt die Stelle (Behauptung), belegt sie mit Zitaten (Beleg) und erklärt ihre Bedeutung für die ganze Geschichte (Deutung). Der Bezug zum Ende zeigt, dass du Zusammenhänge erkennst."},
 {"id": "u-schluss", "level": "hard", "prompt": "Schreibe einen Schluss zur Analyse von „Grüne Ampel“, der die Deutungshypothese überprüft.",
  "solution": "Insgesamt bestätigt die Analyse die Vermutung, dass der Text zeigt, wie man Ängsten mutig begegnen kann. Die personale Erzählweise lässt die Leser Jonas’ Lähmung miterleben, die gelassene Frau wirkt als Kontrastfigur, und die Farbsymbolik von Rot und Grün spiegelt seinen Weg vom Stillstand zum Aufbruch. Die Geschichte macht Mut, auch kleine Schritte zu wagen – eine Erfahrung, die viele aus dem eigenen Schulalltag kennen.",
  "explanation": "Der Schluss bündelt die wichtigsten Ergebnisse, nimmt die Hypothese ausdrücklich auf und endet mit einer knappen Stellungnahme – ohne neue Zitate."},
 {"id": "u-zettel", "level": "hard", "prompt": "Untersuche, wie sich Jonas’ Umgang mit dem Zettel verändert (Z. 3–4 und Z. 19–22), und deute die Veränderung.",
  "solution": "Zu Beginn trägt Jonas den Zettel versteckt in der Jackentasche, „zweimal gefaltet“ (Z. 3), die Ecken „schon weich vom vielen Anfassen“ (Z. 4) – er ist unruhig und will die Note nicht ansehen. Am Ende faltet er ihn auseinander, „strich ihn auf dem Knie glatt“ (Z. 20) und sieht die Note „lange“ an (Z. 22). Der Zettel wird zum Symbol für sein Problem: Aus Verdrängen wird Annehmen. Das stützt die Deutung, dass Jonas den Mut gefunden hat, sich der Situation zu stellen.",
  "explanation": "Hier vergleichst du zwei Textstellen, belegst beide und deutest den Unterschied. Einen Gegenstand als Symbol einer inneren Entwicklung zu erkennen, ist eine anspruchsvolle Interpretationsleistung."},
]

mistakes = [
 ("Nacherzählen statt analysieren", "Die Handlung zu erzählen fühlt sich sicher an – sagt aber nichts über die Gestaltung.", "Inhalt nur knapp (3–6 Sätze) zusammenfassen, dann immer fragen: Wie ist es gemacht, wie wirkt es?"),
 ("Stilmittel nur benennen", "„In Z. 14 ist ein Vergleich“ ist nur der erste Schritt.", "Immer Wirkung und Funktion ergänzen: Was zeigt das Bild über die Figur oder die Aussage?"),
 ("Autor und Erzähler verwechseln", "Besonders beim Ich-Erzähler liegt das nahe.", "Schreibe „der Erzähler“ oder „die Ich-Erzählerin“ – der Autor hat den Text nur geschrieben."),
 ("Falsches Tempus", "Man übernimmt das Präteritum der Geschichte.", "Analyse im Präsens: „Jonas wartet an der Ampel.“"),
 ("Behauptungen ohne Beleg", "Die Deutung erscheint einem selbstverständlich.", "Jede Aussage über den Text mit Zitat oder „vgl.“ und Zeilenangabe belegen."),
 ("Zitate ohne Zeilenangabe oder unverbunden", "Zitate werden einfach hingestellt.", "Zitat in den eigenen Satz einbauen und Zeile angeben: Dass Jonas wie gelähmt ist, zeigt „wie aus Blei“ (Z. 14)."),
 ("Zu lange Zitate", "Man will nichts weglassen.", "Nur die entscheidenden Wörter zitieren, Auslassungen mit […] kennzeichnen."),
 ("Deutungshypothese fehlt oder wird vergessen", "Die Einleitung endet nach den TATTE-Angaben.", "Hypothese in der Einleitung formulieren und im Schluss ausdrücklich überprüfen."),
 ("Eigene Meinung im Hauptteil", "Bewertungen wie „langweilig“ rutschen in die Analyse.", "Im Hauptteil sachlich analysieren; eine begründete Stellungnahme gehört höchstens in den Schluss."),
]

summary = """**Lernzettel Textanalyse (Klasse 9)**

- **Ziel:** zeigen, *wie* ein Text gestaltet ist und *was* er damit aussagt – nicht nacherzählen.
- **Einleitung:** TATTE (Titel, Autor/in, Textsorte, Thema, Erscheinungsjahr) + **Deutungshypothese**.
- **Hauptteil:** kurze Inhaltszusammenfassung → Aufbau → Erzähler → Figuren → Sprache/Stilmittel. Jeder Punkt im **Dreischritt: Behauptung – Beleg – Deutung**.
- **Schluss:** Ergebnisse bündeln, Hypothese überprüfen, ggf. Stellungnahme – keine neuen Belege.
- **Kurzgeschichte:** unvermittelter Einstieg, Alltag, wenige Figuren, kurze erzählte Zeit, Wendepunkt, offenes Ende.
- **Erzähler ≠ Autor.** Erzählform: Ich / Er-Sie. Erzählverhalten: auktorial (Überblick, Kommentar), personal (Innensicht einer Figur), neutral (nur Außensicht).
- **Gedanken:** erlebte Rede (3. Person, Präteritum), innerer Monolog (1. Person, Präsens).
- **Figuren:** direkte vs. indirekte Charakterisierung, Konstellation, Entwicklung.
- **Stilmittel immer mit Wirkung:** Vergleich, Metapher, Personifikation, Ellipse, Anapher, Symbol, Antithese …
- **Zitieren:** direkt „wie aus Blei“ (Z. 14) · über zwei Zeilen (Z. 17 f.) · Bereich (Z. 15–18) · Auslassung […] · indirekt mit (vgl. Z. 12), Konjunktiv I.
- **Sprache der Analyse:** Präsens, sachlich, Fachbegriffe."""

pkg = {
  "$schema": "../../docs/lernpakete/lernpaket.schema.json",
  "format": "studyos-learning-package",
  "version": 1,
  "id": "deutsch-textanalyse-klasse-9",
  "title": "Textanalyse – Klasse 9",
  "subject": "Deutsch",
  "topic": "Textanalyse",
  "level": "Klasse 9",
  "grade": 9,
  "language": "de",
  "description": "Erzähltexte und Kurzgeschichten analysieren: Aufbau einer Textanalyse, Erzähler, Figuren, Sprache und Stilmittel mit Wirkung, Textbelege – mit einem vollständig ausgearbeiteten Beispiel zum Originaltext „Grüne Ampel“.",
  "author": "Study OS (Beispielpaket)",
  "createdAt": "2026-10-25",
  "sources": ["Alle Texte und Beispiele, auch die Kurzgeschichte „Grüne Ampel“, wurden eigens für Study OS verfasst."],
  "objectives": [
    "eine Textanalyse sinnvoll in Einleitung, Hauptteil und Schluss gliedern",
    "eine begründete Deutungshypothese formulieren und überprüfen",
    "Merkmale einer Kurzgeschichte am Text nachweisen",
    "Erzählform und Erzählverhalten bestimmen und ihre Wirkung erklären",
    "Figuren direkt und indirekt charakterisieren",
    "Stilmittel erkennen und ihre Wirkung und Funktion erläutern",
    "Deutungen korrekt mit direkten und indirekten Zitaten belegen",
  ],
  "notes": notes,
  "examples": examples,
  "keyTerms": [dict(term=t, definition=d, **({"example": e} if e else {})) for t, d, e in key_terms],
  "questions": Q,
  "flashcards": [{"front": f, "back": b} for f, b in flashcards],
  "exercises": exercises,
  "mistakes": [{"mistake": m, "why": w, "fix": f} for m, w, f in mistakes],
  "summary": summary,
  "exam": {"title": "Prüfung: Textanalyse (Klasse 9)", "timeLimitMinutes": 25},
}
out = pathlib.Path(__file__).resolve().parent.parent / "public" / "lernpakete" / "deutsch-textanalyse-klasse-9.json"
out.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(out, len(Q), "Fragen,", len(flashcards), "Karten,", len(exercises), "Übungen,", sum(1 for q in Q if q.get("exam")), "Prüfungsfragen")
