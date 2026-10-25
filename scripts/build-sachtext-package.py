#!/usr/bin/env python3
"""Builds the learning package public/lernpakete/deutsch-sachtextanalyse-klasse-9.json.
The commentary "Zwanzig Minuten ohne Bildschirm" is an original text written for Study OS
(author and school newspaper are fictional). Every quotation is looked up in the text, so the
line numbers cannot be wrong."""
import json, pathlib

TEXT = [
    "Seit diesem Schuljahr gilt an vielen Schulen: Das Handy bleibt in der Pause in der Tasche.",
    "Was manche Eltern als längst überfällig feiern, empfinden viele Jugendliche als Bevormundung.",
    "Doch wer genauer hinsieht, erkennt: Das Verbot ist weniger Strafe als Chance.",
    "Zunächst geht es um Konzentration. Eine Pause soll den Kopf frei machen,",
    "nicht mit neuen Reizen füllen. Wer zwanzig Minuten lang Kurzvideos schaut,",
    "sitzt danach zwar am Platz, ist aber gedanklich noch im Feed.",
    "Lehrkräfte berichten, dass Klassen nach handyfreien Pausen ruhiger in den Unterricht starten.",
    "Hinzu kommt das Miteinander. Auf manchen Schulhöfen standen früher Dutzende Jugendliche",
    "nebeneinander – und jede und jeder schaute auf einen eigenen kleinen Bildschirm.",
    "Gespräche, Spiele, auch Streit und Versöhnung fanden kaum noch statt.",
    "Eine Schulleiterin sagt dazu: „Seit es das Verbot gibt, ist es auf dem Hof",
    "wieder laut – und das ist gut so.“",
    "Natürlich lässt sich einwenden, dass Jugendliche lernen müssen, selbst mit dem Handy umzugehen.",
    "Ein Verbot, so die Kritik, nehme ihnen genau diese Übung weg.",
    "Das stimmt – aber nur halb. Wer Fahrradfahren lernt, übt auch nicht zuerst auf der Autobahn.",
    "Medienkompetenz entsteht im Unterricht, wo über Algorithmen, Werbung und Datenschutz",
    "gesprochen wird, nicht in einer Pause, in der jeder allein vor sich hin wischt.",
    "Ein weiterer Einwand wiegt schwerer: Was ist im Notfall?",
    "Doch auch hier gibt es einfache Lösungen. Das Sekretariat ist jederzeit erreichbar,",
    "und wer dringend telefonieren muss, darf das mit Erlaubnis tun.",
    "Niemand ist ohne Handy plötzlich von der Welt abgeschnitten.",
    "Entscheidend ist allerdings, wie ein solches Verbot eingeführt wird.",
    "Wird es einfach von oben verordnet, wirkt es wie ein Misstrauensvotum gegen die Jugend.",
    "Wird es dagegen gemeinsam mit der Schülervertretung entwickelt, kann es zu einer Regel",
    "werden, die alle mittragen.",
    "Die Pause gehört den Schülerinnen und Schülern. Gerade deshalb sollte sie nicht dem Bildschirm gehören.",
    "Wer das Handy für zwanzig Minuten weglegt, verliert wenig – und gewinnt vielleicht ein Gespräch.",
]
TITLE, AUTHOR, SOURCE = "Zwanzig Minuten ohne Bildschirm", "Lena Brandt", "Schülerzeitung „Pausenhof“, 2026"


def L(phrase: str) -> int:
    """Line number of a phrase; fails the build if the phrase is not in the text exactly once."""
    hits = [i for i, line in enumerate(TEXT, 1) if phrase in line]
    assert len(hits) == 1, f"Zitat nicht eindeutig im Text: {phrase!r} -> {hits}"
    return hits[0]


def Z(phrase: str) -> str:
    """Quotation with line reference, e.g. „weniger Strafe als Chance“ (Z. 3)."""
    return f"„{phrase}“ (Z. {L(phrase)})"


TEXT_MD = (f"**„{TITLE}“** – Kommentar von {AUTHOR}, {SOURCE}\n"
           "*Originaltext für Übungszwecke (Study OS). Autorin und Zeitung sind erfunden.*\n\n"
           + "\n".join(f"`{i:>2}`  {line}" for i, line in enumerate(TEXT, 1)))

