import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { ConfirmProvider, LoadingBlock, Notice, ToastProvider } from './components/ui'
import { AppShell } from './components/layout/AppShell'
import { activeKind, checkStorage } from './db/index'
import { ensureGradingScales, getMeta } from './db/repo'
import { useProfile } from './hooks/data'
import { Dashboard } from './features/dashboard/Dashboard'
import { Onboarding } from './features/onboarding/Onboarding'
import { CloudProvider } from './features/account/CloudProvider'

const SubjectsPage = lazy(() => import('./features/subjects/SubjectsPage'))
const SubjectWorkspace = lazy(() => import('./features/subjects/SubjectWorkspace'))
const TopicPage = lazy(() => import('./features/subjects/TopicPage'))
const QuizHome = lazy(() => import('./features/quiz/QuizHome'))
const QuizSetup = lazy(() => import('./features/quiz/QuizSetup'))
const QuizRunner = lazy(() => import('./features/quiz/QuizRunner'))
const DecksPage = lazy(() => import('./features/flashcards/DecksPage'))
const DeckPage = lazy(() => import('./features/flashcards/DeckPage'))
const ReviewSession = lazy(() => import('./features/flashcards/ReviewSession'))
const MathMode = lazy(() => import('./features/math/MathMode'))
const TutorPage = lazy(() => import('./features/tutor/TutorPage'))
const ExamsPage = lazy(() => import('./features/exams/ExamsPage'))
const ExamDetail = lazy(() => import('./features/exams/ExamDetail'))
const LibraryPage = lazy(() => import('./features/library/LibraryPage'))
const NotePage = lazy(() => import('./features/notes/NotePage'))
const MaterialPage = lazy(() => import('./features/library/MaterialPage'))
const ImportPage = lazy(() => import('./features/library/ImportPage'))
const ProgressPage = lazy(() => import('./features/progress/ProgressPage'))
const MistakesPage = lazy(() => import('./features/mistakes/MistakesPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage'))
const MyDayPage = lazy(() => import('./features/calendar/MyDayPage'))
const WeekPlanPage = lazy(() => import('./features/calendar/WeekPlanPage'))
const TasksPage = lazy(() => import('./features/tasks/TasksPage'))
const TimetablePage = lazy(() => import('./features/timetable/TimetablePage'))

/** Runs once per page load – React StrictMode mounts effects twice, so the work must not run twice (demo seeding is not idempotent). */
let bootPromise: Promise<void> | null = null
function boot(onStep: (step: string) => void): Promise<void> {
  bootPromise ??= (async () => {
    const st = await checkStorage()
    if (!st.ok) throw new Error(`storage:${st.error}`)
    await ensureGradingScales()
    if (activeKind === 'demo' && !(await getMeta('demoSeededAt'))) {
      onStep('Demo-Daten werden erstellt …')
      const { seedDemo } = await import('./db/demo')
      await seedDemo()
    }
  })()
  return bootPromise
}

function Bootstrap({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; error?: string; step?: string }>({ status: 'loading' })
  useEffect(() => {
    boot((step) => setState({ status: 'loading', step }))
      .then(() => setState({ status: 'ready' }))
      .catch((e) => setState({ status: 'error', error: e instanceof Error ? e.message.replace(/^storage:/, '') : String(e) }))
  }, [])
  if (state.status === 'loading') return <LoadingBlock label={state.step ?? 'Study OS wird geladen …'} />
  if (state.status === 'error')
    return (
      <div className="mx-auto max-w-lg p-6">
        <Notice tone="danger" icon={AlertTriangle} title="Daten können nicht gespeichert werden">
          Dein Browser blockiert den lokalen Speicher (IndexedDB) – das passiert z. B. im privaten Modus. Öffne Study OS in einem normalen Fenster. Technische Meldung: {state.error}
        </Notice>
      </div>
    )
  return <>{children}</>
}

function Gate({ children }: { children: ReactNode }) {
  const profile = useProfile()
  const location = useLocation()
  if (profile === undefined) return <LoadingBlock />
  if (!profile && activeKind === 'main' && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ConfirmProvider>
          <Bootstrap>
            <CloudProvider>
            <Gate>
              <Routes>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route
                  path="*"
                  element={
                    <AppShell>
                      <Suspense fallback={<LoadingBlock />}>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/faecher" element={<SubjectsPage />} />
                          <Route path="/faecher/:subjectId" element={<SubjectWorkspace />} />
                          <Route path="/faecher/:subjectId/themen/:topicId" element={<TopicPage />} />
                          <Route path="/quiz" element={<QuizHome />} />
                          <Route path="/quiz/neu" element={<QuizSetup />} />
                          <Route path="/quiz/:attemptId" element={<QuizRunner />} />
                          <Route path="/karteikarten" element={<DecksPage />} />
                          <Route path="/karteikarten/lernen" element={<ReviewSession />} />
                          <Route path="/karteikarten/:deckId" element={<DeckPage />} />
                          <Route path="/karteikarten/:deckId/lernen" element={<ReviewSession />} />
                          <Route path="/mathe" element={<MathMode />} />
                          <Route path="/tutor" element={<TutorPage />} />
                          <Route path="/pruefungen" element={<ExamsPage />} />
                          <Route path="/pruefungen/:examId" element={<ExamDetail />} />
                          <Route path="/bibliothek" element={<LibraryPage />} />
                          <Route path="/bibliothek/import" element={<ImportPage />} />
                          <Route path="/bibliothek/notiz/:noteId" element={<NotePage />} />
                          <Route path="/bibliothek/material/:materialId" element={<MaterialPage />} />
                          <Route path="/fortschritt" element={<ProgressPage />} />
                          <Route path="/fehler" element={<MistakesPage />} />
                          <Route path="/einstellungen" element={<SettingsPage />} />
                          <Route path="/kalender" element={<CalendarPage />} />
                          <Route path="/mein-tag" element={<MyDayPage />} />
                          <Route path="/wochenplanung" element={<WeekPlanPage />} />
                          <Route path="/aufgaben" element={<TasksPage />} />
                          <Route path="/stundenplan" element={<TimetablePage />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </AppShell>
                  }
                />
              </Routes>
            </Gate>
            </CloudProvider>
          </Bootstrap>
        </ConfirmProvider>
      </ToastProvider>
    </HashRouter>
  )
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Seite nicht gefunden</h1>
      <p className="mt-2 text-fg-muted">Diese Adresse gibt es in Study OS nicht.</p>
      <a href="#/" className="mt-4 inline-block text-accent underline">
        Zur Startseite
      </a>
    </div>
  )
}
