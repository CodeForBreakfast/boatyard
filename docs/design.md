# Boatyard design

## Purpose

Boatyard runs coding agents in terminal multiplexer panes and coordinates them. It hides the multiplexer behind a port, so that moving to another multiplexer means writing an adapter rather than editing skills. herdr is the first backend. tuios, Orca and tmux are candidates.

## Scope

In scope now:

- The orchestration skills and the launcher.
- A persistent set of long-lived agents, which starts at login under a service manager.
- Compaction at rest, by a mod in the plugin.

Later: the integrations that serve interactive panes only. These are the agent-state hooks, the statusline, review tabs and window-manager keybinds. They go on calling their multiplexer directly until they are moved.

## Layers

| Component | Role | Depends on |
|---|---|---|
| `berth` | The port: a backend-neutral command, plus one adapter per multiplexer | a multiplexer |
| `sign-on` | Launches Claude Code in a berth and gets it past its startup gate | `berth` |
| Compaction mod | Compacts a session at rest before it runs low on context | Claude Code |
| Skills | `steward`, `worker`, `muster` and `tally` | `sign-on`, `berth` |

The port knows only terminal mechanics. It knows nothing about Claude Code. The startup gate belongs to Claude Code, so it lives in `sign-on`. Compaction is useful without any orchestration, so it runs inside every session that loads the plugin, in a berth or not, and does not use the port.

## The port: `berth`

### Principles

- **The port presents what consumers need, in consumer terms.** It does not mirror any multiplexer's model.
- **Adapters compensate.** When a backend cannot supply something the port promises, the adapter makes up for it. Consumers never learn which backend they run on.
- **The port has no concept of groups or workspaces.** All the candidate multiplexers nest panes about three levels deep, but the middle level means something different in each. It is a labelled sidebar entry in herdr, a git worktree in Orca, and one of nine fixed slots in tuios. Layout is each adapter's decision.

### Concepts

- **Yard.** One backend session that holds berths, such as a herdr server session.
- **Berth.** One terminal in which a process runs, usually an agent. A berth id is opaque to consumers. An adapter may use its backend's native id, and the herdr adapter does, returning herdr's pane id verbatim.
- **Relationship.** Every berth is opened in a relationship to its opener:
  - **independent**: it starts its own line of work, as a steward or a persistent agent does.
  - **worker**: it does part of the opener's work. The adapter keeps an opener's workers together.
  - **tender**: an auxiliary view beside the opener, such as a bead-graph viewer. It is usually not an agent.

  Closing an independent berth closes its workers and tenders with it.

  An independent berth opens apart from its opener by default, in a place of its own. It may open **beside** its opener instead, so that a line of work started from a seat a person works in opens next to them. Or it may open in a **tab**, a view of its own near its opener, so that it sits with the opener's line of work without taking room from the opener's screen. A berth beside its opener or in a tab is still independent, so closing either one leaves the other.

### Agent states

A consumer needs only these four states:

| State | Meaning |
|---|---|
| `active` | A turn is in flight. |
| `at-rest` | The agent is at its prompt. This includes an agent parked while background work runs, and one whose last turn errored. |
| `blocked` | The agent is waiting on a human, for example at a permission prompt. |
| `gone` | No agent is in the berth, or the berth no longer exists. |

Each adapter maps its backend's states onto these four and corrects its backend's known mistakes. For example, herdr reports a pane parked on background work as working. The herdr adapter detects that case from herdr's rule-evaluation trace and reports `at-rest`.

### Verbs

| Verb | Effect |
|---|---|
| `berth serve <yard>` | Runs the backend for a yard in the foreground, so a service manager can supervise the real process. |
| `berth stop <yard>` | Stops a yard. |
| `berth yard` | Prints the yard the caller acts in, resolved as the adapter resolves it for every other verb. |
| `berth open --as independent\|worker\|tender --cwd <dir> [--label <text>] [--beside \| --tab] [--focus] -- <command>` | Opens a berth and prints its id. With `--beside`, an independent berth opens beside its opener rather than apart. With `--tab`, it opens in a tab near its opener. With `--focus`, the person watching the yard lands on the new berth. Without it, their focus stays where it was. |
| `berth name [<id>] <label>` | Labels a berth. On an independent berth that opened apart or in a tab, the label also names whatever the adapter groups under it. |
| `berth list [<yard>]` | Prints the berths as JSON: id, label, relationship, parent and state. |
| `berth send-text [<id>] <text>` | Types text into a berth. |
| `berth send-key [<id>] <key>` | Sends one key, such as `Enter`. |
| `berth wait-text [<id>] <text> --timeout <s>` | Blocks until the text appears within one line on screen, or fails at the timeout. The text is literal, because each backend has its own regular expression dialect. |
| `berth read [<id>]` | Prints the visible screen as plain text. |
| `berth state [<id>]` | Prints one of the four states. |
| `berth close [<id>]` | Closes a berth. |

