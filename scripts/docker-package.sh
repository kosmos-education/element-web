#!/usr/bin/env bash

set -ex

BRANCH=$(git rev-parse --abbrev-ref HEAD)

DIR=$(dirname "$0")

# If the branch comes out as HEAD then we're probably checked out to a tag, so if the thing is *not*
# coming out as HEAD then we're on a branch. When we're on a branch, we want to resolve ourselves to
# a few SHAs rather than a version.
if [[ $BRANCH != HEAD && ! $BRANCH =~ heads/v.+ ]]
then
    DIST_VERSION=$("$DIR"/get-version-from-git.sh)
else
    DIST_VERSION=$(git describe --abbrev=0 --tags)
fi

DIST_VERSION=$("$DIR"/normalize-version.sh "$DIST_VERSION")

VERSION=$DIST_VERSION yarn build

pushd /src/webapp
tar --exclude='..' --exclude='.' -czf ../element-web-${DIST_VERSION}.tgz * .*
echo $NEXUS_USER
echo $NEXUS_PASS
curl -k -u $NEXUS_USER:$NEXUS_PASS --upload-file ../element-web-${DIST_VERSION}.tgz https://nexus.nantes.kosmos.fr/nexus/repository/kdecole.internal.raw/element-web-${DIST_VERSION}.tgz
popd
