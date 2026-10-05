# boatyard — working notes

`docs/design.md` is the spec.

## What boatyard owns

boatyard runs coding agents in terminal multiplexer panes and coordinates them.
These are decided and changed here, and nowhere else:

- **The port.** `berth`, its verbs, its four agent states, and one adapter per
  multiplexer, herdr's first.
- **The launcher.** `sign-on`, including how it gets a seat past Claude Code's
  startup gate.
- **The compactor.** `bilge-pump` and its statusline tap.
- **The orchestration skills.** `steward`, `worker`, `muster` and `tally`, and
  the plugin that carries them.
- **The packaging.** The flake, its packages and checks, and the rules for how
  a host supplies its multiplexer, Claude Code command and state directory.
- **The design.** `docs/design.md`, and the migration steps it sets out.

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
  its old fleet skills, launcher and monitor.
- **The work an effort does.** Each effort's repo owns its own code and its own
  beads. boatyard only coordinates the seats.

A seat here may decline an ask outside this remit, and says where it belongs.

## Building and testing

`nix develop` gives you the toolchain. `nix flake check` is the whole of CI, and
`check-before-push` is what to run before you push: it runs the check, and
refuses a dirty tree rather than check a source nix cannot see all of.

A check in the flake's `checks` output is a check CI runs. Adding one there is
how you add one.

Each component is a directory under `nix/`, and its `default.nix` returns that
component's packages and checks. The flake reads every such directory, so a new
component adds its own directory and edits nothing shared.

## PR policy

Changes reach `main` through a pull request, squash-merged. Nothing is pushed
to `main` directly. A steward merges a pull request once its checks pass.

The pull request's **title** becomes the commit subject and its body becomes the
commit message. Write the title as a conventional commit:

    type(scope): description

- **type** is one of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
  `refactor`, `revert`, `style`, `test`. A `!` before the colon marks a breaking
  change.
- **scope** is optional and closed: `berth`, `bilge-pump`, `sign-on`, `skills`,
  `ci`, `flake`, `docs`, `tests`, `deps`. Leave it out rather than coin one; a
  new scope is a change to the check.
- **description** is lower case, in the imperative, and has no full stop at the
  end. It has to finish the sentence *"If applied, this commit will …"*. An
  acronym or a name keeps its capitals.
- **72 characters**.

Say what changed in the subject and why in the body, in a sentence or two.
Don't wrap the body: GitHub renders a wrapped one as ragged short lines.

The `conventional subject` job refuses a title that is none of this. Run
`conventional-subject '<title>'` in the dev shell for the same verdict before
you open the pull request. It prints nothing when the title passes.

## Only invented examples go in the repo

Every example this repository carries is invented: a fixture, inline test data,
a sample config, a worked example in the docs. Never a real capture: no real
pane id, working directory, session name, host, bead description, client or
project. A pull request's title and body land on `main`, so the rule covers
them too.
