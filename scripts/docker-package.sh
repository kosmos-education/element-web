#!/usr/bin/env bash

set -ex

DIR=$(dirname "$0")

# Branche courante + version : cf. scripts/dist-version.sh (règle partagée avec
# scripts/local-release.sh).
DIST_VERSION=$("$DIR"/dist-version.sh)

echo $DIST_VERSION

# Les packages partagés (module-api, shared-components, …) sont consommés par webpack
# via leur artefact buildé (dist/), pas via leurs sources. Le target nx "apps/web build"
# n'a pas de dependsOn:["^build"], donc les packages NE sont PAS rebuildés automatiquement.
# On les rebuilde ici, de façon systématique, AVANT l'app.
# NX_SKIP_NX_CACHE=true garantit un build frais à chaque CI (jamais de dist/ servi depuis le cache).
# Cf. docs/kosmos-customizations.md — section "Build pipeline".
NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build

# Le module de customisations Kosmos est chargé au runtime via config.json (`modules`).
# Son bundle (lib/, gitignoré) est copié dans webapp/ par webpack — il doit donc être
# buildé AVANT l'app, sinon la copie est silencieusement ignorée (noErrorOnMissing).
NX_SKIP_NX_CACHE=true pnpm --filter @kosmos/element-web-module-customisations build

VERSION=$DIST_VERSION pnpm --dir apps/web build

pushd /src/apps/web/webapp
tar --exclude='..' --exclude='.' -czf ../element-web-${DIST_VERSION}.tgz * .*
echo $NEXUS_USER
echo $NEXUS_PASS
curl -k -u $NEXUS_USER:$NEXUS_PASS --upload-file ../element-web-${DIST_VERSION}.tgz https://nexus.nantes.kosmos.fr/nexus/repository/kdecole.internal.raw/element-web-${DIST_VERSION}.tgz
popd
