import Dexie, { type Table } from 'dexie'
import type {
  AchievementUnlock, Answer, CalendarEvent, Card, CardReview, Deck, EventCustomCategory, Exam, GradingScale, Material, MaterialBlob,
  MetaEntry, Note, Profile, Question, QuizAttempt, StudySession, Subject, Task, TeacherGrade, Topic, TutorChat, XpEvent,
} from './types'

export class StudyDB extends Dexie {
  profile!: Table<Profile, string>
  subjects!: Table<Subject, string>
  topics!: Table<Topic, string>
  notes!: Table<Note, string>
  materials!: Table<Material, string>
  materialBlobs!: Table<MaterialBlob, string>
  decks!: Table<Deck, string>
  cards!: Table<Card, string>
  cardReviews!: Table<CardReview, string>
  questions!: Table<Question, string>
  attempts!: Table<QuizAttempt, string>
  answers!: Table<Answer, string>
  exams!: Table<Exam, string>
  gradingScales!: Table<GradingScale, string>
  teacherGrades!: Table<TeacherGrade, string>
  sessions!: Table<StudySession, string>
  xpEvents!: Table<XpEvent, string>
  achievements!: Table<AchievementUnlock, string>
  tutorChats!: Table<TutorChat, string>
  meta!: Table<MetaEntry, string>
  events!: Table<CalendarEvent, string>
  tasks!: Table<Task, string>
  eventCategories!: Table<EventCustomCategory, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      profile: 'id',
      subjects: 'id, order',
      topics: 'id, subjectId, parentId, order',
      notes: 'id, subjectId, topicId, updatedAt, *tags',
      materials: 'id, subjectId, topicId, createdAt, *tags',
      materialBlobs: 'id',
      decks: 'id, subjectId, topicId',
      cards: 'id, deckId, topicId, srs.due',
      cardReviews: 'id, cardId, deckId, at',
      questions: 'id, subjectId, topicId, type, source, skill',
      attempts: 'id, subjectId, startedAt, finishedAt, examId, kind',
      answers: 'id, attemptId, questionId, topicId, subjectId, at',
      exams: 'id, subjectId, date',
      gradingScales: 'id',
      teacherGrades: 'id, subjectId, date',
      sessions: 'id, day, activity, subjectId',
      xpEvents: 'id, day, at',
      achievements: 'id',
      tutorChats: 'id, subjectId, updatedAt',
      meta: 'key',
    })
    // v2: calendar & planner. Only new tables – existing rows need no migration.
    this.version(2).stores({
      events: 'id, date, category, subjectId, taskId, examId, seriesId, source',
      tasks: 'id, status, dueDate, subjectId, kind',
      eventCategories: 'id',
    })
  }

  /** All data tables in a stable order (used for export/import/reset). */
  get dataTables(): Table<{ id?: string; key?: string }, string>[] {
    return [
      this.profile, this.subjects, this.topics, this.notes, this.materials, this.decks, this.cards, this.cardReviews,
      this.questions, this.attempts, this.answers, this.exams, this.gradingScales, this.teacherGrades, this.sessions,
      this.xpEvents, this.achievements, this.tutorChats, this.meta, this.events, this.tasks, this.eventCategories,
    ] as unknown as Table<{ id?: string; key?: string }, string>[]
  }
}

export type DbKind = 'main' | 'demo'
const ACTIVE_KEY = 'studyos.activeDb'
export const DB_NAMES: Record<DbKind, string> = { main: 'studyos-main', demo: 'studyos-demo' }

function readActiveKind(): DbKind {
  try {
    return localStorage.getItem(ACTIVE_KEY) === 'demo' ? 'demo' : 'main'
  } catch {
    return 'main'
  }
}

/**
 * Real learning data and demo data live in two separate IndexedDB databases,
 * so exploring the demo can never mix fake history into the student's real progress.
 */
export let activeKind: DbKind = typeof window === 'undefined' ? 'main' : readActiveKind()
export let db = new StudyDB(DB_NAMES[activeKind])

export function switchDatabase(kind: DbKind, reload = true) {
  try {
    localStorage.setItem(ACTIVE_KEY, kind)
  } catch {
    /* storage blocked – switching still works for this page load */
  }
  if (reload && typeof location !== 'undefined') {
    location.hash = '#/'
    location.reload()
  } else {
    db.close()
    activeKind = kind
    db = new StudyDB(DB_NAMES[kind])
  }
}

/** For tests: use an isolated database. */
export function useTestDatabase(name: string) {
  db = new StudyDB(name)
  activeKind = 'main'
  return db
}

/** Checks whether IndexedDB is usable at all (private mode in some browsers blocks it). */
export async function checkStorage(): Promise<{ ok: boolean; persisted: boolean | null; error?: string }> {
  try {
    await db.open()
    let persisted: boolean | null = null
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) persisted = await navigator.storage.persisted()
    return { ok: true, persisted }
  } catch (e) {
    return { ok: false, persisted: null, error: e instanceof Error ? e.message : String(e) }
  }
}
