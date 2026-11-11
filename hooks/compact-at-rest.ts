import type { EngineInterface, PluginOptions, Register } from 'claude-code'

const WHOLE_NUMBER = /^\d+$/

// A launcher sets BOATYARD_COMPACT_THRESHOLD in a session's environment to opt
// that session in. A whole number gives the session its own threshold over the
// plugin setting, and an empty value keeps the plugin setting. Undefined means
// the session has not opted in.
//
// A resumed session runs in a new process that may not have the launcher's
// environment, so the value is kept in the plugin's store under the session's
// id, and a session without the variable takes the value kept for its id.
async function sessionOverride($: EngineInterface): Promise<string | undefined> {
  const key = `opt-in/${await $.session.id()}`
  const launched = await $.env.get('BOATYARD_COMPACT_THRESHOLD')
  const kept = (await $.store.get(key)) as string | undefined
  if (launched === undefined) return kept
  // ponytail: one key per opted-in session, never pruned. The store holds
  // 4 MiB, tens of thousands of sessions. Prune by age if a host gets there.
  if (launched !== kept) await $.store.set(key, launched)
  return launched
}

function thresholdFor($: EngineInterface, override: string | undefined, options: PluginOptions): number {
  if (override === undefined || override === '') return Number(options.compactThreshold)
  if (WHOLE_NUMBER.test(override)) return Number(override)
  $.ui.log(`BOATYARD_COMPACT_THRESHOLD=${override} is not a whole number, so the plugin setting stands.`)
  return Number(options.compactThreshold)
}

// Free context before Claude Code's own auto-compact, as a whole percentage
// of the space usable before it. Undefined until the session's first
// response, and again straight after a compact.
async function freeBeforeAutoCompact($: EngineInterface): Promise<number | undefined> {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const { tokens, breakdown } = context
  if (tokens === undefined || breakdown === undefined) return undefined
  const usable = breakdown.autoCompactThreshold ?? breakdown.rawMaxTokens
  return Math.floor((100 * (usable - tokens)) / usable)
}

export const register: Register = (on, options) => {
  // A session can be resumed before its first turn ends.
  on('session.start', async ($, e, next) => {
    if (e.surface !== null) await sessionOverride($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const answered = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return answered
    // The engine refuses a compact in a -p or SDK session, which draws nowhere.
    if ((await $.session.surfaces()).length === 0) return answered

    const override = await sessionOverride($)
    if (options.compactAtRest !== true && override === undefined) return answered

    const free = await freeBeforeAutoCompact($)
    if (free !== undefined && free < thresholdFor($, override, options)) {
      await $.session.compact()
    }
    return answered
  })
}
