import { MATHE } from './mathe'
import { DEUTSCH, ENGLISCH } from './sprachen'
import { BIOLOGIE, CHEMIE, PHYSIK } from './naturwiss'
import { GEOGRAFIE, GESCHICHTE, SOZIALKUNDE } from './gesellschaft'
import type { LibQuestion } from './helpers'

export const ALL_LIBRARY_QUESTIONS: LibQuestion[] = [
  ...MATHE, ...DEUTSCH, ...ENGLISCH, ...BIOLOGIE, ...CHEMIE, ...PHYSIK, ...GEOGRAFIE, ...GESCHICHTE, ...SOZIALKUNDE,
]
