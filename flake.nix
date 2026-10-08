{
  description = "boatyard - tools and skills for running several Claude Code agents through one backlog";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # bd builds against the nixpkgs beads locked for itself, so there is no
    # `follows` here. A bd on a schema other than its server's cannot read it,
    # so treat this pin as a schema decision, not a version bump.
    beads.url = "github:gastownhall/beads/v1.3.0";
  };

  outputs = { self, nixpkgs, flake-utils, beads }:
    let
      # Not eachDefaultSystem: nixpkgs unstable has dropped x86_64-darwin, so
      # the flake cannot evaluate there.
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
    in
    flake-utils.lib.eachSystem systems (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # `nix flake check` reads the git index, so an untracked file is not in
        # the source it checks and a green result says nothing about it.
        # Refusing the tree the check cannot see all of is what puts that out
        # of reach.
        checkBeforePush = pkgs.writeShellScriptBin "check-before-push" ''
          set -u

          git=${pkgs.git}/bin/git

          cd "$($git rev-parse --show-toplevel)" || exit 1

          dirty="$($git status --porcelain)"
          if [ -n "$dirty" ]; then
            echo "check-before-push: this tree is dirty, so a check of it would not"
            echo "be a check of what you are about to push."
            echo
            printf '%s\n' "$dirty"

            untracked="$($git ls-files --others --exclude-standard)"
            if [ -n "$untracked" ]; then
              echo
              echo "These are untracked, so the check would not see them at all:"
              printf '%s\n' "$untracked"
            fi

            echo
            echo "Commit, then run this again."
            exit 1
          fi

          exec nix flake check -L "$@"
        '';

        checkBeforePushTest = pkgs.runCommand "check-before-push-test"
          { nativeBuildInputs = [ pkgs.git checkBeforePush ]; } ''
          set -u
          export HOME="$TMPDIR"
          export GIT_CONFIG_GLOBAL="$TMPDIR/gitconfig"
          export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
          export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
          git config --global init.defaultBranch main

          repo="$TMPDIR/repo"
          git init --quiet "$repo"
          printf 'one\n' > "$repo/a.txt"
          git -C "$repo" add a.txt
          git -C "$repo" commit --quiet -m base
          printf 'scratch\n' > "$repo/notes.txt"

          output="$( cd "$repo" && check-before-push 2>&1 )" && status=0 || status=$?

          fail() { echo "FAIL: $1"; echo "$output"; exit 1; }
          [ "$status" = 1 ] || fail "expected a refusal (exit 1), got $status:"
          case "$output" in
            *notes.txt*) ;;
            *) fail "the refusal did not name the untracked file:" ;;
          esac

          touch $out
        '';

        workerClaimTest = pkgs.runCommand "worker-claim-test"
          { nativeBuildInputs = [ beads.packages.${system}.bd pkgs.bash pkgs.coreutils pkgs.jq ]; } ''
          bash ${./tests/worker-claim}
          touch $out
        '';

        # The subject main carries comes from the pull request's title, because
        # this repository squash-merges. A title is not in a tree, so this
        # cannot be a `checks` entry: the workflow hands it the string. The
        # rule and its test stay here, and ci.yml holds only the trigger.
        conventionalSubject = pkgs.writeShellScriptBin "conventional-subject" ''
          set -u

          title="''${1-}"

          if [ "$#" -ne 1 ]; then
            echo "usage: conventional-subject <title>" >&2
            exit 2
          fi

          types='build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test'
          scopes='berth|sign-on|skills|ci|flake|docs|tests|deps'

          refuse() {
            echo "This is not a subject main can carry:"
            echo
            echo "  $title"
            echo
            printf '%s\n' "$1"
            exit 1
          }

          # A newline in the title is a body that has been pasted into the
          # subject.
          newline='
'
          carriageReturn="$( printf '\r' )"
          case "$title" in
            *"$newline"* | *"$carriageReturn"*)
              refuse "It has a newline in it, so it is a subject and a body."
              ;;
          esac

          # Read in either case, so a wrong case is told apart from a wrong
          # shape.
          #
          # The character after the colon and space has to be one. A
          # description opening with a blank leaves `firstWord` empty, and an
          # empty first word passes both the case check and the mood check.
          if ! printf '%s' "$title" | grep -Eq '^[A-Za-z]+(\([A-Za-z0-9_-]+\))?!?: [^[:space:]]'; then
            refuse "Write it as \`type(scope): description\`, or \`type: description\`.
