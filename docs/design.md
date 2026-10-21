# Boatyard design

## Purpose

Boatyard runs coding agents in terminal multiplexer panes and coordinates them. It hides the multiplexer behind a port, so that moving to another multiplexer means writing an adapter rather than editing skills. herdr is the first backend. tuios, Orca and tmux are candidates.

## Scope

In scope now:

- The orchestration skills and the launcher.
- Long-lived agents for a host that runs them under a service manager. `berth serve` runs a yard's backend under the service manager, and `sign-on` opens each agent from a caller that is not a berth.
- Compaction at rest, by a mod in the plugin.

Later: the integrations that serve interactive panes only, such as agent-state hooks, a statusline, review tabs and window-manager keybinds. Until the port serves them, they call their multiplexer directly.

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
  - **independent**: it starts its own line of work, as a steward or a long-lived agent does.
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
| `berth id` | Prints the calling berth's id. A caller that is not a berth gets the id of the pane it runs in, which stands in for it as it does for every other verb. |
| `berth open --as independent\|worker\|tender --cwd <dir> [--label <text>] [--beside \| --tab] [--focus] -- <command>` | Opens a berth and prints its id. With `--beside`, an independent berth opens beside its opener rather than apart. With `--tab`, it opens in a tab near its opener. With `--focus`, the person watching the yard lands on the new berth. Without it, their focus stays where it was. A labelled tender opens once in a line of work: where its opener's line of work already holds a tender with that label, `open` makes the opener its parent and prints its id, and runs no command. |
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

- **Layout.** An independent berth becomes a workspace. One opened beside its opener splits the opener's pane instead, and shares its workspace. One opened in a tab becomes a new tab in the opener's workspace, and takes the berth's label. Workers share a tab in their opener's workspace and split it until a split would leave a pane too short to work in, or too narrow for Claude Code's startup gate to fit on one line. Then they open another tab. A tender splits beside its opener, and a line of work is a workspace when `open` looks for a tender with the same label. The choice of split direction lives here.
- **The parked-on-background-work correction** described under Agent states.
- **The lost-agent correction.** Where a wrapper renames Claude Code's process, as Nix's does, herdr names it from its argv, and skips reading argv while the process waits on the disk, as under swap. Enough misses clear the agent, and herdr may not look again for minutes. The session reported at Claude Code's start-up survives, so a pane with no agent, a session, and a foreground process other than its shell reads `active`, not `gone`.
- **The cascade.** herdr keeps a workspace's other panes when its first pane closes, so the adapter closes them itself. It closes a whole workspace only for the independent berth that opened it, and only while no other independent berth lives there. Any other berth closes its own pane.
- **Waiting for the shell.** herdr starts every pane with a shell, so the adapter types the berth's command into it. It types only once the shell has settled alone in the foreground, because a child of the shell's start-up, such as a dev shell's hook, can read the terminal and swallow typed input.
- **Screen source.** `wait-text` matches herdr's recent output, not only the visible frame. A pane shorter than the text it waits for never shows all of it at once.
- **Package parameter.** herdr's package is a parameter, so a host can supply a platform-specific build.
- **The host's herdr.** A host can name the herdr binary the adapter runs, with `BERTH_HERDR` set to its path. Without it, the adapter runs the packaged herdr. A macOS host that re-signs herdr needs this, because macOS ties its Local-Network grant to the binary's path. The adapter takes the binary from a variable and not from the caller's `PATH`, because a herdr host usually has some herdr on its `PATH`, and the packaged one would quietly give way to it.

## `sign-on`

`sign-on` launches Claude Code in a berth:

1. It records in Claude Code's global config that Claude Code trusts the seat's folder. That folder is the repository's top level, or the launch directory outside a repository. Claude Code otherwise asks about a folder it has never opened, with "No, exit" focused, so pressing Enter there would end the seat. sign-on writes the config under the lock that Claude Code takes for it, and leaves the rest of the file as it was.
2. It asks `berth yard` which yard it is in, so that it works from a pane that is not a berth, then opens a berth through `berth open`.
3. It starts the configured Claude Code command in that berth, opted in to the compaction mod.
4. It gets past the startup gate: `berth wait-text` for the gate's text, then `berth send-key Enter`, repeated until `berth read` no longer shows the gate. `wait-text` cannot tell when the gate has gone, because it searches recent output.

