import {
  Atom, BookMarked, BookOpen, BookOpenCheck, Briefcase, Calculator, CalendarClock, ClipboardCheck, Code, Coffee, Dna, Dumbbell, FlaskConical,
  FolderKanban, Globe, GraduationCap, Landmark, Languages, Layers, Leaf, ListTodo, Music, NotebookPen, Palette, PenLine, Scale, School, Sigma,
  Sparkles, Tag, Theater, User, type LucideIcon,
} from 'lucide-react'
import type { EventCategory, Priority, TaskKind } from '@/db/types'

/** Kinds that appear in the calendar. Exams and tasks have their own stores but share the colour/icon system. */
export type ItemKind = EventCategory | 'exam' | 'homework' | 'project' | 'todo'

export interface KindMeta {
  label: string
  plural: string
  icon: LucideIcon
  /** CSS colour used when the entry has no subject. */
  color: string
  /** Counts as "Lernen" in filters and statistics. */
  study: boolean
  /** Occupies the student's time (planner keeps it free). */
  busy: boolean
}

export const KIND_META: Record<ItemKind, KindMeta> = {
  lesson: { label: 'Unterricht', plural: 'Unterricht', icon: School, color: 'var(--fg-subtle)', study: false, busy: true },
  exam: { label: 'Prüfung', plural: 'Prüfungen', icon: GraduationCap, color: 'var(--danger)', study: false, busy: true },
  homework: { label: 'Hausaufgabe', plural: 'Hausaufgaben', icon: NotebookPen, color: 'var(--warn)', study: false, busy: false },
  project: { label: 'Projekt-Abgabe', plural: 'Projekte', icon: FolderKanban, color: 'var(--s3)', study: false, busy: false },
  todo: { label: 'Aufgabe', plural: 'Aufgaben', icon: ListTodo, color: 'var(--fg-muted)', study: false, busy: false },
  study: { label: 'Lerneinheit', plural: 'Lerneinheiten', icon: BookOpenCheck, color: 'var(--accent)', study: true, busy: true },
  flashcards: { label: 'Karteikarten', plural: 'Karteikarten', icon: Layers, color: 'var(--s5)', study: true, busy: true },
  appointment: { label: 'Termin', plural: 'Termine', icon: User, color: 'var(--s6)', study: false, busy: true },
  internship: { label: 'Praktikum/Projekt', plural: 'Praktika & Projekte', icon: Briefcase, color: 'var(--s9)', study: false, busy: true },
  break: { label: 'Pause/Freizeit', plural: 'Freizeit', icon: Coffee, color: 'var(--s8)', study: false, busy: true },
  custom: { label: 'Eigener Typ', plural: 'Eigene Typen', icon: Tag, color: 'var(--s7)', study: false, busy: true },
}

export const EVENT_CATEGORIES: EventCategory[] = ['lesson', 'study', 'flashcards', 'appointment', 'internship', 'break', 'custom']
export const TASK_KINDS: TaskKind[] = ['homework', 'project', 'todo']
/** Order of the type picker in the editor. */
export const EDITOR_KINDS: ItemKind[] = ['lesson', 'exam', 'homework', 'project', 'study', 'flashcards', 'appointment', 'internship', 'break', 'todo', 'custom']

export const PRIORITY_META: Record<Priority, { label: string; short: string; rank: number }> = {
  high: { label: 'Hoch', short: 'hoch', rank: 0 },
  medium: { label: 'Mittel', short: 'mittel', rank: 1 },
  low: { label: 'Niedrig', short: 'niedrig', rank: 2 },
}

/** Icons the student can give a subject. */
export const SUBJECT_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  calculator: { label: 'Mathe', icon: Calculator },
  sigma: { label: 'Formeln', icon: Sigma },
  book: { label: 'Buch', icon: BookOpen },
  pen: { label: 'Schreiben', icon: PenLine },
  languages: { label: 'Sprachen', icon: Languages },
  flask: { label: 'Chemie', icon: FlaskConical },
  atom: { label: 'Physik', icon: Atom },
  dna: { label: 'Biologie', icon: Dna },
  leaf: { label: 'Natur', icon: Leaf },
  globe: { label: 'Erdkunde', icon: Globe },
  landmark: { label: 'Geschichte', icon: Landmark },
  scale: { label: 'Sozialkunde', icon: Scale },
  code: { label: 'Informatik', icon: Code },
  music: { label: 'Musik', icon: Music },
  palette: { label: 'Kunst', icon: Palette },
  theater: { label: 'Darstellendes Spiel', icon: Theater },
  dumbbell: { label: 'Sport', icon: Dumbbell },
  bookmarked: { label: 'Religion/Philosophie', icon: BookMarked },
  briefcase: { label: 'Arbeit/Wirtschaft', icon: Briefcase },
  sparkles: { label: 'Sonstiges', icon: Sparkles },
  clipboard: { label: 'Projekt', icon: ClipboardCheck },
  clock: { label: 'Termin', icon: CalendarClock },
}

/** Sensible default icon from the subject name (used until the student picks one). */
export function guessSubjectIcon(name: string): string {
  const n = name.toLowerCase()
  const rules: [RegExp, string][] = [
    [/mathe/, 'calculator'], [/deutsch/, 'pen'], [/englisch|franz|spanisch|latein|russisch|polnisch/, 'languages'], [/chemie/, 'flask'],
    [/physik/, 'atom'], [/bio/, 'dna'], [/geo|erdkunde/, 'globe'], [/geschichte/, 'landmark'], [/sozial|politik|gesellschaft/, 'scale'],
    [/informatik/, 'code'], [/musik/, 'music'], [/kunst/, 'palette'], [/sport/, 'dumbbell'], [/religion|philosoph|ethik/, 'bookmarked'],
    [/wirtschaft|arbeit|awt/, 'briefcase'], [/theater|darstell/, 'theater'],
  ]
  return rules.find(([re]) => re.test(n))?.[1] ?? 'book'
}

export const subjectIcon = (s: { icon?: string | null; name: string }): LucideIcon => SUBJECT_ICONS[s.icon ?? guessSubjectIcon(s.name)]?.icon ?? BookOpen

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Keine' },
  { value: 0, label: 'Zur Startzeit' },
  { value: 10, label: '10 Min. vorher' },
  { value: 30, label: '30 Min. vorher' },
  { value: 60, label: '1 Std. vorher' },
  { value: 24 * 60, label: '1 Tag vorher' },
  { value: 2 * 24 * 60, label: '2 Tage vorher' },
]
