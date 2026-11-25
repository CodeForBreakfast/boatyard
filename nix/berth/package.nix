# herdr and herdr-core are arguments so that a host can supply its own builds
# of them. A host can instead name a herdr binary at run time with
# BERTH_HERDR.
{ lib, stdenvNoCC, makeWrapper, bash, coreutils, flock, gnugrep, jq, herdr, herdr-core }:

stdenvNoCC.mkDerivation {
  name = "berth";

  src = lib.fileset.toSource {
    root = ../../bin;
    fileset = lib.fileset.unions [
      ../../bin/berth
      ../../bin/berth-herdr
      ../../bin/berth-herdr-state
      ../../bin/berth-herdr-app
    ];
  };

  nativeBuildInputs = [ makeWrapper ];
  buildInputs = [ bash ];

  installPhase = ''
    install -Dm755 -t $out/bin berth berth-herdr berth-herdr-state berth-herdr-app
    wrapProgram $out/bin/berth --prefix PATH : ${lib.makeBinPath [ coreutils ]}
    wrapProgram $out/bin/berth-herdr --prefix PATH : ${lib.makeBinPath [ coreutils jq ]} \
      --set-default BERTH_HERDR ${herdr}/bin/herdr
    wrapProgram $out/bin/berth-herdr-state --prefix PATH : ${lib.makeBinPath [ jq ]}
    wrapProgram $out/bin/berth-herdr-app --prefix PATH : ${lib.makeBinPath [ coreutils flock gnugrep jq herdr-core ]}
  '';

  meta.mainProgram = "berth";
}
