import type { On, SessionUsage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// Auto-compact runs at 160000 tokens, so 160000 is the space usable before it.
const AUTO_COMPACT_AT = 160000

function usageAt(tokens: number | undefined): SessionUsage {
  return {
    startedAt: 0,
    rateLimits: [],
    context: {
      tokens,
      window: 200000,
      breakdown: {
        categories: [],
        totalTokens: tokens ?? 0,
        maxTokens: 200000,
        rawMaxTokens: 200000,
        autocompactSource: 'auto',
        percentage: 0,
        gridRows: [],
        model: 'claude-test',
        memoryFiles: [],
        mcpTools: [],
        agents: [],
        autoCompactThreshold: AUTO_COMPACT_AT,
        isAutoCompactEnabled: true,
        apiUsage: null,
      },
    },
  }
}

// The engine beneath the plugin: a session whose context holds `tokens`, and
// a count of the compactions the plugin asks for.
function session(on: On, tokens: number | undefined, env: Record<string, string> = {}) {
  const compactions = { count: 0 }
  mock.env(on, env)
  on('session.usage', () => ({ value: usageAt(tokens) }))
  on('session.compact', () => {
    compactions.count += 1
    return { messages: [{ role: 'user', text: 'the summary', toolUses: [] }] }
  })
  on('turn.complete', () => ({ text: 'done' }))
  return compactions
}

const TURN = { answer: 'done', durationMs: 1000, isAborted: false, turnId: 'turn-1' } as const

// A share of free context before auto-compact, as tokens in use.
const tokensAtFree = (percent: number) => AUTO_COMPACT_AT * (1 - percent / 100)

const OPTED_IN = { BOATYARD_COMPACT_THRESHOLD: '70' }

test('compacts an opted-in session at the end of a turn below the threshold', async ($, on) => {
  const compactions = session(on, tokensAtFree(60), OPTED_IN)
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(1)
})

test('leaves a session that has not opted in alone', async ($, on) => {
  const compactions = session(on, tokensAtFree(10))
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(0)
})

test('the plugin setting opts every session in', { options: { compactAtRest: true } }, async ($, on) => {
  const compactions = session(on, tokensAtFree(60))
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(1)
})

test('does not compact at or above the threshold', async ($, on) => {
  const compactions = session(on, tokensAtFree(70), OPTED_IN)
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(0)
})

test('does not compact when turned off', { options: { compactAtRest: false } }, async ($, on) => {
  const compactions = session(on, tokensAtFree(10))
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(0)
})

test('does not compact straight after its own compact', async ($, on) => {
  // The engine reports no context figure until the first response after a
  // compact.
  const compactions = session(on, undefined, OPTED_IN)
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(0)
})

test('does not compact after a turn the person interrupted', async ($, on) => {
  const compactions = session(on, tokensAtFree(10), OPTED_IN)
  await $.turn.complete({ ...TURN, isAborted: true, reason: 'aborted' })
  expect(compactions.count).toBe(0)
})

test('does not compact for a subagent', async ($, on) => {
  const compactions = session(on, tokensAtFree(10), OPTED_IN)
  await $.turn.complete({ ...TURN, agentId: 'agent-1', reason: 'answer' })
  expect(compactions.count).toBe(0)
})

test('takes the threshold from the plugin setting', { options: { compactAtRest: true, compactThreshold: 50 } }, async ($, on) => {
  const compactions = session(on, tokensAtFree(60))
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(0)
})

test('the per-session override wins over the plugin setting', { options: { compactThreshold: 50 } }, async ($, on) => {
  const compactions = session(on, tokensAtFree(60), { BOATYARD_COMPACT_THRESHOLD: '80' })
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(1)
})

test('an override that is not a whole number leaves the plugin setting', { options: { compactThreshold: 50 } }, async ($, on) => {
  const compactions = session(on, tokensAtFree(60), { BOATYARD_COMPACT_THRESHOLD: 'eighty' })
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(0)
})

test('an empty override opts in at the plugin setting, and says nothing', { options: { compactThreshold: 50 } }, async ($, on) => {
  const logged: string[] = []
  on('ui.log', (_$, e) => {
    logged.push(e.text)
    return { value: undefined }
  })
  const below = session(on, tokensAtFree(40), { BOATYARD_COMPACT_THRESHOLD: '' })
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(below.count).toBe(1)
  expect(logged).toEqual([])
})

test('an empty override leaves a session above the plugin setting alone', { options: { compactThreshold: 50 } }, async ($, on) => {
  const compactions = session(on, tokensAtFree(60), { BOATYARD_COMPACT_THRESHOLD: '' })
  await $.turn.complete({ ...TURN, reason: 'answer' })
  expect(compactions.count).toBe(0)
})
