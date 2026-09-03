#!/usr/bin/env bash

# Release Element Web depuis un poste de dev, quand la CI Jenkins n'est pas disponible.
#
# Produit, en une passe, ce que produit la chaîne CI (Jenkinsfile → apps/web/Dockerfile →
# scripts/docker-package.sh) : l'archive à plat poussée sur Nexus et l'image Docker
# skolengo/element-web. Le build tourne nativement sur le poste, pas dans le conteneur
# builder.
#
# Usage :
#   ./scripts/local-release.sh                                   # build + archive + image locale
#   ./scripts/local-release.sh --registry nexus.example.fr:5000  # image taguée pour le registry
#   ./scripts/local-release.sh --registry <hôte> --push          # + upload Nexus + push registry
#
# Options :
#   --version <v>       force la version (défaut : scripts/dist-version.sh)
#   --registry <hôte>   registry Docker sous la forme hôte[:port][/chemin], SANS schéma
#                       http(s):// (c'est un préfixe de tag Docker, pas une URL)
#   --nexus-repo <url>  dépôt Nexus recevant l'archive
#   --image-name <nom>  nom de l'image sans le registry (défaut : skolengo/element-web)
#   --push              pousse l'archive sur Nexus ET l'image sur le registry
#   --push-nexus        pousse uniquement l'archive sur Nexus
#   --push-image        pousse uniquement l'image sur le registry
#   --no-image          saute la construction de l'image
#   --dry-run           affiche version, archive, image et destinations, puis s'arrête
#                       (permet de vérifier les URLs sans lancer un build de dix minutes)
#
# Variables d'environnement — destinations :
#   DOCKER_REGISTRY   registry Docker, équivalent de --registry, sous la forme
#                     hôte[:port][/chemin] (aucun défaut : l'hôte n'est pas dans le dépôt,
#                     il vient de la librairie Jenkins kosmos_pipeline)
#   NEXUS_REPO        dépôt Nexus, équivalent de --nexus-repo
#                     (défaut : https://nexus.nantes.kosmos.fr/nexus/repository/kdecole.internal.raw)
#   IMAGE_NAME        nom de l'image, équivalent de --image-name (défaut : skolengo/element-web)
#   Les options de la ligne de commande ont priorité sur ces variables.
#
# Variables d'environnement — reste :
#   NEXUS_USER / NEXUS_PASS   requis pour tout upload Nexus
#   GIT_BRANCH                override de branche pour le calcul de version (rarement utile)
#   Optionnelles, lues par webpack : SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG,
#   SENTRY_PROJECT, SENTRY_URL, RIOT_OG_IMAGE_URL, CSP_EXTRA_SOURCE.
#   CI_PACKAGE désactiverait la minification : le script refuse de démarrer si elle est définie.
#
# Doc complète : docs/kosmos-release-locale.md

set -eo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Destinations : valeurs par défaut du dépôt, surchargeables par l'environnement, puis par
# les options de la ligne de commande.
# Le défaut ne s'applique que si la variable est absente : une variable définie mais vide
# est une erreur de configuration, pas une demande de valeur par défaut — on la laisse vide
# pour que la validation plus bas la rejette.
NEXUS_REPO="${NEXUS_REPO-https://nexus.nantes.kosmos.fr/nexus/repository/kdecole.internal.raw}"
IMAGE_NAME="${IMAGE_NAME-skolengo/element-web}"
# Image intermédiaire, locale, portant /modules (cf. étape « Récupération des modules amont »)
MODULES_IMAGE="element-web-modules-local"
REGISTRY="${DOCKER_REGISTRY-}"

DIST_VERSION=""
PUSH_NEXUS=false
PUSH_IMAGE=false
BUILD_IMAGE=true
DRY_RUN=false

