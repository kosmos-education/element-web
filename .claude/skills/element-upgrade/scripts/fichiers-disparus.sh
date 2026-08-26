#!/usr/bin/env bash
# Liste les fichiers que le fork customise et que l'amont a supprimés ou déplacés
# entre deux tags. À lancer AVANT le rebase : le résultat prédit les conflits
# « modifié par nous / supprimé par eux » et signale les alignements de tests à
# re-héberger plutôt qu'à récupérer.
#
# Usage :
#   .claude/skills/element-upgrade/scripts/fichiers-disparus.sh v1.12.22 v1.12.26 kosmos/release/v1.12.22-2

set -euo pipefail

if [ $# -ne 3 ]; then
    echo "Usage : $0 <TAG_ACTUEL> <TAG_CIBLE> <BRANCHE_RELEASE_ACTUELLE>" >&2
    exit 1
fi

TAG_ACTUEL=$1
TAG_CIBLE=$2
BRANCHE=$3

cd "$(git rev-parse --show-toplevel)"

for ref in "$TAG_ACTUEL" "$TAG_CIBLE" "$BRANCHE"; do
    git rev-parse --verify --quiet "$ref" >/dev/null || {
        echo "Référence introuvable : $ref (un git fetch upstream --tags manque ?)" >&2
        exit 1
    }
done

echo "### Écart amont $TAG_ACTUEL → $TAG_CIBLE"
echo "  commits : $(git rev-list --count "$TAG_ACTUEL".."$TAG_CIBLE")"
echo "  $(git diff --shortstat "$TAG_ACTUEL".."$TAG_CIBLE")"
echo
echo "### Commits Kosmos à rejouer : $(git rev-list --count "$TAG_ACTUEL".."$BRANCHE")"
echo
echo "### Fichiers customisés par le fork et DISPARUS en $TAG_CIBLE"
echo "    (chercher où ils sont partis : un test peut avoir été co-localisé plutôt que supprimé)"
echo

disparus=0
while read -r f; do
    # Ignorer les fichiers créés par Kosmos : ils n'ont jamais existé en amont.
    git cat-file -e "$TAG_ACTUEL:$f" 2>/dev/null || continue
    if ! git cat-file -e "$TAG_CIBLE:$f" 2>/dev/null; then
        echo "  ✗ $f"
        # Proposer un candidat de renommage sur la base du nom de fichier.
        base=$(basename "$f" | sed -E 's/\.(tsx?|snap|pcss)$//; s/-test$//; s/\.test$//')
        # Sous 5 caractères, le nom de base est trop générique ("app", "utils") et
        # la recherche remonterait tout le dépôt : mieux vaut ne rien proposer.
        if [ ${#base} -ge 5 ]; then
            candidats=$(git ls-tree -r --name-only "$TAG_CIBLE" | grep -F "$base" | head -3 || true)
            if [ -n "$candidats" ]; then
                echo "$candidats" | sed 's/^/       candidat → /'
            fi
        fi
        disparus=$((disparus + 1))
    fi
done < <(git diff --name-only "$TAG_ACTUEL".."$BRANCHE")

echo
if [ "$disparus" -eq 0 ]; then
    echo "→ Aucun fichier customisé supprimé en amont."
else
    echo "→ $disparus fichier(s). Pour chacun : entériner la suppression si la"
    echo "  fonctionnalité a disparu, ou porter le patch vers le candidat si le"
    echo "  fichier a simplement été déplacé ou renommé."
fi