A verb given no id acts on `BERTH_ID`, the calling berth. So a worker closes itself with a bare `berth close`.

`read` is for diagnosis only, for example a steward checking on a stalled worker. Coordination state never travels through a screen. The skills state that rule, because the port cannot enforce it.

### Environment

Every berth carries three variables:

- `BERTH_BACKEND` selects the adapter.
- `BERTH_YARD` names the yard.
- `BERTH_ID` is the berth's own id.

A berth opened from inside another inherits `BERTH_BACKEND` and `BERTH_YARD`. An adapter may set variables of its own, but consumers read only these three.

A caller that is not itself a berth has none of the three: a service manager's unit, or a pane a person opened by hand. The host's environment then names the backend, and the adapter resolves the yard and the calling pane from its backend's own variables. With no backend named, `berth` exits non-zero.

Where a verb needs the caller, such as a worker's opener or the opener a berth opens beside, the calling pane stands in for a caller that is not a berth. It stands in only within its own yard. A caller in no pane, or whose pane is in another yard than the one named, is refused with a message that says which.

### Errors

- A berth that no longer exists reports state `gone` and exits 0. That is an answer, not a failure.
- If the backend is unreachable, or the adapter cannot do what was asked, `berth` exits non-zero with a message that names the adapter.
- Nothing falls back silently.

### The herdr adapter

It is written first. Its obligations beyond straight mapping:

- **Layout.** An independent berth becomes a workspace. One opened beside its opener splits the opener's pane instead, and shares its workspace. One opened in a tab becomes a new tab in the opener's workspace, and takes the berth's label. Workers share one tab in their opener's workspace and split it. A tender splits beside its opener. The choice of split direction lives here.
- **The parked-on-background-work correction** described under Agent states.
- **The lost-agent correction.** Where a wrapper renames Claude Code's process, as Nix's does, herdr names it from its argv, and skips reading argv while the process waits on the disk, as under swap. Enough misses clear the agent, and herdr may not look again for minutes. The session reported at Claude Code's start-up survives, so a pane with no agent, a session, and a foreground process other than its shell reads `active`, not `gone`.
- **The cascade.** herdr keeps a workspace's other panes when its first pane closes, so the adapter closes them itself. It closes a whole workspace only for the independent berth that opened it, and only while no other independent berth lives there. Any other berth closes its own pane.
- **Waiting for the shell.** herdr starts every pane with a shell, so the adapter types the berth's command into it. It types only once the shell has settled alone in the foreground, because a child of the shell's start-up, such as a dev shell's hook, can read the terminal and swallow typed input.
- **Screen source.** `wait-text` matches herdr's recent output, not only the visible frame. A pane shorter than the text it waits for never shows all of it at once.
- **Package parameter.** herdr's package is a parameter, so a host can supply a platform-specific build.

## `sign-on`

`sign-on` launches Claude Code in a berth:

1. It asks `berth yard` which yard it is in, so that it works from a pane that is not a berth, then opens a berth through `berth open`.
2. It starts the configured Claude Code command in that berth.
3. It attaches `bilge-pump` to the berth.
4. It gets past the startup gate: `berth wait-text` for the gate's text, then `berth send-key Enter`, repeated until `berth read` no longer shows the gate. `wait-text` cannot tell when the gate has gone, because it searches recent output.

The compactor goes on before the gate because a berth that `sign-on` gives up on stays open for a person to read. Once that person answers the prompt that stopped it, the seat goes to work, and it must not work without a compactor.

The host supplies the site-specific parts as configuration:

- the Claude Code command, including any wrapper, environment setup and flags;
- the startup gate's text, because the gate comes from the host's flags. With none configured, `sign-on` returns once the agent has shown, and the steward finds a gate nobody configured as a blocked berth;
- the MCP start-up timeout;
- how long an agent may take to show its gate, or to show at all;
- the memory the host must have available before a seat starts, 8 GiB by default.

