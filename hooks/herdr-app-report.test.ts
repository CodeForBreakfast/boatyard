import type { EngineInterface, On, RenderSurface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const ESC = '\x1b'
const report = (fields: string) => `${ESC}]7501;:${fields}:app=claude-code${ESC}\\`

const IN_APP_TERMINAL = { HC_TERMINAL_ID: 't7' }

// The engine beneath the plugin: a Claude Code process whose pid is 4242, in a
// terminal whose environment is `env`, drawing on `surfaces`. A test reads
// back the status reports written to that process's tty and the hc commands
// the plugin ran, and may change what the session draws on.
function seat(on: On, env: Record<string, string> = IN_APP_TERMINAL, surfaces: readonly RenderSurface[] = ['terminal']) {
  const world = { reports: [] as string[], hc: [] as string[][], surfaces }
  on('store.get', () => ({ value: undefined }))
  on('env.get', (_$, e) => ({ value: env[e.name] }))
  on('session.surfaces', () => ({ value: world.surfaces }))
  on('session.id', () => ({ value: SESSION.session_id }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('process.hookEnv', () => ({ value: { CLAUDE_PID: '4242' } }))
  on('process.run', (_$, e) => {
    const [program, ...args] = e.argv
    if (program === 'hc') world.hc.push(args)
    else if (program === 'sh' && args[3] === '4242') world.reports.push(args[4])
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('tool.call', () => ({ result: {} }))
  for (const event of ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Notification', 'Stop', 'StopFailure', 'SessionEnd'] as const) {
    on(`classic.${event}`, () => ({}))
  }
  return world
}

const SESSION = { session_id: 'session-1' }

// How a session starts in an app terminal, in the orders Claude Code 2.1.332
// was seen to raise its events there. One that opens straight onto its prompt
// draws on the terminal before SessionStart. One held at a startup dialog,
// such as the warning --dangerously-load-development-channels raises, draws
// on nothing at SessionStart and attaches the terminal at session.start. A -p
// or SDK session draws on nothing at either.
async function startAtPrompt($: EngineInterface) {
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.classic.SessionStart({ ...SESSION, source: 'startup' })
}

async function startPastDialog($: EngineInterface, world: { surfaces: readonly RenderSurface[] }) {
  world.surfaces = []
  await $.classic.SessionStart({ ...SESSION, source: 'startup' })
  world.surfaces = ['terminal']
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
}

async function startHeadless($: EngineInterface) {
  await $.classic.SessionStart({ ...SESSION, source: 'startup' })
  await $.session.start({ cwd: '/work', surface: null, isInteractive: false })
}

async function startTurn($: EngineInterface) {
  await $.classic.SessionStart({ ...SESSION, source: 'resume' })
  await $.classic.UserPromptSubmit({ ...SESSION, prompt: 'go' })
}

test('a session start reports idle and labels the terminal with the session id', async ($, on) => {
  const app = seat(on)
  await startAtPrompt($)
  expect(app.reports).toEqual([report('state=idle')])
  expect(app.hc).toEqual([['label', 't7', 'claude.session=session-1']])
})

test('a session held at a startup dialog labels the terminal once it draws there', async ($, on) => {
  const app = seat(on)
  await startPastDialog($, app)
  expect(app.reports).toEqual([report('state=idle')])
  expect(app.hc).toEqual([['label', 't7', 'claude.session=session-1']])
})

test('a cleared session labels the terminal with its new session id', async ($, on) => {
  const app = seat(on)
  await $.classic.SessionStart({ ...SESSION, source: 'startup' })
  await $.classic.SessionStart({ session_id: 'session-2', source: 'clear' })
  expect(app.hc.at(-1)).toEqual(['label', 't7', 'claude.session=session-2'])
})

test('a compaction reports nothing, as it may come in the middle of a turn', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.SessionStart({ ...SESSION, source: 'compact' })
  expect(app.reports.at(-1)).toBe(report('state=working'))
  expect(app.hc.length).toBe(1)
})

test('a turn reports working, then done', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.Stop({ ...SESSION, stop_hook_active: false })
  expect(app.reports.slice(1)).toEqual([report('state=working'), report('state=done')])
})

test('a turn that fails reports error', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.StopFailure({ ...SESSION, error: 'server_error' })
  expect(app.reports.at(-1)).toBe(report('state=error'))
})

test('a permission prompt reports blocked, and the tool that runs after it reports working', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.Notification({ ...SESSION, message: 'needs permission', notification_type: 'permission_prompt' })
  await $.classic.PostToolUse({ ...SESSION, tool_name: 'Bash', tool_input: {}, tool_response: {}, tool_use_id: 'u1' })
  expect(app.reports.slice(2)).toEqual([report('state=blocked:kind=permission'), report('state=working')])
})

test('a question to the person reports blocked on a question', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] })
  expect(app.reports.at(-1)).toBe(report('state=blocked:kind=question'))
})

