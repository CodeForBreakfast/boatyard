{ pkgs }:

let
  sign-on = pkgs.callPackage ./package.nix { };
  berth = pkgs.callPackage ../berth/package.nix { };
  bilge-pump = pkgs.callPackage ../bilge-pump/package.nix { };
in
{
  packages.sign-on = sign-on;

  checks = {
    sign-on-herdr = pkgs.runCommand "sign-on-herdr"
      {
        nativeBuildInputs = [ sign-on berth bilge-pump pkgs.bash pkgs.coreutils pkgs.git pkgs.herdr pkgs.jq ];
      } ''
      bash ${../../tests/with-herdr-yard} bash ${../../tests/sign-on}
      touch $out
    '';

    sign-on-shellcheck = pkgs.runCommand "sign-on-shellcheck"
      { nativeBuildInputs = [ pkgs.shellcheck ]; } ''
      shellcheck ${../../bin/sign-on} ${../../tests/sign-on}
      touch $out
    '';
  };
}
