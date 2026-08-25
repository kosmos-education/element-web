#!/usr/bin/env bash
#
# Lance Element en local : install, build des packages partagés, config de dev,
# prébuilds nx, puis webpack-dev-server. Voir PENSE-BETE.md pour le détail des étapes.
#
# On n'utilise PAS « pnpm --dir apps/web start » (= nx start) : sa cible déclare
# dependsOn ["…", "^build", "^start"], et le « ^start » de packages/shared-components
# est « vite build --watch », une tâche continue que nx lance EN PARALLÈLE de
# webpack-dev-server. Comme vite vide dist/ à chaque passe (emptyOutDir par défaut) et
# que « numbers » est sa dernière entrée émise, webpack résout parfois pendant la
# fenêtre où dist/ est vide et échoue sur :
#   Module not found: Package path ./numbers is exported from
#   @element-hq/web-shared-components, but no valid target file was found
# On rejoue donc les prébuilds et on appelle webpack-dev-server directement, ce qui
# supprime la course. Contrepartie : pas de rebuild à chaud de packages/**, il faut
# relancer ce script après une modif dans packages/**.

set -euo pipefail

SKIP_INSTALL=0
DO_BUILD=1

usage() {
    cat <<'USAGE'
Usage: ./scripts/dev-element.sh [options]

Rejoue la séquence complète de lancement d'Element en local :
  1. pnpm install
  2. build des packages/** (indispensable pour les customisations Kosmos)
  3. création de apps/web/config.json s'il est absent
  4. prébuilds nx (module_system, rethemendex)
  5. démarrage du dev-server sur http://localhost:8080

Le hot-reload de apps/web/src reste actif. En revanche une modif dans packages/**
n'est PAS reprise à chaud : relancer le script.

Options :
  -s, --skip-install   Saute « pnpm install » (deps inchangées : plus rapide)
      --no-build       Ne rebuild pas les packages/**, se fie au dist/ existant
  -h, --help           Affiche cette aide
USAGE
}

while [ $# -gt 0 ]; do
    case "$1" in
        -s | --skip-install)
            SKIP_INSTALL=1
            ;;
        --no-build)
            DO_BUILD=0
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            echo "Option inconnue : $1" >&2
            echo >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

log() {
    echo
    echo "==> $*"
}

cd "$(dirname "$0")/.."

if ! command -v pnpm > /dev/null 2>&1; then
    echo "Erreur : pnpm est introuvable dans le PATH." >&2
    echo "Installe-le (par ex. « corepack enable pnpm ») puis relance ce script." >&2
    exit 1
fi

if [ "$SKIP_INSTALL" -eq 1 ]; then
    log "Étape 1/5 — pnpm install ignoré (--skip-install)"
else
    log "Étape 1/5 — Installation des dépendances (pnpm install)"
    pnpm install
fi

SHARED_DIST_PROBE="packages/shared-components/dist/numbers.js"

if [ "$DO_BUILD" -eq 0 ]; then
    log "Étape 2/5 — build des packages/** ignoré (--no-build)"
    if [ ! -f "$SHARED_DIST_PROBE" ]; then
        echo "Erreur : $SHARED_DIST_PROBE est absent." >&2
        echo "Comme nx ne rebuild plus les packages ici, webpack échouerait sur" >&2
        echo "« Package path ./numbers […] no valid target file was found »." >&2
        echo "Relance sans --no-build." >&2
        exit 1
    fi
else
    log "Étape 2/5 — Build des packages partagés (shared-components, module-api)"
    pnpm -r --filter "./packages/**" build
fi

if [ -f apps/web/config.json ]; then
    log "Étape 3/5 — apps/web/config.json déjà présent, conservé tel quel"
else
    log "Étape 3/5 — Création de apps/web/config.json depuis config.sample.json"
    cp apps/web/config.sample.json apps/web/config.json
    echo "    Adapte-le si besoin (homeserver, etc.)."
fi

log "Étape 4/5 — Prébuilds nx (module_system, rethemendex)"
pnpm --dir apps/web exec nx prebuild:module_system
pnpm --dir apps/web exec nx prebuild:rethemendex

log "Étape 5/5 — Démarrage du dev-server → http://localhost:8080 (Ctrl+C pour arrêter)"
# Commande recopiée à l'identique depuis la cible « start » de apps/web/project.json.
# La resynchroniser si elle évolue en amont.
exec pnpm --dir apps/web exec webpack-dev-server \
    --output-path webapp \
    --output-filename="bundles/_dev_/[name].js" \
    --output-chunk-filename="bundles/_dev_/[name].js" \
    --mode development