A \`!\` before the colon marks a breaking change.

  types:  ''${types//|/ }
  scopes: ''${scopes//|/ }"
          fi

          type="$( printf '%s' "$title" | sed -E 's/^([A-Za-z]+).*/\1/' )"
          scope="$( printf '%s' "$title" | sed -nE 's/^[A-Za-z]+\(([^)]*)\).*/\1/p' )"
          description="''${title#*: }"

          if printf '%s' "$type$scope" | grep -q '[A-Z]'; then
            refuse "A type and a scope are lower case: \`''${type,,}''${scope:+(''${scope,,})}\`."
          fi

          if ! printf '%s' "$type" | grep -Eq "^($types)$"; then
            refuse "\`$type\` is not one of the types: ''${types//|/ }"
          fi

          if [ -n "$scope" ] && ! printf '%s' "$scope" | grep -Eq "^($scopes)$"; then
            refuse "\`$scope\` is not one of the scopes: ''${scopes//|/ }

Leave the scope out rather than coin one; adding a scope means adding it
here too."
          fi

          case "$description" in
            *.) refuse "A description does not end in a full stop." ;;
          esac

          # Only an ordinary capitalised first word is refused, so an acronym
          # or a name keeps its capitals.
          firstWord="''${description%% *}"
          if printf '%s' "$firstWord" | grep -Eq '^[A-Z][a-z]*$'; then
            refuse "A description starts lower case: \`''${firstWord,,}\`, not \`$firstWord\`.
An acronym or a name keeps its capitals."
          fi

          # Imperative mood, which no pattern can read. A suffix cannot stand
          # in for it: `-ing` would refuse `bring`, and `-ed` would refuse
          # `read`, `seed` and `feed`. So the forms that turn up are named
          # instead, which makes this a floor rather than a judge of mood.
          notImperative='adds|added|adding
            addresses|addressed|addressing
            adjusts|adjusted|adjusting
            allows|allowed|allowing
            bumps|bumped|bumping
            changes|changed|changing
            cleans|cleaned|cleaning
            converts|converted|converting
            corrects|corrected|correcting
            creates|created|creating
            deletes|deleted|deleting
            drops|dropped|dropping
            ensures|ensured|ensuring
            extracts|extracted|extracting
            fixes|fixed|fixing
            handles|handled|handling
            implements|implemented|implementing
            improves|improved|improving
            includes|included|including
            introduces|introduced|introducing
            makes|made|making
            merges|merged|merging
            moves|moved|moving
            prevents|prevented|preventing
            refactors|refactored|refactoring
            removes|removed|removing
            renames|renamed|renaming
            replaces|replaced|replacing
            reverts|reverted|reverting
            simplifies|simplified|simplifying
            supports|supported|supporting
            updates|updated|updating
            uses|used|using
            writes|wrote|writing'
          notImperative="$( printf '%s' "$notImperative" | tr -d ' ' | tr '\n' '|' )"
          if printf '%s' "$firstWord" | grep -Eq "^($notImperative)$"; then
            refuse "\`$firstWord\` is not the imperative. A description has to finish the
sentence \"If applied, this commit will …\", so \`open\` rather than
\`opens\`, \`opened\` or \`opening\`."
          fi

          limit=72
          if [ "''${#title}" -gt "$limit" ]; then
            refuse "It is ''${#title} characters. The limit is $limit.

Say what changed here and put the reason in the body, in a sentence or
two. A subject this long prints over two lines in \`git log --oneline\`,
in blame and in bisect."
          fi
        '';

        # Every subject this repository takes goes through the check above, so
        # it passes whether or not it can still refuse one. This is what says
        # it can.
        conventionalSubjectTest = pkgs.runCommand "conventional-subject-test"
          { nativeBuildInputs = [ conventionalSubject ]; } ''
          set -u

          fail() { echo "FAIL: $1"; echo "$output"; exit 1; }

          accepts() {
            output="$( conventional-subject "$@" 2>&1 )" && status=0 || status=$?
            [ "$status" = 0 ] || fail "it refused \`$1\`:"
          }

          refuses() {
            want="$1"
            shift
            output="$( conventional-subject "$@" 2>&1 )" && status=0 || status=$?
            [ "$status" = 1 ] || fail "expected a refusal (exit 1) of \`$1\`, got $status:"
            case "$output" in
              *"$want"*) ;;
              *) fail "the refusal of \`$1\` did not say why ($want):" ;;
            esac
          }

          # A scope, and no scope, which conventional commits leaves optional.
          accepts "feat(berth): open a berth beside the caller"
          accepts "docs: say which backends have an adapter"

          # The breaking-change marker, with a scope and without.
          accepts "feat!: name every berth by its id"
          accepts "fix(sign-on)!: refuse a yard nobody serves"

          # Every type and every scope, so the two lists are asserted rather
          # than described.
          for type in build chore ci docs feat fix perf refactor revert style test; do
            accepts "$type: a subject of no particular interest"
          done
          for scope in berth sign-on skills ci flake docs tests deps; do
            accepts "fix($scope): a subject of no particular interest"
          done

          # The boundary, from both sides. 72 is the limit rather than the
          # first length refused.
          at72="fix(berth): $(printf '%058d' 0)ab"
          [ "''${#at72}" = 72 ] || fail "the fixture is ''${#at72} characters, not 72:"
          accepts "$at72"
          refuses "73 characters" "''${at72}c"

          # A second argument is refused rather than quietly ignored.
          output="$( conventional-subject "fix(berth): close the berth" 133 2>&1 )" &&
            status=0 || status=$?
          [ "$status" = 2 ] || fail "expected exit 2 for a second argument, got $status:"

          # The shape.
          refuses "type(scope): description" "Open a berth beside the caller"
          refuses "type(scope): description" "fix(berth):no space after the colon"
          refuses "type(scope): description" "fix(berth): "

          # A description opening with a blank leaves an empty first word,
          # which neither the case check nor the mood check would refuse.
          refuses "type(scope): description" "fix:  Fixed the berth it opened"
          refuses "type(scope): description" "fix(berth):  fixes the berth"

          # Case is a different complaint from a wrong shape, and has to say
          # so.
          refuses "lower case" "Fix(berth): close the berth"
          refuses "lower case" "fix(Berth): close the berth"

          # A capitalised ordinary word opens none of these. An acronym or a
          # name must survive.
          refuses "full stop" "fix(berth): close the berth."
          refuses "starts lower case" "fix(berth): The yard says what it holds"
          refuses "starts lower case" "fix(berth): A berth is gone once closed"
          accepts "fix(berth): GitHub appends the reference as it squashes"
          accepts "fix(ci): CI seeds its own checks"
          accepts "fix(berth): BERTH_ID survives a respawn"
          accepts "docs(flake): README says what berth needs"

          # The imperative. It must not refuse an imperative that merely looks
          # like one of the forms it names.
          refuses "not the imperative" "fix(berth): fixes the berth it opened"
          refuses "not the imperative" "fix(berth): fixed the berth it opened"
          refuses "not the imperative" "fix(berth): fixing the berth it opened"
          refuses "not the imperative" "fix(berth): updates the label"
          refuses "not the imperative" "fix(berth): made the label shorter"
          accepts "fix(berth): read the screen back before sending a key"
          accepts "ci(flake): seed the dependency builds into the cache"
          accepts "fix(sign-on): feed the agent its first prompt"
          accepts "fix(berth): bring the caller back into focus"

          # A type and a scope outside their lists.
          refuses "\`improve\` is not one of the types" "improve(berth): sharpen a label"
          refuses "\`slipway\` is not one of the scopes" "fix(slipway): keep the berth"

          # A newline would put a body in the subject. An em dash must not be
          # refused with it.
          refuses "newline" "fix(berth): a subject
and a second line"
          accepts "fix(berth): a subject — with an em dash in it"

          # No argument at all is a misuse of the check rather than a bad
          # subject.
          output="$( conventional-subject 2>&1 )" && status=0 || status=$?
          [ "$status" = 2 ] || fail "expected exit 2 with no argument, got $status:"

          touch $out
        '';

        tools = [
          pkgs.git
          checkBeforePush
          conventionalSubject
        ];

        # Each directory under nix/ is one component, whose default.nix takes
        # pkgs and returns its own packages and checks.
        components = map
          (name: import (./nix + "/${name}") { inherit pkgs; })
          (builtins.attrNames (pkgs.lib.filterAttrs (_: type: type == "directory") (builtins.readDir ./nix)));
        componentOutputs = output:
          pkgs.lib.foldl' (merged: component: merged // component.${output} or { }) { } components;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = tools;

          shellHook = ''
            # On stderr, because on stdout it corrupts every
            # `nix develop -c … --json` a caller pipes into a parser.
            echo "⚓ boatyard development shell" >&2
          '';
        };

        # The default shell plus `bd`. Select it with an untracked
        # `.envrc.local` containing `devshell=maintainer`.
        devShells.maintainer = pkgs.mkShell {
          buildInputs = tools ++ [ beads.packages.${system}.bd ];

          shellHook = ''
            # `.beads/` and `.env.local` live in the main checkout only, so a
            # worktree reads both from there.
            main_checkout="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"

            # Setting this at all is also what stops a bare bd from inheriting
            # another project's BEADS_DIR.
            export BEADS_DIR="$main_checkout/.beads"

            # bd's smart remote-migrate gate can migrate a shared server as a
            # side effect of opening it. The server is migrated on purpose, by
            # `bd migrate schema`, which works with the gate off.
            export BD_SMART_GATE=0

            echo "⚓ boatyard maintainer shell" >&2
            # Where bd resolved from, because a version alone cannot tell this
            # shell's bd from PATH's.
            echo "beads: $(bd --version) ($(command -v bd))" >&2

            if [ -f "$main_checkout/.env.local" ]; then
              set -a
              source "$main_checkout/.env.local"
              set +a
            else
              echo "no .env.local, so bd cannot authenticate" >&2
            fi
          '';
        };

        packages = componentOutputs "packages" // {
          conventional-subject = conventionalSubject;
        };

        # `nix flake check` is the whole of CI. Anything CI should run belongs
        # here, not in the workflow that calls it.
        checks = componentOutputs "checks" // {
          check-before-push-test = checkBeforePushTest;
          conventional-subject-test = conventionalSubjectTest;
          worker-claim-test = workerClaimTest;
        };
      }
    );
}
