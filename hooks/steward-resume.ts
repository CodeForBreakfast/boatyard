import type { Register } from 'claude-code'

const STEWARD_SKILL = /(^|:)steward$/

const WAKE_RITUAL = [
  'This session was resumed, and you are a boatyard steward.',
  'commy came back bound, so `current_identity` cannot tell this resume from a compaction.',
  "Run the steward skill's whole wake ritual now: Reachable, then Reconstruct.",
].join(' ')

const stewardKey = (sessionId: string) => `steward/${sessionId}`

// A resumed session keeps its id, so the plugin's store says which sessions
// loaded the steward skill.
export const register: Register = (on) => {
  on('skill.prompt', async ($, e, next) => {
    if (e.pluginName === 'boatyard' && STEWARD_SKILL.test(e.skill)) {
      // ponytail: one key per steward session, never pruned, as compact-at-rest's opt-in.
      await $.store.set(stewardKey(await $.session.id()), true)
    }
    return next(e)
  })

  // A new process runs SessionStart before its REPL mounts, and the engine
  // refuses a prompt until then. An interactive session.start follows the mount.
  let resumedSteward = false

  on('classic.SessionStart', async ($, e, next) => {
    resumedSteward = e.source === 'resume' && (await $.store.get(stewardKey(e.session_id))) === true
    return next(e)
  })

  on('session.start', { isInteractive: true }, async ($, e, next) => {
    if (resumedSteward) {
      resumedSteward = false
      void $.prompt.submit({ text: WAKE_RITUAL })
    }
    return next(e)
  })
}
