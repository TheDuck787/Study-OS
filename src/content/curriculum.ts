/**
 * Example curriculum for grade 9 (Gesamtschule, Mecklenburg-Vorpommern).
 *
 * IMPORTANT: This list was written from general knowledge of typical grade-9 content.
 * It has NOT been checked against the official Rahmenpläne of Mecklenburg-Vorpommern.
 * Every topic is therefore seeded with curriculum = 'example-unverified' and labelled in the UI.
 * Students can edit, rename, reorder and delete everything.
 */
export interface CurriculumTopic {
  key: string
  name: string
  description: string
  prereq?: string[]
  children?: CurriculumTopic[]
}

export interface CurriculumSubject {
  key: string
  name: string
  color: number
  topics: CurriculumTopic[]
}

export const CURRICULUM_NOTICE =
  'Beispiel-Lehrplan: Diese Themen sind typische Inhalte der 9. Klasse, wurden aber NICHT mit den offiziellen Rahmenplänen von Mecklenburg-Vorpommern abgeglichen. Bitte mit dem Unterricht vergleichen und anpassen.'

export const CURRICULUM: CurriculumSubject[] = [
  {
    key: 'ma',
    name: 'Mathematik',
    color: 0,
    topics: [
      { key: 'ma-brueche', name: 'Bruchrechnung (Wiederholung)', description: 'Kürzen, Erweitern, Addieren, Multiplizieren und Dividieren von Brüchen.' },
      { key: 'ma-terme', name: 'Terme und binomische Formeln', description: 'Terme vereinfachen, ausmultiplizieren, ausklammern; die drei binomischen Formeln.', prereq: ['ma-brueche'] },
      { key: 'ma-gleichungen', name: 'Lineare Gleichungen', description: 'Gleichungen durch Äquivalenzumformungen lösen, Probe machen.', prereq: ['ma-terme'] },
      { key: 'ma-linfkt', name: 'Lineare Funktionen', description: 'Steigung, y-Achsenabschnitt, Funktionsgleichung y = mx + n, Graphen zeichnen.', prereq: ['ma-gleichungen'] },
      { key: 'ma-lgs', name: 'Lineare Gleichungssysteme', description: 'Zwei Gleichungen mit zwei Variablen: Gleichsetzungs-, Einsetzungs- und Additionsverfahren.', prereq: ['ma-gleichungen', 'ma-linfkt'] },
      { key: 'ma-potenzen', name: 'Potenzen und Wurzeln', description: 'Potenzgesetze, Quadratwurzeln, Zehnerpotenzen und wissenschaftliche Schreibweise.', prereq: ['ma-brueche'] },
      { key: 'ma-pythagoras', name: 'Satz des Pythagoras', description: 'a² + b² = c² im rechtwinkligen Dreieck, Seitenlängen berechnen, Anwendungen.', prereq: ['ma-potenzen', 'ma-gleichungen'] },
      { key: 'ma-quadfkt', name: 'Quadratische Funktionen', description: 'Normalparabel, Scheitelpunktform, Verschieben und Strecken von Parabeln.', prereq: ['ma-linfkt', 'ma-terme'] },
      { key: 'ma-quadgl', name: 'Quadratische Gleichungen', description: 'Lösen mit Wurzelziehen, Faktorisieren und der p-q-Formel.', prereq: ['ma-quadfkt', 'ma-potenzen'] },
      { key: 'ma-prozent', name: 'Prozent- und Zinsrechnung', description: 'Grundwert, Prozentwert, Prozentsatz; Zinsen, Zinseszins, prozentuale Änderungen.', prereq: ['ma-brueche'] },
      { key: 'ma-koerper', name: 'Körperberechnung', description: 'Volumen und Oberfläche von Prisma und Zylinder.', prereq: ['ma-pythagoras'] },
      { key: 'ma-wkeit', name: 'Wahrscheinlichkeitsrechnung', description: 'Mehrstufige Zufallsexperimente, Baumdiagramme, Pfadregeln.', prereq: ['ma-brueche'] },
    ],
  },
  {
    key: 'de',
    name: 'Deutsch',
    color: 1,
    topics: [
      { key: 'de-eroerterung', name: 'Erörterung', description: 'Lineare und dialektische Erörterung: These, Argument, Beleg, Beispiel; Aufbau und Schluss.' },
      { key: 'de-sachtext', name: 'Sachtexte analysieren', description: 'Thema, Intention, Aufbau, sprachliche Mittel; Textsorten unterscheiden.' },
      { key: 'de-kurzgeschichte', name: 'Kurzgeschichten interpretieren', description: 'Merkmale der Kurzgeschichte, Figuren, Erzählperspektive, Deutungshypothese.' },
      { key: 'de-lyrik', name: 'Gedichte und Stilmittel', description: 'Metrum, Reimschema, rhetorische Stilmittel erkennen und deuten.' },
      { key: 'de-konjunktiv', name: 'Konjunktiv und indirekte Rede', description: 'Konjunktiv I für indirekte Rede, Konjunktiv II als Ersatzform und für Irreales.' },
      { key: 'de-satzbau', name: 'Satzglieder und Nebensätze', description: 'Satzglieder bestimmen, Haupt- und Nebensatz, Relativ- und Konjunktionalsätze.' },
      { key: 'de-komma', name: 'Kommasetzung und das/dass', description: 'Kommaregeln bei Nebensätzen, Aufzählungen, Infinitivgruppen; „das“ oder „dass“.', prereq: ['de-satzbau'] },
      { key: 'de-bewerbung', name: 'Bewerbung und Lebenslauf', description: 'Bewerbungsanschreiben und tabellarischen Lebenslauf für ein Praktikum verfassen.' },
    ],
  },
  {
    key: 'en',
    name: 'Englisch',
    color: 2,
    topics: [
      { key: 'en-tenses', name: 'Tenses: past and present perfect', description: 'Simple past, present perfect, past progressive – when to use which.' },
      { key: 'en-conditionals', name: 'Conditional sentences (if-clauses)', description: 'Type I, II and III: form and meaning.', prereq: ['en-tenses'] },
      { key: 'en-passive', name: 'Passive voice', description: 'Passive in different tenses, by-agent.', prereq: ['en-tenses'] },
      { key: 'en-reported', name: 'Reported speech', description: 'Backshift of tenses, changes of time and place words.', prereq: ['en-tenses'] },
      { key: 'en-relative', name: 'Relative clauses', description: 'who, which, that, whose; defining and non-defining clauses.' },
      { key: 'en-gerund', name: 'Gerund and infinitive', description: 'Verbs followed by -ing or to-infinitive.' },
      { key: 'en-vocab-jobs', name: 'Vocabulary: Jobs and the future', description: 'Wortschatz rund um Berufe, Bewerbung und Zukunftspläne.' },
      { key: 'en-vocab-env', name: 'Vocabulary: Environment', description: 'Wortschatz zu Umwelt, Klima und Nachhaltigkeit.' },
      { key: 'en-writing', name: 'Writing: formal emails', description: 'Aufbau formeller E-Mails und Briefe, typische Wendungen.' },
    ],
  },
  {
    key: 'bio',
    name: 'Biologie',
    color: 3,
    topics: [
      { key: 'bio-zelle', name: 'Zelle und Zellorganellen', description: 'Aufbau von Tier- und Pflanzenzelle, Aufgaben der Organellen.' },
      { key: 'bio-stoffwechsel', name: 'Fotosynthese und Zellatmung', description: 'Energieumwandlung in Pflanzen und Tieren, Wortgleichungen.', prereq: ['bio-zelle'] },
      { key: 'bio-nerven', name: 'Nervensystem und Sinnesorgane', description: 'Reiz-Reaktions-Schema, Nervenzelle, Reflexe, Auge und Ohr.', prereq: ['bio-zelle'] },
      { key: 'bio-hormone', name: 'Hormone', description: 'Hormondrüsen, Regelkreis, Blutzuckerregulation mit Insulin und Glukagon, Diabetes.', prereq: ['bio-nerven'] },
      { key: 'bio-immun', name: 'Immunsystem', description: 'Krankheitserreger, unspezifische und spezifische Abwehr, Impfung.', prereq: ['bio-zelle'] },
      { key: 'bio-genetik', name: 'Genetik', description: 'DNA, Chromosomen, Mitose, Mendelsche Regeln.', prereq: ['bio-zelle'] },
      { key: 'bio-oekologie', name: 'Ökologie', description: 'Ökosysteme, Nahrungsketten, biotische und abiotische Faktoren.' },
    ],
  },
  {
    key: 'ch',
    name: 'Chemie',
    color: 4,
    topics: [
      { key: 'ch-reaktion', name: 'Chemische Reaktion', description: 'Merkmale chemischer Reaktionen, Gesetz von der Erhaltung der Masse, Reaktionsgleichungen.' },
      { key: 'ch-atombau', name: 'Atombau und Periodensystem', description: 'Kern-Hülle-Modell, Protonen, Neutronen, Elektronen, Schalenmodell, Hauptgruppen.' },
      { key: 'ch-ionen', name: 'Ionenbindung und Salze', description: 'Ionenbildung, Edelgaskonfiguration, Eigenschaften von Salzen.', prereq: ['ch-atombau'] },
      { key: 'ch-elektronenpaar', name: 'Elektronenpaarbindung', description: 'Moleküle, Lewis-Schreibweise, polare Bindung, Wasser als Dipol.', prereq: ['ch-atombau'] },
      { key: 'ch-saeuren', name: 'Säuren und Basen', description: 'pH-Wert, Indikatoren, Neutralisation, typische Säuren und Laugen.', prereq: ['ch-ionen'] },
      { key: 'ch-redox', name: 'Metalle und Redoxreaktionen', description: 'Oxidation und Reduktion als Elektronenübertragung, Redoxreihe.', prereq: ['ch-reaktion', 'ch-ionen'] },
    ],
  },
  {
    key: 'ph',
    name: 'Physik',
    color: 5,
    topics: [
      { key: 'ph-stromkreis', name: 'Elektrischer Stromkreis', description: 'Stromstärke, Spannung, Messgeräte, Schaltzeichen.' },
      { key: 'ph-ohm', name: 'Widerstand und Ohmsches Gesetz', description: 'R = U / I, Kennlinien, Abhängigkeiten des Widerstands.', prereq: ['ph-stromkreis'] },
      { key: 'ph-schaltungen', name: 'Reihen- und Parallelschaltung', description: 'Gesetze für Strom, Spannung und Widerstand in beiden Schaltungen.', prereq: ['ph-ohm'] },
      { key: 'ph-leistung', name: 'Elektrische Energie und Leistung', description: 'P = U · I, E = P · t, Stromkosten berechnen.', prereq: ['ph-ohm'] },
      { key: 'ph-mechanik', name: 'Kraft, Arbeit und Energie', description: 'Newtonsche Gesetze, Hubarbeit, Energieerhaltung, Leistung.' },
      { key: 'ph-kern', name: 'Radioaktivität', description: 'Atomkern, Alpha-, Beta-, Gammastrahlung, Halbwertszeit, Strahlenschutz.' },
    ],
  },
  {
    key: 'geo',
    name: 'Geografie',
    color: 6,
    topics: [
      { key: 'geo-klima', name: 'Klima und Klimawandel', description: 'Treibhauseffekt, Ursachen und Folgen des Klimawandels, Klimadiagramme.' },
      { key: 'geo-global', name: 'Globalisierung', description: 'Weltweite Verflechtung von Wirtschaft, Handel und Kommunikation.' },
      { key: 'geo-bevoelkerung', name: 'Bevölkerung und Migration', description: 'Bevölkerungsentwicklung, Bevölkerungspyramiden, Push- und Pull-Faktoren.' },
      { key: 'geo-europa', name: 'Europa und die EU', description: 'Länder, Wirtschaftsräume, Aufgaben der Europäischen Union.' },
      { key: 'geo-ressourcen', name: 'Ressourcen und Nachhaltigkeit', description: 'Erneuerbare und fossile Energieträger, nachhaltige Entwicklung.', prereq: ['geo-klima'] },
    ],
  },
  {
    key: 'ge',
    name: 'Geschichte',
    color: 7,
    topics: [
      { key: 'ge-wk1', name: 'Erster Weltkrieg', description: 'Ursachen, Verlauf, Folgen und Versailler Vertrag.' },
      { key: 'ge-weimar', name: 'Weimarer Republik', description: 'Novemberrevolution, Verfassung, Krisenjahre 1923, „Goldene Zwanziger“, Weltwirtschaftskrise.', prereq: ['ge-wk1'] },
      { key: 'ge-ns', name: 'Nationalsozialismus', description: 'Machtübernahme 1933, Gleichschaltung, Ideologie, Verfolgung, Holocaust.', prereq: ['ge-weimar'] },
      { key: 'ge-wk2', name: 'Zweiter Weltkrieg', description: 'Kriegsbeginn 1939, Verlauf, Vernichtungskrieg, Kriegsende 1945.', prereq: ['ge-ns'] },
      { key: 'ge-teilung', name: 'Nachkriegszeit und Teilung Deutschlands', description: 'Besatzungszonen, Gründung von BRD und DDR 1949, Kalter Krieg.', prereq: ['ge-wk2'] },
    ],
  },
  {
    key: 'sk',
    name: 'Sozialkunde',
    color: 8,
    topics: [
      { key: 'sk-grundrechte', name: 'Grundgesetz und Grundrechte', description: 'Menschenwürde, Freiheitsrechte, Gleichheitsrechte.' },
      { key: 'sk-demokratie', name: 'Demokratie und Wahlen', description: 'Wahlgrundsätze, Parteien, Erst- und Zweitstimme.', prereq: ['sk-grundrechte'] },
      { key: 'sk-staat', name: 'Staatsorgane und Föderalismus', description: 'Bundestag, Bundesrat, Bundesregierung, Bundespräsident, Bundesverfassungsgericht, Länder.', prereq: ['sk-demokratie'] },
    ],
  },
]

export function flattenTopics(topics: CurriculumTopic[], parent: string | null = null): (CurriculumTopic & { parent: string | null })[] {
  return topics.flatMap((t) => [{ ...t, parent }, ...flattenTopics(t.children ?? [], t.key)])
}