`sign-on` checks that memory before it opens a berth. Below the floor it opens nothing and exits with status 75, so a caller can tell "not now" from a failure.

Each launch states its own relationship, working directory, label and prompt. A launch with no prompt leaves the seat idle at its prompt, past its gate and with its compactor attached, until a person types. An independent launch may ask to open beside its caller, or in a tab near it. It may ask for focus, so that a caller such as a desktop shortcut lands the person on the seat as soon as it opens. It may add a model, an effort level, an extra working directory, environment variables, a settings file and a compaction threshold. A steward's settings file lets it run `sign-on`, and a worker gets none.

A seat is born in its repository's main checkout, never in a linked worktree. Claude Code reads its instructions, skills and trust state from the launch directory and cannot re-read them after a `cd`.

The persistent set's start-up script calls `sign-on` too, so the gate logic exists once.

## Compaction

A mod in the plugin compacts a session at the end of a turn once its free context falls below a threshold. The next message then lands on a lean context, rather than the session drifting into Claude Code's own auto-compact mid-turn.

- **The engine supplies the figures.** At the end of each answered turn of the main loop, the mod reads the context fill and the auto-compact point from the session. It compacts with the same call that `/compact` makes.
- **The figure is free context before auto-compact,** as a whole percentage of the space usable before auto-compact. A session with auto-compact off measures against its whole window.
- **A turn with no figure is left alone.** The engine has none until a session's first response, and none straight after a compact, so the mod never compacts twice running. It does not compact after an interrupted turn, which the person is about to follow up, or at the end of a subagent's turn.
- **A session is left alone unless it has opted in,** so a person's interactive session is never compacted by surprise. Setting `BOATYARD_COMPACT_THRESHOLD` in a session's environment opts that session in and gives it its own threshold, which wins over the plugin setting. `sign-on` sets it from a launch's compaction threshold. A value that is not a whole number is logged and ignored, and the session stays opted in at the setting's threshold.
- **Plugin settings can opt in every session and set the threshold.** `compactAtRest` is off by default. The threshold is 70 by default.

## Skills

| Skill | Role | Invocation |
|---|---|---|
| `steward` | Drives one multi-agent effort from its top bead. | slash only |
| `worker` | Executes one bead as a berth in an effort. The steward starts it with `sign-on`, posts its brief, then types `/boatyard:worker <topic>` into its berth. | slash only |
| `muster` | Turns a body of work into an effort a steward can drive cold, then launches the steward. | model-invoked, so an agent told to start an effort can run it from its own seat. Its description says to use it only when invoked by name. |
| `tally` | A read-only roll-up of every live effort and what each needs from a human. | model-invoked, so plain questions reach it. Its description says "boatyard" and "effort". |

An effort is its top bead and everything that bead depends on, followed transitively across trackers. The top bead states the outcome the effort delivers, and parent links put nothing in an effort. `muster` adopts or files the top bead rather than creating an epic to anchor the effort. It files the work as observable outcomes, each wired to the outcomes it needs, and places a bead that is true only after a release or deployment downstream of that release. An epic is an "and" over the outcomes it depends on. The steward is started with the top bead, and the effort's slug, index line and berth are keyed on it. The effort ends when someone who has seen the evidence for its outcome closes the top bead.

The slash-only skills set `disable-model-invocation: true`, because plugin skills cannot be disabled one at a time. Claude Code then refuses them to the Skill tool, so only a typed command or a launch prompt starts one.