# Affiche l'en-tête de ce fichier (tout le bloc de commentaires qui suit le shebang).
usage() { awk 'NR>2 && /^#/ { sub(/^# ?/, ""); print; next } NR>2 { exit }' "${BASH_SOURCE[0]}"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)     DIST_VERSION="${2:?--version attend une valeur}"; shift 2 ;;
        --registry)    REGISTRY="${2:?--registry attend une valeur}"; shift 2 ;;
        --nexus-repo)  NEXUS_REPO="${2:?--nexus-repo attend une valeur}"; shift 2 ;;
        --image-name)  IMAGE_NAME="${2:?--image-name attend une valeur}"; shift 2 ;;
        --push)        PUSH_NEXUS=true; PUSH_IMAGE=true; shift ;;
        --push-nexus)  PUSH_NEXUS=true; shift ;;
        --push-image)  PUSH_IMAGE=true; shift ;;
        --no-image)    BUILD_IMAGE=false; shift ;;
        --dry-run)     DRY_RUN=true; shift ;;
        -h|--help)     usage; exit 0 ;;
        *)             echo "Option inconnue : $1" >&2; echo; usage >&2; exit 1 ;;
    esac
done

log()  { echo -e "\n\033[1;34m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mErreur :\033[0m $*" >&2; exit 1; }

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Validation, avant tout build : un échec de configuration doit tomber tout de
# suite, pas après dix minutes de webpack.
# ---------------------------------------------------------------------------

# CI_PACKAGE désactive la minification (apps/web/webpack.config.ts) : jamais pour une release.
[[ -n "${CI_PACKAGE:-}" ]] && fail "CI_PACKAGE est définie : la minification serait désactivée."

if $PUSH_NEXUS; then
    if [[ -z "${NEXUS_USER:-}" ]] || [[ -z "${NEXUS_PASS:-}" ]]; then
        fail "upload Nexus demandé mais NEXUS_USER / NEXUS_PASS ne sont pas définies."
    fi
    [[ -n "$NEXUS_REPO" ]] || fail "dépôt Nexus vide : renseigner --nexus-repo ou NEXUS_REPO."
fi

[[ -n "$IMAGE_NAME" ]] || fail "nom d'image vide : renseigner --image-name ou IMAGE_NAME."

if $PUSH_IMAGE; then
    $BUILD_IMAGE || fail "--push-image est incompatible avec --no-image."
    [[ -n "$REGISTRY" ]] || fail "--push-image exige --registry <hôte>."
fi

[[ -n "$DIST_VERSION" ]] || DIST_VERSION=$("$REPO_ROOT"/scripts/dist-version.sh)

