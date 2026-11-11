import type { EngineInterface, On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// The engine beneath the plugin: one session, the prompts the plugin submits,
// and the plugin's store, which outlives the process as a resume finds it.
// A process starting up runs SessionStart before its REPL mounts, and refuses
// a prompt until the REPL has mounted.
function session(on: On) {
  const store: Record<string, unknown> = {}
  const world = { prompts: [] as string[], store, mounted: true }
  on('store.get', (_$, e) => ({ value: store[e.key] }))
  on('store.set', (_$, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'session-1' }))
  on('env.get', () => ({ value: undefined }))
  on('skill.prompt', (_$, e) => ({ text: e.text }))
  on('prompt.submit', (_$, e) => {
    if (!world.mounted) throw new Error('$.prompt.submit is not available in this mode: no session is bound in this process')
    world.prompts.push(e.text)
    return { text: e.text }
  })
  on('classic.SessionStart', () => ({}))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  return world
}

// A new process starts the session, as `claude --resume` does when herdr
// restores a pane.
async function start($: EngineInterface, world: { mounted: boolean }, source: 'startup' | 'resume') {
  world.mounted = false
  await $.classic.SessionStart({ source, session_id: 'session-1' })
  world.mounted = true
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
}

const loadSkill = (skill: string) => ({ skill, text: `the ${skill} skill`, pluginName: 'boatyard', source: 'plugin' })

test('a steward resumed in a new process is sent through its whole wake ritual', async ($, on) => {
  const seat = session(on)
  await $.skill.prompt(loadSkill('boatyard:steward'))

  await start($, seat, 'resume')
  expect(seat.prompts.length).toBe(1)
  expect(seat.prompts[0]).toContain('Reachable')
})

test('a resumed worker is left alone', async ($, on) => {
  const seat = session(on)
  await $.skill.prompt(loadSkill('boatyard:worker'))

  await start($, seat, 'resume')
  expect(seat.prompts).toEqual([])
})

test("a person's resumed session is left alone", async ($, on) => {
  const person = session(on)
  await start($, person, 'resume')
  expect(person.prompts).toEqual([])
})

test('a fresh start is left alone', async ($, on) => {
  const seat = session(on)
  await start($, seat, 'startup')
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

  await start($, seat, 'resume')
  expect(seat.prompts).toEqual([])
})