notes = [
 {"id": "sachtexte", "title": "Sachtexte und ihre Funktion", "content": """Ein **Sachtext** (auch *pragmatischer* oder *nicht-literarischer Text*) bezieht sich auf die **wirkliche Welt**: auf Ereignisse, Probleme, Fakten und Meinungen. Ein literarischer Text dagegen erschafft eine erfundene Welt (Figuren, Erzähler, Handlung).

**Die vier Textfunktionen** – jeder Sachtext hat mindestens eine *Hauptfunktion*:

| Funktion | Absicht | typische Textsorten |
|---|---|---|
| **informieren** | sachlich über Fakten berichten | Nachricht, Bericht, Lexikonartikel |
| **argumentieren / überzeugen** | eine Meinung begründen | Kommentar, Leserbrief, Rede, Essay |
| **appellieren** | zu einer Handlung auffordern | Werbung, Aufruf, Rede |
| **instruieren** | eine Anleitung geben | Gebrauchsanweisung, Rezept |

**Wichtige Textsorten erkennen**

| Textsorte | Merkmale |
|---|---|
| **Nachricht** | kurz, sachlich, das Wichtigste zuerst (W-Fragen), keine Meinung |
| **Bericht** | ausführlicher als die Nachricht, weiterhin sachlich, Hintergründe |
| **Reportage** | anschaulich, Präsens, Eindrücke vor Ort, mit Personen und Szenen |
| **Kommentar** | Meinung der Verfasserin/des Verfassers, These + Argumente, oft zugespitzter Schluss |
| **Glosse** | kurzer, ironisch-spöttischer Meinungstext |
| **Interview** | Fragen und Antworten, wörtliche Rede |

**Merke:** Bei Sachtexten sprichst du von der **Verfasserin / dem Verfasser** (oder Autor/in) – *nicht* von einem Erzähler. Die Person meint, was sie schreibt (außer bei Ironie)."""},

 {"id": "erschliessen", "title": "Den Text erschließen – mit Übungstext", "content": f"""Bevor du schreibst, musst du den Text **verstehen und ordnen**. Das spart in der Klassenarbeit Zeit, weil du beim Schreiben nicht mehr suchen musst.

**Fünf Schritte**
1. **Überfliegen:** Titel, Quelle, Textsorte. Worum geht es ungefähr?
2. **Genau lesen und markieren:** These (eine Farbe), Argumente (zweite Farbe), Einwände/Gegenargumente (dritte Farbe). Auffällige Sprache am Rand notieren.
3. **Sinnabschnitte bilden:** Wo beginnt ein neuer Gedanke? Signalwörter helfen: *zunächst, hinzu kommt, natürlich … aber, doch, entscheidend ist, gerade deshalb*.
4. **Randnotizen in Stichworten:** z. B. „Z. 4–7: Arg. 1 Konzentration + Beleg Lehrkräfte“.
5. **Kernaussage in einem Satz:** *Die Verfasserin meint, dass …, weil …*

---

### Übungstext (wird in allen Beispielen, Fragen und Übungen verwendet)

{TEXT_MD}

---

**Sinnabschnitte dieses Textes**

| Zeilen | Funktion | Inhalt |
|---|---|---|
| 1–3 | Einleitung + These | Handyverbot in Pausen; Streit darüber; These: „Chance“ statt Strafe |
| 4–7 | Argument 1 | Konzentration – Beleg: Beobachtung von Lehrkräften |
| 8–12 | Argument 2 | Miteinander – Beleg: Beispiel Schulhof + Zitat einer Schulleiterin |
| 13–17 | Einwand 1 + Widerlegung | „selbst lernen“ – Gegenvergleich Fahrrad/Autobahn; Medienkompetenz im Unterricht |
| 18–21 | Einwand 2 + Widerlegung | Notfall – Sekretariat, Telefonieren mit Erlaubnis |
| 22–25 | Einschränkung | Verbot nur sinnvoll, wenn gemeinsam mit der Schülervertretung entwickelt |
| 26–27 | Schluss | Zuspitzung: Pause gehört den Jugendlichen, nicht dem Bildschirm |"""},

 {"id": "aufbau", "title": "Aufbau einer Sachtextanalyse", "content": """Eine Sachtextanalyse hat drei Teile. Der Hauptteil ist der längste (etwa drei Viertel des Textes).

### 1. Einleitung
TATTE-Angaben + **Kernaussage / These** des Textes, eventuell deine **Deutungs-** bzw. **Arbeitshypothese** zur Wirkung (→ eigene Notiz).

### 2. Hauptteil
1. **Inhalt und Gedankengang** – Abschnitt für Abschnitt, mit Funktion (*führt an, räumt ein, widerlegt*).
2. **Argumentation** – These, Argumente, Belege, Argumenttypen, Umgang mit Gegenargumenten, Aufbau (z. B. steigernd).
3. **Sprache** – Wortwahl, Satzbau, rhetorische Mittel, jeweils mit **Wirkung** und **Funktion** für die Absicht.
4. **Absicht und Wirkung** zusammenführen: Wie versucht der Text, die Leser zu überzeugen?

> Du darfst 2. und 3. auch **verbinden** (Abschnitt für Abschnitt Argumentation *und* Sprache). Das ist anspruchsvoller, wirkt aber oft flüssiger.

### 3. Schluss
Ergebnis bündeln, Hypothese überprüfen, eventuell **begründete Stellungnahme** (nur wenn die Aufgabe danach fragt!).

**Grundregeln für alle Teile:** Präsens · sachlicher Stil · eigene Worte · jede Aussage am Text belegen · Verfasser/in statt „Erzähler“."""},

 {"id": "einleitung", "title": "Die Einleitung", "content": """Die Einleitung ist kurz (2–4 Sätze), aber sie entscheidet über den ersten Eindruck.

**Was hinein gehört (TATTE + Kernaussage)**
- **T**itel – in Anführungszeichen
- **A**utor/in
- **T**extsorte – möglichst genau (*Kommentar*, nicht nur „Text“)
- **T**hema – das allgemeine Problem, nicht der ganze Inhalt
- **E**rscheinungsjahr und Quelle (Zeitung, Website …)
- **Kernaussage / These** der Verfasserin
- optional: **Hypothese zur Wirkung** (*Der Text versucht, vor allem Jugendliche zu überzeugen, indem …*)

**Formulierungshilfen**
> In dem Kommentar „…“ von …, erschienen … in …, setzt sich die Verfasserin mit der Frage auseinander, ob … . Sie vertritt die These, dass … .

> Der Kommentar „…“ von … (…) behandelt das Thema … . Die Autorin kommt zu dem Ergebnis, dass … .

**Was *nicht* hinein gehört**
- Nacherzählung von Einzelheiten
- Stilmittel oder Zitate (gehören in den Hauptteil)
- deine eigene Meinung („Ich finde das Verbot gut.“)
- ein Einstieg wie in einem Aufsatz („Handys sind heute überall.“) – höchstens ein kurzer, sachlicher Satz, wenn die Lehrkraft das wünscht."""},

 {"id": "gedankengang", "title": "Inhalt und Gedankengang wiedergeben", "content": """Im ersten Teil des Hauptteils beschreibst du, **was** die Verfasserin in welcher **Reihenfolge** schreibt – und **welche Funktion** jeder Abschnitt hat. Das ist mehr als eine Inhaltsangabe: Du zeigst, wie der Text *gebaut* ist.

**Schlechte Wiedergabe (nur Inhalt):**
> Zuerst geht es um Konzentration. Dann geht es um den Schulhof. Dann geht es um den Notfall.

**Gute Wiedergabe (Inhalt + Funktion):**
> Zunächst **begründet** die Verfasserin ihre These mit der Konzentration der Schülerinnen und Schüler (Z. 4–7). Anschließend **führt** sie als zweites Argument das soziale Miteinander **an** (Z. 8–12). Danach **greift** sie zwei mögliche Einwände **auf** und **entkräftet** sie (Z. 13–21), bevor sie ihre Position **einschränkt** (Z. 22–25).

**Verben für den Gedankengang** (statt „sagt“ und „geht es um“)

| Funktion | Verben |
|---|---|
| These | behauptet, vertritt die Auffassung, stellt die These auf |
| Argument | begründet, führt an, stützt, untermauert |
| Beispiel / Beleg | veranschaulicht, belegt, verweist auf, zitiert |
| Gegenargument | räumt ein, gesteht zu, greift einen Einwand auf |
| Widerlegung | entkräftet, widerlegt, weist zurück, relativiert |
| Einschränkung | schränkt ein, differenziert, gibt zu bedenken |
| Schluss | fasst zusammen, spitzt zu, appelliert, fordert |

**Indirekte Rede:** Wenn du wiedergibst, was im Text *jemand anderes* sagt, nutze den **Konjunktiv I**: *Kritiker meinen, ein Verbot **nehme** Jugendlichen die Übung weg.*"""},

 {"id": "argumentation", "title": "Argumentation analysieren", "content": f"""**Die Bausteine einer Argumentation**

| Baustein | Frage | Beispiel aus dem Text |
|---|---|---|
| **These** | Was behauptet die Verfasserin? | {Z("Das Verbot ist weniger Strafe als Chance.")} |
| **Argument** | Warum soll das stimmen? | Pausen sollen der Erholung dienen, Kurzvideos lenken weiter ab (Z. 4–6) |
| **Beleg / Beispiel** | Woran sieht man das? | {Z("Lehrkräfte berichten")} von ruhigeren Klassen |
| **Gegenargument (Einwand)** | Was spricht dagegen? | {Z("Was ist im Notfall?")} |
| **Widerlegung** | Warum gilt der Einwand nicht? | Sekretariat erreichbar, Telefonieren mit Erlaubnis (Z. 19–20) |

**Typische Argumentationsstrukturen**
- **steigernd (linear):** vom schwächsten zum stärksten Argument – das stärkste bleibt im Gedächtnis.
- **dialektisch:** erst Pro-, dann Contra-Argumente (oder umgekehrt), am Ende Abwägung.
- **Einwand-Widerlegung („Ja, aber …“):** ein Gegenargument wird vorweggenommen, teilweise zugestanden und dann entkräftet. So wirkt die Verfasserin **fair und überlegt** und nimmt Kritikern den Wind aus den Segeln.

Im Übungstext: zwei Pro-Argumente → zwei Einwände mit Widerlegung → **Einschränkung** (Z. 22–25) → zugespitzter Schluss. Die Einwände werden gesteigert: {Z("Ein weiterer Einwand wiegt schwerer")}.

**Konzession (Zugeständnis):** Signalwörter wie *natürlich, zwar, zugegeben, das stimmt* leiten ein Zugeständnis ein, *aber, doch, dennoch* die Widerlegung: {Z("Das stimmt – aber nur halb.")}

**Fragen, die du immer beantworten solltest**
1. Wo steht die These – am Anfang, versteckt oder erst am Schluss?
2. Welche Argumente werden genannt, in welcher Reihenfolge – und warum?
3. Wie werden sie gestützt? Sind die Belege überprüfbar oder nur behauptet?
4. Wie geht der Text mit Gegenpositionen um?
5. Ist die Argumentation **überzeugend**? (Lücken, Verallgemeinerungen, fehlende Quellen?)"""},

 {"id": "argumenttypen", "title": "Argumenttypen und Überzeugungsstrategien", "content": f"""Argumente lassen sich danach unterscheiden, **womit** sie überzeugen wollen.

| Argumenttyp | stützt sich auf … | Beispiel im Text | Wirkung |
|---|---|---|---|
| **Faktenargument** | überprüfbare Tatsachen, Zahlen, Studien | (kommt nicht vor – siehe unten) | objektiv, schwer zu bestreiten |
| **Erfahrungs-/Beobachtungsargument** | Erfahrungen von Menschen | {Z("Lehrkräfte berichten")} | anschaulich, aber nicht verallgemeinerbar |
| **Autoritätsargument** | Aussage einer Fachperson | Zitat der Schulleiterin (Z. 11–12) | glaubwürdig durch Amt/Erfahrung |
| **Analogieargument** | Vergleich mit einem ähnlichen Fall | {Z("Wer Fahrradfahren lernt, übt auch nicht zuerst auf der Autobahn.")} | einleuchtend, leicht vorstellbar |
| **normatives Argument** | Werte und Normen | {Z("Die Pause gehört den Schülerinnen und Schülern.")} | spricht Gerechtigkeitsgefühl an |
| **Plausibilitätsargument** | allgemeine Logik, „leuchtet ein“ | Pause soll Kopf frei machen, nicht füllen (Z. 4–5) | wirkt selbstverständlich |

**Kritischer Blick:** Der Text enthält **keine Zahlen und keine Studien**. Er überzeugt eher durch Beobachtungen, Vergleiche und Werte. Das darfst (und sollst) du in der Analyse benennen – sachlich: *Die Argumentation wirkt anschaulich, ist aber nicht durch Daten belegt.*

**Überzeugungsstrategien** (wie wird der Leser angesprochen?)
- **sachlich-rational:** Gründe, Belege, logischer Aufbau
- **emotional:** Bilder, die Gefühle wecken (der stille Schulhof, Z. 8–10)
- **Glaubwürdigkeit:** fairer Umgang mit Einwänden, eigene Einschränkung (Z. 22–25)
- **Leserbezug:** die Verfasserin nimmt die Sicht der Jugendlichen ernst (Z. 2, Z. 23–26) und gewinnt so gerade die Kritiker"""},

 {"id": "sprache", "title": "Sprache und Wirkung analysieren", "content": f"""Sprachliche Mittel analysierst du **nie als Liste**, sondern immer im Dreischritt:

> **Mittel benennen** + **Textbeleg** → **Wirkung** → **Funktion** für die Absicht des Textes

**1. Wortwahl**
- Wertende Wörter: {Z("Bevormundung")} (Sicht der Jugendlichen), {Z("Misstrauensvotum")}
- Fach- und Fremdwörter wirken kompetent: {Z("Algorithmen, Werbung und Datenschutz")}
- Umgangssprachliches/Anschauliches wirkt nah: {Z("allein vor sich hin wischt")}
- Inklusive Formen sprechen alle an: {Z("jede und jeder")}

**2. Satzbau**
- Kurze Sätze setzen Akzente: {Z("Das stimmt – aber nur halb.")}
- Gedankenstriche erzeugen eine Pause vor der Pointe: {Z("verliert wenig – und gewinnt vielleicht ein Gespräch")}
- Doppelpunkte kündigen das Wichtige an: {Z("erkennt: Das Verbot")}

**3. Rhetorische Mittel**

| Mittel | Beleg | Wirkung |
|---|---|---|
| **Antithese** (Gegensatz) | {Z("weniger Strafe als Chance")} | deutet das Verbot positiv um, prägt sich ein |
| **Metapher** | {Z("gedanklich noch im Feed")} | zeigt anschaulich, dass der Kopf nicht abschaltet |
| **Aufzählung** | {Z("Gespräche, Spiele, auch Streit und Versöhnung")} | zeigt, wie viel Gemeinschaft verloren geht |
| **Vergleich / Analogie** | {Z("übt auch nicht zuerst auf der Autobahn")} | macht den Einwand bildhaft unsinnig |
| **Frage** (Einwand als Frage) | {Z("Was ist im Notfall?")} | greift die Sorge der Leser direkt auf |
| **Parallelismus** | {Z("Wird es einfach von oben verordnet")} / {Z("Wird es dagegen gemeinsam")} (Z. 23–24) | stellt zwei Wege übersichtlich gegenüber |
| **Wiederholung / Wortspiel** | {Z("gehört den Schülerinnen")} – {Z("nicht dem Bildschirm gehören")} | pointierter, einprägsamer Schluss |

**Wirkungs-Wörter** (statt immer „Das wirkt spannend“): *veranschaulicht, betont, hebt hervor, spitzt zu, wertet ab/auf, emotionalisiert, schafft Nähe, wirkt glaubwürdig/kompetent/eindringlich, lenkt den Blick auf …*"""},

 {"id": "textbelege", "title": "Textbelege und Zitiertechnik", "content": f"""Jede Behauptung über den Text braucht einen **Beleg** – sonst ist sie nur eine Meinung.

**Drei Arten zu belegen**
1. **Wörtliches Zitat** – exakt, in Anführungszeichen, mit Zeile:
   Die Verfasserin bezeichnet das Verbot als {Z("weniger Strafe als Chance")}.
2. **Eingebautes Zitat** – grammatisch in den eigenen Satz eingefügt; Anpassungen in eckigen Klammern:
   Wer in der Pause Videos schaut, sei danach nur körperlich anwesend, aber {Z("gedanklich noch im Feed")}.
3. **Verweis (sinngemäß)** – eigene Worte + „vgl.“:
   Die Verfasserin verweist auf die Beobachtungen von Lehrkräften (vgl. Z. 7).

**Regeln**
- Zitate **wortgenau** übernehmen – auch Rechtschreibung und Satzzeichen.
- **Auslassungen** mit […]: „Medienkompetenz entsteht im Unterricht, wo über […] Datenschutz gesprochen wird“ (Z. 16 f.).
- Zeilen: *Z. 7* – eine Zeile; *Z. 16 f.* – diese und die folgende; *Z. 13–17* – Bereich.
- Ein Zitat **im Zitat** bekommt halbe Anführungszeichen: ‚…‘
- **Kein Zitat ohne Erklärung:** Nach dem Zitat folgt immer, was es zeigt.

**Der Beleg-Dreischritt (Behauptung – Beleg – Erläuterung)**
> Die Verfasserin nimmt Einwände ernst, gibt ihnen aber nur teilweise recht. **(Behauptung)** So schreibt sie: {Z("Das stimmt – aber nur halb.")} **(Beleg)** Durch das Zugeständnis wirkt sie fair; das „aber“ leitet sofort die Widerlegung ein, sodass ihre Position am Ende gestärkt ist. **(Erläuterung)**"""},

 {"id": "schluss", "title": "Der Schluss: Fazit und Stellungnahme", "content": """Der Schluss rundet die Analyse ab. Er bringt **nichts völlig Neues** aus dem Text, sondern bündelt.

**Bausteine**
1. **Ergebnis zusammenfassen:** Mit welchen Mitteln versucht der Text zu überzeugen?
2. **Hypothese überprüfen:** Hat sich deine Annahme aus der Einleitung bestätigt?
3. **Wirkung beurteilen:** Ist der Text überzeugend? Für wen? Wo sind Schwächen?
4. **Stellungnahme** (nur, wenn die Aufgabe sie verlangt): eigene Meinung zum *Thema*, **begründet** – mit mindestens einem eigenen Argument.

**Formulierungshilfen**
> Insgesamt zeigt sich, dass die Verfasserin ihre These vor allem durch … stützt.
> Besonders überzeugend wirkt …, weil … . Weniger überzeugend ist …, da … .
> Meine Hypothese, dass …, hat sich bestätigt / muss ergänzt werden: … .

**Beispiel**
> Insgesamt überzeugt der Kommentar weniger durch Fakten als durch anschauliche Beobachtungen, einen fairen Umgang mit Einwänden und eine pointierte Sprache. Gerade dass die Verfasserin ihre Forderung selbst einschränkt (Z. 22–25), macht sie für jugendliche Leser glaubwürdig. Eine Schwäche ist, dass keine überprüfbaren Zahlen genannt werden.

**Achtung:** „Analysiere“ heißt *nicht* „Nimm Stellung“. Wenn nur eine Analyse verlangt ist, bleibt deine Meinung zum Handyverbot draußen – du beurteilst nur, **wie gut** der Text argumentiert."""},
]

