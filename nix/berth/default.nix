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

    berth-shellcheck = pkgs.runCommand "berth-shellcheck"
      { nativeBuildInputs = [ pkgs.shellcheck ]; } ''
      shellcheck ${../../bin/berth} ${../../bin/berth-herdr} \
        ${../../tests/with-herdr-yard} ${../../tests/berth-contract} ${../../tests/herdr-layout}
      touch $out
    '';
  };
}
