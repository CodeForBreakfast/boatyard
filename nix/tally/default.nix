{ pkgs }:

{
  checks = {
    tally-efforts = pkgs.runCommand "tally-efforts"
      { nativeBuildInputs = [ pkgs.bash pkgs.coreutils pkgs.gawk pkgs.jq ]; } ''
      bash ${../../tests/tally-efforts} ${../../skills/tally/efforts}
      touch $out
    '';

    tally-shellcheck = pkgs.runCommand "tally-shellcheck"
      { nativeBuildInputs = [ pkgs.shellcheck ]; } ''
      shellcheck ${../../skills/tally/efforts} ${../../tests/tally-efforts}
      touch $out
    '';
  };
}
