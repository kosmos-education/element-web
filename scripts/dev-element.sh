#!/usr/bin/env bash
#
# Lance Element en local : install, build des packages partagés, config de dev,
# puis webpack-dev-server. Voir PENSE-BETE.md pour le détail des étapes.

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
  4. démarrage du dev-server sur http://localhost:8080

Options :
  -s, --skip-install   Saute « pnpm install » (deps inchangées : plus rapide)
      --no-build       Saute le build des packages/** (modif uniquement dans apps/web/src)
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
    log "Étape 1/4 — pnpm install ignoré (--skip-install)"
else
    log "Étape 1/4 — Installation des dépendances (pnpm install)"
    pnpm install
fi

if [ "$DO_BUILD" -eq 0 ]; then
    log "Étape 2/4 — build des packages/** ignoré (--no-build)"
else
    log "Étape 2/4 — Build des packages partagés (shared-components, module-api)"
    pnpm -r --filter "./packages/**" build
fi

if [ -f apps/web/config.json ]; then
    log "Étape 3/4 — apps/web/config.json déjà présent, conservé tel quel"
else
    log "Étape 3/4 — Création de apps/web/config.json depuis config.sample.json"
    cp apps/web/config.sample.json apps/web/config.json
    echo "    Adapte-le si besoin (homeserver, etc.)."
fi

log "Étape 4/4 — Démarrage du dev-server → http://localhost:8080 (Ctrl+C pour arrêter)"
exec pnpm --dir apps/web start