examples = [
 {"id": "einleitung-schreiben", "title": "Eine Einleitung schreiben",
  "task": f"Schreibe die Einleitung zur Analyse des Kommentars „{TITLE}“ (Übungstext in der Notiz „Den Text erschließen“).",
  "steps": [
   {"step": f"TATTE sammeln: Titel „{TITLE}“, Autorin {AUTHOR}, Textsorte Kommentar, erschienen 2026 in der Schülerzeitung „Pausenhof“.",
    "why": "Diese Angaben stehen über dem Text und gehören in jede Einleitung. Die Textsorte „Kommentar“ erkennt man daran, dass eine Meinung mit Argumenten begründet wird."},
   {"step": "Thema allgemein formulieren: das Handyverbot in Schulpausen.",
    "why": "Das Thema ist das Problem, über das der Text spricht – nicht schon die Meinung und nicht der ganze Inhalt."},
   {"step": f"These finden: {Z('Das Verbot ist weniger Strafe als Chance.')}",
    "why": "Die These steht hier nach einem kurzen Einstieg in Z. 3, eingeleitet durch „Doch wer genauer hinsieht, erkennt:“ – der Doppelpunkt kündigt die zentrale Aussage an."},
   {"step": "These in eigenen Worten wiedergeben: Das Handyverbot sei sinnvoll, weil es Konzentration und Gemeinschaft fördere – allerdings nur, wenn es gemeinsam mit den Schülern entwickelt werde.",
    "why": "In der Einleitung zitierst du nicht, sondern zeigst, dass du die Kernaussage verstanden hast. Die Einschränkung aus Z. 22–25 gehört zur Position dazu."},
   {"step": "Hypothese zur Wirkung formulieren: Der Text versucht, besonders skeptische Jugendliche zu überzeugen, indem er ihre Einwände aufgreift.",
    "why": "Eine Hypothese gibt der Analyse eine Richtung. Sie wird im Hauptteil überprüft – Hinweise sind Z. 2 („Bevormundung“) und die vorweggenommenen Einwände."}],
  "result": f"In dem Kommentar „{TITLE}“ von {AUTHOR}, erschienen 2026 in der Schülerzeitung „Pausenhof“, setzt sich die Verfasserin mit dem Handyverbot in Schulpausen auseinander. Sie vertritt die These, ein solches Verbot sei keine Strafe, sondern eine Chance für Konzentration und Gemeinschaft – vorausgesetzt, es werde gemeinsam mit den Schülerinnen und Schülern entwickelt. Vermutlich will der Text vor allem skeptische Jugendliche überzeugen, indem er ihre Einwände ernst nimmt und entkräftet."},

 {"id": "argumentation-abschnitt", "title": "Einwand und Widerlegung analysieren (Z. 13–17)",
  "task": "Analysiere, wie die Verfasserin in Z. 13–17 mit dem Einwand umgeht, Jugendliche müssten den Umgang mit dem Handy selbst lernen. Schreibe einen zusammenhängenden Absatz.",
  "steps": [
   {"step": f"Einwand erkennen: {Z('Natürlich lässt sich einwenden')} – Jugendliche müssten lernen, selbst mit dem Handy umzugehen.",
    "why": "„Natürlich“ und „einwenden“ sind Signalwörter für ein Zugeständnis: Die Verfasserin gibt eine Gegenposition wieder, die nicht ihre eigene ist."},
   {"step": f"Wiedergabe der Kritik im Konjunktiv bemerken: {Z('nehme ihnen genau diese Übung weg')}.",
    "why": "Der Konjunktiv I („nehme“) zeigt indirekte Rede – die Verfasserin distanziert sich damit von der Aussage, ohne sie schon zu bewerten."},
   {"step": f"Teilweises Zugeständnis: {Z('Das stimmt – aber nur halb.')}",
    "why": "Der kurze Satz gibt dem Einwand zunächst recht (fair, glaubwürdig). Der Gedankenstrich erzeugt eine Pause, das „aber“ leitet die Widerlegung ein."},
   {"step": f"Analogieargument bestimmen: {Z('Wer Fahrradfahren lernt, übt auch nicht zuerst auf der Autobahn.')}",
    "why": "Ein vertrauter Fall wird mit dem Problem verglichen: Wie beim Fahrradfahren lernt man auch Medienumgang besser in einem geschützten Rahmen. Der Vergleich ist bildhaft und leicht einleuchtend."},
   {"step": "Gegenvorschlag erkennen: Medienkompetenz entstehe im Unterricht, nicht in der Pause (Z. 16 f.).",
    "why": "Die Verfasserin widerlegt nicht nur, sie bietet eine Alternative an. Dadurch wirkt ihre Position konstruktiv statt nur verbietend."},
   {"step": f"Sprache am Ende deuten: {Z('allein vor sich hin wischt')}.",
    "why": "Das abwertende, umgangssprachliche Bild zeigt Handynutzung als gedankenlos und einsam – ein deutlicher Gegensatz zum Lernen „im Unterricht“."},
   {"step": "Funktion für den ganzen Text benennen.",
    "why": "Eine Analyse endet nicht beim Mittel, sondern erklärt, wozu es dient: Hier stärkt das Ja-aber-Muster die Glaubwürdigkeit und damit die These."}],
  "result": "Im dritten Abschnitt greift die Verfasserin einen naheliegenden Einwand auf: Jugendliche müssten den Umgang mit dem Handy selbst lernen (Z. 13). Die Kritik gibt sie im Konjunktiv wieder – ein Verbot „nehme ihnen genau diese Übung weg“ (Z. 14) – und distanziert sich so von ihr. Mit dem knappen Satz „Das stimmt – aber nur halb.“ (Z. 15) räumt sie dem Einwand zunächst teilweise recht ein, was sie fair und überlegt wirken lässt. Unmittelbar danach entkräftet sie ihn durch ein Analogieargument: Wer Fahrradfahren lerne, übe „auch nicht zuerst auf der Autobahn“ (Z. 15). Der alltägliche Vergleich macht anschaulich, dass man Medienkompetenz besser in einem geschützten Rahmen erwirbt. Diesen Rahmen benennt sie anschließend selbst: den Unterricht, in dem über „Algorithmen, Werbung und Datenschutz“ (Z. 16) gesprochen werde. Das abwertende Bild von Jugendlichen, die in der Pause „allein vor sich hin wisch[en]“ (Z. 17), unterstreicht den Gegensatz. Durch dieses Ja-aber-Muster nimmt die Verfasserin Kritikern den Wind aus den Segeln und stärkt ihre These, das Verbot sei eine Chance."},

 {"id": "sprache-deuten", "title": "Sprachliche Mittel analysieren und deuten",
  "task": "Untersuche drei sprachliche Mittel aus dem Anfang und dem Schluss des Kommentars und erkläre ihre Wirkung und Funktion.",
  "steps": [
   {"step": f"Mittel 1 bestimmen: Antithese {Z('weniger Strafe als Chance')}.",
    "why": "Zwei gegensätzliche Begriffe werden gegenübergestellt. Das Wort „Strafe“ greift die Sicht der Kritiker auf, „Chance“ setzt die eigene Deutung dagegen."},
   {"step": "Wirkung und Funktion von Mittel 1 erklären.",
    "why": "Die Antithese deutet das Verbot positiv um und prägt sich als Kernaussage ein. Weil sie an der Stelle der These steht, lenkt sie das Verständnis des ganzen Textes."},
   {"step": f"Mittel 2 bestimmen: Metapher {Z('gedanklich noch im Feed')}, verbunden mit dem Gegensatz „zwar am Platz, … aber“ (Z. 6).",
    "why": "„Feed“ ist eigentlich der Nachrichtenstrom einer App; dass man gedanklich „darin“ ist, ist ein Bild – also eine Metapher. Das Wort stammt aus der Lebenswelt der Jugendlichen."},
   {"step": "Wirkung und Funktion von Mittel 2 erklären.",
    "why": "Das Bild macht das Argument der fehlenden Konzentration vorstellbar und spricht die Zielgruppe in ihrer eigenen Sprache an – das schafft Nähe."},
   {"step": f"Mittel 3 bestimmen: Wiederholung von „gehört/gehören“ in Z. 26 und Antithese im letzten Satz {Z('verliert wenig – und gewinnt vielleicht ein Gespräch')}.",
    "why": "Das Verb „gehören“ kehrt in gegensätzlicher Bedeutung wieder (Schüler vs. Bildschirm). Im letzten Satz stehen „verliert“ und „gewinnt“ gegeneinander, getrennt durch einen Gedankenstrich."},
   {"step": "Wirkung und Funktion von Mittel 3 erklären.",
    "why": "Der Schluss wird pointiert und einprägsam. „vielleicht“ macht die Aussage vorsichtig und sympathisch statt belehrend. Der Satz wirkt wie ein leiser Appell, das Handy wegzulegen."},
   {"step": "Gemeinsamkeit benennen und zu einem Ergebnis verbinden.",
    "why": "Gute Sprachanalysen zeigen einen Zusammenhang: Alle drei Mittel arbeiten mit Gegensätzen und stellen den Verzicht als Gewinn dar."}],
  "result": "Bereits in ihrer These verwendet die Verfasserin eine Antithese: Das Verbot sei „weniger Strafe als Chance“ (Z. 3). Indem sie den Begriff der Kritiker aufgreift und ihm einen positiven gegenüberstellt, deutet sie das Verbot um; die knappe Formel prägt sich als Kernaussage ein. Im ersten Argument veranschaulicht die Metapher, man sei nach dem Videoschauen „gedanklich noch im Feed“ (Z. 6), die fehlende Konzentration. Der Ausdruck stammt aus der Lebenswelt der Jugendlichen und schafft Nähe zur Zielgruppe. Der Schluss ist durch die Wiederholung des Verbs „gehören“ (Z. 26) und die Antithese „verliert wenig – und gewinnt vielleicht ein Gespräch“ (Z. 27) besonders pointiert. Das abschwächende „vielleicht“ lässt die Aussage nicht belehrend, sondern einladend wirken. Alle drei Mittel arbeiten mit Gegensätzen und stellen den Verzicht auf das Handy als Gewinn dar – genau das ist die Absicht des Kommentars."},
]

