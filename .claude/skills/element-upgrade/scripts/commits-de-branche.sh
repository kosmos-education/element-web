#!/usr/bin/env bash
# Diagnostique une branche de lot non fusionnée avant de l'intégrer à une nouvelle release.
#
# Le piège : ces branches ont souvent été rebasées entre-temps et portent une copie
# ré-hashée — et parfois ANTÉRIEURE — de travaux déjà présents dans la release. Les
# rejouer en bloc régresserait la branche de livraison. Ce script sépare les commits
# réellement propres à la branche du reste, et signale si la branche est en retard.
#
# Usage :
#   .claude/skills/element-upgrade/scripts/commits-de-branche.sh \
#       kosmos/release/v1.12.22-2 kosmos/SCAT-42-masquer-onglets-parametrage

set -euo pipefail

if [ $# -ne 2 ]; then
    echo "Usage : $0 <BRANCHE_RELEASE_ACTUELLE> <BRANCHE_LOT>" >&2
    exit 1
fi

RELEASE=$1
BRANCHE=$2

cd "$(git rev-parse --show-toplevel)"

for ref in "$RELEASE" "$BRANCHE"; do
    git rev-parse --verify --quiet "$ref" >/dev/null || {
        echo "Référence introuvable : $ref" >&2
        exit 1
    }
done

echo "### $BRANCHE"
echo

# git cherry compare par patch-id : '+' = contenu absent de la release, '-' = déjà présent.
echo "Commits dont le contenu est ABSENT de $RELEASE :"
git cherry "$RELEASE" "$BRANCHE" | grep '^+' | while read -r _ sha; do
    echo "  $(git log --oneline -1 --format='%h %s' "$sha")"
done
echo

echo "### La branche est-elle en retard sur la release ?"
echo "    (des suppressions = la branche porte un état ANTÉRIEUR de fichiers que"
echo "     la release possède déjà à jour → ne pas rebaser en bloc)"
echo
git diff --stat "$RELEASE" "$BRANCHE" | tail -25
echo

suppressions=$(git diff --numstat "$RELEASE" "$BRANCHE" | awk '$2 > 0 && $1 == 0 {n++} END {print n+0}')
echo "---"
if [ "$suppressions" -gt 0 ]; then
    echo "⚠️  $suppressions fichier(s) uniquement supprimé(s) côté branche."
    echo "   La branche est probablement en retard. Reprendre par cherry-pick CIBLÉ"
    echo "   des seuls commits fonctionnels listés ci-dessus, sur la nouvelle branche"
    echo "   release — et laisser la branche d'origine intacte."
else
    echo "→ Pas de signe de retard. Un rebase complet de la branche est envisageable :"
    echo "     BASE=\$(git merge-base $RELEASE $BRANCHE)"
    echo "     git rebase --onto <NOUVELLE_RELEASE> \"\$BASE\" $BRANCHE"
fi
