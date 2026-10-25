import { mc, tf, txt, type LibQuestion } from './helpers'

export const DEUTSCH: LibQuestion[] = [
  // Erörterung
  mc('de-er-1', 'de-eroerterung', 'Was gehört zu einem vollständigen Argument?', ['Nur eine Behauptung', 'Behauptung, Begründung und Beispiel/Beleg', 'Eine Frage an den Leser', 'Eine Zusammenfassung des Themas'], 1, 'Ein überzeugendes Argument besteht aus Behauptung (These), Begründung und einem Beispiel oder Beleg (B-B-B).', { fb: ['Eine Behauptung allein überzeugt niemanden – es fehlt das „Warum“.', 'Richtig.', 'Eine rhetorische Frage kann helfen, ersetzt aber kein Argument.', 'Die Zusammenfassung gehört in den Schluss.'], d: 1 }),
  mc('de-er-2', 'de-eroerterung', 'Was unterscheidet die dialektische (Pro-Kontra-)Erörterung von der linearen?', ['Sie hat keine Einleitung.', 'Sie wägt Argumente für und gegen eine Frage ab.', 'Sie enthält nur Argumente für eine Seite.', 'Sie ist kürzer.'], 1, 'Die lineare Erörterung verfolgt nur eine Richtung. Die dialektische stellt Pro und Kontra gegenüber und endet mit einer begründeten eigenen Position.', { fb: ['Beide Formen haben Einleitung, Hauptteil und Schluss.', 'Richtig.', 'Das beschreibt die lineare (steigernde) Erörterung.', 'Die Länge ist kein Unterscheidungsmerkmal.'] }),
  tf('de-er-3', 'de-eroerterung', 'Wahr oder falsch: In einer Erörterung ordnet man die Argumente meist so, dass das stärkste Argument am Ende steht.', true, 'Wahr: Die Steigerung vom schwächsten zum stärksten Argument wirkt am überzeugendsten (Sanduhr- bzw. Steigerungsprinzip).'),
  txt('de-er-4', 'de-eroerterung', 'Was gehört in den Schluss einer dialektischen Erörterung?', 'Eine eigene, begründete Meinung bzw. ein Fazit, das sich auf die Argumente bezieht.', 'Im Schluss ziehst du ein Fazit: Du nimmst begründet Stellung und kannst einen Ausblick oder Kompromiss formulieren.', { keywords: [['meinung', 'stellung', 'fazit', 'position', 'urteil', 'standpunkt']] }),

  // Sachtexte
  mc('de-sa-1', 'de-sachtext', 'Was ist die Intention eines Textes?', ['Die Anzahl der Absätze', 'Die Absicht, die der Autor mit dem Text verfolgt', 'Die Überschrift', 'Der Erscheinungsort'], 1, 'Die Intention ist die Absicht des Verfassers: informieren, überzeugen, appellieren oder unterhalten.', { d: 1 }),
  mc('de-sa-2', 'de-sachtext', 'Welche Textsorte will vor allem meinungsbildend wirken?', ['Nachricht', 'Kommentar', 'Bericht', 'Lexikonartikel'], 1, 'Der Kommentar enthält die Meinung des Autors und will überzeugen. Nachricht, Bericht und Lexikonartikel informieren möglichst sachlich.', { fb: ['Eine Nachricht informiert kurz und sachlich (W-Fragen).', 'Richtig.', 'Ein Bericht informiert ausführlicher, aber sachlich.', 'Ein Lexikonartikel ist neutral und informierend.'] }),
  txt('de-sa-3', 'de-sachtext', 'Nenne die fünf wichtigsten Angaben, die in den Einleitungssatz einer Sachtextanalyse gehören.', 'Textsorte, Titel, Autor, Erscheinungsdatum/-ort und Thema', 'Einleitungssatz: Textsorte, Titel, Autor/in, Quelle mit Datum und das Thema in einem Satz.', { keywords: [['textsorte', 'textart'], ['titel', 'ueberschrift'], ['autor', 'verfasser'], ['datum', 'erschien', 'quelle', 'jahr'], ['thema']], d: 2 }),

  // Kurzgeschichte
  mc('de-kg-1', 'de-kurzgeschichte', 'Welches Merkmal ist typisch für eine Kurzgeschichte?', ['Ausführliche Einleitung mit Vorgeschichte', 'Unvermittelter Anfang und offenes Ende', 'Viele Haupthandlungen', 'Ein Erzähler, der direkt die Moral nennt'], 1, 'Kurzgeschichten beginnen meist mitten im Geschehen und enden offen – der Leser soll selbst weiterdenken.', { fb: ['Gerade die fehlt meist: Man wird direkt ins Geschehen geworfen.', 'Richtig.', 'Kurzgeschichten konzentrieren sich auf eine Situation.', 'Die Deutung bleibt dem Leser überlassen – das ist eher typisch für Fabeln.'], d: 1 }),
  mc('de-kg-2', 'de-kurzgeschichte', '„Sie spürte, wie ihr Herz raste, und fragte sich, ob er es bemerkte.“ Welche Erzählperspektive liegt vor?', ['Ich-Erzähler', 'Personaler Erzähler', 'Auktorialer Erzähler', 'Neutraler Erzähler'], 1, 'Erzählt wird in der 3. Person, aber aus der Innensicht einer Figur (ihre Gefühle und Gedanken) – das ist personales Erzählen.', { fb: ['Dann stünde „ich“ statt „sie“.', 'Richtig.', 'Ein auktorialer Erzähler wüsste auch, was „er“ denkt, und kommentiert oft.', 'Ein neutraler Erzähler würde keine Gefühle von innen schildern.'], d: 3 }),
  txt('de-kg-3', 'de-kurzgeschichte', 'Was ist eine Deutungshypothese?', 'Eine erste begründete Vermutung darüber, was der Text aussagen will.', 'Die Deutungshypothese ist eine vorläufige Annahme zur Aussage des Textes, die du im Hauptteil am Text überprüfst.', { keywords: [['vermutung', 'annahme', 'these', 'vorlaeufig'], ['aussage', 'bedeutung', 'botschaft', 'sagen', 'deut']] }),

  // Lyrik
  mc('de-ly-1', 'de-lyrik', 'Welches Reimschema hat ein Kreuzreim?', ['aabb', 'abab', 'abba', 'aaaa'], 1, 'Kreuzreim: abab. Paarreim: aabb. Umarmender Reim: abba.', { fb: ['aabb ist der Paarreim.', 'Richtig.', 'abba ist der umarmende Reim.', 'aaaa wäre ein durchgehender Reim.'], d: 1 }),
  mc('de-ly-2', 'de-lyrik', '„Das Leben ist eine Achterbahn.“ Welches Stilmittel ist das?', ['Vergleich', 'Metapher', 'Personifikation', 'Alliteration'], 1, 'Metapher: ein bildhafter Ausdruck ohne „wie“. Mit „wie“ (Das Leben ist wie eine Achterbahn) wäre es ein Vergleich.', { fb: ['Ein Vergleich hätte ein Vergleichswort wie „wie“ oder „als“.', 'Richtig.', 'Bei einer Personifikation bekommen Dinge menschliche Eigenschaften.', 'Alliteration bedeutet gleiche Anfangslaute (z. B. „Milch macht müde Männer munter“).'], d: 2 }),
  mc('de-ly-3', 'de-lyrik', '„Der Wind flüsterte durch die Bäume.“ Welches Stilmittel liegt vor?', ['Personifikation', 'Hyperbel', 'Anapher', 'Ironie'], 0, 'Der Wind bekommt eine menschliche Fähigkeit (flüstern) – das ist eine Personifikation.', { d: 1 }),
  tf('de-ly-4', 'de-lyrik', 'Wahr oder falsch: Eine Anapher ist die Wiederholung desselben Wortes am Anfang aufeinanderfolgender Verse oder Sätze.', true, 'Wahr. Beispiel: „Wer reitet so spät … / Wer hört …“', { d: 2 }),

  // Konjunktiv
  mc('de-ko-1', 'de-konjunktiv', 'Wie lautet die indirekte Rede? Tom sagt: „Ich habe keine Zeit.“', ['Tom sagt, er hat keine Zeit.', 'Tom sagt, er habe keine Zeit.', 'Tom sagt, ich hätte keine Zeit.', 'Tom sagt, er hätte keine Zeit gehabt.'], 1, 'In der indirekten Rede steht der Konjunktiv I: „er habe“. Das Pronomen wechselt von „ich“ zu „er“.', { fb: ['Das ist Indikativ – in der Schriftsprache verwendet man Konjunktiv I.', 'Richtig.', 'Das Pronomen muss aus Sicht des Berichtenden angepasst werden: „er“.', 'Das verändert die Zeit: Tom spricht über die Gegenwart.'], d: 2 }),
  mc('de-ko-2', 'de-konjunktiv', 'Die Schüler sagen: „Wir haben Hunger.“ Welche indirekte Rede ist richtig?', ['Die Schüler sagen, sie haben Hunger.', 'Die Schüler sagen, sie hätten Hunger.', 'Die Schüler sagen, wir hätten Hunger.', 'Die Schüler sagen, sie habe Hunger.'], 1, 'Konjunktiv I „sie haben“ sieht genauso aus wie der Indikativ. Dann nimmt man die Ersatzform Konjunktiv II: „sie hätten“.', { fb: ['„sie haben“ ist nicht vom Indikativ zu unterscheiden – deshalb Ersatzform.', 'Richtig.', 'Das Pronomen muss zu „sie“ werden.', '„habe“ passt zur 3. Person Singular, hier ist Plural gemeint.'], d: 3 }),
  txt('de-ko-3', 'de-konjunktiv', 'Bilde den Konjunktiv II von „gehen“ in der 1. Person Singular (ich …).', 'ginge', '„ich ginge“ (Konjunktiv II). Umgangssprachlich auch „ich würde gehen“.', { accepted: ['ich ginge', 'würde gehen', 'ich würde gehen'], d: 2 }),

  // Satzbau
  mc('de-sb-1', 'de-satzbau', '„Am Morgen schenkt die Lehrerin den Kindern Bücher.“ Was ist „den Kindern“?', ['Subjekt', 'Akkusativobjekt', 'Dativobjekt', 'Adverbiale Bestimmung'], 2, 'Frage: „Wem schenkt die Lehrerin Bücher?“ – den Kindern. Wem-Frage → Dativobjekt.', { fb: ['Das Subjekt fragst du mit „Wer?“ – das ist „die Lehrerin“.', 'Nach dem Akkusativobjekt fragst du mit „Wen oder was?“ – das sind die „Bücher“.', 'Richtig.', '„Am Morgen“ ist die adverbiale Bestimmung der Zeit.'], d: 2 }),
  mc('de-sb-2', 'de-satzbau', 'Welcher Satz enthält einen Relativsatz?', ['Ich bleibe zu Hause, weil es regnet.', 'Das Buch, das du mir geliehen hast, ist spannend.', 'Ich weiß, dass du recht hast.', 'Er lacht und sie weint.'], 1, 'Ein Relativsatz bezieht sich auf ein Nomen und wird mit einem Relativpronomen (der, die, das, welcher …) eingeleitet: „das Buch, das …“.', { fb: ['„weil“ leitet einen Kausalsatz (Konjunktionalsatz) ein.', 'Richtig.', '„dass“ ist eine Konjunktion – das ist ein dass-Satz, kein Relativsatz.', 'Das sind zwei Hauptsätze.'], d: 2 }),
  tf('de-sb-3', 'de-satzbau', 'Wahr oder falsch: Im Nebensatz steht das gebeugte Verb normalerweise am Ende.', true, 'Wahr: „…, weil ich heute keine Zeit habe.“ Das ist ein gutes Erkennungsmerkmal für Nebensätze.', { d: 1 }),

  // Komma / das-dass
  mc('de-km-1', 'de-komma', 'Welches Wort passt? „Ich hoffe, ___ du morgen kommst.“', ['das', 'dass'], 1, '„dass“ ist eine Konjunktion und leitet hier einen Nebensatz ein. Test: Man kann „das“ nicht durch „dieses“ oder „welches“ ersetzen.', { fb: ['Ersatzprobe: „Ich hoffe, welches du morgen kommst“ – ergibt keinen Sinn, also „dass“.', 'Richtig.'], d: 1 }),
  mc('de-km-2', 'de-komma', 'Welches Wort passt? „Das Fahrrad, ___ dort steht, gehört mir.“', ['das', 'dass'], 0, 'Hier ist „das“ ein Relativpronomen und lässt sich durch „welches“ ersetzen: „Das Fahrrad, welches dort steht …“', { fb: ['Richtig.', 'Ersatzprobe: „welches dort steht“ funktioniert – also „das“ mit einem s.'], d: 1 }),
  mc('de-km-3', 'de-komma', 'Welcher Satz ist richtig geschrieben?', ['Ich glaube dass es regnet.', 'Ich glaube, dass es regnet.', 'Ich glaube, dass, es regnet.', 'Ich, glaube dass es regnet.'], 1, 'Vor „dass“ steht ein Komma, weil ein Nebensatz beginnt. Haupt- und Nebensatz werden durch Komma getrennt.', { d: 1 }),
  tf('de-km-4', 'de-komma', 'Wahr oder falsch: Vor „und“ steht bei einer einfachen Aufzählung (Äpfel, Birnen und Kirschen) ein Komma.', false, 'Falsch: Bei Aufzählungen ersetzt „und“ das Komma. Also: „Äpfel, Birnen und Kirschen“.', { d: 1 }),

  // Bewerbung
  mc('de-bw-1', 'de-bewerbung', 'Welche Grußformel ist im Bewerbungsanschreiben üblich?', ['Liebe Grüße', 'Mit freundlichen Grüßen', 'Bis bald', 'Hochachtungsvoll und herzlich'], 1, '„Mit freundlichen Grüßen“ ist die Standardformel – ohne Komma danach.', { d: 1 }),
  txt('de-bw-2', 'de-bewerbung', 'Nenne drei Bestandteile eines tabellarischen Lebenslaufs.', 'Persönliche Daten, Schulbildung, Praktika/Erfahrungen, Kenntnisse, Interessen, Datum und Unterschrift', 'Typisch: persönliche Daten, Schulbildung, Praktika, besondere Kenntnisse (z. B. Sprachen, PC), Hobbys/Interessen, Ort/Datum/Unterschrift.', { keywords: [['persoenlich', 'name', 'adresse', 'geburt'], ['schul', 'bildung'], ['praktik', 'kenntnis', 'interess', 'hobby', 'erfahrung', 'faehigkeit', 'sprach']] }),
]

