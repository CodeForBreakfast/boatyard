# Boatyard design

## Purpose

Boatyard runs coding agents in terminal multiplexer panes and coordinates them. It hides the multiplexer behind a port, so that moving to another multiplexer means writing an adapter rather than editing skills. herdr is the first backend. tuios, Orca and tmux are candidates.

## Scope

In scope now:

- The orchestration skills and the launcher.
- A persistent set of long-lived agents, which starts at login under a service manager.
- The compactor, `bilge-pump`.

Later: the integrations that serve interactive panes only. These are the agent-state hooks, the statusline, review tabs and window-manager keybinds. They go on calling their multiplexer directly until they are moved.

## Layers

| Component | Role | Depends on |
|---|---|---|
| `berth` | The port: a backend-neutral command, plus one adapter per multiplexer | a multiplexer |
| `sign-on` | Launches Claude Code in a berth and gets it past its startup gate | `berth` |
| `bilge-pump` | Compacts an idle agent before it runs low on context | `berth` |
| Skills | `steward`, `worker`, `muster` and `tally` | `sign-on`, `berth` |

The port knows only terminal mechanics. It knows nothing about Claude Code. The startup gate belongs to Claude Code, so it lives in `sign-on`. Compaction is useful without any orchestration, so `bilge-pump` is its own component. It is a consumer of the port and is not part of it.

## The port: `berth`

### Principles

- **The port presents what consumers need, in consumer terms.** It does not mirror any multiplexer's model.
- **Adapters compensate.** When a backend cannot supply something the port promises, the adapter makes up for it. Consumers never learn which backend they run on.
- **The port has no concept of groups or workspaces.** All the candidate multiplexers nest panes about three levels deep, but the middle level means something different in each. It is a labelled sidebar entry in herdr, a git worktree in Orca, and one of nine fixed slots in tuios. Layout is each adapter's decision.

### Concepts

- **Yard.** One backend session that holds berths, such as a herdr server session.
- **Berth.** One terminal in which a process runs, usually an agent. A berth id is opaque to consumers. An adapter may use its backend's native id, and the herdr adapter does, returning herdr's pane id verbatim.
- **Relationship.** Every berth is opened in a relationship to its opener:
  - **independent**: it starts its own line of work, as an orchestrator or a persistent agent does.
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

`read` is for diagnosis only, for example an orchestrator checking on a stalled worker. Coordination state never travels through a screen. The skills state that rule, because the port cannot enforce it.

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
- **Screen source.** `wait-text` matches herdr's recent output, not only the visible frame. A pane shorter than the text it waits for never shows all of it at once.
- **Package parameter.** herdr's package is a parameter, so a host can supply a platform-specific build.

## `sign-on`

`sign-on` launches Claude Code in a berth:

1. It asks `berth yard` which yard it is in, so that it works from a pane that is not a berth, then opens a berth through `berth open`.
2. It starts the configured Claude Code command in that berth.
3. It gets past the startup gate: `berth wait-text` for the gate's text, then `berth send-key Enter`, repeated until `berth read` no longer shows the gate. `wait-text` cannot tell when the gate has gone, because it searches recent output.
4. It attaches `bilge-pump` to the berth.

The host supplies the site-specific parts as configuration:

- the Claude Code command, including any wrapper, environment setup and flags;
- the startup gate's text, because the gate comes from the host's flags. With none configured, `sign-on` returns once the agent has shown, and the steward finds a gate nobody configured as a blocked berth;
- the MCP start-up timeout;
- how long an agent may take to show its gate, or to show at all.

Each launch states its own relationship, working directory, label and prompt. An independent launch may ask to open beside its caller, or in a tab near it. It may ask for focus, so that a caller such as a desktop shortcut lands the person on the seat as soon as it opens. It may add a model, an effort level, an extra working directory, environment variables, a settings file and a compaction threshold. A steward's settings file lets it run `sign-on`, and a worker gets none.

A seat is born in its repository's main checkout, never in a linked worktree. Claude Code reads its instructions, skills and trust state from the launch directory and cannot re-read them after a `cd`.

The persistent set's start-up script calls `sign-on` too, so the gate logic exists once.

## `bilge-pump`

`bilge-pump` sends Claude Code's compact command to an agent that is at rest and low on free context. The next message then lands on a lean context, rather than the agent drifting into Claude Code's own auto-compact mid-turn.