# Un tag Docker n'est pas une URL : il ne porte pas de schéma. On tolère un http(s)://
# collé par habitude plutôt que de faire échouer le `docker build` après dix minutes.
if [[ "$REGISTRY" =~ ^https?://(.*)$ ]]; then
    REGISTRY="${BASH_REMATCH[1]}"
    echo "Note : schéma http(s):// retiré du registry, un tag Docker n'en porte pas." >&2
fi
REGISTRY="${REGISTRY%/}"

if [[ -n "$REGISTRY" ]]; then
    IMAGE_TAG="${REGISTRY}/${IMAGE_NAME}:${DIST_VERSION}"
else
    IMAGE_TAG="${IMAGE_NAME}:${DIST_VERSION}"
fi

# Un registry Nexus exposé par chemin (/nexus/repository/<repo>/) ne peut pas être la cible
# d'un push : le client Docker interroge toujours <hôte>/v2/, le chemin étant interprété
# comme un nom d'image. Il faut le port du connecteur Docker du dépôt Nexus.
if [[ "$REGISTRY" == */repository/* || "$REGISTRY" == */nexus/* ]]; then
    echo "Attention : « $REGISTRY » ressemble à une URL de dépôt Nexus, pas à un registry Docker.
    Le client Docker contactera <hôte>/v2/ et ignorera le chemin : le push échouera.
    Utiliser le port du connecteur Docker du dépôt (Nexus → Repository → le dépôt docker →
    « HTTP connector port »), par exemple nexus.nantes.kosmos.fr:8891." >&2
fi

# Validation avant le build : un tag invalide ne doit pas se découvrir après le webpack.
# Forme d'une référence Docker : [hôte[:port]/]chemin[/chemin…]:tag, en minuscules.
if $BUILD_IMAGE && [[ ! "$IMAGE_TAG" =~ ^[a-z0-9]([a-z0-9._-]*[a-z0-9])?(:[0-9]+)?(/[a-z0-9]+([._-][a-z0-9]+)*)*:[A-Za-z0-9_][A-Za-z0-9._-]*$ ]]; then
    fail "tag Docker invalide : $IMAGE_TAG
    Le registry s'écrit hôte[:port][/chemin], sans schéma et en minuscules.
    Exemples : nexus.exemple.fr:8891  |  registry.exemple.fr/kosmos
    Avec Nexus, le registry Docker est généralement exposé sur un port dédié, distinct de
    l'URL /nexus/repository/… utilisée pour l'archive (voir docs/kosmos-release-locale.md)."
fi

TARBALL="$REPO_ROOT/apps/web/dist/element-web-${DIST_VERSION}.tgz"

log "Version de distribution : $DIST_VERSION"
echo "    archive  : $TARBALL"
$BUILD_IMAGE && echo "    image    : $IMAGE_TAG"
echo "    upload   : Nexus=$PUSH_NEXUS  registry=$PUSH_IMAGE"
echo "    dépôt    : ${NEXUS_REPO%/}/element-web-${DIST_VERSION}.tgz"

if $DRY_RUN; then
    log "--dry-run : rien n'a été construit ni publié."
    exit 0
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

# Sur un poste de dev, apps/web/webapp/ accumule les artefacts des runs de
# webpack-dev-server (fichiers *.hot-update.*, bundles obsolètes, config.json de dev).
# Webpack n'y fait pas le ménage : sans ce nettoyage l'archive embarque plusieurs Go de
# déchets et la configuration locale. Le conteneur builder de la CI part, lui, d'un
# répertoire vierge.
log "Nettoyage de apps/web/webapp"
rm -rf "$REPO_ROOT/apps/web/webapp"

# apps/web/src/modules.js est gitignoré et n'est généré par aucune dépendance de la cible
# "build" : on le génère explicitement (indispensable sur un checkout propre).
log "Génération du module system"
pnpm --dir apps/web exec nx prebuild:module_system

# webpack consomme les dist/ des packages partagés, pas leurs sources : sans ce build, les
# customisations Kosmos (thème « La Bulle », etc.) sont absentes du bundle.
# Cf. docs/kosmos-customizations.md — section "Build pipeline".
log "Build des packages partagés"
NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build

# Le module de customisations Kosmos vit dans modules/, pas dans packages/ : le filtre
# ci-dessus ne le couvre pas. Son bundle (lib/, gitignoré) est copié dans webapp/ par
# webpack, donc il doit être buildé AVANT l'app — sinon la copie est silencieusement
# ignorée (noErrorOnMissing) et l'image part sans les customisations.
log "Build du module de customisations Kosmos"
NX_SKIP_NX_CACHE=true pnpm --filter @kosmos/element-web-module-customisations build

log "Build de l'application"
VERSION=$DIST_VERSION pnpm --dir apps/web build

# ---------------------------------------------------------------------------
# Archive : contenu de webapp/ à la racine du tgz, forme attendue par les cibles nginx —
# à ne pas confondre avec apps/web/scripts/package.sh (upstream) qui encapsule tout dans
# un dossier element-<version>/.
# ---------------------------------------------------------------------------
log "Création de l'archive"
mkdir -p "$REPO_ROOT/apps/web/dist"
# Filet de sécurité : une config locale ne doit jamais partir dans une release.
rm -f "$REPO_ROOT/apps/web/webapp/config.json"
(
    cd "$REPO_ROOT/apps/web/webapp"
    tar --exclude='..' --exclude='.' -czf "$TARBALL" * .*
)
echo "    $(du -h "$TARBALL" | cut -f1)"

if $BUILD_IMAGE; then
    # Les modules amont (banner, restricted-guests, widget-lifecycle, widget-toggles) sont
    # embarqués par le dernier stage du Dockerfile de production, donc présents dans l'image
    # de la CI et injectés dans config.json au runtime par l'entrypoint. On les récupère du
    # stage `modules` du Dockerfile de production plutôt que de redéclarer leurs versions et
    # leurs checksums ici. Ce stage part d'une image alpine et ne dépend pas du builder :
    # son build est immédiat.
    log "Récupération des modules amont"
    docker build -f apps/web/Dockerfile --target modules -t "$MODULES_IMAGE" "$REPO_ROOT"

    log "Construction de l'image $IMAGE_TAG"
    # Nexus 3.22 (le registry cible) n'implémente que le manifeste Docker Schema 2 : il
    # rejette avec « error from registry: unknown » aussi bien les listes de manifestes que
    # les mediatypes OCI. Avec BuildKit et le magasin d'images containerd, le défaut est
    # justement un index OCI accompagné d'une attestation de provenance, d'où :
    #   --provenance=false --sbom=false  : pas d'attestation, donc pas d'index
    #   --platform linux/amd64           : une seule plateforme, donc pas de liste
    #   oci-mediatypes=false             : mediatypes Docker et non OCI
    # `--output type=image` n'est disponible qu'avec le magasin d'images containerd. Sur le
    # magasin historique, `docker build -t` produit déjà du Docker Schema 2 : rien à forcer.
    if docker info 2>/dev/null | grep -q 'io.containerd.snapshotter'; then
        docker build -f apps/web/Dockerfile.local \
            --build-arg "MODULES_IMAGE=$MODULES_IMAGE" \
            --provenance=false --sbom=false --platform linux/amd64 \
            --output "type=image,name=${IMAGE_TAG},oci-mediatypes=false" \
            "$REPO_ROOT"
    else
        docker build -f apps/web/Dockerfile.local \
            --build-arg "MODULES_IMAGE=$MODULES_IMAGE" \
            --provenance=false --sbom=false --platform linux/amd64 \
            -t "$IMAGE_TAG" "$REPO_ROOT"
    fi

    # Garde-fou : un manifeste OCI ou une liste de manifestes serait accepté couche par
    # couche puis rejeté par Nexus avec « error from registry: unknown ».
    MEDIATYPE=$(docker image inspect "$IMAGE_TAG" --format '{{.Descriptor.MediaType}}' 2>/dev/null || true)
    if [[ -n "$MEDIATYPE" && "$MEDIATYPE" != "application/vnd.docker.distribution.manifest.v2+json" ]]; then
        fail "manifeste au format « $MEDIATYPE », or Nexus 3.22 n'accepte que
    application/vnd.docker.distribution.manifest.v2+json (cf. docs/kosmos-release-locale.md)."
    fi
    echo "    manifeste : ${MEDIATYPE:-non déterminé}"
fi

# ---------------------------------------------------------------------------
# Publication
# ---------------------------------------------------------------------------

if $PUSH_NEXUS; then
    log "Upload de l'archive sur Nexus"
    # -k : le certificat de Nexus n'est pas vérifiable, comme dans la chaîne CI.
    # Les credentials passent par un fichier de config curl pour n'apparaître ni dans la
    # ligne de commande (ps) ni dans les logs.
    CURL_CONFIG=$(mktemp)
    trap 'rm -f "$CURL_CONFIG"' EXIT
    printf 'user = "%s:%s"\n' "$NEXUS_USER" "$NEXUS_PASS" > "$CURL_CONFIG"
    NEXUS_URL="${NEXUS_REPO%/}/element-web-${DIST_VERSION}.tgz"
    curl -k --fail --show-error --silent --config "$CURL_CONFIG" \
        --upload-file "$TARBALL" "$NEXUS_URL"
    echo "    $NEXUS_URL"
fi

[[ -n "$IMAGE_NAME" ]] || fail "nom d'image vide : renseigner --image-name ou IMAGE_NAME."

if $PUSH_IMAGE; then
    log "Push de l'image"
    docker push "$IMAGE_TAG"
fi

# ---------------------------------------------------------------------------
log "Terminé"
echo "    archive              : $TARBALL"
$PUSH_NEXUS && echo "    publiée sur Nexus    : oui" || echo "    publiée sur Nexus    : non"
if $BUILD_IMAGE; then
    echo "    image                : $IMAGE_TAG"
    $PUSH_IMAGE && echo "    poussée sur registry : oui" || echo "    poussée sur registry : non"
fi