The host supplies the site-specific parts as configuration:

- the Claude Code command, including any wrapper, environment setup and flags;
- the startup gate's text, because the gate comes from the host's flags. With none configured, `sign-on` returns once the agent has shown, and the steward finds a gate nobody configured as a blocked berth;
- the MCP start-up timeout;
- how long an agent may take to show its gate, or to show at all;
- the memory the host must have available before a seat starts, 8 GiB by default.

`sign-on` checks that memory before it opens a berth. Below the floor it opens nothing and exits with status 75, so a caller can tell "not now" from a failure.

Each launch states its own relationship, working directory, label and prompt. A launch with no prompt leaves the seat idle at its prompt, past its gate, until a person types. An independent launch may ask to open beside its caller, or in a tab near it. It may ask for focus, so that a caller such as a desktop shortcut lands the person on the seat as soon as it opens. It may add a model, an effort level, an extra working directory, environment variables, a settings file and a compaction threshold. A steward's settings file lets it run `sign-on`, and a worker gets none.

A seat is born in its repository's main checkout, never in a linked worktree. Claude Code reads its instructions, skills and trust state from the launch directory and cannot re-read them after a `cd`.

A host that starts long-lived agents from a script calls `sign-on` there too, so the gate logic exists once.

## Compaction

A mod in the plugin compacts a session at the end of a turn once its free context falls below a threshold. The next message then lands on a lean context, rather than the session drifting into Claude Code's own auto-compact mid-turn.

- **The engine supplies the figures.** At the end of each answered turn of the main loop, the mod reads the context fill and the auto-compact point from the session. It compacts with the same call that `/compact` makes.
- **The figure is free context before auto-compact,** as a whole percentage of the space usable before auto-compact. A session with auto-compact off measures against its whole window.
- **A turn with no figure is left alone.** The engine has none until a session's first response, and none straight after a compact, so the mod never compacts twice running. It does not compact after an interrupted turn, which the person is about to follow up, or at the end of a subagent's turn.
- **A session is left alone unless it has opted in,** so a person's interactive session is never compacted by surprise. Setting `BOATYARD_COMPACT_THRESHOLD` in a session's environment opts that session in. A whole number gives the session its own threshold, which wins over the plugin setting, and an empty value keeps the setting's threshold. `sign-on` sets it for every seat it launches, to the launch's compaction threshold or else empty. Any other value is logged and ignored, and the session stays opted in at the setting's threshold.
- **Plugin settings can opt in every session and set the threshold.** `compactAtRest` is off by default. The threshold is 70 by default.

## Skills

| Skill | Role | Invocation |
|---|---|---|
| `steward` | Drives one multi-agent effort from its top bead. | model-invoked, so `muster` can load it. Its description says to use it only when invoked by name, or when `muster` hands an effort to the seat it runs in. |
| `worker` | Executes one bead as a berth in an effort. The steward starts it with `sign-on`, posts its brief, then types `/boatyard:worker <topic>` into its berth. | slash only |
| `muster` | Turns a body of work into an effort a steward can drive cold, then hands it to a steward. A seat a person works in takes the effort over itself, by loading `steward`. A seat with a standing role, such as one that answers in its project's channel, launches a separate steward with `sign-on`. | model-invoked, so an agent told to start an effort can run it from its own seat. Its description says to use it only when invoked by name. |
| `tally` | A read-only roll-up of every live effort and what each needs from a human. | model-invoked, so plain questions reach it. Its description says "boatyard" and "effort". |

An effort is its top bead and everything that bead depends on, followed transitively across trackers. The top bead states the outcome the effort delivers, and parent links put nothing in an effort. `muster` adopts or files the top bead rather than creating an epic to anchor the effort. It files the work as observable outcomes, each wired to the outcomes it needs, and places a bead that is true only after a release or deployment downstream of that release. An epic is an "and" over the outcomes it depends on. The steward is started with the top bead, and the effort's slug, index line and berth are keyed on it. The effort ends when someone who has seen the evidence for its outcome closes the top bead.

