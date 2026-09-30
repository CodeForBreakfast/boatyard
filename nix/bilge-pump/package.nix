# berth is not a dependency: bilge-pump uses whichever berth the host puts on
# the path, and refuses to start without one.
{ lib, stdenvNoCC, makeWrapper, bash, coreutils, jq, perl }:

stdenvNoCC.mkDerivation {
  name = "bilge-pump";

  src = lib.fileset.toSource {
    root = ../../bin;
    fileset = lib.fileset.unions [
      ../../bin/bilge-pump
      ../../bin/bilge-pump-decide
      ../../bin/bilge-pump-tap
    ];
  };

  nativeBuildInputs = [ makeWrapper ];
  buildInputs = [ bash ];

  installPhase = ''
    install -Dm755 -t $out/bin bilge-pump bilge-pump-decide bilge-pump-tap
    wrapProgram $out/bin/bilge-pump --prefix PATH : ${lib.makeBinPath [ coreutils perl ]}
    wrapProgram $out/bin/bilge-pump-tap --prefix PATH : ${lib.makeBinPath [ coreutils jq ]}
  '';

  meta.mainProgram = "bilge-pump";
}