key_terms = [
 ("Sachtext", "Nicht-literarischer Text, der sich auf die wirkliche Welt bezieht (informiert, argumentiert, appelliert oder anleitet).", "Nachricht, Kommentar, Lexikonartikel"),
 ("Kommentar", "Meinungsbetonte journalistische Textsorte: Die Verfasserin bezieht Stellung und begründet ihre Meinung mit Argumenten.", f"„{TITLE}“"),
 ("Nachricht / Bericht", "Informierende Textsorten, die sachlich und ohne eigene Meinung über ein Ereignis berichten; der Bericht ist ausführlicher.", None),
 ("These", "Zentrale Behauptung, die bewiesen oder begründet werden soll.", "„Das Verbot ist weniger Strafe als Chance.“ (Z. 3)"),
 ("Argument", "Begründung, die eine These stützen soll.", "Eine Pause soll den Kopf frei machen (Z. 4)."),
 ("Beleg / Beispiel", "Stützt ein Argument durch Fakten, Erfahrungen, Zitate oder einen konkreten Fall.", "„Lehrkräfte berichten …“ (Z. 7)"),
 ("Gegenargument / Einwand", "Argument, das gegen die eigene These spricht.", "„Was ist im Notfall?“ (Z. 18)"),
 ("Konzession (Zugeständnis)", "Die Verfasserin gibt einem Einwand teilweise recht, bevor sie ihn entkräftet; Signalwörter: natürlich, zwar, zugegeben.", "„Das stimmt – aber nur halb.“ (Z. 15)"),
 ("Widerlegung (Entkräftung)", "Zeigt, dass ein Gegenargument nicht oder nur eingeschränkt gilt.", "Sekretariat ist erreichbar (Z. 19)."),
 ("Faktenargument", "Stützt sich auf überprüfbare Tatsachen, Zahlen oder Studien.", "„Laut einer Umfrage …“ – kommt im Übungstext nicht vor."),
 ("Autoritätsargument", "Beruft sich auf die Aussage einer anerkannten oder fachkundigen Person.", "Zitat der Schulleiterin (Z. 11 f.)"),
 ("Analogieargument", "Überträgt einen bekannten, ähnlichen Fall auf das Problem.", "Fahrradfahren lernt man nicht auf der Autobahn (Z. 15)."),
 ("Antithese", "Gegenüberstellung gegensätzlicher Begriffe oder Gedanken.", "„weniger Strafe als Chance“ (Z. 3)"),
 ("Metapher", "Bildhafter Ausdruck ohne Vergleichswort; ein Wort wird in übertragener Bedeutung verwendet.", "„gedanklich noch im Feed“ (Z. 6)"),
 ("Appell", "Direkte oder indirekte Aufforderung an die Leser, etwas zu tun oder zu denken.", "Schluss: Handy für zwanzig Minuten weglegen (Z. 27)"),
 ("Konjunktiv I (indirekte Rede)", "Verbform, mit der man fremde Aussagen neutral wiedergibt.", "„Ein Verbot … nehme ihnen genau diese Übung weg.“ (Z. 14)"),
]


