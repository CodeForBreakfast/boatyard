import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// The engine beneath the plugin: one session, the prompts the plugin submits,
// and the plugin's store, which outlives the process as a resume finds it.
function session(on: On) {
  const store: Record<string, unknown> = {}
  const world = { prompts: [] as string[], store }
  on('store.get', (_$, e) => ({ value: store[e.key] }))
  on('store.set', (_$, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'session-1' }))
  on('skill.prompt', (_$, e) => ({ text: e.text }))
  on('prompt.submit', (_$, e) => {
    world.prompts.push(e.text)
    return { text: e.text }
  })
  on('classic.SessionStart', () => ({}))
  return world
}

const loadSkill = (skill: string) => ({ skill, text: `the ${skill} skill`, pluginName: 'boatyard', source: 'plugin' })

test('a resumed steward is sent through its whole wake ritual', async ($, on) => {
  const seat = session(on)
  await $.skill.prompt(loadSkill('boatyard:steward'))

  await $.classic.SessionStart({ source: 'resume', session_id: 'session-1' })
  expect(seat.prompts.length).toBe(1)
  expect(seat.prompts[0]).toContain('Reachable')
})

test('a resumed worker is left alone', async ($, on) => {
  const seat = session(on)
  await $.skill.prompt(loadSkill('boatyard:worker'))

  await $.classic.SessionStart({ source: 'resume', session_id: 'session-1' })
  expect(seat.prompts).toEqual([])
})

test("a person's resumed session is left alone", async ($, on) => {
  const person = session(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 'session-1' })
  expect(person.prompts).toEqual([])
})

test('a fresh start is left alone', async ($, on) => {
  const seat = session(on)
  await $.classic.SessionStart({ source: 'startup', session_id: 'session-1' })
  await $.skill.prompt(loadSkill('boatyard:steward'))
  expect(seat.prompts).toEqual([])
})

test('a compacted steward is left to the wake ritual', async ($, on) => {
  const seat = session(on)
  await $.skill.prompt(loadSkill('boatyard:steward'))

  await $.classic.SessionStart({ source: 'compact', session_id: 'session-1' })
  expect(seat.prompts).toEqual([])
})

test("another plugin's steward skill marks nothing", async ($, on) => {
  const seat = session(on)
  await $.skill.prompt({ ...loadSkill('steward'), pluginName: 'elsewhere' })

  await $.classic.SessionStart({ source: 'resume', session_id: 'session-1' })
  expect(seat.prompts).toEqual([])
})
