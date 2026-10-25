import { describe, expect, it } from 'vitest'
import { generateStudyPlan, orderTopics, type PlanTopic } from '@/lib/studyplan'
import { diffDays } from '@/lib/dates'

const topics: PlanTopic[] = [
  { id: 'a', name: 'Potenzen', mastery: 0.8, level: 'solid', prerequisiteIds: [] },
  { id: 'b', name: 'Wurzeln', mastery: 0.2, level: 'struggling', prerequisiteIds: ['a'] },
  { id: 'c', name: 'Pythagoras', mastery: 0.0, level: 'new', prerequisiteIds: ['b'] },
  { id: 'd', name: 'Prozent', mastery: 0.4, level: 'practicing', prerequisiteIds: [] },
]
const allDays = [0, 1, 2, 3, 4, 5, 6]

describe('orderTopics', () => {
  it('puts prerequisites before dependent topics', () => {
    const ids = orderTopics(topics).map((t) => t.id)
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'))
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'))
  })
})

describe('generateStudyPlan', () => {
  it('contains all phases in a sensible order with enough time', () => {
    const { sessions, warnings } = generateStudyPlan({ today: '2026-11-02', examDate: '2026-11-16', topics, minutesPerDay: 40, availableWeekdays: allDays, difficulty: 2 })
    const types = sessions.map((s) => s.type)
    for (const t of ['diagnostic', 'learn', 'practice', 'review', 'mock', 'analysis', 'final']) expect(types).toContain(t)
    const first = sessions[0]
    expect(first.type).toBe('diagnostic')
    expect(first.date).toBe('2026-11-02')
    const final = sessions.find((s) => s.type === 'final')!
    expect(final.date).toBe('2026-11-15')
    const mock = sessions.find((s) => s.type === 'mock')!
    expect(diffDays(mock.date, '2026-11-16')).toBeGreaterThanOrEqual(2)
    // no session on/after exam day, per-day minutes respected
    expect(sessions.every((s) => s.date < '2026-11-16')).toBe(true)
    const perDay = new Map<string, number>()
    for (const s of sessions) perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.minutes)
    expect([...perDay.values()].every((m) => m <= 40)).toBe(true)
    expect(warnings.filter((w) => w.includes('reicht nicht'))).toHaveLength(0)
  })
  it('learns weak topics before the mock exam', () => {
    const { sessions } = generateStudyPlan({ today: '2026-11-02', examDate: '2026-11-16', topics, minutesPerDay: 40, availableWeekdays: allDays, difficulty: 2 })
    const mock = sessions.find((s) => s.type === 'mock')!
    const learnC = sessions.find((s) => s.type === 'learn' && s.topicIds[0] === 'c')!
    expect(learnC.date < mock.date).toBe(true)
  })
  it('respects available weekdays', () => {
    const { sessions } = generateStudyPlan({ today: '2026-11-02', examDate: '2026-11-16', topics, minutesPerDay: 30, availableWeekdays: [1, 3, 5], difficulty: 2 })
    for (const s of sessions) expect([1, 3, 5]).toContain(new Date(s.date + 'T12:00').getDay())
  })
  it('warns and prioritises when time is short', () => {
    const { sessions, warnings } = generateStudyPlan({ today: '2026-11-13', examDate: '2026-11-16', topics, minutesPerDay: 20, availableWeekdays: allDays, difficulty: 3 })
    expect(warnings.some((w) => w.includes('reicht nicht'))).toBe(true)
    expect(sessions.some((s) => s.type === 'final')).toBe(true)
  })
  it('handles exam today and past dates', () => {
    expect(generateStudyPlan({ today: '2026-11-16', examDate: '2026-11-16', topics, minutesPerDay: 30, availableWeekdays: allDays, difficulty: 2 }).sessions).toHaveLength(0)
    expect(generateStudyPlan({ today: '2026-11-17', examDate: '2026-11-16', topics, minutesPerDay: 30, availableWeekdays: allDays, difficulty: 2 }).warnings[0]).toMatch(/Vergangenheit/)
  })
  it('keeps done sessions and does not repeat a done diagnostic when re-planning', () => {
    const first = generateStudyPlan({ today: '2026-11-02', examDate: '2026-11-16', topics, minutesPerDay: 40, availableWeekdays: allDays, difficulty: 2 })
    const diag = { ...first.sessions[0], done: true, doneAt: '2026-11-02T10:00:00Z' }
    const re = generateStudyPlan({ today: '2026-11-03', examDate: '2026-11-16', topics, minutesPerDay: 40, availableWeekdays: allDays, difficulty: 2, keep: [diag] })
    expect(re.sessions.filter((s) => s.type === 'diagnostic')).toHaveLength(1)
    expect(re.sessions[0].id).toBe(diag.id)
  })
})
