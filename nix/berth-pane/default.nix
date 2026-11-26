{ pkgs }:

let
  # The folder a host puts in the herdr app's mods folder, as it is.
  berth-pane = pkgs.runCommand "berth-pane" { } ''
    cp -r ${../../herdr-app/berth-pane} $out
  '';
in
{
  packages.berth-pane = berth-pane;

  checks.berth-pane-loads = pkgs.runCommand "berth-pane-loads"
    { nativeBuildInputs = [ pkgs.herdr-desktop ]; } ''
    export HOME="$TMPDIR" HERDR_APP_HOME="$TMPDIR/herdr-app"
    mkdir -p "$HERDR_APP_HOME/mods"
    cp -r ${berth-pane} "$HERDR_APP_HOME/mods/berth-pane"
    chmod -R u+w "$HERDR_APP_HOME/mods/berth-pane"
    herdr-app check "$HERDR_APP_HOME/mods/berth-pane"
    touch $out
  '';
}
