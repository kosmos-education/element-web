# Release Element Web depuis un poste de dev

Procédure de secours quand la CI Jenkins n'est pas disponible. Elle produit les deux
artefacts de la chaîne normale :

- l'archive `element-web-<version>.tgz` publiée sur Nexus (déploiement nginx sur VM) ;
- l'image Docker `skolengo/element-web:<version>` (déploiement Kubernetes).

Tout passe par un seul script : [`scripts/local-release.sh`](../scripts/local-release.sh).

## En bref

```bash
cd /chemin/vers/element-web
git fetch --tags
pnpm install --frozen-lockfile

docker login nexus.nantes.kosmos.fr:18445
export NEXUS_USER=... NEXUS_PASS=...
./scripts/local-release.sh --registry nexus.nantes.kosmos.fr:18445 --push
```

Sans `--push`, le script se contente de construire l'archive et l'image en local : c'est le
mode à utiliser pour valider un packaging avant de publier.

```bash
./scripts/local-release.sh                     # build + archive + image locale, aucun upload
./scripts/local-release.sh --no-image          # archive seule
./scripts/local-release.sh --push-nexus        # archive + upload Nexus, image non poussée
./scripts/local-release.sh --version 1.2.3-kosmos
./scripts/local-release.sh --dry-run           # affiche version et destinations, ne construit rien
```

## Où vont les artefacts

Les deux destinations ont un défaut dans le script et se surchargent, soit par option, soit
par variable d'environnement — l'option gagne sur la variable.

| Destination | Défaut | Option | Variable |
| --- | --- | --- | --- |
| Dépôt Nexus (archive) | `https://nexus.nantes.kosmos.fr/nexus/repository/kdecole.internal.raw` | `--nexus-repo <url>` | `NEXUS_REPO` |
| Registry Docker (image) | **aucun** — sans lui l'image reste taguée en local ; en pratique `nexus.nantes.kosmos.fr:18445` | `--registry <hôte[:port][/chemin]>` | `DOCKER_REGISTRY` |
| Nom de l'image | `skolengo/element-web` | `--image-name <nom>` | `IMAGE_NAME` |

Le registry n'a volontairement pas de défaut : son hôte n'est nulle part dans le dépôt, il
vient de la librairie Jenkins `kosmos_pipeline` (`pipelineDocker`). Sans `--registry` ni
`DOCKER_REGISTRY`, l'image est construite et taguée `skolengo/element-web:<version>` sur le
poste, et `--push-image` est refusé.

L'archive est déposée à `<dépôt>/element-web-<version>.tgz`, l'image taguée
`<registry>/<nom-image>:<version>`.

```bash
# Tout par variables d'environnement
export NEXUS_USER=... NEXUS_PASS=...
export DOCKER_REGISTRY=registry.exemple.fr:5000
export NEXUS_REPO=https://nexus.exemple.fr/nexus/repository/mon-raw
./scripts/local-release.sh --push

# Ou tout par options
./scripts/local-release.sh --push \
  --registry registry.exemple.fr:5000 \
  --nexus-repo https://nexus.exemple.fr/nexus/repository/mon-raw
```

`--dry-run` affiche les destinations résolues et s'arrête : à utiliser pour vérifier une URL
sans payer dix minutes de build.

```
==> Version de distribution : 1.12.22-2-kosmos
    archive  : /chemin/apps/web/dist/element-web-1.12.22-2-kosmos.tgz
    image    : registry.exemple.fr:5000/skolengo/element-web:1.12.22-2-kosmos
    upload   : Nexus=true  registry=true
    dépôt    : https://nexus.exemple.fr/nexus/repository/mon-raw/element-web-1.12.22-2-kosmos.tgz
```

Une variable **définie mais vide** est traitée comme une erreur de configuration, pas comme
une demande de valeur par défaut : le script s'arrête.

### Le registry n'est pas une URL

Les deux destinations ne s'écrivent pas de la même façon, et c'est la principale source
d'erreur :

- `--nexus-repo` attend une **URL** : `https://hôte/nexus/repository/<dépôt>` ;
- `--registry` attend un **préfixe de tag Docker** : `hôte[:port][/chemin]`, sans schéma et
  en minuscules.

Un `https://` collé sur `--registry` est retiré automatiquement avec une note, et un tag
invalide fait échouer le script **avant** le build. Sans cette validation, l'erreur
`invalid reference format` ne tombait qu'après le webpack.

