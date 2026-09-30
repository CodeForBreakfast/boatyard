# The host's site-specific parts are arguments, so that a host supplies its
# own Claude Code command and gate. callPackage fills an argument from nixpkgs
# wherever nixpkgs has an attribute of that name, so none of these may share
# one.
#
# berth and bilge-pump are not dependencies: sign-on uses whichever the host
# puts on the path.
{ lib, stdenvNoCC, makeWrapper, bash, coreutils, git
, claudeCommand ? "claude"
, startupGate ? null
, mcpStartupTimeout ? null
, startupTimeout ? 180
}:

stdenvNoCC.mkDerivation {
  name = "sign-on";

  src = lib.fileset.toSource {
    root = ../../bin;
    fileset = ../../bin/sign-on;
  };

  nativeBuildInputs = [ makeWrapper ];
  buildInputs = [ bash ];

  installPhase = ''
    install -Dm755 -t $out/bin sign-on
    wrapProgram $out/bin/sign-on --prefix PATH : ${lib.makeBinPath [ coreutils git ]} \
      --set-default SIGN_ON_CLAUDE ${lib.escapeShellArg claudeCommand} \
      --set-default SIGN_ON_START_TIMEOUT ${toString startupTimeout} \
      ${lib.optionalString (startupGate != null) "--set-default SIGN_ON_GATE ${lib.escapeShellArg startupGate}"} \
      ${lib.optionalString (mcpStartupTimeout != null) "--set-default SIGN_ON_MCP_TIMEOUT ${toString mcpStartupTimeout}"}
  '';

  meta.mainProgram = "sign-on";
}
