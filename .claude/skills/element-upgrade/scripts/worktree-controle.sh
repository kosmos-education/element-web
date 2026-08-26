#!/usr/bin/env bash
# Rejoue une commande de test sur le tag upstream VIERGE, dans un worktree jetable.
#
# Sert à trancher une question qui revient à chaque montée de version : « cet échec
# vient-il de nos customisations, ou existe-t-il déjà en amont ? » Sans cette preuve,
# on perd des heures à "corriger" des tests qui dépendent du fuseau horaire, de la
# locale de la machine, ou du typage d'une dépendance — et on risque surtout de
# maquiller un vrai problème.
#
# Usage :
#   .claude/skills/element-upgrade/scripts/worktree-controle.sh v1.12.26 \
#       'cd apps/web && pnpm exec jest test/unit-tests/components/structures/RoomView-test.tsx'
#
# Le worktree est supprimé à la sortie, y compris en cas d'interruption.

set -euo pipefail

if [ $# -ne 2 ]; then
    echo "Usage : $0 <TAG_CIBLE> '<COMMANDE_DE_TEST>'" >&2
    exit 1
fi

TAG=$1
CMD=$2

cd "$(git rev-parse --show-toplevel)"
git rev-parse --verify --quiet "$TAG" >/dev/null || {
    echo "Tag introuvable : $TAG" >&2
    exit 1
}

WT=$(mktemp -d -t element-controle-XXXXXX)
cleanup() {
    git worktree remove --force "$WT" >/dev/null 2>&1 || true
    rm -rf "$WT" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

rm -rf "$WT"
git worktree add -f "$WT" "$TAG" >/dev/null

echo "### Worktree de contrôle sur $TAG"
(
    cd "$WT"
    # Le store pnpm est partagé : l'installation est rapide sur une machine déjà chaude.
    pnpm install --frozen-lockfile >/dev/null 2>&1
    # Webpack et jest consomment le dist/ des packages partagés, pas leurs sources.
    pnpm -r --filter "./packages/**" build >/dev/null 2>&1
    echo "--- sortie de la commande sur le tag vierge :"
    eval "$CMD"
)

echo
echo "→ Si l'échec se reproduit ci-dessus, il est AMONT : le mentionner explicitement"
echo "  dans le commit d'adaptation et le ticket, sans tenter de le corriger."
echo "  Sinon, il vient des customisations et doit être traité."