def mc(id, prompt, options, correct, explanation, diff="easy", optexp=None):
    q = {"id": id, "type": "multiple-choice", "prompt": prompt, "options": options, "correct": correct, "explanation": explanation, "difficulty": diff, "exam": True}
    if optexp: q["optionExplanations"] = optexp
    return q
def tf(id, prompt, correct, explanation, diff="easy"):
    return {"id": id, "type": "true-false", "prompt": prompt, "correct": correct, "explanation": explanation, "difficulty": diff, "exam": True}
def op(id, prompt, solution, explanation, diff="medium", keywords=None, hints=None):
    q = {"id": id, "type": "open", "prompt": prompt, "solution": solution, "explanation": explanation, "difficulty": diff, "exam": True}
    if keywords: q["keywords"] = keywords
    if hints: q["hints"] = hints
    return q

Q = [
 mc("q1", "Woran erkennst du, dass „Zwanzig Minuten ohne Bildschirm“ ein Kommentar und keine Nachricht ist?",
    ["Er ist kurz und beantwortet die W-Fragen.", "Die Verfasserin vertritt eine Meinung und begründet sie mit Argumenten.", "Er enthält ein Zitat.", "Er ist im Präsens geschrieben."], 1,
    "Ein Kommentar ist meinungsbetont: These + Argumente + Umgang mit Einwänden. Eine Nachricht informiert sachlich ohne Meinung.",
    optexp=["Das ist ein Merkmal der Nachricht.", "Richtig – genau das macht einen Kommentar aus.", "Zitate gibt es in vielen Textsorten, auch in Nachrichten.", "Das Tempus sagt nichts über die Textsorte aus."]),
 mc("q2", "Welcher Satz ist die These des Kommentars?",
    ["„Seit diesem Schuljahr gilt an vielen Schulen: Das Handy bleibt in der Pause in der Tasche.“ (Z. 1)", "„Das Verbot ist weniger Strafe als Chance.“ (Z. 3)", "„Lehrkräfte berichten, dass Klassen nach handyfreien Pausen ruhiger in den Unterricht starten.“ (Z. 7)", "„Ein weiterer Einwand wiegt schwerer: Was ist im Notfall?“ (Z. 18)"], 1,
    "Die These ist die zentrale Behauptung, die der Text begründet. Z. 1 nennt nur die Ausgangslage, Z. 7 ist ein Beleg, Z. 18 leitet einen Einwand ein.", diff="easy"),
 mc("q3", "Um welchen Argumenttyp handelt es sich bei „Wer Fahrradfahren lernt, übt auch nicht zuerst auf der Autobahn.“ (Z. 15)?",
    ["Faktenargument", "Autoritätsargument", "Analogieargument", "normatives Argument"], 2,
    "Ein bekannter, ähnlicher Fall (Fahrradfahren lernen) wird auf das Problem (Medienumgang lernen) übertragen – das ist ein Analogieargument.", diff="medium",
    optexp=["Es werden keine überprüfbaren Zahlen oder Studien genannt.", "Es wird keine Fachperson zitiert.", "Richtig – Übertragung eines Vergleichsfalls.", "Es geht nicht um Werte, sondern um einen Vergleich."]),
 mc("q4", "Welche Aussage über Z. 13–15 trifft am besten zu?",
    ["Die Verfasserin ändert ihre Meinung.", "Die Verfasserin nimmt einen Einwand vorweg, gibt ihm teilweise recht und entkräftet ihn.", "Die Verfasserin zitiert eine Expertin.", "Die Verfasserin fasst ihre Argumente zusammen."], 1,
    "„Natürlich lässt sich einwenden“ leitet einen Einwand ein, „Das stimmt – aber nur halb.“ ist ein Zugeständnis mit anschließender Widerlegung (Konzession).", diff="medium"),
 tf("q5", "In einer Sachtextanalyse schreibst du über „den Erzähler“ des Textes.", False,
    "Falsch. Einen Erzähler gibt es nur in literarischen Texten. Bei Sachtexten sprichst du von der Verfasserin bzw. dem Verfasser (oder Autor/in)."),
 tf("q6", "Der Kommentar stützt seine These durch Zahlen und Studien.", False,
    "Falsch. Der Text nennt keine Zahlen oder Studien. Er argumentiert mit Beobachtungen (Z. 7), einem Zitat (Z. 11 f.), Vergleichen (Z. 15) und Werten (Z. 26). Das kann man in der Analyse als Schwäche benennen.", diff="medium"),
 tf("q7", "„Ein Verbot, so die Kritik, nehme ihnen genau diese Übung weg.“ (Z. 14) – Der Konjunktiv zeigt, dass die Verfasserin eine fremde Meinung wiedergibt.", True,
    "Wahr. „nehme“ ist Konjunktiv I, die Form der indirekten Rede. Die Verfasserin gibt die Position der Kritiker wieder und macht deutlich, dass es nicht ihre eigene ist.", diff="medium"),
 op("q8", "Benenne das sprachliche Mittel in „Das Verbot ist weniger Strafe als Chance.“ (Z. 3) und erkläre seine Wirkung.",
    "Antithese: „Strafe“ und „Chance“ werden gegenübergestellt. Die Verfasserin greift die negative Sicht der Kritiker auf und setzt ihre positive Deutung dagegen. Die knappe Formel prägt sich ein und lenkt als These das Verständnis des ganzen Textes.",
    "Volle Punktzahl gibt es für drei Teile: richtiger Fachbegriff (Antithese/Gegensatz), Beleg (die beiden Gegenbegriffe) und Wirkung bzw. Funktion für die Absicht. Nur „Antithese“ zu schreiben reicht nicht.",
    diff="easy", keywords=["Antithese", "Gegensatz", "Strafe", "Chance"]),
 op("q9", "Beschreibe den Aufbau der Argumentation des Kommentars (Abschnitte mit Zeilenangaben und Funktion).",
    "Z. 1–3: Ausgangslage und These. Z. 4–7: Argument 1 (Konzentration) mit Beobachtung der Lehrkräfte. Z. 8–12: Argument 2 (Miteinander) mit Beispiel und Zitat der Schulleiterin. Z. 13–17: Einwand „selbst lernen“ + Widerlegung durch Analogie. Z. 18–21: gesteigerter Einwand „Notfall“ + Widerlegung. Z. 22–25: Einschränkung – Verbot nur gemeinsam mit der Schülervertretung. Z. 26–27: zugespitzter Schluss mit indirektem Appell. Insgesamt: Pro-Argumente, dann Einwand-Widerlegung, dann Einschränkung.",
    "Wichtig ist nicht nur der Inhalt, sondern die Funktion jedes Abschnitts (These, Argument, Einwand, Widerlegung, Einschränkung, Schluss) und Verben wie „führt an“, „räumt ein“, „entkräftet“.",
    diff="medium", hints=["Wo steht die These?", "Wo wechselt der Text von eigenen Argumenten zu Gegenargumenten?", "Was passiert in Z. 22–25?"]),
 op("q10", "Schreibe einen Analyse-Absatz zur Frage: Wie versucht die Verfasserin in Z. 18–25, besonders skeptische Leserinnen und Leser zu überzeugen? Nutze mindestens zwei Zitate mit Zeilenangabe.",
    "Musterabsatz: In Z. 18 greift die Verfasserin den Einwand auf, den sie selbst als gewichtigsten bezeichnet: „Ein weiterer Einwand wiegt schwerer: Was ist im Notfall?“ (Z. 18). Indem sie die Sorge als Frage formuliert, spricht sie Eltern und Jugendliche direkt an. Sie entkräftet sie mit praktischen Lösungen – das Sekretariat sei „jederzeit erreichbar“ (Z. 19), Telefonieren sei mit Erlaubnis möglich – und schließt mit der verallgemeinernden Beruhigung, niemand sei „von der Welt abgeschnitten“ (Z. 21). Danach schränkt sie ihre eigene Position ein: Entscheidend sei, „wie ein solches Verbot eingeführt wird“ (Z. 22). Der Parallelismus „Wird es einfach von oben verordnet …“ / „Wird es dagegen gemeinsam …“ (Z. 23 f.) stellt zwei Wege gegenüber; die Metapher „Misstrauensvotum gegen die Jugend“ (Z. 23) übernimmt sogar die Perspektive der Kritiker. Durch diese Einschränkung wirkt die Verfasserin nicht wie eine Verbotsbefürworterin um jeden Preis, sondern wie jemand, der die Jugendlichen ernst nimmt – das macht sie gerade für Skeptiker glaubwürdig.",
    "Bewertet werden: richtige Beobachtungen (Einwand als Frage, Widerlegung, Einschränkung), korrekt zitierte Belege mit Zeilenangabe, Erklärung der Wirkung und der Bezug zur Leitfrage (Skeptiker überzeugen). Ein Absatz ohne Bezug zur Wirkung bleibt eine Inhaltsangabe.",
    diff="hard", hints=["Welche Sorge wird in Z. 18 aufgegriffen – und wie?", "Warum schränkt die Verfasserin ihre eigene Forderung ein?"]),
]

