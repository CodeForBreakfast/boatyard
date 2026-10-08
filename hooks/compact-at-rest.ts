import type { EngineInterface, PluginOptions, Register } from 'claude-code'

const WHOLE_NUMBER = /^\d+$/

// A launcher sets BOATYARD_COMPACT_THRESHOLD in a session's environment to opt
// that session in, and to give it its own threshold over the plugin setting.
async function thresholdFor($: EngineInterface, options: PluginOptions): Promise<number> {
  const override = await $.env.get('BOATYARD_COMPACT_THRESHOLD')
  if (override === undefined) return Number(options.compactThreshold)
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
  on('turn.complete', async ($, e, next) => {
    const answered = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return answered
    if (options.compactAtRest !== true && (await $.env.get('BOATYARD_COMPACT_THRESHOLD')) === undefined) return answered

    const free = await freeBeforeAutoCompact($)
    if (free !== undefined && free < (await thresholdFor($, options))) {
      await $.session.compact()
    }
    return answered
  })
}
