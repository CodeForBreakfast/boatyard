# herdr is an argument so that a host can supply its own build of it.
{ lib, stdenvNoCC, makeWrapper, bash, coreutils, jq, herdr }:

stdenvNoCC.mkDerivation {
  name = "berth";

  src = lib.fileset.toSource {
    root = ../../bin;
    fileset = lib.fileset.unions [ ../../bin/berth ../../bin/berth-herdr ];
  };

  nativeBuildInputs = [ makeWrapper ];
  buildInputs = [ bash ];

  installPhase = ''
    install -Dm755 -t $out/bin berth berth-herdr
    wrapProgram $out/bin/berth --prefix PATH : ${lib.makeBinPath [ coreutils ]}
    wrapProgram $out/bin/berth-herdr --prefix PATH : ${lib.makeBinPath [ coreutils herdr jq ]}
  '';

  meta.mainProgram = "berth";
}
