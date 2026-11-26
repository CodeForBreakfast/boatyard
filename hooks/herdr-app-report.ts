import type { EngineInterface, Register } from 'claude-code'

// Claude Code reports its own status to a herdr app terminal over OSC 7501,
// but only when the terminal answers its startup probe within two seconds. A
// slow start, such as a resume with a large transcript, misses the probe and
// never reports. These hooks report the same states from Claude Code's own
// events, and record the session id as the terminal's `claude.session` label.

type State = 'idle' | 'working' | 'done' | 'blocked' | 'error' | 'clear'
type Kind = 'permission' | 'question'

const ESC = '\x1b'
const statusReport = (state: State, kind?: Kind) =>
  `${ESC}]7501;:state=${state}${kind === undefined ? '' : `:kind=${kind}`}:app=claude-code${ESC}\\`

// A hook's child has no controlling terminal, so the report goes to the tty
// of the Claude Code process itself. ps names it as `pts/3` on Linux and
// `ttys003` on macOS, and `?` or `??` for none.
const WRITE_TO_TTY_OF = [
  'tty=$(ps -o tty= -p "$1" | tr -d " ")',
  'case "$tty" in ""|"?"|"??") echo "process $1 has no tty" >&2; exit 1;; esac',
  'printf "%s" "$2" > "/dev/$tty"',
].join('\n')

// herdr runs its own integration, and its panes inherit the app terminal's
// variables when herdr itself runs inside one. A -p or SDK session, which
// draws nowhere, inherits them too when something in the terminal starts it.
async function appTerminal($: EngineInterface): Promise<string | undefined> {
  if ((await $.env.get('HERDR_PANE_ID')) !== undefined) return undefined
  const terminal = await $.env.get('HC_TERMINAL_ID')
  if (terminal === undefined || (await $.session.surfaces()).length === 0) return undefined
  return terminal
}

async function run($: EngineInterface, argv: string[]) {
  const what = argv[0] === 'hc' ? argv.join(' ') : 'the status report'
  try {
    const { exitCode, stderr } = await $.process.run(argv)
    if (exitCode !== 0) $.ui.log(`herdr app: ${what} failed: ${stderr.trim()}`, { to: 'debug' })
  } catch (err) {
    $.ui.log(`herdr app: ${what} failed: ${String(err)}`, { to: 'debug' })
  }
}

async function report($: EngineInterface, state: State, kind?: Kind): Promise<State> {
  if ((await appTerminal($)) !== undefined) {
    const { CLAUDE_PID } = await $.process.hookEnv()
    await run($, ['sh', '-c', WRITE_TO_TTY_OF, 'sh', CLAUDE_PID, statusReport(state, kind)])
  }
  return state
}

export const register: Register = (on) => {
  let last: State | undefined

  // A compaction keeps the session id, and may come in the middle of a turn.
  // A subagent's start belongs to the session that runs it.
  on('classic.SessionStart', { source: ['startup', 'resume', 'clear', 'fork'] }, async ($, e, next) => {
    if (e.agent_id !== undefined) return next(e)
    const terminal = await appTerminal($)
    if (terminal !== undefined) {
      last = await report($, 'idle')
      await run($, ['hc', 'label', terminal, `claude.session=${e.session_id}`])
    }
    return next(e)
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    last = await report($, 'working')
    return next(e)
  })

  on('tool.call', { tool: ['AskUserQuestion', 'ExitPlanMode'] }, async ($, e, next) => {
    last = await report($, 'blocked', 'question')
    return next(e)
  })

  // Nothing else reports working again once a permission is granted.
  on('classic.PostToolUse', async ($, e, next) => {
    if (last === 'blocked') last = await report($, 'working')
    return next(e)
  })

  on('classic.Notification', async ($, e, next) => {
    if (e.notification_type === 'permission_prompt') last = await report($, 'blocked', 'permission')
    else if (e.notification_type === 'elicitation_dialog') last = await report($, 'blocked', 'question')
    // A turn the person interrupted ends without a Stop.
    else if (e.notification_type === 'idle_prompt' && (last === 'working' || last === 'blocked')) last = await report($, 'idle')
    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    last = await report($, 'done')
    return next(e)
  })

  on('classic.StopFailure', async ($, e, next) => {
    last = await report($, 'error')
    return next(e)
  })

  on('classic.SessionEnd', async ($, e, next) => {
    last = await report($, 'clear')
    return next(e)
  })
}