Attention au cas Nexus : le dépôt Docker d'un Nexus est souvent exposé **par chemin**
(`https://nexus.example.fr/nexus/repository/mon-docker/v2/`), or le client Docker interroge
toujours `<hôte>/v2/` et traite le chemin comme un nom d'image — le push échoue. Il faut le
**port du connecteur Docker** du dépôt, visible dans Nexus sous *Repository → le dépôt docker
→ HTTP connector port* :

```bash
# ✗ URL du dépôt Nexus : le push partirait vers nexus.nantes.kosmos.fr/v2/ (404) et échouerait
./scripts/local-release.sh --registry https://nexus.nantes.kosmos.fr/nexus/repository/docker-kosmos.registry

# ✓ connecteur Docker du dépôt
./scripts/local-release.sh --registry nexus.nantes.kosmos.fr:18445
```

Le script émet un avertissement si le registry contient `/repository/` ou `/nexus/`. Pour
vérifier un endpoint :

```bash
curl -sI https://<hôte>:<port>/v2/ | grep -i docker-distribution
# doit répondre : Docker-Distribution-Api-Version: registry/2.0  (401 attendu sans auth)
```

Sur `nexus.nantes.kosmos.fr:18445`, le certificat TLS est validé sans option particulière :
aucun `insecure-registries` à déclarer dans la configuration Docker. Un `docker login` sur ce
même `hôte:port` est nécessaire avant `--push-image` (les identifiants Nexus servent aux deux,
mais `docker push` lit ceux de `~/.docker/config.json`, pas `NEXUS_USER`/`NEXUS_PASS`).

Le script valide sa configuration **avant** de lancer le build : credentials manquants,
`--push-image` sans `--registry` ou `CI_PACKAGE` définie échouent immédiatement, pas après
dix minutes de webpack.

## Variables d'environnement

Les variables de destination (`NEXUS_REPO`, `DOCKER_REGISTRY`, `IMAGE_NAME`) sont décrites
dans la section précédente.

