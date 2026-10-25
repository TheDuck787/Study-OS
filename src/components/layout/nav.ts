import { BookOpen, CalendarClock, House, Layers, Library, ListChecks, MessagesSquare, RotateCcw, Settings, Sigma, TrendingUp, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  group: 'main' | 'learn' | 'organize'
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Heute', icon: House, group: 'main' },
  { to: '/faecher', label: 'Fächer', icon: BookOpen, group: 'main' },
  { to: '/quiz', label: 'Quiz', icon: ListChecks, group: 'learn' },
  { to: '/karteikarten', label: 'Karteikarten', icon: Layers, group: 'learn' },
  { to: '/mathe', label: 'Mathe', icon: Sigma, group: 'learn' },
  { to: '/tutor', label: 'Tutor', icon: MessagesSquare, group: 'learn' },
  { to: '/fehler', label: 'Fehler wiederholen', icon: RotateCcw, group: 'learn' },
  { to: '/pruefungen', label: 'Prüfungen', icon: CalendarClock, group: 'organize' },
  { to: '/bibliothek', label: 'Bibliothek', icon: Library, group: 'organize' },
  { to: '/fortschritt', label: 'Fortschritt', icon: TrendingUp, group: 'organize' },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings, group: 'organize' },
]

export const MOBILE_PRIMARY = ['/', '/faecher', '/quiz', '/karteikarten']
