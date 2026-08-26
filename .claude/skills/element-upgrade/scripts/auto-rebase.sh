#!/usr/bin/env bash
# Déroule un rebase en cours en résolvant automatiquement les seuls conflits « jetables »
# (snapshots jest, baselines visuelles, lockfile) par la version amont, et s'arrête dès
# qu'un conflit demande une décision.
#
# Usage : lancer depuis la racine du dépôt, après avoir démarré le rebase.
#   git rebase --onto <TAG_CIBLE> <TAG_ACTUEL>
#   .claude/skills/element-upgrade/scripts/auto-rebase.sh
#
# Relancer après chaque résolution manuelle (git add <fichiers> puis ce script).
#
# Ces artefacts se régénèrent (`jest -u`, `vitest run -u`, `pnpm install`) : les fusionner
# à la main produit des fichiers faux et coûte du temps pour rien.

set -uo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel) || exit 1
cd "$REPO_ROOT" || exit 1

if [ ! -d .git/rebase-merge ] && [ ! -d .git/rebase-apply ]; then
    echo "Aucun rebase en cours." >&2
    exit 1
fi

stuck=0
last=""

while [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; do
    cur=$(cat .git/rebase-merge/msgnum 2>/dev/null || echo "?")

    # Garde-fou : si l'étape n'avance plus, c'est que `rebase --continue` refuse
    # pour une raison qui n'est pas un conflit (commit vide, hook…). On rend la main
    # en affichant son message plutôt que de boucler.
    if [ "$cur" = "$last" ]; then
        stuck=$((stuck + 1))
    else
        stuck=0
    fi
    last=$cur
    if [ "$stuck" -ge 3 ]; then
        echo "ARRÊT : blocage à l'étape $cur. Sortie de git rebase --continue :"
        git -c core.editor=true rebase --continue 2>&1 | tail -5
        break
    fi

    mapfile -t conflicts < <(git diff --name-only --diff-filter=U)

    if [ ${#conflicts[@]} -gt 0 ]; then
        auto=1
        for f in "${conflicts[@]}"; do
            case "$f" in
                *__snapshots__*|*__vis__*|pnpm-lock.yaml) ;;
                *) auto=0 ;;
            esac
        done

        if [ $auto -eq 0 ]; then
            echo "ARRÊT à l'étape $cur — conflits nécessitant une décision :"
            printf '  %s\n' "${conflicts[@]}"
            echo
            echo "Commit en cours : $(git log -1 --format='%s' "$(cat .git/rebase-merge/stopped-sha 2>/dev/null)" 2>/dev/null)"
            break
        fi

        for f in "${conflicts[@]}"; do
            # `:2:` = version amont (--ours pendant un rebase). Absente => supprimée en amont.
            if git cat-file -e ":2:$f" 2>/dev/null; then
                git checkout --ours -- "$f" && git add -- "$f"
            else
                git rm -q -- "$f"
            fi
        done
        echo "étape $cur : ${#conflicts[@]} artefact(s) aligné(s) sur l'amont"
    fi

    git -c core.editor=true rebase --continue >/dev/null 2>&1 || true
done

echo "---"
if [ -d .git/rebase-merge ]; then
    echo "étape $(cat .git/rebase-merge/msgnum)/$(cat .git/rebase-merge/end)"
else
    echo "REBASE TERMINÉ"
    echo "Pensez à régénérer les snapshots et baselines mis de côté (voir references/verification.md)."
fi
