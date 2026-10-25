// Domain model for Study OS. All records live in IndexedDB (see db/index.ts).
// The Supabase migration in supabase/migrations mirrors these shapes.

export type ID = string
/** ISO 8601 timestamp, e.g. 2026-10-25T14:03:00.000Z */
export type ISODate = string
/** Local calendar day, YYYY-MM-DD */
export type DayKey = string

export type ExplanationMode = 'simple' | 'normal' | 'detailed' | 'examples' | 'steps'
export type Difficulty = 1 | 2 | 3 | 4
export type ThemePref = 'dark' | 'light' | 'system'

export interface Profile {
  id: 'me'
  name: string
  grade: number
  schoolType: string
  region: string
  dailyGoalMinutes: number
  /** Learning days per week the student aims for (rest days are fine). */
  weeklyGoalDays: number
  explanationMode: ExplanationMode
  quizDifficulty: Difficulty | 'adaptive'
  gradingScaleId: ID
  /** Weekdays (0 = Sunday … 6 = Saturday) that are planned rest days; they never break a streak. */
  restDays: number[]
  /** Optional break (illness, holidays): days up to and including this day never break a streak. */
  pausedUntil: DayKey | null
  notifications: {
    enabled: boolean
    reminderTime: string // HH:MM
    examReminders: boolean
  }
  createdAt: ISODate
  updatedAt: ISODate
}

export interface Subject {
  id: ID
  name: string
  /** Index into the subject color palette (see lib/colors.ts). */
  color: number
  /** Key of a subject icon (see lib/calendar/icons.tsx); optional. */
  icon?: string | null
  order: number
  createdAt: ISODate
}

export type CurriculumStatus = 'example-unverified' | 'own'

export interface Topic {
  id: ID
  subjectId: ID
  parentId: ID | null
  name: string
  description: string
  order: number
  /** Topics that should be understood before this one. */
  prerequisiteIds: ID[]
  curriculum: CurriculumStatus
  createdAt: ISODate
}

export interface Note {
  id: ID
  subjectId: ID | null
  topicId: ID | null
  title: string
  /** Markdown, may contain $math$. */
  content: string
  tags: string[]
  sourceMaterialId: ID | null
  createdAt: ISODate
  updatedAt: ISODate
}

export type ExtractionStatus = 'complete' | 'partial' | 'failed' | 'unsupported'
export type ExtractionMethod = 'pdf-text' | 'pdf-ocr' | 'image-ocr' | 'ai-vision' | 'plain-text' | 'paste'

export interface MaterialSection {
  heading: string
  level: number
  text: string
}

export interface Material {
  id: ID
  subjectId: ID | null
  topicId: ID | null
  title: string
  fileName: string | null
  mimeType: string
  size: number
  text: string
  sections: MaterialSection[]
  extraction: {
    status: ExtractionStatus
    method: ExtractionMethod
    pages?: number
    pagesWithText?: number
    /** Human readable German warnings shown to the student. */
    warnings: string[]
  }
  summary: string
  /** Where the summary came from – important so the student knows what to trust. */
  summarySource: 'none' | 'extractive' | 'ai'
  tags: string[]
  hasBlob: boolean
  createdAt: ISODate
}

export interface MaterialBlob {
  id: ID // same as Material.id
  blob: Blob
}

export interface Deck {
  id: ID
  subjectId: ID | null
  topicId: ID | null
  name: string
  description: string
  /** BCP-47 language of the front side, used for pronunciation (e.g. en-GB). */
  frontLang: string | null
  backLang: string | null
  createdAt: ISODate
}

export type CardState = 'new' | 'learning' | 'review'
export type CardRating = 'again' | 'hard' | 'good' | 'easy'

export interface SrsState {
  state: CardState
  due: ISODate
  intervalDays: number
  ease: number
  reps: number
  lapses: number
  lastReviewed: ISODate | null
}

export interface Card {
  id: ID
  deckId: ID
  topicId: ID | null
  front: string
  back: string
  example: string
  tags: string[]
  srs: SrsState
  sourceMaterialId: ID | null
  createdAt: ISODate
  updatedAt: ISODate
}

export interface CardReview {
  id: ID
  cardId: ID
  deckId: ID
  rating: CardRating
  at: ISODate
  wasDue: boolean
  intervalBefore: number
  intervalAfter: number
}

export type QuestionType = 'mc' | 'tf' | 'text' | 'numeric' | 'math' | 'vocab'
export type QuestionSource = 'library' | 'user' | 'generator' | 'material' | 'ai'

