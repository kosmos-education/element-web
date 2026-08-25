# Pense-bête — Lancer Element en local

Depuis la racine du repo (`element-web`) :

```bash
# 1. Installer les dépendances (uniquement si elles ont changé)
pnpm install

# 2. Builder les packages partagés (shared-components, module-api)
#    Indispensable : webpack consomme leur dist/, pas leurs sources.
#    Sans ça, les customisations situées dans packages/** ne sont PAS prises en compte.
#    (cf. docs/kosmos-customizations.md)
pnpm -r --filter "./packages/**" build

# 3. Créer la config de dev si elle n'existe pas encore
cp apps/web/config.sample.json apps/web/config.json   # puis adapter si besoin

# 4. Lancer le serveur de dev (webpack-dev-server, hot-reload)
pnpm --dir apps/web start
```

➡️ App servie sur **http://localhost:8080**

## Script tout-en-un

```bash
./scripts/dev-element.sh        # rejoue les 4 étapes ci-dessus puis lance le dev-server
./scripts/dev-element.sh -s     # cas courant : saute « pnpm install »
./scripts/dev-element.sh --no-build   # modif uniquement dans apps/web/src
```

## Raccourci manuel (après le premier setup)

```bash
pnpm -r --filter "./packages/**" build && pnpm --dir apps/web start
```

⚠️ Ce raccourci manuel est sujet à la course décrite ci-dessous. Préférer le script.

## Ne pas utiliser `pnpm --dir apps/web start` directement

`apps/web/project.json` déclare pour la cible `start` :

```
dependsOn: ["prebuild:module_system", "prebuild:rethemendex", "^build", "^start"]
continuous: true
```

Le `^start` est le piège. La cible `start` de `packages/shared-components` est
`vite build --watch` (et elle déclare à son tour `dependsOn: ["^start"]`, ce qui
entraîne aussi `module-api`). Ces tâches sont `continuous` : **nx ne les attend pas**,
elles tournent en parallèle de `webpack-dev-server`.

Or `vite.config.ts` de shared-components ne fixe pas `emptyOutDir` → Vite le met à
`true` par défaut, donc chaque passe du watch **vide `dist/`**, la première incluse.
Et `numbers` est la seconde entrée du build multi-entrées, donc émise en dernier.
Si webpack résout pendant cette fenêtre :

```
Module not found: Package path ./numbers is exported from
@element-hq/web-shared-components, but no valid target file was found
```

Webpack met l'échec en cache : il faut redémarrer, pas seulement re-sauver un fichier.

`./scripts/dev-element.sh` contourne la course en rejouant les prébuilds puis en
appelant `webpack-dev-server` directement, sans passer par `nx start`. Contrepartie :
pas de rebuild à chaud de `packages/**` (relancer le script après une modif là-dedans).
Le hot-reload de `apps/web/src` reste intact.

## Notes

- L'étape 2 reste indispensable avec le script, puisqu'il ne passe plus par le `^build`
  de nx. Pour une modif dans `apps/web/src/...`, le dev-server recompile directement.
- Tests unitaires ciblés : `cd apps/web && pnpm exec jest <pattern>`
  (voir le contournement `--transformIgnorePatterns` si ça casse sur `matrix-js-sdk`)
- Vérification des types : `cd apps/web && pnpm exec tsc --noEmit`

```

```
