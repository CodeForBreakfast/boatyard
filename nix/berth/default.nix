{ pkgs }:

let
  berth = pkgs.callPackage ./package.nix { };
  sign-on = pkgs.callPackage ../sign-on/package.nix { };

  openByHand = pkgs.writeShellScript "herdr-open-by-hand" ''
    exec bash ${../../tests/herdr-open-by-hand} "$@"
  '';

  # Each suite runs against a herdr server of its own inside the build
  # sandbox.
  herdrSuite = suite: pkgs.runCommand "berth-${suite}"
    { nativeBuildInputs = [ berth pkgs.bash pkgs.coreutils pkgs.herdr pkgs.jq ]; } ''
    export BERTH_OPEN_BY_HAND=${openByHand}
    bash ${../../tests/with-herdr-yard} bash ${../../tests + "/${suite}"}
    touch $out
  '';

  openByHandInApp = pkgs.writeShellScript "herdr-app-open-by-hand" ''
    exec bash ${../../tests/herdr-app-open-by-hand} "$@"
  '';

  # Each suite runs against a herdr-core of its own inside the build sandbox.
  # hc cannot type text without pressing Enter, so text that berth holds for
  # the next Enter does not show on screen until then.
  herdrAppSuite = suite: pkgs.runCommand "berth-${suite}-herdr-app"
    { nativeBuildInputs = [ berth sign-on pkgs.bash pkgs.coreutils pkgs.flock pkgs.herdr-core pkgs.jq ]; } ''
    export BERTH_OPEN_BY_HAND=${openByHandInApp}
    export BERTH_CONTRACT_GAPS=unsent-text-shows
    bash ${../../tests/with-herdr-app-yard} bash ${../../tests + "/${suite}"}
    touch $out
  '';
in
{
  packages.berth = berth;

  checks = {
    berth-contract-herdr = herdrSuite "berth-contract";
    berth-contract-herdr-app = herdrAppSuite "berth-contract";
    berth-herdr-app-caller = herdrAppSuite "herdr-app-caller";
    berth-herdr-app-restore = herdrAppSuite "herdr-app-restore";
    berth-herdr-layout = herdrSuite "herdr-layout";
    berth-herdr-lost-agent = herdrSuite "herdr-lost-agent";
    berth-herdr-session = herdrSuite "herdr-session";
    berth-herdr-caller = herdrSuite "herdr-caller";
    berth-herdr-shell-start = herdrSuite "herdr-shell-start";
    berth-herdr-binary = herdrSuite "herdr-binary";
    berth-herdr-restore = herdrSuite "herdr-restore";

    berth-herdr-state = pkgs.runCommand "berth-herdr-state"
      { nativeBuildInputs = [ berth pkgs.bash pkgs.jq ]; } ''
      bash ${../../tests/herdr-state}
      touch $out
    '';

    berth-usage = pkgs.runCommand "berth-usage"
      { nativeBuildInputs = [ pkgs.bash pkgs.coreutils ]; } ''
      bash ${../../tests/berth-usage} ${../../bin/berth}
      touch $out
    '';

    berth-shellcheck = pkgs.runCommand "berth-shellcheck"
      { nativeBuildInputs = [ pkgs.shellcheck ]; } ''
      shellcheck ${../../bin/berth} ${../../bin/berth-herdr} ${../../bin/berth-herdr-state} \
        ${../../tests/with-herdr-yard} ${../../tests/berth-contract} ${../../tests/herdr-layout} \
        ${../../tests/herdr-state} ${../../tests/herdr-lost-agent} ${../../tests/herdr-caller} \
        ${../../tests/herdr-shell-start} ${../../tests/herdr-binary} ${../../tests/herdr-session} ${../../tests/herdr-restore} \
        ${../../tests/berth-usage} ${../../tests/herdr-open-by-hand} \
        ${../../bin/berth-herdr-app} ${../../tests/with-herdr-app-yard} ${../../tests/herdr-app-open-by-hand} \
        ${../../tests/herdr-app-caller} ${../../tests/herdr-app-restore}
      touch $out
    '';
  };
}