export interface Question {
  id: ID
  subjectId: ID
  topicId: ID
  type: QuestionType
  prompt: string
  /** mc: answer options */
  options?: string[]
  /** mc: index of correct option */
  correctIndex?: number
  /** mc: why each option is wrong/right (same length as options) – used to explain misconceptions. */
  optionFeedback?: string[]
  /** tf: correct value */
  correctBool?: boolean
  /** Canonical answer (text, number or math expression). */
  answer: string
  acceptedAnswers?: string[]
  /** text: every group must be matched by at least one of its alternatives (case-insensitive). */
  keywords?: string[][]
  unit?: string
  /** numeric: allowed absolute deviation */
  tolerance?: number
  /** math: only when the task itself asks for a form (e.g. "kürze", "multipliziere aus"). */
  requireForm?: 'simplified-fraction' | 'expanded' | 'factored' | 'simplified'
  explanation: string
  hints: string[]
  steps?: string[]
  difficulty: Difficulty
  points: number
  source: QuestionSource
  sourceMaterialId?: ID | null
  /** For generated math questions: which skill produced it (used for weak-skill practice). */
  skill?: string
  /** Enables "Rechenweg prüfen": the student's steps are checked line by line. */
  stepCheck?: { kind: 'equation'; variable: string; solutions: number[]; equation?: string } | { kind: 'expression'; original: string }
  tags?: string[]
  createdAt: ISODate
}

export type AttemptKind = 'practice' | 'exam' | 'quick' | 'diagnostic' | 'mock' | 'mistakes' | 'math'

export interface QuizAttempt {
  id: ID
  kind: AttemptKind
  mode: 'practice' | 'exam'
  title: string
  subjectId: ID | null
  topicIds: ID[]
  questionIds: ID[]
  /** Questions are frozen into the attempt so later edits don't change history. */
  questionSnapshots: Question[]
  startedAt: ISODate
  finishedAt: ISODate | null
  score: number
  maxScore: number
  percent: number
  gradingScaleId: ID
  estimatedGrade: number | null
  examId: ID | null
  planSessionId: ID | null
  durationSec: number
  /** Optional time limit (mock exams). */
  timeLimitMin?: number
  /** Exam mode: answers typed so far, saved continuously so closing the tab loses nothing. */
  draftAnswers?: Record<string, string>
}

export interface Answer {
  id: ID
  attemptId: ID
  questionId: ID
  subjectId: ID
  topicId: ID
  given: string
  correct: boolean
  /** 0..1 – partial credit is possible (e.g. half points). */
  score: number
  at: ISODate
  hintsUsed: number
  timeMs: number
  mode: 'practice' | 'exam'
  /** True if the student judged a free-text answer themselves. */
  selfAssessed: boolean
  feedback: string
  /** Machine-readable error category, e.g. 'sign-error' – used for recurring-mistake analysis. */
  errorTag: string | null
}

export type PlanSessionType = 'diagnostic' | 'learn' | 'practice' | 'review' | 'mock' | 'analysis' | 'final'

export interface PlanSession {
  id: ID
  date: DayKey
  type: PlanSessionType
  title: string
  description: string
  topicIds: ID[]
  minutes: number
  done: boolean
  doneAt: ISODate | null
  attemptId: ID | null
  /** Start time HH:MM, assigned by the planner or the student (null = no fixed time). */
  start?: string | null
  /** Set when the student moved/edited the session by hand – the planner never moves it again. */
  pinned?: boolean
}

export type ExamType = 'Klassenarbeit' | 'Test' | 'Vokabeltest' | 'Präsentation' | 'Sonstiges'

export interface Exam {
  id: ID
  subjectId: ID
  title: string
  type: ExamType
  date: DayKey
  topicIds: ID[]
  materialIds: ID[]
  /** 1 = eher leicht, 2 = mittel, 3 = schwer (self-estimate) */
  difficulty: 1 | 2 | 3
  minutesPerDay: number
  availableWeekdays: number[]
  notes: string
  plan: PlanSession[]
  planWarnings: string[]
  planGeneratedAt: ISODate | null
  gradingScaleId: ID | null
  /** Optional time and room (HH:MM). */
  startTime?: string | null
  endTime?: string | null
  location?: string
  /** Self-assessed confidence per topic, 1 (unsicher) … 5 (sehr sicher). Shown next to – never mixed with – measured mastery. */
  topicConfidence?: Record<ID, number>
  /** Student's own estimate of the total preparation time in minutes. */
  estimatedPrepMinutes?: number | null
  createdAt: ISODate
}

export interface GradeThreshold {
  grade: 1 | 2 | 3 | 4 | 5 | 6
  minPercent: number
}

export interface GradingScale {
  id: ID
  name: string
  description: string
  thresholds: GradeThreshold[]
  /** Show + / − tendencies inside a grade band. */
  tendencies: boolean
  builtin: boolean
}

