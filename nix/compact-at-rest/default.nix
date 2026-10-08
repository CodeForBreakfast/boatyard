{ pkgs }:

let
  # Claude Code is unfree, and the flake's nixpkgs takes no unfree package
  # but this one.
  claude-code = (import pkgs.path {
    inherit (pkgs) system;
    config.allowUnfreePredicate = pkg: pkgs.lib.getName pkg == "claude-code";
  }).claude-code;

  plugin = pkgs.lib.fileset.toSource {
    root = ../..;
    fileset = pkgs.lib.fileset.unions [
      ../../.claude-plugin
      ../../hooks
    ];
  };
in
{
  checks.compact-at-rest-tests = pkgs.runCommand "compact-at-rest-tests"
    { nativeBuildInputs = [ claude-code ]; } ''
    export HOME="$TMPDIR"
    cp -r ${plugin} plugin
    chmod -R u+w plugin
    claude plugin validate plugin
    claude plugin test plugin
    touch $out
  '';
}
