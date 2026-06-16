#!/usr/bin/env bash

set -ex

DIR=$(dirname "$0")

# Version dérivée du dernier tag git (ex: v1.12.21 -> 1.12.21), suffixée -kosmos
# Exception : branche kosmos/<xxx> avec xxx != "release" → on utilise le nom de branche en lowercase
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" =~ ^kosmos/(.+)$ ]] && [[ "${BASH_REMATCH[1]}" != release* ]]; then
    DIST_VERSION=$(echo "$CURRENT_BRANCH" | tr '/' '-' | tr '[:upper:]' '[:lower:]')
else
    DIST_VERSION=$(git describe --abbrev=0 --tags)
    DIST_VERSION=$("$DIR"/normalize-version.sh "$DIST_VERSION")
    DIST_VERSION="${DIST_VERSION}-kosmos"
fi

echo $DIST_VERSION

# Les packages partagés (module-api, shared-components, …) sont consommés par webpack
# via leur artefact buildé (dist/), pas via leurs sources. Le target nx "apps/web build"
# n'a pas de dependsOn:["^build"], donc les packages NE sont PAS rebuildés automatiquement.
# On les rebuilde ici, de façon systématique, AVANT l'app.
# NX_SKIP_NX_CACHE=true garantit un build frais à chaque CI (jamais de dist/ servi depuis le cache).
# Cf. docs/kosmos-customizations.md — section "Build pipeline".
NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build

VERSION=$DIST_VERSION pnpm --dir apps/web build

pushd /src/apps/web/webapp
tar --exclude='..' --exclude='.' -czf ../element-web-${DIST_VERSION}.tgz * .*
echo $NEXUS_USER
echo $NEXUS_PASS
curl -k -u $NEXUS_USER:$NEXUS_PASS --upload-file ../element-web-${DIST_VERSION}.tgz https://nexus.nantes.kosmos.fr/nexus/repository/kdecole.internal.raw/element-web-${DIST_VERSION}.tgz
popd
