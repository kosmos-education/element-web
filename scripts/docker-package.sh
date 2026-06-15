#!/usr/bin/env bash

set -ex

DIR=$(dirname "$0")

# Version dérivée du dernier tag git (ex: v1.12.21 -> 1.12.21), suffixée -kosmos
DIST_VERSION=$(git describe --abbrev=0 --tags)
DIST_VERSION=$("$DIR"/normalize-version.sh "$DIST_VERSION")
DIST_VERSION="${DIST_VERSION}-kosmos"

echo $DIST_VERSION

VERSION=$DIST_VERSION pnpm --dir apps/web build

pushd /src/apps/web/webapp
tar --exclude='..' --exclude='.' -czf ../element-web-${DIST_VERSION}.tgz * .*
echo $NEXUS_USER
echo $NEXUS_PASS
curl -k -u $NEXUS_USER:$NEXUS_PASS --upload-file ../element-web-${DIST_VERSION}.tgz https://nexus.nantes.kosmos.fr/nexus/repository/kdecole.internal.raw/element-web-${DIST_VERSION}.tgz
popd