export const ENGLISCH: LibQuestion[] = [
  // Tenses
  mc('en-te-1', 'en-tenses', 'Choose the correct form: “I ___ to London last year.”', ['have been', 'went', 'go', 'have gone'], 1, '“last year” is a finished time in the past → simple past: went.', { fb: ['Present perfect cannot be used with a finished time like “last year”.', 'Richtig.', 'That is present tense.', 'Present perfect + “last year” is not possible.'], d: 1, hints: ['Signalwort: last year'] }),
  mc('en-te-2', 'en-tenses', 'Choose the correct form: “She ___ her homework yet.”', ["didn't finish", "hasn't finished", "doesn't finish", "wasn't finishing"], 1, '“yet” is a signal word for the present perfect: has(n’t) + past participle.', { fb: ['Simple past does not go with “yet”.', 'Richtig.', 'Simple present does not fit “yet”.', 'Past progressive describes an action in progress in the past.'], d: 2 }),
  mc('en-te-3', 'en-tenses', 'Choose the correct form: “While I ___ TV, the phone rang.”', ['watched', 'was watching', 'have watched', 'watch'], 1, 'Past progressive for an action that was in progress when something else happened (simple past).', { d: 2 }),
  tf('en-te-4', 'en-tenses', 'True or false: “since” is used with a point in time (since 2020), “for” with a period of time (for three years).', true, 'True: since + Zeitpunkt, for + Zeitraum.', { d: 1 }),
  txt('en-te-5', 'en-tenses', 'Write the past participle of “write”.', 'written', 'write – wrote – written', { d: 1 }),

  // Conditionals
  mc('en-co-1', 'en-conditionals', '“If it rains tomorrow, we ___ at home.”', ['stay', 'will stay', 'would stay', 'would have stayed'], 1, 'Conditional type I (real possibility): if + simple present, will + infinitive.', { fb: ['In the main clause of type I we need “will”.', 'Richtig.', '“would” is type II (unlikely/imagined).', 'That is type III (past, unreal).'], d: 1 }),
  mc('en-co-2', 'en-conditionals', '“If I ___ rich, I would travel around the world.”', ['am', 'were', 'will be', 'had been'], 1, 'Type II (imagined situation): if + simple past (with “to be” often “were” for all persons), would + infinitive.', { d: 2 }),
  mc('en-co-3', 'en-conditionals', '“If you had studied, you ___ the test.”', ['would pass', 'will pass', 'would have passed', 'passed'], 2, 'Type III (unreal past): if + past perfect, would have + past participle.', { d: 3 }),
  tf('en-co-4', 'en-conditionals', 'True or false: In an if-clause of type I you use “will”: “If he will come, …”', false, 'False: no “will” in the if-clause. Correct: “If he comes, …”', { d: 2 }),

  // Passive
  mc('en-pa-1', 'en-passive', 'Passive: “People speak English all over the world.”', ['English is spoken all over the world.', 'English was spoken all over the world.', 'English speaks all over the world.', 'English is speaking all over the world.'], 0, 'Simple present passive: am/is/are + past participle → is spoken.', { fb: ['Richtig.', 'The active sentence is in the present, so the passive must be present too.', 'Without “be” + past participle it is not passive.', 'That is present progressive active.'], d: 1 }),
  mc('en-pa-2', 'en-passive', 'Passive: “Somebody stole my bike yesterday.”', ['My bike is stolen yesterday.', 'My bike was stolen yesterday.', 'My bike has been stolen yesterday.', 'My bike stole yesterday.'], 1, 'Simple past passive: was/were + past participle.', { d: 2 }),
  txt('en-pa-3', 'en-passive', 'Complete with the passive: “The new school ___ (build) next year.” (future)', 'will be built', 'Future passive: will be + past participle.', { accepted: ['is going to be built'], d: 3 }),

  // Reported speech
  mc('en-rs-1', 'en-reported', 'She said: “I am tired.” → She said that she ___ tired.', ['is', 'was', 'has been', 'will be'], 1, 'Backshift: simple present (am) → simple past (was) when the reporting verb is in the past.', { d: 1 }),
  mc('en-rs-2', 'en-reported', 'Tom said: “I will call you tomorrow.” → Tom said that he ___ me the next day.', ['will call', 'would call', 'called', 'calls'], 1, 'will → would; tomorrow → the next day.', { d: 2 }),
  mc('en-rs-3', 'en-reported', 'Which time word fits reported speech? “now” becomes …', ['then', 'ago', 'tomorrow', 'yet'], 0, 'now → then; here → there; today → that day; yesterday → the day before.', { d: 2 }),

  // Relative
  mc('en-re-1', 'en-relative', 'The girl ___ lives next door is my friend.', ['which', 'who', 'whose', 'where'], 1, '“who” for people, “which” for things; “that” is possible for both in defining clauses.', { d: 1 }),
  mc('en-re-2', 'en-relative', 'That’s the man ___ car was stolen.', ['who', 'which', 'whose', 'whom'], 2, '“whose” shows possession: the man’s car → whose car.', { d: 2 }),

  // Gerund
  mc('en-ge-1', 'en-gerund', 'I enjoy ___ in the sea.', ['to swim', 'swimming', 'swim', 'swam'], 1, '“enjoy” is followed by the gerund (-ing).', { d: 1 }),
  mc('en-ge-2', 'en-gerund', 'We decided ___ a new car.', ['buying', 'to buy', 'buy', 'bought'], 1, '“decide” is followed by the to-infinitive.', { d: 2 }),

  // Writing
  mc('en-wr-1', 'en-writing', 'How do you end a formal email that starts with “Dear Mr Smith”?', ['Love,', 'Yours sincerely,', 'Cheers,', 'See you!'], 1, 'If you know the name: “Yours sincerely” (BE). If you don’t know the name (“Dear Sir or Madam”): “Yours faithfully”.', { d: 1 }),
  tf('en-wr-2', 'en-writing', 'True or false: Contractions like “I’m” or “don’t” are typical of formal letters.', false, 'False: Formal writing uses full forms (I am, do not).', { d: 1 }),
]
