export const SUBJECT_COLOR_COUNT = 10
export const subjectColorVar = (i: number) => `var(--s${((i % 10) + 10) % 10})`
