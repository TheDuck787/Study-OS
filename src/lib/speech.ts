/** Pronunciation via the browser's speech synthesis (no network). */
export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function hasVoiceFor(lang: string): boolean {
  if (!speechAvailable()) return false
  const voices = window.speechSynthesis.getVoices()
  // Voices load asynchronously in some browsers; an empty list means "unknown", so allow trying.
  return voices.length === 0 || voices.some((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
}

export function speak(text: string, lang: string) {
  if (!speechAvailable()) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, ''))
  u.lang = lang
  u.rate = 0.9
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()))
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
  return true
}
