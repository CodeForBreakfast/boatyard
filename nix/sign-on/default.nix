{ pkgs }:

let
  sign-on = pkgs.callPackage ./package.nix { };
  berth = pkgs.callPackage ../berth/package.nix { };

  signOnSuite = name: yard: backend: pkgs.runCommand name
    {
      nativeBuildInputs = [ sign-on berth pkgs.bash pkgs.coreutils pkgs.git pkgs.jq ] ++ backend;
    } ''
    bash ${yard} bash ${../../tests/sign-on}
    touch $out
  '';
in
{
  packages.sign-on = sign-on;

  checks = {
    sign-on-herdr = signOnSuite "sign-on-herdr" ../../tests/with-herdr-yard [ pkgs.herdr ];
    sign-on-herdr-app = signOnSuite "sign-on-herdr-app" ../../tests/with-herdr-app-yard
      [ pkgs.flock pkgs.herdr-core ];

    sign-on-shellcheck = pkgs.runCommand "sign-on-shellcheck"
      { nativeBuildInputs = [ pkgs.shellcheck ]; } ''
      shellcheck ${../../bin/sign-on} ${../../tests/sign-on}
      touch $out
    '';
  };
}