/** A grade the teacher actually gave – never mixed with estimates. */
export interface TeacherGrade {
  id: ID
  subjectId: ID
  examId: ID | null
  title: string
  /** e.g. "2-" or "3" */
  grade: string
  date: DayKey
  note: string
  createdAt: ISODate
}

export type ActivityKind = 'quiz' | 'flashcards' | 'math' | 'tutor' | 'plan'

export interface StudySession {
  id: ID
  day: DayKey
  startedAt: ISODate
  durationSec: number
  activity: ActivityKind
  subjectId: ID | null
  /** Number of answered questions / reviewed cards. */
  items: number
  refId: ID | null
}

export interface XpEvent {
  id: ID
  at: ISODate
  day: DayKey
  amount: number
  reason: string
  refId: ID | null
}

export interface AchievementUnlock {
  id: string // achievement key
  unlockedAt: ISODate
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  at: ISODate
  /** Provider that produced an assistant message, for transparency. */
  provider?: string
}

export interface TutorChat {
  id: ID
  subjectId: ID | null
  topicId: ID | null
  title: string
  mode: ExplanationMode
  materialIds: ID[]
  messages: ChatMessage[]
  createdAt: ISODate
  updatedAt: ISODate
}

export interface MetaEntry {
  key: string
  value: unknown
}

// ───────────────────────── Calendar & planner ─────────────────────────

/** Built-in entry types. Exams live in `exams`, homework/projects in `tasks`; everything else in `events`. */
export type EventCategory = 'lesson' | 'study' | 'flashcards' | 'appointment' | 'internship' | 'break' | 'custom'
export type Priority = 'low' | 'medium' | 'high'
export type EventStatus = 'planned' | 'done' | 'cancelled'

export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
}

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly'
  /** Every n days/weeks/months (weekly + interval 2 = every other week). */
  interval: number
  /** weekly: weekdays 0 (So) … 6 (Sa); empty = weekday of the start date. */
  byWeekday: number[]
  until: DayKey | null
  count: number | null
  /** Occurrence dates that were deleted or replaced by a separate event. */
  exceptions: DayKey[]
}

export interface CalendarEvent {
  id: ID
  title: string
  category: EventCategory
  /** Only for category "custom". */
  customCategoryId: ID | null
  subjectId: ID | null
  /** First (or only) day. */
  date: DayKey
  /** Last day for multi-day all-day entries (internship, trip); null = same day. */
  endDate: DayKey | null
  allDay: boolean
  /** HH:MM, null when allDay. */
  start: string | null
  end: string | null
  priority: Priority
  status: EventStatus
  description: string
  location: string
  teacher: string
  topicIds: ID[]
  materialIds: ID[]
  deckId: ID | null
  /** Work session for a task (homework, project). */
  taskId: ID | null
  /** Study block that belongs to an exam (besides the exam's own plan). */
  examId: ID | null
  workloadMinutes: number | null
  /** Minutes before start; null = no reminder. */
  reminderMinutes: number | null
  checklist: ChecklistItem[]
  recurrence: Recurrence | null
  /** Recurring entries: occurrence dates marked as done. */
  completedDates: DayKey[]
  /** Separate event that replaces one occurrence of a series. */
  seriesId: ID | null
  originalDate: DayKey | null
  /** "planner" entries may be replaced by the planner; "manual" ones never. */
  source: 'manual' | 'planner'
  /** Planner entries the student moved by hand are kept on re-planning. */
  pinned: boolean
  /** Unavailable for studying (e.g. internship day, family event) even if all-day. */
  blocksStudy: boolean
  createdAt: ISODate
  updatedAt: ISODate
}

export interface EventCustomCategory {
  id: ID
  name: string
  color: number
  createdAt: ISODate
}

export type TaskKind = 'homework' | 'project' | 'todo'

export interface Task {
  id: ID
  title: string
  description: string
  kind: TaskKind
  subjectId: ID | null
  topicIds: ID[]
  materialId: ID | null
  dueDate: DayKey | null
  dueTime: string | null
  priority: Priority
  estimateMinutes: number | null
  status: 'open' | 'done'
  doneAt: ISODate | null
  subtasks: ChecklistItem[]
  reminderMinutes: number | null
  createdAt: ISODate
  updatedAt: ISODate
}

export interface TimeWindow {
  from: string
  to: string
}

export interface PlannerSettings {
  /** Study windows per weekday (index 0 = Sunday); null = no studying that day. */
  windows: (TimeWindow | null)[]
  /** School hours per weekday – shaded in the week view. */
  school: (TimeWindow | null)[]
  maxDailyMinutes: number
  sessionMaxMinutes: number
  breakMinutes: number
  /** Gap kept free around lessons and appointments. */
  bufferMinutes: number
  horizonDays: number
  includeFlashcards: boolean
}