The slash-only skill sets `disable-model-invocation: true`, because plugin skills cannot be disabled one at a time. Claude Code then refuses it to the Skill tool, so only a typed command or a launch prompt starts it.

The skills contain no multiplexer syntax. They call only `sign-on` and `berth`. Coordination runs over [commy](https://github.com/CodeForBreakfast/commy), with each effort indexed in a `boatyard` topic in its project's channel, and the [beads](https://github.com/gastownhall/beads) graph is the system of record. A worker records its berth id as `agent_pane` on the bead it is working, so bead viewers can draw the berth against its work. A steward claims its top bead, so `tally` on any machine can tell a running effort from a parked one.

Readiness comes from `bdi`, the reader in [beady-eye](https://github.com/CodeForBreakfast/beady-eye), because an effort's edges cross trackers and `bd ready` and `bd blocked` do not follow an edge into another tracker. The steward and `muster` judge from the top bead's tree in `bdi` what can start, what waits and what is in delivery, and `tally` reads every effort through it. `bd` stays for looking a record up by id, label, metadata or closed status.

Pull requests are GitHub's. The skills read, wait on and merge them with `gh` and bd's `gh:pr` gates, so a repo hosted anywhere else takes its work by a direct push.

## Packaging

- **One repository, one Claude Code plugin, `boatyard`.** It holds the skills and puts the executables in its `bin/`, which reaches the Bash tool's path.
- **One flake exporting two packages:** `berth` and `sign-on`. The packages matter as much as the plugin. A service manager does not see the plugin's `bin/`, so a host that runs agents under one installs the packages.
- **Host inputs.** The multiplexer package, the Claude Code command and flags, and the settings path are all package arguments or configuration. A host supplies its own.
- **A host keeps its seats' claims alive.** A bd claim's lease lapses unless something renews it, and `tally` reads a steward as live only while its top bead's lease is. The host renews the claims of every running seat, including a seat that is asleep.
- **A host allows the plugin's mod.** Where a host's managed settings limit mods to its organization's, the compaction mod does not load until the host allows it.
- **Runtime dependencies.** The scripts in `bin/` state their dependencies, such as `jq`, for readers who do not use nix.
- **One revision per host.** Claude Code puts a plugin's `bin/` after the ambient path, so where a host installs the packages, the packages run and the plugin supplies only the skills. A host that installs both loads the plugin from the same revision as the packages, with `--plugin-dir` on its Claude Code command.

## Testing

- **Port contract suite.** One suite states what every adapter must do: open in each relationship, list, name, send-text, send-key, wait-text, read, state across all four states, close, and the cascade when an independent berth closes. It runs against every adapter.
  - For herdr, it runs a throwaway server with `HOME` redirected and every `HERDR_*` variable unset. An inherited `HERDR_SOCKET_PATH` would otherwise drive the live session. The server runs inside the nix build sandbox, so the suite is a flake check.
  - herdr treats a process named `claude` as an agent and reads its state from the screen. The suite drives the states with a stand-in process of that name, not with Claude Code.
- **Unit tests.** The compaction mod's rule has its own tests, run by `claude plugin test` against a stand-in engine. So does each adapter's mapping from backend states to the four port states, including the herdr parked-on-background-work and lost-agent corrections.
- **End to end.** One real effort runs on `steward` and `worker`.

## Open decisions

- **The second adapter.** tmux would bring `berth` to the most users. tuios fits the port model most closely. Orca was the original request for a second backend.

## Rejected alternatives

- **Primitive verbs,** which would have given each herdr command a neutral name. The startup gate and screen scraping would have stayed in consumers, and Orca's worktree model would have leaked into them.
- **Teaching the skills several multiplexer dialects.** That doubles the recipes in the documents that are hardest to keep correct.
- **Our own agent-state detection.** Every candidate multiplexer surfaces agent state, so adapters correct their backend instead.
- **Deriving context from the session transcript.** It needs the model's window size, and the transcript format is not documented as stable.
- **A compactor outside the session,** which typed `/compact` into the berth once a statusline tap recorded a low figure. It needed a multiplexer and a tap wired into the user's statusline, and it measured against the whole window rather than the auto-compact point.
