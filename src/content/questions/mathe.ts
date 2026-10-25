import { math, mc, num, tf, txt, type LibQuestion } from './helpers'

export const MATHE: LibQuestion[] = [
  // Brüche
  math('ma-br-1', 'ma-brueche', 'Kürze vollständig: $\\frac{18}{24}$', '3/4', '18 und 24 sind beide durch 6 teilbar: $\\frac{18 : 6}{24 : 6} = \\frac{3}{4}$.', { form: 'simplified-fraction', d: 1, hints: ['Suche die größte Zahl, durch die 18 und 24 beide teilbar sind.'] }),
  math('ma-br-2', 'ma-brueche', 'Berechne: $\\frac{2}{3} + \\frac{1}{4}$', '11/12', 'Hauptnenner 12: $\\frac{8}{12} + \\frac{3}{12} = \\frac{11}{12}$.', { d: 2, hints: ['Brüche kann man nur addieren, wenn sie den gleichen Nenner haben.', 'Der kleinste gemeinsame Nenner von 3 und 4 ist 12.'], steps: ['Hauptnenner bestimmen: 12', 'Erweitern: $\\frac{2}{3} = \\frac{8}{12}$, $\\frac{1}{4} = \\frac{3}{12}$', 'Zähler addieren: $\\frac{8+3}{12} = \\frac{11}{12}$'] }),
  math('ma-br-3', 'ma-brueche', 'Berechne: $\\frac{3}{5} \\cdot \\frac{10}{9}$', '2/3', 'Zähler mal Zähler, Nenner mal Nenner: $\\frac{30}{45} = \\frac{2}{3}$. Schneller: vorher kürzen.', { d: 2 }),
  math('ma-br-4', 'ma-brueche', 'Berechne: $\\frac{3}{4} : \\frac{1}{2}$', '3/2', 'Durch einen Bruch teilt man, indem man mit dem Kehrwert multipliziert: $\\frac{3}{4} \\cdot \\frac{2}{1} = \\frac{6}{4} = \\frac{3}{2}$.', { d: 2, accepted: ['1.5'], hints: ['Teilen durch einen Bruch = mal Kehrwert.'] }),
  mc('ma-br-5', 'ma-brueche', 'Welcher Bruch ist am größten?', ['$\\frac{3}{5}$', '$\\frac{5}{8}$', '$\\frac{4}{7}$', '$\\frac{2}{3}$'], 3, 'Als Dezimalzahl: 0,6 · 0,625 · ≈0,571 · ≈0,667. Also ist $\\frac{2}{3}$ am größten.', { fb: ['0,6 ist kleiner als 2/3 ≈ 0,667.', '0,625 ist nah dran, aber kleiner als 0,667.', '4/7 ≈ 0,571 ist sogar der kleinste.', 'Richtig: 2/3 ≈ 0,667.'], hints: ['Wandle die Brüche in Dezimalzahlen um.'] }),
  tf('ma-br-6', 'ma-brueche', 'Wahr oder falsch: $\\frac{1}{2} + \\frac{1}{3} = \\frac{2}{5}$', false, 'Falsch. Nenner werden nicht addiert! Richtig: $\\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}$.', { d: 1 }),

  // Terme
  math('ma-te-1', 'ma-terme', 'Multipliziere aus und fasse zusammen: $3(x + 4) - 2x$', 'x + 12', '$3x + 12 - 2x = x + 12$.', { form: 'expanded', d: 1, hints: ['Jeder Summand in der Klammer wird mit 3 multipliziert.'] }),
  math('ma-te-2', 'ma-terme', 'Wende die 1. binomische Formel an: $(x + 5)^2$', 'x^2 + 10x + 25', '$(a+b)^2 = a^2 + 2ab + b^2$, also $x^2 + 2 \\cdot 5 \\cdot x + 25 = x^2 + 10x + 25$.', { form: 'expanded', d: 2, hints: ['$(a+b)^2 = a^2 + 2ab + b^2$', 'Typischer Fehler: das Mittelglied $2ab$ vergessen.'] }),
  math('ma-te-3', 'ma-terme', 'Wende die 3. binomische Formel an: $(2a - 3)(2a + 3)$', '4a^2 - 9', '$(x-y)(x+y) = x^2 - y^2$, hier $(2a)^2 - 3^2 = 4a^2 - 9$.', { form: 'expanded', d: 2 }),
  math('ma-te-4', 'ma-terme', 'Klammere den größten gemeinsamen Faktor aus: $6x^2 + 9x$ (Gib den ausgeklammerten Term an.)', '3x(2x + 3)', 'Gemeinsamer Faktor ist $3x$: $3x(2x + 3)$. Probe durch Ausmultiplizieren.', { form: 'factored', d: 3 }),
  mc('ma-te-5', 'ma-terme', 'Was ist $(x - 4)^2$?', ['$x^2 - 16$', '$x^2 - 8x + 16$', '$x^2 + 16$', '$x^2 - 8x - 16$'], 1, '2. binomische Formel: $(a - b)^2 = a^2 - 2ab + b^2 = x^2 - 8x + 16$.', { fb: ['Das wäre $(x-4)(x+4)$ – das Mittelglied fehlt.', 'Richtig.', 'Das Mittelglied $-8x$ fehlt, und so entsteht kein Plus vor 16.', '$(-4)^2 = +16$, nicht $-16$.'] }),

  // Gleichungen
  math('ma-gl-1', 'ma-gleichungen', 'Löse: $3x + 7 = 22$', 'x = 5', '$3x = 15$, also $x = 5$. Probe: $3 \\cdot 5 + 7 = 22$ ✓', { d: 1, steps: ['$3x + 7 = 22 \\quad | -7$', '$3x = 15 \\quad | :3$', '$x = 5$'], hints: ['Bringe zuerst die 7 auf die andere Seite.'] }),
  math('ma-gl-2', 'ma-gleichungen', 'Löse: $5x - 3 = 2x + 9$', 'x = 4', '$3x - 3 = 9 \\Rightarrow 3x = 12 \\Rightarrow x = 4$.', { d: 2, steps: ['$5x - 3 = 2x + 9 \\quad | -2x$', '$3x - 3 = 9 \\quad | +3$', '$3x = 12 \\quad | :3$', '$x = 4$'] }),
  math('ma-gl-3', 'ma-gleichungen', 'Löse: $2(x - 3) = x + 4$', 'x = 10', '$2x - 6 = x + 4 \\Rightarrow x = 10$.', { d: 2 }),
  math('ma-gl-4', 'ma-gleichungen', 'Löse: $\\frac{x}{4} + 2 = 5$', 'x = 12', '$\\frac{x}{4} = 3 \\Rightarrow x = 12$.', { d: 2 }),
  mc('ma-gl-5', 'ma-gleichungen', 'Welche Umformung ist bei $4x = 20$ richtig?', ['Auf beiden Seiten −4', 'Auf beiden Seiten :4', 'Nur links :4', 'Auf beiden Seiten ·4'], 1, '4x bedeutet 4 · x. Die Umkehrung von „mal 4“ ist „geteilt durch 4“ – und zwar auf beiden Seiten.', { fb: ['−4 würde zu 4x − 4 = 16 führen, x bleibt mit 4 multipliziert.', 'Richtig.', 'Eine Umformung muss immer auf beiden Seiten passieren, sonst stimmt die Gleichung nicht mehr.', 'Dann stünde 16x = 80 da – x ist nicht freigestellt.'], d: 1 }),

  // Lineare Funktionen
  mc('ma-lf-1', 'ma-linfkt', 'Welche Steigung hat $y = -2x + 5$?', ['5', '−2', '2', '−5'], 1, 'In $y = mx + n$ ist m die Steigung, hier $m = -2$. n = 5 ist der y-Achsenabschnitt.', { fb: ['5 ist der y-Achsenabschnitt n, nicht die Steigung.', 'Richtig.', 'Das Vorzeichen gehört dazu: m = −2, die Gerade fällt.', 'Das vermischt Steigung und Achsenabschnitt.'], d: 1 }),
  math('ma-lf-2', 'ma-linfkt', 'Eine Gerade geht durch $P(1|3)$ und $Q(3|7)$. Berechne die Steigung m.', '2', '$m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{7 - 3}{3 - 1} = \\frac{4}{2} = 2$.', { d: 2, hints: ['Steigung = Höhenunterschied geteilt durch Breitenunterschied.'] }),
  num('ma-lf-3', 'ma-linfkt', 'Berechne den Funktionswert von $f(x) = 3x - 4$ an der Stelle $x = 5$.', '11', '$f(5) = 3 \\cdot 5 - 4 = 11$.', { d: 1 }),
  tf('ma-lf-4', 'ma-linfkt', 'Wahr oder falsch: Die Gerade $y = 4$ ist parallel zur x-Achse.', true, 'Wahr: Die Steigung ist 0, jeder Punkt hat den y-Wert 4.', { d: 1 }),
  math('ma-lf-5', 'ma-linfkt', 'Bestimme die Nullstelle von $f(x) = 2x - 6$.', 'x = 3', 'Nullstelle heißt $f(x) = 0$: $2x - 6 = 0 \\Rightarrow x = 3$.', { d: 2 }),

  // LGS
  math('ma-lgs-1', 'ma-lgs', 'Löse das Gleichungssystem: $x + y = 10$ und $x - y = 2$. Gib beide Werte an (z. B. „x = 1; y = 2“).', 'x = 6; y = 4', 'Addieren: $2x = 12 \\Rightarrow x = 6$, dann $y = 10 - 6 = 4$.', { d: 2, hints: ['Addiere beide Gleichungen – dann fällt y weg.'] }),
  math('ma-lgs-2', 'ma-lgs', 'Löse: $y = 2x + 1$ und $y = -x + 7$. Gib beide Werte an.', 'x = 2; y = 5', 'Gleichsetzen: $2x + 1 = -x + 7 \\Rightarrow 3x = 6 \\Rightarrow x = 2$, $y = 5$.', { d: 2 }),
  mc('ma-lgs-3', 'ma-lgs', 'Zwei Geraden sind parallel und verschieden. Wie viele Lösungen hat das zugehörige Gleichungssystem?', ['Genau eine', 'Keine', 'Unendlich viele', 'Zwei'], 1, 'Parallele, verschiedene Geraden schneiden sich nie – es gibt keinen gemeinsamen Punkt, also keine Lösung.', { fb: ['Genau eine Lösung gibt es, wenn sich die Geraden schneiden.', 'Richtig.', 'Unendlich viele Lösungen gibt es nur, wenn die Geraden identisch sind.', 'Zwei verschiedene Geraden können sich höchstens einmal schneiden.'] }),

  // Potenzen
  math('ma-po-1', 'ma-potenzen', 'Vereinfache: $a^3 \\cdot a^5$', 'a^8', 'Gleiche Basis: Exponenten addieren, $a^{3+5} = a^8$.', { form: 'simplified', d: 1, hints: ['Bei gleicher Basis werden beim Multiplizieren die Exponenten addiert.'] }),
  math('ma-po-2', 'ma-potenzen', 'Berechne: $\\sqrt{144}$', '12', '$12 \\cdot 12 = 144$.', { d: 1 }),
  math('ma-po-3', 'ma-potenzen', 'Berechne: $2^{-3}$', '1/8', '$2^{-3} = \\frac{1}{2^3} = \\frac{1}{8}$.', { d: 2, accepted: ['0.125'] }),
  mc('ma-po-4', 'ma-potenzen', 'Wie schreibt man 0,00042 in wissenschaftlicher Schreibweise?', ['$4{,}2 \\cdot 10^{4}$', '$4{,}2 \\cdot 10^{-4}$', '$42 \\cdot 10^{-5}$', '$4{,}2 \\cdot 10^{-3}$'], 1, 'Das Komma wandert 4 Stellen nach rechts, also $10^{-4}$. Vor dem Komma steht genau eine Ziffer (4,2).', { fb: ['Positive Exponenten stehen für große Zahlen.', 'Richtig.', 'Der Wert stimmt, aber in wissenschaftlicher Schreibweise steht vor dem Komma genau eine Ziffer von 1 bis 9.', 'Zähle nochmal: 0,00042 → 4,2 sind 4 Stellen.'], d: 3 }),
  tf('ma-po-5', 'ma-potenzen', 'Wahr oder falsch: $(a^2)^3 = a^5$', false, 'Falsch: Potenzieren einer Potenz → Exponenten multiplizieren: $(a^2)^3 = a^6$.', { d: 2 }),
  mc('ma-po-6', 'ma-potenzen', 'Welche Darstellung ist $\\sqrt{50}$ teilweise radiziert?', ['$25\\sqrt{2}$', '$5\\sqrt{2}$', '$2\\sqrt{5}$', '$5\\sqrt{10}$'], 1, '$\\sqrt{50} = \\sqrt{25 \\cdot 2} = \\sqrt{25} \\cdot \\sqrt{2} = 5\\sqrt{2}$.', { fb: ['Aus 25 wird beim Wurzelziehen 5 – die 25 darf nicht vor der Wurzel stehen bleiben.', 'Richtig.', '$2\\sqrt{5} = \\sqrt{20}$, nicht $\\sqrt{50}$.', '$5\\sqrt{10} = \\sqrt{250}$.'], d: 3 }),

  // Pythagoras
  num('ma-py-1', 'ma-pythagoras', 'In einem rechtwinkligen Dreieck sind die Katheten $a = 6$ cm und $b = 8$ cm lang. Wie lang ist die Hypotenuse c?', '10', '$c^2 = 6^2 + 8^2 = 36 + 64 = 100$, also $c = 10$ cm.', { unit: 'cm', d: 1, hints: ['$c^2 = a^2 + b^2$'] }),
  num('ma-py-2', 'ma-pythagoras', 'Hypotenuse $c = 13$ m, Kathete $a = 5$ m. Berechne die Kathete b.', '12', '$b^2 = c^2 - a^2 = 169 - 25 = 144$, also $b = 12$ m.', { unit: 'm', d: 2, hints: ['Stelle $a^2 + b^2 = c^2$ nach $b^2$ um.'] }),
  num('ma-py-3', 'ma-pythagoras', 'Eine 5 m lange Leiter lehnt an einer Wand. Der Fuß steht 1,5 m von der Wand entfernt. Wie hoch reicht die Leiter? (auf zwei Nachkommastellen)', '4.77', '$h = \\sqrt{5^2 - 1{,}5^2} = \\sqrt{22{,}75} \\approx 4{,}77$ m. Die Leiter ist die Hypotenuse!', { unit: 'm', d: 3 }),
  mc('ma-py-4', 'ma-pythagoras', 'Welche Seite ist im rechtwinkligen Dreieck die Hypotenuse?', ['Die kürzeste Seite', 'Die Seite gegenüber dem rechten Winkel', 'Jede Seite am rechten Winkel', 'Die Seite gegenüber dem kleinsten Winkel'], 1, 'Die Hypotenuse liegt dem rechten Winkel gegenüber und ist immer die längste Seite.', { fb: ['Die Hypotenuse ist sogar die längste Seite.', 'Richtig.', 'Die Seiten am rechten Winkel heißen Katheten.', 'Gegenüber dem kleinsten Winkel liegt die kürzeste Seite.'], d: 1 }),

  // Quadratische Funktionen / Gleichungen
  mc('ma-qf-1', 'ma-quadfkt', 'Wo liegt der Scheitelpunkt von $f(x) = (x - 2)^2 + 3$?', ['$S(2|3)$', '$S(-2|3)$', '$S(2|-3)$', '$S(3|2)$'], 0, 'Scheitelpunktform $f(x) = (x - d)^2 + e$ mit $S(d|e)$. Hier $d = 2$, $e = 3$.', { fb: ['Richtig.', 'Achtung: In $(x - 2)$ steckt $d = +2$. Das Minus gehört zur Formel.', 'Das $+3$ verschiebt nach oben, also $e = +3$.', 'x- und y-Koordinate vertauscht.'], d: 2 }),
  tf('ma-qf-2', 'ma-quadfkt', 'Wahr oder falsch: Die Parabel $y = -x^2$ ist nach unten geöffnet.', true, 'Wahr: Ein negativer Faktor vor $x^2$ spiegelt die Normalparabel an der x-Achse.', { d: 1 }),
  math('ma-qg-1', 'ma-quadgl', 'Löse: $x^2 = 49$', 'x = 7; x = -7', 'Zwei Lösungen: $x = 7$ und $x = -7$, denn auch $(-7)^2 = 49$.', { d: 1, hints: ['Denke daran: Auch eine negative Zahl zum Quadrat ist positiv.'] }),
  math('ma-qg-2', 'ma-quadgl', 'Löse mit der p-q-Formel: $x^2 - 2x - 8 = 0$', 'x = 4; x = -2', '$p = -2$, $q = -8$: $x = 1 \\pm \\sqrt{1 + 8} = 1 \\pm 3$, also $x_1 = 4$, $x_2 = -2$.', { d: 3, steps: ['p und q ablesen: $p = -2$, $q = -8$', '$x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{\\left(\\frac{p}{2}\\right)^2 - q}$', '$= 1 \\pm \\sqrt{1 + 8} = 1 \\pm 3$', '$x_1 = 4$, $x_2 = -2$'], hints: ['Lies p und q mit Vorzeichen ab.', '$x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{(\\frac{p}{2})^2 - q}$'] }),
  math('ma-qg-3', 'ma-quadgl', 'Löse: $x(x - 5) = 0$', 'x = 0; x = 5', 'Ein Produkt ist null, wenn ein Faktor null ist: $x = 0$ oder $x - 5 = 0$.', { d: 2 }),

  // Prozent
  num('ma-pr-1', 'ma-prozent', 'Wie viel sind 15 % von 80 €?', '12', '$80 \\cdot 0{,}15 = 12$ €.', { unit: '€', d: 1 }),
  num('ma-pr-2', 'ma-prozent', 'Ein Pullover kostet nach 20 % Rabatt noch 48 €. Wie teuer war er vorher?', '60', '48 € sind 80 % des alten Preises: $48 : 0{,}8 = 60$ €.', { unit: '€', d: 3, hints: ['48 € entsprechen nicht 100 %, sondern 80 %.'] }),
  num('ma-pr-3', 'ma-prozent', '18 von 24 Schülern haben ein Haustier. Wie viel Prozent sind das?', '75', '$\\frac{18}{24} = 0{,}75 = 75\\,\\%$.', { unit: '%', d: 1 }),
  num('ma-pr-4', 'ma-prozent', 'Du legst 500 € zu 2 % Zinsen pro Jahr an. Wie viele Zinsen bekommst du nach einem Jahr?', '10', '$500 \\cdot 0{,}02 = 10$ €.', { unit: '€', d: 1 }),
  num('ma-pr-5', 'ma-prozent', '1000 € werden 2 Jahre lang mit 3 % Zinseszins angelegt. Wie hoch ist das Kapital danach?', '1060.90', '$1000 \\cdot 1{,}03^2 = 1060{,}90$ €.', { unit: '€', d: 3 }),
  mc('ma-pr-6', 'ma-prozent', 'Ein Preis steigt um 10 % und sinkt danach um 10 %. Was stimmt?', ['Der Preis ist wieder gleich.', 'Der Preis ist danach niedriger als vorher.', 'Der Preis ist danach höher als vorher.', 'Das hängt vom Preis ab.'], 1, 'Beispiel 100 € → 110 € → 99 €. Die 10 % beim Senken beziehen sich auf den größeren Wert 110 €.', { fb: ['Der Grundwert ändert sich: Die 10 % Rabatt werden von 110 € berechnet.', 'Richtig.', 'Rechne es an 100 € durch: 100 → 110 → 99.', 'Es gilt für jeden Preis: Faktor 1,1 · 0,9 = 0,99.'], d: 3 }),

  // Körper
  num('ma-kp-1', 'ma-koerper', 'Ein Zylinder hat den Radius $r = 3$ cm und die Höhe $h = 10$ cm. Berechne das Volumen (auf eine Nachkommastelle).', '282.7', '$V = \\pi r^2 h = \\pi \\cdot 9 \\cdot 10 \\approx 282{,}7$ cm³.', { unit: 'cm³', d: 2, hints: ['$V = \\pi \\cdot r^2 \\cdot h$'] }),
  num('ma-kp-2', 'ma-koerper', 'Ein Quader ist 4 cm lang, 3 cm breit und 5 cm hoch. Berechne die Oberfläche.', '94', '$O = 2(ab + ac + bc) = 2(12 + 20 + 15) = 94$ cm².', { unit: 'cm²', d: 2 }),
  num('ma-kp-3', 'ma-koerper', 'Ein dreiseitiges Prisma hat als Grundfläche ein rechtwinkliges Dreieck mit den Katheten 3 cm und 4 cm. Die Höhe des Prismas ist 10 cm. Volumen?', '60', '$G = \\frac{3 \\cdot 4}{2} = 6$ cm², $V = G \\cdot h = 60$ cm³.', { unit: 'cm³', d: 3 }),

  // Wahrscheinlichkeit
  math('ma-wk-1', 'ma-wkeit', 'Eine faire Münze wird zweimal geworfen. Wie groß ist die Wahrscheinlichkeit für zweimal Kopf?', '1/4', 'Pfadregel: $\\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{4}$.', { d: 1, accepted: ['0.25', '25%'] }),
  math('ma-wk-2', 'ma-wkeit', 'In einer Urne liegen 3 rote und 2 blaue Kugeln. Du ziehst zweimal OHNE Zurücklegen. Wie groß ist die Wahrscheinlichkeit für zwei rote Kugeln?', '3/10', '$\\frac{3}{5} \\cdot \\frac{2}{4} = \\frac{6}{20} = \\frac{3}{10}$. Beim zweiten Zug ist eine rote Kugel weniger drin!', { d: 3, hints: ['Nach dem ersten Zug liegen nur noch 4 Kugeln in der Urne.'] }),
  txt('ma-wk-3', 'ma-wkeit', 'Wie lautet die Summenregel für Baumdiagramme? Beschreibe in einem Satz.', 'Die Wahrscheinlichkeit eines Ereignisses ist die Summe der Wahrscheinlichkeiten aller Pfade, die zu diesem Ereignis gehören.', 'Man addiert die Pfadwahrscheinlichkeiten aller passenden Pfade (die Pfadwahrscheinlichkeiten selbst bekommt man durch Multiplizieren entlang des Pfades).', { keywords: [['addier', 'summe', 'zusammenzaehl', 'plus']], d: 2 }),
]