test('an ordinary tool call reports nothing', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.classic.PostToolUse({ ...SESSION, tool_name: 'Bash', tool_input: {}, tool_response: {}, tool_use_id: 'u1' })
  expect(app.reports.length).toBe(2)
})

test('an idle prompt after an interrupted turn reports idle', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.Notification({ ...SESSION, message: 'waiting', notification_type: 'idle_prompt' })
  expect(app.reports.at(-1)).toBe(report('state=idle'))
})

test('an idle prompt after a finished turn leaves it done', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.Stop({ ...SESSION, stop_hook_active: false })
  await $.classic.Notification({ ...SESSION, message: 'waiting', notification_type: 'idle_prompt' })
  expect(app.reports.at(-1)).toBe(report('state=done'))
})

test('a session end clears the status', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.SessionEnd({ ...SESSION, reason: 'prompt_input_exit' })
  expect(app.reports.at(-1)).toBe(report('state=clear'))
})

test('outside an app terminal it does nothing', async ($, on) => {
  const app = seat(on, {})
  await startTurn($)
  expect(app.reports).toEqual([])
  expect(app.hc).toEqual([])
})

test('under herdr it does nothing, even inside an app terminal', async ($, on) => {
  const app = seat(on, { ...IN_APP_TERMINAL, HERDR_PANE_ID: 'p1' })
  await startTurn($)
  expect(app.reports).toEqual([])
  expect(app.hc).toEqual([])
})

test('a headless session in an app terminal leaves its label and status alone', async ($, on) => {
  const app = seat(on, IN_APP_TERMINAL, [])
  await startHeadless($)
  await $.classic.UserPromptSubmit({ ...SESSION, prompt: 'go' })
  await $.classic.Notification({ ...SESSION, message: 'needs permission', notification_type: 'permission_prompt' })
  await $.classic.Stop({ ...SESSION, stop_hook_active: false })
  await $.classic.SessionEnd({ ...SESSION, reason: 'other' })
  expect(app.reports).toEqual([])
  expect(app.hc).toEqual([])
})

test('a subagent that starts in an app terminal leaves its label and status alone', async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.SessionStart({ session_id: 'session-2', source: 'startup', agent_id: 'agent-1' })
  expect(app.reports.at(-1)).toBe(report('state=working'))
  expect(app.hc).toEqual([['label', 't7', 'claude.session=session-1']])
})

test("a subagent's permission prompt reports the terminal blocked", async ($, on) => {
  const app = seat(on)
  await startTurn($)
  await $.classic.Notification({ ...SESSION, agent_id: 'agent-1', message: 'needs permission', notification_type: 'permission_prompt' })
  expect(app.reports.at(-1)).toBe(report('state=blocked:kind=permission'))
})

test('a report that cannot be written leaves the session running, and says why in the debug log', async ($, on) => {
  const logged: string[] = []
  on('ui.log', (_$, e) => {
    logged.push(e.text)
    return { value: undefined }
  })
  on('store.get', () => ({ value: undefined }))
  on('env.get', (_$, e) => ({ value: IN_APP_TERMINAL[e.name as keyof typeof IN_APP_TERMINAL] }))
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('process.hookEnv', () => ({ value: { CLAUDE_PID: '4242' } }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'no tty' } }))
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ ...SESSION, source: 'startup' })
  expect(logged.length).toBe(2)
  expect(logged[0]).toContain('no tty')
})
