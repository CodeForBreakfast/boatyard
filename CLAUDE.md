# boatyard — working notes

`docs/design.md` is the spec.

## What boatyard owns

boatyard runs coding agents in terminal multiplexer panes and coordinates them.
These are decided and changed here, and nowhere else:

- **The port.** `berth`, its verbs, its four agent states, and one adapter per
  multiplexer, herdr's first.
- **The launcher.** `sign-on`, including how it gets a seat past Claude Code's
  startup gate.
- **The compactor.** The plugin's mod that compacts a session at rest.
- **The orchestration skills.** `steward`, `worker`, `muster` and `tally`, and
  the plugin that carries them.
- **The packaging.** The flake, its packages and checks, and the rules for how
  a host supplies its multiplexer and Claude Code command.
- **The design.** `docs/design.md`.

A user's deployment, configuration and data live with that user, not here.

## What it does not own

- **Messaging between agents.** The skills post through a messaging layer. Its
  maintainers own it, and boatyard only uses it.
- **The bead tracker and its client.** The upstream beads project owns `bd`.
  The maintainers of the tracker viewer own the viewer that draws seats against
  beads.
- **The multiplexer itself.** herdr and any later backend belong to their
  upstream projects. boatyard writes adapters for them.
- **Claude Code.** Its behaviour, flags and startup gate belong to Anthropic.
  boatyard works around them.
- **Which hosts run boatyard, and how.** Whoever runs it installs the packages
  and plugin, and owns the persistent agent set, its service units, and the
  Claude Code settings, permissions and hooks.
- **Tooling a deployment ran before boatyard.** Whoever runs boatyard retires
  whatever it replaces.
- **The work an effort does.** Each effort's repo owns its own code and its own
  beads. boatyard only coordinates the seats.

A seat here may decline an ask outside this remit, and says where it belongs.

## Building and testing

`nix develop` gives you the toolchain. `nix flake check` is the whole of CI, and
`check-before-push` is what to run before you push: it runs the check, and
refuses a dirty tree rather than check a source nix cannot see all of.

Each component is a directory under `nix/`, and its `default.nix` returns that
component's packages and checks. The flake reads every such directory, so a new
component adds its own directory and edits nothing shared.

## PR policy

Changes reach `main` through a pull request, squash-merged. Nothing is pushed
to `main` directly.

The pull request's title becomes the commit subject and its body the commit
message. The title is a conventional commit with a closed set of scopes. Run
`conventional-subject '<title>'` in the dev shell before you open the pull
request: it prints nothing for a title CI will take, and says what is wrong
with any other.

Say what changed in the subject and why in the body, in a sentence or two.
Don't wrap the body: GitHub renders a wrapped one as ragged short lines.

## Only invented examples go in the repo

Every example this repository carries is invented: a fixture, inline test data,
a sample config, a worked example in the docs. Never a real capture: no real
pane id, working directory, session name, host, bead description, client or
project. A pull request's title and body land on `main`, so the rule covers
them too.
