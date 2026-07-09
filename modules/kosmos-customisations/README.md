# @kosmos/element-web-module-customisations

Module de customisations Kosmos pour Element Web, basé sur le [Module API](../../packages/module-api)
(`@element-hq/element-web-module-api`). Il regroupe les personnalisations d'interface Kosmos qui
peuvent passer par le Module API, afin de garder le code spécifique **isolé** du code d'Element et de
limiter les conflits aux rebases upstream.

## Fonctionnalités

- **Masquage de l'identifiant Matrix (userId)** dans toute l'application : surcharge du point
  d'extension `UserIdentifier` (`getDisplayUserIdentifier` renvoie `null`).

## Build

```
pnpm --filter @kosmos/element-web-module-customisations build
```

Produit le bundle `lib/index.js`.

## Activation

Le module est chargé au runtime par le _plugin system_ d'Element (`loadPlugins()` lit le champ
`modules` de `config.json`). Ajouter dans `config.json` :

```json
{
    "modules": ["/modules/kosmos-customisations/index.js"]
}
```

Le bundle est copié dans la racine servie (`webapp/modules/kosmos-customisations/`) au build de
`apps/web` via un pattern `CopyWebpackPlugin`.

> ⚠️ `config.json` est gitignoré : répercuter cette entrée dans le pipeline de déploiement de chaque
> environnement. `config.sample.json` en contient un exemple.

## Copyright & License

Copyright (c) 2026 Kosmos
