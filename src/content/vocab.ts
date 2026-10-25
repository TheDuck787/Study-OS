/** Example vocabulary decks (English → German) for grade 9. Students can edit or delete them. */
export interface VocabDeck {
  key: string
  name: string
  description: string
  subject: string // curriculum subject key
  topic: string // curriculum topic key
  frontLang: string
  backLang: string
  cards: [front: string, back: string, example: string][]
}

export const VOCAB_DECKS: VocabDeck[] = [
  {
    key: 'deck-en-jobs',
    name: 'Englisch: Jobs and the future',
    description: 'Wortschatz zu Berufen, Bewerbung und Zukunftsplänen.',
    subject: 'en',
    topic: 'en-vocab-jobs',
    frontLang: 'en-GB',
    backLang: 'de-DE',
    cards: [
      ['job interview', 'das Vorstellungsgespräch', 'I have a job interview at a bank tomorrow.'],
      ['to apply for', 'sich bewerben um', 'She applied for a work placement at the hospital.'],
      ['application', 'die Bewerbung', 'Please send your application by email.'],
      ['work experience / work placement', 'das Praktikum', 'In year 9 we do two weeks of work experience.'],
      ['employer', 'der Arbeitgeber', 'My employer gave me a day off.'],
      ['employee', 'der Arbeitnehmer; der Angestellte', 'The company has 200 employees.'],
      ['salary', 'das Gehalt', 'Nurses should earn a higher salary.'],
      ['skill', 'die Fähigkeit; die Fertigkeit', 'Communication is an important skill.'],
      ['reliable', 'zuverlässig', 'Employers want reliable staff.'],
      ['to be good at', 'gut sein in', 'I am good at maths and fixing things.'],
      ['apprenticeship', 'die Ausbildung; die Lehre', 'He started an apprenticeship as an electrician.'],
      ['qualification', 'die Qualifikation; der Abschluss', 'You need good qualifications for this job.'],
      ['career', 'die Laufbahn; die Karriere', 'She wants a career in IT.'],
      ['to earn', 'verdienen', 'How much do you earn per hour?'],
      ['part-time job', 'der Nebenjob; die Teilzeitstelle', 'I have a part-time job in a café.'],
      ['full-time', 'Vollzeit', 'My mum works full-time.'],
      ['CV (curriculum vitae)', 'der Lebenslauf', 'Don’t forget to attach your CV.'],
      ['to be responsible for', 'verantwortlich sein für', 'I was responsible for the till.'],
      ['to improve', '(sich) verbessern', 'I want to improve my English.'],
      ['opportunity', 'die Gelegenheit; die Chance', 'This is a great opportunity.'],
      ['to look forward to', 'sich freuen auf', 'I look forward to hearing from you.'],
      ['colleague', 'der Kollege; die Kollegin', 'My colleagues are very friendly.'],
    ],
  },
  {
    key: 'deck-en-env',
    name: 'Englisch: Environment',
    description: 'Wortschatz zu Umwelt, Klima und Nachhaltigkeit.',
    subject: 'en',
    topic: 'en-vocab-env',
    frontLang: 'en-GB',
    backLang: 'de-DE',
    cards: [
      ['environment', 'die Umwelt', 'We must protect the environment.'],
      ['climate change', 'der Klimawandel', 'Climate change affects everybody.'],
      ['pollution', 'die Verschmutzung', 'Air pollution is a big problem in cities.'],
      ['to pollute', 'verschmutzen', 'Factories pollute rivers.'],
      ['renewable energy', 'erneuerbare Energie', 'Wind and solar power are renewable energy.'],
      ['to reduce', 'verringern; reduzieren', 'We should reduce plastic waste.'],
      ['to recycle', 'recyceln; wiederverwerten', 'We recycle paper and glass.'],
      ['waste', 'der Abfall; der Müll', 'Too much food goes to waste.'],
      ['greenhouse gas', 'das Treibhausgas', 'CO₂ is a greenhouse gas.'],
      ['sustainable', 'nachhaltig', 'Buy sustainable products.'],
      ['drought', 'die Dürre', 'The drought destroyed the harvest.'],
      ['flood', 'die Überschwemmung; die Flut', 'The flood damaged many houses.'],
      ['species', 'die Art (Tierart, Pflanzenart)', 'Many species are endangered.'],
      ['endangered', 'gefährdet; vom Aussterben bedroht', 'Polar bears are endangered.'],
      ['to save energy', 'Energie sparen', 'Switch off the lights to save energy.'],
      ['fossil fuels', 'fossile Brennstoffe', 'Coal, oil and gas are fossil fuels.'],
      ['carbon footprint', 'der CO₂-Fußabdruck', 'Flying increases your carbon footprint.'],
      ['to protect', 'schützen', 'Laws protect the forest.'],
      ['rubbish', 'der Müll (BE)', 'Put the rubbish in the bin.'],
      ['to throw away', 'wegwerfen', 'Don’t throw away old clothes – donate them.'],
    ],
  },
]
