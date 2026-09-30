{ pkgs }:

let
  bilge-pump = pkgs.callPackage ./package.nix { };
in
{
  packages.bilge-pump = bilge-pump;

  checks = {
    bilge-pump-tests = pkgs.runCommand "bilge-pump-tests"
      { nativeBuildInputs = [ bilge-pump pkgs.bash pkgs.coreutils pkgs.jq ]; } ''
      bash ${../../tests/bilge-pump}
      touch $out
    '';

    bilge-pump-shellcheck = pkgs.runCommand "bilge-pump-shellcheck"
      { nativeBuildInputs = [ pkgs.shellcheck ]; } ''
      shellcheck ${../../bin/bilge-pump} ${../../bin/bilge-pump-decide} \
        ${../../bin/bilge-pump-tap} ${../../tests/bilge-pump}
      touch $out
    '';
  };
}