- **It consumes the port.** It reads `berth state` and types through `berth send-text`. It runs one long-lived process per berth, attached by `sign-on` or by hand.
- **It works without orchestration.** A person running one agent in one multiplexer pane can use it. It always needs a multiplexer, because Claude Code offers no outside way to trigger a compact.
- **The context figure comes from a statusline tap.** A plugin cannot register the main statusline, and hook input carries no context figure. So `bilge-pump` ships a tap that reads the statusline's input, records the context figure for the berth in a state file, and passes the input on unchanged to the user's own statusline command. The state file is keyed by yard and berth id, because a berth id is unique only within its yard. The user wires it in with one settings line.
- **A berth with no figure is never compacted.** It is left to Claude Code's auto-compact, which is what happens today without a compactor. The compactor logs once per berth that it has no figure.
- **Heartbeat.** It rewrites a heartbeat file for each berth every tick, holding the epoch, state, free context, threshold and yard. A reader can then tell a ticking compactor from a wedged one.
- **One compactor per berth.** It declines to start where one already runs. Its state directory is configurable.
- **Pure decisions.** The compaction decision is a pure function with its own unit tests.
- **Dependency check.** It exits non-zero with a clear message if `berth` is not on the path.

## Skills

| Skill | Role | Invocation |
|---|---|---|
| `steward` | Drives one multi-agent effort anchored on one bead. | slash only |
| `worker` | Executes one bead as a berth in an effort. `sign-on` starts it by typing `/boatyard:worker <brief>`. | slash only |
| `muster` | Turns a body of work into an effort a steward can drive cold, then launches the steward. | model-invoked, so an agent told to start an effort can run it from its own seat. Its description says to use it only when invoked by name. |
| `tally` | A read-only roll-up of every live effort and what each needs from a human. | model-invoked, so plain questions reach it. Its description says "boatyard" and "effort". |

The slash-only skills set `disable-model-invocation: true`, because plugin skills cannot be disabled one at a time. Claude Code then refuses them to the Skill tool, so only a typed command or a launch prompt starts one.

The skills contain no multiplexer syntax. They call only `sign-on` and `berth`. Coordination runs over [commy](https://github.com/CodeForBreakfast/commy), with each effort indexed in a `boatyard` topic in its project's channel, and the [beads](https://github.com/gastownhall/beads) graph is the system of record. A worker records its berth id on its bead as `agent_pane`, so bead viewers can draw the berth against its work.

## Packaging

- **One repository, one Claude Code plugin, `boatyard`.** It holds the skills and puts the executables in its `bin/`, which reaches the Bash tool's path.
- **One flake exporting three packages:** `berth`, `bilge-pump` and `sign-on`. The packages matter as much as the plugin. `bilge-pump` runs detached, and the persistent set starts under a service manager, and neither of those sees the plugin's `bin/`.
- **Host inputs.** The multiplexer package, the Claude Code command and flags, the settings path and the state directory are all package arguments or configuration. A host supplies its own.
- **Runtime dependencies.** The scripts in `bin/` state their dependencies, such as `jq`, for readers who do not use nix.
- **One revision per host.** Claude Code puts a plugin's `bin/` after the ambient path, so where a host installs the packages, the packages run and the plugin supplies only the skills. A host that installs both loads the plugin from the same revision as the packages, with `--plugin-dir` on its Claude Code command.

## Testing

- **Port contract suite.** One suite states what every adapter must do: open in each relationship, list, name, send-text, send-key, wait-text, read, state across all four states, close, and the cascade when an independent berth closes. It runs against every adapter.
  - For herdr, it runs a throwaway server with `HOME` redirected and every `HERDR_*` variable unset. An inherited `HERDR_SOCKET_PATH` would otherwise drive the live session. The server runs inside the nix build sandbox, so the suite is a flake check.
  - herdr treats a process named `claude` as an agent and reads its state from the screen. The suite drives the states with a stand-in process of that name, not with Claude Code.
- **Unit tests.** The pure decisions have their own tests: `bilge-pump`'s compaction decision, and each adapter's mapping from backend states to the four port states, including the herdr parked-on-background-work and lost-agent corrections.
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
7. When the last old effort has closed, retire the old skills, the old launcher and the old monitor. Remove their names from the hooks, the settings and the other skills that mention them, and tell each project to do the same in its own notes. Each old index topic gets one closing line pointing at `boatyard`.

The migration is done when no search of the host configuration or the Claude Code configuration finds the old skill, launcher and monitor names, and no raw multiplexer calls remain in the in-scope files.

## Open decisions

- **The second adapter.** tmux would bring `bilge-pump` to the most users. tuios fits the port model most closely. Orca was the original request for a second backend.

## Rejected alternatives

- **Primitive verbs,** which would have given each herdr command a neutral name. The startup gate and screen scraping would have stayed in consumers, and Orca's worktree model would have leaked into them.
- **Teaching the skills several multiplexer dialects.** That doubles the recipes in the documents that are hardest to keep correct.
- **Our own agent-state detection.** Every candidate multiplexer surfaces agent state, so adapters correct their backend instead.
- **Deriving context from the session transcript.** It needs the model's window size, and the transcript format is not documented as stable. It remains a fallback if the statusline tap proves unworkable.
- **Separate plugins for `berth` and `bilge-pump`.** A plugin's `bin/` gives a compactor-only user nothing, because the compactor runs outside any session. The flake packages carry that independence instead.