The skills contain no multiplexer syntax. They call only `sign-on` and `berth`. Coordination runs over [commy](https://github.com/CodeForBreakfast/commy), with each effort indexed in a `boatyard` topic in its project's channel, and the [beads](https://github.com/gastownhall/beads) graph is the system of record. A worker records its berth id on its bead as `agent_pane`, so bead viewers can draw the berth against its work.

## Packaging

- **One repository, one Claude Code plugin, `boatyard`.** It holds the skills and puts the executables in its `bin/`, which reaches the Bash tool's path.
- **One flake exporting three packages:** `berth`, `bilge-pump` and `sign-on`. The packages matter as much as the plugin. `bilge-pump` runs detached, and the persistent set starts under a service manager, and neither of those sees the plugin's `bin/`.
- **Host inputs.** The multiplexer package, the Claude Code command and flags, the settings path and the state directory are all package arguments or configuration. A host supplies its own.
- **A host allows the plugin's mod.** Where a host's managed settings limit mods to its organization's, the compaction mod does not load until the host allows it.
- **Runtime dependencies.** The scripts in `bin/` state their dependencies, such as `jq`, for readers who do not use nix.
- **One revision per host.** Claude Code puts a plugin's `bin/` after the ambient path, so where a host installs the packages, the packages run and the plugin supplies only the skills. A host that installs both loads the plugin from the same revision as the packages, with `--plugin-dir` on its Claude Code command.

## Testing

- **Port contract suite.** One suite states what every adapter must do: open in each relationship, list, name, send-text, send-key, wait-text, read, state across all four states, close, and the cascade when an independent berth closes. It runs against every adapter.
  - For herdr, it runs a throwaway server with `HOME` redirected and every `HERDR_*` variable unset. An inherited `HERDR_SOCKET_PATH` would otherwise drive the live session. The server runs inside the nix build sandbox, so the suite is a flake check.
  - herdr treats a process named `claude` as an agent and reads its state from the screen. The suite drives the states with a stand-in process of that name, not with Claude Code.
- **Unit tests.** The compaction mod's rule has its own tests, run by `claude plugin test` against a stand-in engine. So does each adapter's mapping from backend states to the four port states, including the herdr parked-on-background-work and lost-agent corrections.
- **End to end.** One real effort runs on `steward` and `worker` before any previous system is retired.

## Migration from an existing herdr-based setup

Build beside the existing system under the new names. The two share one herdr server without colliding. Every command, environment variable, state file and index topic is new, and each pane is launched by one system and compacted by that system's own monitor. The existing system stays untouched until the last step.

The work lands in three places: this repository, the host configuration that packages the old launcher and the persistent set, and the user's Claude Code configuration, which holds the old skills, the statusline, the settings and the hooks.

1. Build `berth` with the herdr adapter and its contract suite.
2. Build `bilge-pump`, with the statusline tap and the no-figure fallback. Wire the tap into the statusline. The statusline's compactor indicator reads whichever heartbeat its pane has, the old one or the new one.
3. Build `sign-on`, which attaches `bilge-pump`.
4. Write `steward` and `worker`. Install the packages and the plugin on one host, and allow `berth` and `sign-on` in the permission settings the seats run under. Then run one real effort, its steward started by hand with `sign-on` and indexed in a `boatyard` topic.
5. Move the persistent set, one host at a time, because each host has its own service manager. Its server runs under `berth serve`, and its start-up script opens each agent with `sign-on`.
6. Write `muster` and `tally`. Switch every skill that starts an effort to `muster`, so that no new effort starts on the old system. `tally` reads both the old and the new index topics until the last old effort closes.
7. Move compaction into the plugin's mod. `sign-on` stops attaching `bilge-pump` and sets the mod's per-session threshold instead, and `bilge-pump` and its statusline tap go.
8. When the last old effort has closed, retire the old skills, the old launcher and the old monitor. Remove their names from the hooks, the settings and the other skills that mention them, and tell each project to do the same in its own notes. Each old index topic gets one closing line pointing at `boatyard`.

The migration is done when no search of the host configuration or the Claude Code configuration finds the old skill, launcher and monitor names, and no raw multiplexer calls remain in the in-scope files.

## Open decisions

- **The second adapter.** tmux would bring `berth` to the most users. tuios fits the port model most closely. Orca was the original request for a second backend.

## Rejected alternatives

- **Primitive verbs,** which would have given each herdr command a neutral name. The startup gate and screen scraping would have stayed in consumers, and Orca's worktree model would have leaked into them.
- **Teaching the skills several multiplexer dialects.** That doubles the recipes in the documents that are hardest to keep correct.
- **Our own agent-state detection.** Every candidate multiplexer surfaces agent state, so adapters correct their backend instead.
- **Deriving context from the session transcript.** It needs the model's window size, and the transcript format is not documented as stable.
- **A compactor outside the session,** which typed `/compact` into the berth once a statusline tap recorded a low figure. It needed a multiplexer and a tap wired into the user's statusline, and it measured against the whole window rather than the auto-compact point.