flashcards = [
 ("Was ist ein Sachtext?", "Ein nicht-literarischer Text, der sich auf die wirkliche Welt bezieht."),
 ("Die vier Textfunktionen", "informieren · argumentieren/überzeugen · appellieren · instruieren"),
 ("Kommentar vs. Nachricht", "Kommentar: Meinung + Argumente. Nachricht: sachliche Information ohne Meinung."),
 ("Was gehört in die Einleitung?", "TATTE (Titel, Autor/in, Textsorte, Thema, Erscheinungsjahr/Quelle) + Kernaussage/These, evtl. Hypothese"),
 ("Bausteine einer Argumentation", "These → Argument → Beleg/Beispiel (+ Gegenargument und Widerlegung)"),
 ("Konzession", "Zugeständnis an einen Einwand, bevor er entkräftet wird (natürlich … aber; zwar … doch)"),
 ("Analogieargument", "Ein ähnlicher, bekannter Fall wird auf das Problem übertragen."),
 ("Autoritätsargument", "Berufung auf eine fachkundige oder anerkannte Person."),
 ("Dreischritt der Sprachanalyse", "Mittel + Beleg → Wirkung → Funktion für die Absicht"),
 ("Wie kennzeichnest du eine Auslassung im Zitat?", "Mit eckigen Klammern: […]"),
 ("Welches Tempus in der Analyse?", "Präsens (Vorzeitiges im Perfekt)."),
 ("Wann gehört deine Meinung in die Analyse?", "Nur im Schluss und nur, wenn die Aufgabe eine Stellungnahme verlangt."),
]

