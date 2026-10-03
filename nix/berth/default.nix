{ pkgs }:

let
  berth = pkgs.callPackage ./package.nix { };

  # Each suite runs against a herdr server of its own inside the build
  # sandbox.
  herdrSuite = suite: pkgs.runCommand "berth-${suite}"
    { nativeBuildInputs = [ berth pkgs.bash pkgs.coreutils pkgs.herdr pkgs.jq ]; } ''
    bash ${../../tests/with-herdr-yard} bash ${../../tests + "/${suite}"}
    touch $out
  '';
in
{
  packages.berth = berth;

  checks = {
    berth-contract-herdr = herdrSuite "berth-contract";
    berth-herdr-layout = herdrSuite "herdr-layout";
    berth-herdr-lost-agent = herdrSuite "herdr-lost-agent";

    berth-herdr-state = pkgs.runCommand "berth-herdr-state"
      { nativeBuildInputs = [ berth pkgs.bash pkgs.jq ]; } ''
      bash ${../../tests/herdr-state}
      touch $out
    '';

    berth-shellcheck = pkgs.runCommand "berth-shellcheck"
      { nativeBuildInputs = [ pkgs.shellcheck ]; } ''
      shellcheck ${../../bin/berth} ${../../bin/berth-herdr} ${../../bin/berth-herdr-state} \
        ${../../tests/with-herdr-yard} ${../../tests/berth-contract} ${../../tests/herdr-layout} \
        ${../../tests/herdr-state} ${../../tests/herdr-lost-agent}
      touch $out
    '';
  };
}
