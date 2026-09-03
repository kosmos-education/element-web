#!/usr/bin/env bash

# Calcule la version de distribution (DIST_VERSION) depuis l'état git et l'écrit sur stdout.
# Utilisé par scripts/docker-package.sh (build CI) et scripts/local-release.sh (build poste).
# Toute règle de versionnage doit vivre ici, et nulle part ailleurs.

set -e

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Détermination de la branche courante, de façon robuste (le checkout CI est en detached
# HEAD, donc `rev-parse --abbrev-ref HEAD` renvoie "HEAD"). Par ordre de priorité :
#  1. $GIT_BRANCH : override manuel optionnel (env), si défini ;
#  2. git symbolic-ref : branche checkout-ée (dev local, HEAD non détaché) ;
#  3. refspec de fetch : Jenkins écrit remote.<x>.fetch = +refs/heads/<branche>:... dans
#     .git/config, bind-monté dans le conteneur. C'est la source fiable en CI (detached
#     HEAD) et elle ne dépend d'aucun paramètre passé à pipelineDocker / au docker build ;
#  4. ref remote pointant sur HEAD (dernier recours).
CURRENT_BRANCH="${GIT_BRANCH:-}"
CURRENT_BRANCH="${CURRENT_BRANCH#origin/}"

if [[ -z "$CURRENT_BRANCH" || "$CURRENT_BRANCH" == "HEAD" ]]; then
    CURRENT_BRANCH=$(git symbolic-ref --short -q HEAD || true)
fi

if [[ -z "$CURRENT_BRANCH" ]]; then
    # Extrait la branche d'un refspec de fetch non-wildcard (checkout Jenkins mono-branche)
    while read -r _ refspec; do
        src="${refspec%%:*}"   # partie gauche du refspec (ex: +refs/heads/kosmos/release/v1.12.22)
        src="${src#+}"         # retire le '+' éventuel
        case "$src" in
            refs/heads/*"*"*) ;;                                    # wildcard (+refs/heads/*) → ignorer
            refs/heads/?*) CURRENT_BRANCH="${src#refs/heads/}"; break ;;
        esac
    done < <(git config --get-regexp '^remote\..*\.fetch$' || true)
fi

if [[ -z "$CURRENT_BRANCH" ]]; then
    CURRENT_BRANCH=$(git for-each-ref --format='%(refname:short)' --points-at HEAD 'refs/remotes/**' | head -n1 || true)
    CURRENT_BRANCH="${CURRENT_BRANCH#*/}"   # retire le préfixe remote (ex: origin/)
fi

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

echo "$DIST_VERSION"