exercises = [
 {"id": "u1", "level": "easy", "prompt": "Ordne zu: Nachricht, Kommentar, Reportage, Gebrauchsanweisung – welche Hauptfunktion hat jede Textsorte?",
  "solution": "Nachricht: informieren · Kommentar: argumentieren/überzeugen · Reportage: informieren (anschaulich, mit Eindrücken) · Gebrauchsanweisung: instruieren",
  "explanation": "Die Hauptfunktion ergibt sich aus der Absicht: Wer berichtet, informiert; wer eine Meinung begründet, argumentiert; wer anleitet, instruiert. Die Reportage informiert, wirkt aber durch Szenen und Eindrücke lebendiger."},
 {"id": "u2", "level": "easy", "prompt": "Finde im Übungstext je ein Signalwort für (a) ein neues Argument, (b) ein Zugeständnis, (c) eine Widerlegung.",
  "solution": f"(a) „Hinzu kommt“ (Z. {L('Hinzu kommt')}) · (b) „Natürlich lässt sich einwenden“ (Z. {L('Natürlich lässt sich einwenden')}) · (c) „Doch auch hier“ (Z. {L('Doch auch hier')}) oder „aber nur halb“ (Z. {L('aber nur halb')})",
  "explanation": "Signalwörter zeigen die Gliederung des Gedankengangs. Wer sie beim Lesen markiert, findet die Sinnabschnitte schneller. Auch „Zunächst“ (Z. 4) wäre für (a) richtig."},
 {"id": "u3", "level": "medium", "prompt": "Bestimme den Argumenttyp in Z. 7 und Z. 11–12 und beurteile, wie überzeugend die beiden Belege sind.",
  "solution": "Z. 7: Erfahrungs-/Beobachtungsargument („Lehrkräfte berichten“). Z. 11–12: Autoritätsargument (Zitat einer Schulleiterin). Beide wirken anschaulich und glaubwürdig, sind aber nicht überprüfbar: Es werden keine Zahlen, Namen oder Studien genannt, und es bleibt offen, wie viele Lehrkräfte das beobachtet haben.",
  "explanation": "Zu einer Argumentationsanalyse gehört auch die Bewertung der Belege. „Überzeugend“ heißt nicht „wahr“ – ein Beleg kann anschaulich, aber trotzdem schwach sein.",
  "steps": ["Wer spricht? (Lehrkräfte bzw. Schulleiterin)", "Welcher Typ? (Erfahrung bzw. Autorität)", "Was fehlt? (Zahlen, Quelle, Verallgemeinerbarkeit)"]},
 {"id": "u4", "level": "medium", "prompt": "Gib den Einwand aus Z. 13–14 in indirekter Rede mit Konjunktiv I wieder und erkläre, warum die Verfasserin selbst den Konjunktiv verwendet.",
  "solution": "Kritiker meinen, Jugendliche müssten lernen, selbst mit dem Handy umzugehen; ein Verbot nehme ihnen genau diese Übung weg. – Die Verfasserin nutzt den Konjunktiv („nehme“, Z. 14), um deutlich zu machen, dass sie eine fremde Meinung wiedergibt, von der sie sich distanziert.",
  "explanation": "„müssten“ ist hier Konjunktiv II als Ersatzform, weil der Konjunktiv I („müssen“) mit dem Indikativ gleich lautet. Der Konjunktiv kennzeichnet Aussagen als fremd – wichtig für das Verständnis von Einwänden."},
 {"id": "u5", "level": "hard", "prompt": "Analysiere die Sprache des Schlusses (Z. 26–27) in einem Absatz: mindestens zwei Mittel, mit Zitat, Wirkung und Funktion.",
  "solution": "Im Schluss spitzt die Verfasserin ihre Position zu. Das Verb „gehört“ (Z. 26) wird wiederholt und in gegensätzlicher Bedeutung verwendet: Die Pause gehöre den Schülern, gerade deshalb solle sie „nicht dem Bildschirm gehören“. Dieses Wortspiel greift das Argument der Kritiker (Bevormundung) auf und dreht es um: Das Verbot erscheint nicht als Einschränkung, sondern als Schutz der Freiheit der Jugendlichen. Der letzte Satz enthält die Antithese „verliert wenig – und gewinnt vielleicht ein Gespräch“ (Z. 27); der Gedankenstrich schafft eine Pause vor der Pointe. Das vorsichtige „vielleicht“ wirkt einladend statt belehrend. So endet der Kommentar mit einem indirekten Appell, das Handy freiwillig wegzulegen.",
  "explanation": "Ein guter Absatz benennt die Mittel genau, belegt sie wörtlich und erklärt, wozu sie im Gesamttext dienen – hier: das Verbot als Gewinn erscheinen zu lassen.",
  "steps": ["Mittel finden (Wiederholung/Wortspiel, Antithese, Gedankenstrich, „vielleicht“)", "zitieren mit Zeilenangabe", "Wirkung beschreiben", "Funktion: Bezug zur These und zur Zielgruppe"]},
 {"id": "u6", "level": "hard", "prompt": "Schreibe einen Schluss zur Analyse des Kommentars, der das Ergebnis bündelt und die Überzeugungskraft beurteilt (ohne eigene Meinung zum Handyverbot).",
  "solution": "Insgesamt versucht die Verfasserin, ihre Leserinnen und Leser vor allem durch anschauliche Beobachtungen, einprägsame Vergleiche und einen fairen Umgang mit Gegenargumenten zu überzeugen. Ihre Sprache arbeitet durchgehend mit Gegensätzen, die den Verzicht auf das Handy als Gewinn darstellen. Besonders überzeugend wirkt, dass sie Einwände nicht übergeht, sondern teilweise zugesteht, und ihre eigene Forderung an die Beteiligung der Schülervertretung knüpft. Dadurch erscheint sie gerade jugendlichen Skeptikern glaubwürdig. Eine Schwäche ist, dass sie keine überprüfbaren Zahlen oder Studien nennt. Die Hypothese, der Text richte sich vor allem an skeptische Jugendliche, hat sich damit bestätigt.",
  "explanation": "Der Schluss fasst zusammen, beurteilt Stärken und Schwächen der Argumentation und überprüft die Hypothese. Eine Meinung zum Thema (z. B. „Ich bin für das Verbot“) gehört nur hinein, wenn die Aufgabe eine Stellungnahme verlangt."},
]

