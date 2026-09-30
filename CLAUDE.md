# boatyard — working notes

`docs/design.md` is the spec.

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
to `main` directly.

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
