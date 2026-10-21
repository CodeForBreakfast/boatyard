# herdr is an argument so that a host can supply its own build of it. A host
# can instead name a herdr binary at run time with BERTH_HERDR.
{ lib, stdenvNoCC, makeWrapper, bash, coreutils, jq, herdr }:

stdenvNoCC.mkDerivation {
  name = "berth";

  src = lib.fileset.toSource {
    root = ../../bin;
    fileset = lib.fileset.unions [ ../../bin/berth ../../bin/berth-herdr ../../bin/berth-herdr-state ];
  };

  nativeBuildInputs = [ makeWrapper ];
  buildInputs = [ bash ];

  installPhase = ''
    install -Dm755 -t $out/bin berth berth-herdr berth-herdr-state
    wrapProgram $out/bin/berth --prefix PATH : ${lib.makeBinPath [ coreutils ]}
    wrapProgram $out/bin/berth-herdr --prefix PATH : ${lib.makeBinPath [ coreutils jq ]} \
      --set-default BERTH_HERDR ${herdr}/bin/herdr
    wrapProgram $out/bin/berth-herdr-state --prefix PATH : ${lib.makeBinPath [ jq ]}
  '';

  meta.mainProgram = "berth";
}
