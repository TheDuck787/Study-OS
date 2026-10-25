import { BookOpen, CalendarClock, CalendarDays, ClipboardList, House, Layers, Library, ListChecks, ListTodo, MessagesSquare, RotateCcw, Settings, Sigma, Sun, TrendingUp, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  group: 'main' | 'learn' | 'organize'
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Heute', icon: House, group: 'main' },
  { to: '/mein-tag', label: 'Mein Tag', icon: Sun, group: 'main' },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays, group: 'main' },
  { to: '/aufgaben', label: 'Aufgaben', icon: ListTodo, group: 'main' },
  { to: '/faecher', label: 'Fächer', icon: BookOpen, group: 'main' },
  { to: '/quiz', label: 'Quiz', icon: ListChecks, group: 'learn' },
  { to: '/karteikarten', label: 'Karteikarten', icon: Layers, group: 'learn' },
  { to: '/mathe', label: 'Mathe', icon: Sigma, group: 'learn' },
  { to: '/tutor', label: 'Tutor', icon: MessagesSquare, group: 'learn' },
  { to: '/fehler', label: 'Fehler wiederholen', icon: RotateCcw, group: 'learn' },
  { to: '/pruefungen', label: 'Prüfungen', icon: CalendarClock, group: 'organize' },
  { to: '/wochenplanung', label: 'Wochenplanung', icon: ClipboardList, group: 'organize' },
  { to: '/bibliothek', label: 'Bibliothek', icon: Library, group: 'organize' },
  { to: '/fortschritt', label: 'Fortschritt', icon: TrendingUp, group: 'organize' },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings, group: 'organize' },
]

export const MOBILE_PRIMARY = ['/', '/kalender', '/aufgaben', '/faecher']
