import type { Register } from 'claude-code'
import { register as compactAtRest } from './compact-at-rest.ts'
import { register as stewardResume } from './steward-resume.ts'

export const register: Register = (on, options) => {
  compactAtRest(on, options)
  stewardResume(on, options)
}