| Variable | Statut | Rôle |
| --- | --- | --- |
| `NEXUS_USER` / `NEXUS_PASS` | requises pour tout upload Nexus | authentification sur le dépôt Nexus |
| `GIT_BRANCH` | optionnelle | force la branche utilisée pour calculer la version. Inutile en local (HEAD n'est pas détaché) ; c'est un override prévu pour la CI |
| `CI_PACKAGE` | **ne pas définir** | désactiverait la minification ([`apps/web/webpack.config.ts:134`](../apps/web/webpack.config.ts)). Le script refuse de démarrer si elle est présente |
| `SENTRY_DSN` | optionnelle | active le plugin Sentry et les source maps séparées |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_URL` | optionnelles | upload des source maps vers Sentry ; lues implicitement par `sentryWebpackPlugin` |
| `RIOT_OG_IMAGE_URL` | optionnelle | image OpenGraph d'`index.html` (défaut : logo `app.element.io`) |
| `CSP_EXTRA_SOURCE` | optionnelle | source ajoutée aux directives CSP en `'self'` |
| `VERSION`, `NX_SKIP_NX_CACHE` | gérées par le script | ne pas les positionner à la main |

`NPM_TOKEN`, passée par [`Jenkinsfile`](../Jenkinsfile), n'est utilisée nulle part : aucun
`ARG NPM_TOKEN` n'existe dans le Dockerfile. C'est un vestige.

## Version produite

Le calcul vit dans [`scripts/dist-version.sh`](../scripts/dist-version.sh), partagé avec la
chaîne CI pour que les deux ne divergent jamais. Règle, par ordre de priorité :

| Branche | Version |
| --- | --- |
| `kosmos/release/vX.Y.Z…` | `X.Y.Z…-kosmos` (indépendant des tags poussés) |
| `kosmos/<autre>` | nom de branche slugifié en minuscules |
| autre (`develop`, fallback) | dernier tag git + `-kosmos` |

Vérifiable à tout moment :

```bash
./scripts/dist-version.sh      # ex. 1.12.22-2-kosmos
```

## Prérequis du poste

- **Node 24** (`mise.toml`), **pnpm** (le `devEngines` demande 11.2.2 avec `onFail: ignore`,
  une version plus récente passe), **Docker avec BuildKit**, **git avec l'historique
  complet et les tags** (`git fetch --tags` ; le fallback de versionnage utilise
  `git describe`).
- Accès réseau : registre npm, `nexus.nantes.kosmos.fr`, et le registry Docker cible.
- L'hôte du registry n'est **pas** dans le dépôt : il vient de la librairie Jenkins
  `kosmos_pipeline`, d'où l'option `--registry`. Valeur en vigueur :
  `nexus.nantes.kosmos.fr:18445` (connecteur Docker du dépôt `docker-kosmos.registry`).
- `docker login nexus.nantes.kosmos.fr:18445` avant tout `--push-image`.

## Ce que fait le script, étape par étape

1. **Nettoyage de `apps/web/webapp/`.** Indispensable en local : ce répertoire accumule les
   artefacts des runs de `webpack-dev-server` (`*.hot-update.*`, bundles obsolètes,
   `config.json` de dev) et webpack n'y fait pas le ménage. Sans nettoyage l'archive passe
   de ~28 Mo à plusieurs Go et embarque la configuration locale. Le conteneur builder de la
   CI part, lui, d'un répertoire vierge — le problème est propre au poste de dev.
2. **`prebuild:module_system`.** `apps/web/src/modules.js` est gitignoré et n'est généré par
   aucune dépendance de la cible `build` ; sur un checkout propre il faut le produire
   explicitement.
3. **Build des packages partagés** (`NX_SKIP_NX_CACHE=true`). Webpack consomme les `dist/`
   de `packages/**`, pas leurs sources : sauter cette étape retire silencieusement les
   customisations Kosmos (thème « La Bulle », etc.) du bundle. Cf.
   [`docs/kosmos-customizations.md`](kosmos-customizations.md), section « Build pipeline ».
4. **Build du module de customisations Kosmos**
   (`@kosmos/element-web-module-customisations`). Il vit dans `modules/`, pas dans
   `packages/` : le filtre de l'étape précédente ne le couvre pas. Son bundle `lib/` est
   gitignoré et copié dans `webapp/` par webpack en `noErrorOnMissing`, donc un build
   manquant ne produit **aucune erreur** — l'image part simplement sans les customisations.
   Même ordre que [`scripts/docker-package.sh`](../scripts/docker-package.sh).
5. **Build de l'application** avec `VERSION=<version>`.
6. **Archive à plat** : le contenu de `webapp/` à la racine du `.tgz`, forme attendue par les
   cibles nginx. C'est ce qui distingue cette archive de celle d'
   [`apps/web/scripts/package.sh`](../apps/web/scripts/package.sh) (script upstream Element),
   qui encapsule tout dans un dossier `element-<version>/` — **ne pas utiliser ce dernier
   pour une release Kosmos**.
7. **Récupération des modules amont** : `docker build --target modules` sur le Dockerfile de
   production. Voir la section suivante.
8. **Image Docker** via [`apps/web/Dockerfile.local`](../apps/web/Dockerfile.local), qui
   reprend les stages applicatifs du Dockerfile de production en partant de l'artefact déjà
   construit au lieu de tout rebuilder dans un conteneur.
9. **Publications** (opt-in) : upload de l'archive sur Nexus, push de l'image.

## Dockerfile.local duplique le Dockerfile de production

`apps/web/Dockerfile.local` reproduit le contenu des stages `element_web` et
`element_web_modules` de [`apps/web/Dockerfile`](../apps/web/Dockerfile), en remplaçant le
seul `COPY --from=builder` par une copie de `apps/web/webapp` depuis le contexte. **Cette
duplication doit être maintenue à la main** : image nginx (épinglée par digest), paquets
`apk`, templates nginx, entrypoints, `ELEMENT_WEB_PORT`, healthcheck. Toute évolution du
Dockerfile de production — y compris un simple bump de digest par un rebase amont — doit y
être répercutée, sans quoi l'image locale diverge silencieusement de celle de la CI.

Deux points ne sont volontairement **pas** dupliqués :

- **Les modules amont** (`banner`, `restricted-guests`, `widget-lifecycle`,
  `widget-toggles`), épinglés par version et par checksum sha256. Le script construit le
  stage `modules` du Dockerfile de production (`docker build --target modules`) et
  `Dockerfile.local` y puise via `COPY --from`. Ce stage part d'une image `alpine` et ne
  dépend pas du `builder` : son build est immédiat. Les versions et les checksums n'existent
  donc qu'en un seul endroit.
- Le `builder` lui-même, qui est précisément ce que le build local remplace.

Ces modules comptent : l'entrypoint
[`18-load-element-modules.sh`](../apps/web/docker/docker-entrypoint.d/18-load-element-modules.sh)
scanne `/modules` et injecte chaque module trouvé dans le champ `modules` de `config.json`.
Une image sans eux ne charge pas les mêmes fonctionnalités que celle de la CI.

> `COPY --from=${VARIABLE}` n'est pas supporté par BuildKit : l'`ARG MODULES_IMAGE` est
> déclaré en portée globale et consommé par un stage nommé (`FROM ${MODULES_IMAGE} AS
> modules_src`), qui est le contournement documenté.

## Vérifications après build

```bash
V=$(./scripts/dist-version.sh)

# La version embarquée est bien celle attendue (fichier interrogé par la détection de MAJ)
cat apps/web/webapp/version

# Archive : contenu à la racine, ni config.json ni résidus de dev-server
tar tzf apps/web/dist/element-web-$V.tgz | grep -v / | sort
tar tzf apps/web/dist/element-web-$V.tgz | grep -c hot-update    # doit afficher 0

# Customisations Kosmos présentes
tar tzf apps/web/dist/element-web-$V.tgz | grep -c la-bulle      # doit être > 0

# Smoke test de l'image
docker run -d --rm --name ew-smoke -p 18080:80 skolengo/element-web:$V
curl -sf localhost:18080/config.json && curl -s localhost:18080/version
docker stop ew-smoke
```

Ordre de grandeur pour repérer une anomalie : archive ~28 Mo, image ~200 Mo.

## Format de l'image : Nexus 3.22 n'accepte que le Docker Schema 2

Le registry tourne sur Nexus 3.22.0, qui n'implémente ni les listes de manifestes ni les
mediatypes OCI. Or BuildKit, avec le magasin d'images containerd, produit par défaut un
index OCI accompagné d'une attestation de provenance. Le symptôme est trompeur : toutes les
couches sont acceptées, puis le manifeste est refusé.

```
97b5d352f24e: Pushed
...
error from registry: unknown
```

`scripts/local-release.sh` construit donc l'image avec :

```bash
docker build --provenance=false --sbom=false --platform linux/amd64 \
  --output "type=image,name=<tag>,oci-mediatypes=false" ...
```

Vérification du format avant de pousser — le mediatype doit être
`application/vnd.docker.distribution.manifest.v2+json`, jamais un
`vnd.oci.image.*` ni un `.list.v2+json` :

```bash
docker image inspect <tag> --format '{{.Descriptor.MediaType}}'
```

À garder en tête si le magasin d'images containerd est activé sur le poste
(`docker info | grep snapshotter`) ou lors d'une montée de version de Docker.

## Limites connues de la chaîne CI

Relevées pendant la mise en place de cette procédure, non corrigées ici :

- [`scripts/docker-package.sh`](../scripts/docker-package.sh) fait `echo $NEXUS_USER` /
  `echo $NEXUS_PASS` : les credentials apparaissent en clair dans les logs Jenkins (aggravé
  par `set -x`). `local-release.sh` passe, lui, par un fichier de config curl temporaire.
- L'upload Nexus y est inconditionnel : impossible de construire l'image sans credentials.
- `curl -k` désactive la vérification TLS vers Nexus (reproduit à l'identique ici, pour ne
  pas dépendre d'une chaîne de certificats que la CI n'a pas).
- [`Jenkinsfile`](../Jenkinsfile) enchaîne un `docker build` explicite puis `defaultStep()` :
  l'image est vraisemblablement construite deux fois.
- `prebuild:module_system` n'est déclenché par aucune cible de la chaîne de build.

## Voir aussi

- [`docs/kosmos-customizations.md`](kosmos-customizations.md) — pipeline de build et packages partagés
- [`docs/kosmos-nginx-exploitation.md`](kosmos-nginx-exploitation.md) — service de l'archive par nginx (règles de cache)
- [`PENSE-BETE.md`](../PENSE-BETE.md) — lancement en développement
- `docs/release.md`, `docs/packaging.md` — documentation **upstream Element**, non applicable à Kosmos