mistakes = [
 ("Vom „Erzähler“ sprechen.", "Begriffe aus der Analyse literarischer Texte werden übertragen.", "Bei Sachtexten: „die Verfasserin“, „der Autor“. Einen Erzähler gibt es nur in erfundenen Texten."),
 ("Den Inhalt nacherzählen statt den Gedankengang zu analysieren.", "„Was steht da?“ ist leichter als „Was macht der Abschnitt?“", "Jeden Abschnitt mit seiner Funktion beschreiben: „führt als Argument an“, „räumt ein“, „entkräftet“."),
 ("Stilmittel nur auflisten („In Z. 3 ist eine Antithese.“).", "Man glaubt, das Finden sei schon die Analyse.", "Immer der Dreischritt: Mittel + Beleg → Wirkung → Funktion für die Absicht des Textes."),
 ("Ungenaue oder falsch belegte Zitate.", "Aus dem Gedächtnis zitiert oder Zeile verrutscht.", "Wortgenau abschreiben, Auslassungen mit […] kennzeichnen, Zeilen prüfen (Z. 7, Z. 16 f., Z. 13–17)."),
 ("Die eigene Meinung zum Thema in die Analyse schreiben („Ich finde Handyverbote doof.“).", "Das Thema betrifft einen selbst – man will mitdiskutieren.", "In der Analyse nur beurteilen, *wie gut* argumentiert wird. Eigene Meinung nur im Schluss, wenn eine Stellungnahme verlangt ist."),
 ("Die Meinung der Kritiker als Meinung der Verfasserin ausgeben.", "Einwände werden im Text ausführlich wiedergegeben und beim schnellen Lesen für die Position gehalten.", "Auf Signalwörter (natürlich, so die Kritik) und den Konjunktiv achten; prüfen, ob danach ein „aber/doch“ folgt."),
 ("Wechsel ins Präteritum („Die Autorin schrieb …“).", "Gewohnheit aus Erzählungen und Berichten.", "Durchgehend Präsens: „Die Autorin schreibt / führt an / betont …“."),
 ("Wirkungsbeschreibungen bleiben leer („Das wirkt interessant.“).", "Es fehlen passende Wörter für Wirkungen.", "Genau benennen: veranschaulicht, betont, wertet ab, schafft Nähe, wirkt glaubwürdig – und sagen, *bei wem* und *wozu*."),
]

summary = f"""**Sachtextanalyse – das Wichtigste auf einen Blick**

- **Sachtext** = bezieht sich auf die Wirklichkeit; Hauptfunktion bestimmen (informieren, argumentieren, appellieren, instruieren). Verfasser/in statt Erzähler.
- **Vorbereitung:** markieren (These, Argumente, Einwände), Sinnabschnitte mit Signalwörtern, Kernaussage in einem Satz.
- **Einleitung:** TATTE + These, evtl. Hypothese zur Wirkung. Kein Zitat, keine Meinung.
- **Hauptteil 1 – Gedankengang:** Abschnitte mit Funktion (*führt an, räumt ein, entkräftet, schränkt ein*), fremde Aussagen im Konjunktiv I.
- **Hauptteil 2 – Argumentation:** These → Argument → Beleg; Argumenttypen (Fakten, Erfahrung, Autorität, Analogie, Norm); Struktur (steigernd, dialektisch, Einwand-Widerlegung); Belege kritisch prüfen.
- **Hauptteil 3 – Sprache:** Wortwahl, Satzbau, rhetorische Mittel – immer **Mittel + Beleg → Wirkung → Funktion**.
- **Textbelege:** wortgenau, Zeilenangabe, Auslassung […], nach jedem Zitat erklären.
- **Schluss:** Ergebnis bündeln, Hypothese prüfen, Überzeugungskraft beurteilen; Stellungnahme nur auf Nachfrage.
- **Tempus:** Präsens. **Stil:** sachlich, eigene Worte.

**Übungstext in einem Satz:** {AUTHOR} hält das Handyverbot in Pausen für eine Chance ({Z("weniger Strafe als Chance")}), stützt das mit Konzentration und Miteinander, entkräftet zwei Einwände und knüpft das Verbot an die Mitwirkung der Schülervertretung."""

pkg = {
  "format": "studyos-learning-package", "version": 1,
  "id": "deutsch-sachtextanalyse-klasse-9",
  "title": "Sachtextanalyse – Klasse 9", "subject": "Deutsch", "topic": "Sachtextanalyse",
  "level": "Klasse 9", "grade": 9, "language": "de",
  "description": f"Sachtexte analysieren – von der Einleitung über Gedankengang und Argumentation bis zu Sprache und Textbelegen. Alle Beispiele beziehen sich auf den eigens geschriebenen Kommentar „{TITLE}“.",
  "author": "Study OS", "createdAt": "2026-10-25",
  "objectives": [
    "Ich kann Sachtexte nach Textsorte und Funktion einordnen.",
    "Ich kann eine Einleitung mit TATTE und Kernaussage schreiben.",
    "Ich kann den Gedankengang eines Textes mit Funktionsverben wiedergeben.",
    "Ich kann These, Argumente, Belege, Einwände und Widerlegungen erkennen und Argumenttypen bestimmen.",
    "Ich kann sprachliche Mittel mit Beleg, Wirkung und Funktion analysieren.",
    "Ich kann korrekt zitieren und einen begründeten Schluss schreiben.",
  ],
  "notes": notes,
  "examples": examples,
  "keyTerms": [dict(term=t, definition=d, **({"example": e} if e else {})) for t, d, e in key_terms],
  "questions": Q,
  "flashcards": [{"front": f, "back": b} for f, b in flashcards],
  "exercises": exercises,
  "mistakes": [{"mistake": m, "why": w, "fix": f} for m, w, f in mistakes],
  "summary": summary,
  "exam": {"title": "Übungstest: Sachtextanalyse (Klasse 9)", "timeLimitMinutes": 45, "questionIds": [q["id"] for q in Q]},
}

counts = dict(notes=len(notes), examples=len(examples), keyTerms=len(key_terms), questions=len(Q), flashcards=len(flashcards), exercises=len(exercises), mistakes=len(mistakes))
assert counts == dict(notes=10, examples=3, keyTerms=16, questions=10, flashcards=12, exercises=6, mistakes=8), counts
assert sorted(e["level"] for e in exercises) == ["easy"] * 2 + ["hard"] * 2 + ["medium"] * 2
out = pathlib.Path(__file__).resolve().parent.parent / "public/lernpakete/deutsch-sachtextanalyse-klasse-9.json"
out.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(out, counts)
