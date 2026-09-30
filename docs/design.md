# Boatyard design

Status: draft. Sections marked **[NOT YET APPROVED]** have been proposed but not approved. Everything else is settled.

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
| `berth open --as independent\|worker\|tender --cwd <dir> [--label <text>] -- <command>` | Opens a berth and prints its id. |
| `berth name [<id>] <label>` | Labels a berth. On an independent berth, the label also names whatever the adapter groups under it. |
| `berth list [<yard>]` | Prints the berths as JSON: id, label, relationship, parent and state. |
| `berth send-text [<id>] <text>` | Types text into a berth. |
| `berth send-key [<id>] <key>` | Sends one key, such as `Enter`. |
| `berth wait-text [<id>] <pattern> --timeout <s>` | Blocks until the pattern appears on screen, or fails at the timeout. |
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

### Errors

- A berth that no longer exists reports state `gone` and exits 0. That is an answer, not a failure.
- If the backend is unreachable, or the adapter cannot do what was asked, `berth` exits non-zero with a message that names the adapter.
- Nothing falls back silently.

### The herdr adapter

It is written first. Its obligations beyond straight mapping:

- **Layout.** An independent berth becomes a workspace. Workers share one tab in their opener's workspace and split it. A tender splits beside its opener. The choice of split direction lives here.
- **The parked-on-background-work correction** described under Agent states.
- **Package parameter.** herdr's package is a parameter, so a host can supply a platform-specific build.

## `sign-on`

`sign-on` launches Claude Code in a berth:

1. It opens a berth through `berth open`.
2. It starts the configured Claude Code command in that berth.
3. It gets past the startup gate: `berth wait-text` for the prompt text, then `berth send-key Enter`, repeated until the prompt clears.
4. It attaches `bilge-pump` to the berth.

The host supplies the site-specific parts as configuration:

- the Claude Code command, including any wrapper, environment setup and flags;
- the settings file to pass;
- the MCP start-up timeout.

The persistent set's start-up script calls `sign-on` too, so the gate logic exists once.

## `bilge-pump`

`bilge-pump` sends Claude Code's compact command to an agent that is at rest and low on free context. The next message then lands on a lean context, rather than the agent drifting into Claude Code's own auto-compact mid-turn.

- **It consumes the port.** It reads `berth state` and types through `berth send-text`. It runs one long-lived process per berth, attached by `sign-on` or by hand.
- **It works without orchestration.** A person running one agent in one multiplexer pane can use it. It always needs a multiplexer, because Claude Code offers no outside way to trigger a compact.
- **The context figure comes from a statusline tap.** A plugin cannot register the main statusline, and hook input carries no context figure. So `bilge-pump` ships a tap that reads the statusline's input, records the context figure for the berth in a state file, and passes the input on unchanged to the user's own statusline command. The user wires it in with one settings line.
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
| `muster` | Turns a body of work into an effort a steward can drive cold, then launches the steward. | slash only |
| `tally` | A read-only roll-up of every live effort and what each needs from a human. | model-invoked, so plain questions reach it. Its description says "boatyard" and "effort". |

The slash-only skills set `disable-model-invocation: true`, because plugin skills cannot be disabled one at a time.

The skills contain no multiplexer syntax. They call only `sign-on` and `berth`. Coordination runs over [commy](https://github.com/CodeForBreakfast/commy), with each effort indexed in a `boatyard` topic in its project's channel, and the [beads](https://github.com/gastownhall/beads) graph is the system of record. A worker records its berth id on its bead as `agent_pane`, so bead viewers can draw the berth against its work.

## Packaging [NOT YET APPROVED]

- **One repository, one Claude Code plugin, `boatyard`.** It holds the skills and puts the executables in its `bin/`, which reaches the Bash tool's path.
- **One flake exporting three packages:** `berth`, `bilge-pump` and `sign-on`. The packages matter as much as the plugin. `bilge-pump` runs detached, and the persistent set starts under a service manager, and neither of those sees the plugin's `bin/`.
- **Host inputs.** The multiplexer package, the Claude Code command and flags, the settings path and the state directory are all package arguments or configuration. A host supplies its own.
- **Runtime dependencies.** The scripts in `bin/` state their dependencies, such as `jq`, for readers who do not use nix.

## Testing [NOT YET APPROVED]

- **Port contract suite.** One suite states what every adapter must do: open in each relationship, list, name, send-text, send-key, wait-text, read, state across all four states, close, and the cascade when an independent berth closes. It runs against every adapter.
  - For herdr, it runs a throwaway server with `HOME` redirected and every `HERDR_*` variable unset. An inherited `HERDR_SOCKET_PATH` would otherwise drive the live session.
- **Unit tests.** The pure decisions have their own tests: `bilge-pump`'s compaction decision, and each adapter's mapping from backend states to the four port states, including the herdr parked-on-background-work correction.
- **End to end.** One real effort runs on `steward` and `worker` before any previous system is retired.

## Migration from an existing herdr-based setup [NOT YET APPROVED]

Build beside the existing system under the new names. The two share one herdr server without colliding, because every name, environment variable and index topic is new. The existing system stays untouched until the last step.

1. Build `berth` with the herdr adapter and its contract suite.
2. Build `bilge-pump`, with the statusline tap and the no-figure fallback. It must decline to start on a pane an existing monitor already covers, and write its heartbeat where existing readers look, until those readers move.
3. Build `sign-on`, which attaches `bilge-pump`.
4. Write `steward` and `worker`, and run one real effort on them, indexed in a `boatyard` topic.
5. Move the persistent set's start-up script onto `sign-on`. Point the statusline and the steward's start-up check at the new heartbeat.
6. Write `muster` and `tally`. `tally` reads both the old and the new index topics until the last old effort closes.
7. Retire the old skills, the old launcher and the old monitor. Each old index topic gets one closing line pointing at `boatyard`.

The migration is done when no search finds the old skill and launcher names, and no raw multiplexer calls remain in the in-scope files.

## Open decisions

- **The blocked-duration record.** The previous monitor also logged how long a pane stayed blocked. Nothing reads that log but a human, and it is not about compaction. The draft leaves it out of `bilge-pump`. A human decides whether to drop it or rebuild it on the orchestration side when something needs it.
- **The second adapter.** tmux would bring `bilge-pump` to the most users. tuios fits the port model most closely. Orca was the original request for a second backend.

## Rejected alternatives

- **Primitive verbs,** which would have given each herdr command a neutral name. The startup gate and screen scraping would have stayed in consumers, and Orca's worktree model would have leaked into them.
- **Teaching the skills several multiplexer dialects.** That doubles the recipes in the documents that are hardest to keep correct.
- **Our own agent-state detection.** Every candidate multiplexer surfaces agent state, so adapters correct their backend instead.
- **Deriving context from the session transcript.** It needs the model's window size, and the transcript format is not documented as stable. It remains a fallback if the statusline tap proves unworkable.
- **Separate plugins for `berth` and `bilge-pump`.** A plugin's `bin/` gives a compactor-only user nothing, because the compactor runs outside any session. The flake packages carry that independence instead.
