#!/usr/bin/env bash

set -ex

DIR=$(dirname "$0")

# Détermination de la branche courante, de façon robuste :
#  1. $GIT_BRANCH : injectée par la CI (build-arg Docker), fiable même en detached HEAD ;
#  2. git rev-parse --abbrev-ref HEAD : dev local sur une vraie branche ;
#  3. fallback (detached HEAD sans $GIT_BRANCH) : ref remote pointant sur HEAD.
CURRENT_BRANCH="${GIT_BRANCH:-}"
if [[ -z "$CURRENT_BRANCH" || "$CURRENT_BRANCH" == "HEAD" ]]; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi
if [[ "$CURRENT_BRANCH" == "HEAD" ]]; then
    CURRENT_BRANCH=$(git for-each-ref --format='%(refname:short)' --points-at HEAD 'refs/remotes/origin/*' | head -n1 || true)
fi
CURRENT_BRANCH="${CURRENT_BRANCH#origin/}"

# Version, par ordre de priorité :
#  - branche release kosmos/release/vX.Y.Z → version = X.Y.Z-kosmos (indépendant des tags poussés)
#  - autre branche kosmos/<xxx> → nom de branche slugifié en lowercase
#  - sinon (develop, fallback) → dernier tag git (ex: v1.12.21 -> 1.12.21-kosmos)
if [[ "$CURRENT_BRANCH" =~ ^kosmos/release/(v[0-9]+\.[0-9]+\.[0-9]+.*)$ ]]; then
    DIST_VERSION=$("$DIR"/normalize-version.sh "${BASH_REMATCH[1]}")
    DIST_VERSION="${DIST_VERSION}-kosmos"
elif [[ "$CURRENT_BRANCH" =~ ^kosmos/(.+)$ ]]; then
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
