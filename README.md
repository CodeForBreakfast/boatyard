# boatyard

boatyard runs several Claude Code agents through one backlog. Each agent works in a terminal multiplexer pane of its own, called a berth. A steward agent drives an effort from its top bead, starts a worker agent for each piece of work that is ready, and keeps track of them until the work lands. The work and its state live in a [beads](https://github.com/gastownhall/beads) tracker, so a seat that dies can be replaced without losing anything.

It also compacts an agent's context when the agent is at rest, before it runs low, so the next message lands on a lean session instead of one about to auto-compact mid-turn.

boatyard is one developer's daily setup, published as it is. It supports one multiplexer, [herdr](https://github.com/herdrdev/herdr), and one agent, Claude Code. It has no other users yet, so expect rough edges.

## What is in it

- **`berth`** is a small command for opening, naming, reading and closing terminal panes, and for asking whether the agent in one is busy, at rest, waiting on a person or gone. The skills only ever talk to the multiplexer through it, and herdr is its first backend.
- **`sign-on`** launches Claude Code in a new berth and gets it past Claude Code's startup prompt.
- **The Claude Code plugin** carries four skills and the compaction mod:
  - `muster` turns a body of work into an effort a steward can drive.
  - `steward` drives one effort.
  - `worker` does one bead's worth of work inside an effort.
  - `tally` reports every effort that is running and what each one needs from you.

[`docs/design.md`](docs/design.md) is the full design.

## What a host needs

- **herdr**, with the agents running inside it.
- **Claude Code.**
- **A beads tracker** for each project an effort touches, and the `bd` client.
- **[commy](https://github.com/CodeForBreakfast/commy)**, which carries the messages between the steward, its workers and you.
- **[beady-eye](https://github.com/CodeForBreakfast/beady-eye)**, which wakes an agent when a bead it waits on changes, and whose `bdi` reads readiness across trackers.
- **GitHub and its `gh` client**, for a repo that takes work through pull requests. A repo hosted anywhere else takes its work by a direct push.
- **Nix**, if you install the packages from the flake. Without it, you need `bash`, `coreutils`, `git` and `jq` on the path.

## Install

### The packages

The flake exports `berth` and `sign-on`:

```sh
nix profile install github:CodeForBreakfast/boatyard#berth github:CodeForBreakfast/boatyard#sign-on
```

Without Nix, put the scripts in `bin/` on your path.

Install the packages even though the plugin carries the same scripts. A service manager does not see the plugin's `bin/`, so anything started outside Claude Code needs them on the path.

### The plugin

Load the plugin from a checkout of the same revision as the packages:

```sh
git clone https://github.com/CodeForBreakfast/boatyard ~/src/boatyard
claude --plugin-dir ~/src/boatyard
```

If your managed settings allow only your own organization's plugin mods, allow this one too, or the compaction mod does not load.

### Configuration

`berth` needs to know which multiplexer it drives:

```sh
export BERTH_BACKEND=herdr
```

`sign-on` reads the Claude Code command and its startup settings from the environment. The header of [`bin/sign-on`](bin/sign-on) lists them. The command must include the `--plugin-dir` flag, so that every seat loads the plugin:

```sh
export SIGN_ON_CLAUDE="claude --plugin-dir $HOME/src/boatyard"
```

With Nix, set the same things as package arguments instead:

```nix
boatyard.packages.${system}.sign-on.override {
  claudeCommand = "claude --plugin-dir ${boatyard}";
}
```

`berth` takes `herdr` as an argument in the same way, so a host can supply its own build.

Compaction is off unless a session opts in. `sign-on` opts in every seat it launches. To opt in every session, turn on the plugin's `compactAtRest` setting.

Each seat needs permission to run `berth` and `sign-on`. bd leases a claim for a limited time, so the host also has to renew the claims of its running seats.

## A first seat

From inside herdr, open a Claude Code seat in a workspace of its own:

```sh
sign-on --as independent --cwd ~/src/example-app --label "example-app" --focus
```

To start an effort, type `/boatyard:muster` and describe the work. Once the work is ready to drive, the seat becomes the effort's steward.

## Developing

`nix develop` gives you the toolchain, and `nix flake check` runs every test. [`CLAUDE.md`](CLAUDE.md) has the conventions for a change.

## Licence

Apache 2.0. See [LICENSE](LICENSE).
