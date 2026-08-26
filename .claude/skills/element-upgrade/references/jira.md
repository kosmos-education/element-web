# Ticket Jira d'une montée de version

Instance : **issues.kosmos.fr** (API : `cst.kosmos.fr`), projet **SCAT** — « Skolengo - La Bulle ».
Outils : MCP `mcp-atlassian` (`jira_create_issue`, `jira_create_issue_link`, `jira_add_comment`).

## Champs

| Champ         | Valeur                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| Type          | `Task` (les précédentes montées : SCAT-31, SCAT-35)                          |
| Composant     | `Surcharge technique Element`                                                |
| Priorité      | `Minor`                                                                      |
| Urgence       | `P3 - Normale`                                                               |
| `fixVersions` | aucune — le projet n'en définit pas                                          |
| Liens         | `Cloners` vers la montée précédente ; `Lier` vers les tickets du lot intégré |

Types d'issue disponibles sur SCAT : `Bug`, `Epic`, `Story`, `Recette interne`, `Task`.
Autres composants : `Configuration Element`, `Configuration Synapse`, `Espaces`,
`Plugin d'isolation des espaces`, `Utilisateurs`.

## Conventions

Les résumés sont **en français, sans préfixe ni code**, formulés à l'infinitif ou en substantif
d'action. Pour une montée de version : `Montée de version de Element en version X.Y.Z`.

Les descriptions techniques suivent des sections `*Objectif*` / `*Périmètre*` / `*Recette*`. Le MCP
convertit le Markdown en markup wiki Jira, avec des ratés sur les emphases imbriquées : préférer
des listes simples et vérifier le rendu après création.

Convention Git corrélée : branches `kosmos/SCAT-<n>-<slug>` pour les stories,
`kosmos/release/vX.Y.Z` pour les montées de version, messages de commit préfixés `SCAT-<n>`.

## Modèle de description

```
Suite à la montée de version réalisée dans SCAT-<n> sur la version <TAG_ACTUEL>, il faut
maintenant faire monter Element de version en <TAG_CIBLE>.

*Objectif*
Rebaser le fork Kosmos (branche kosmos/release/<TAG_ACTUEL>) sur le tag <TAG_CIBLE>
d'element-web en reportant l'ensemble des customisations Kosmos, puis faire les adaptations
des fonctionnalités qui ont changé.

Écart amont : <N> commits, <M> fichiers modifiés.

*Périmètre*
* Création de la branche kosmos/release/<TAG_CIBLE> à partir du tag upstream.
* Report des customisations décrites dans docs/kosmos-customizations.md.
* Intégration du lot en cours, le cas échéant.
* Vérification des points de rattachement modifiés par l'amont (<chantiers repérés dans les
  release notes>).
* Mise à jour de docs/kosmos-customizations.md et du diff fonctionnel.
* Passage des tests (lint, types, suites unitaires) et du build.

*Recette*
Non-régression sur : envoi de message, envoi de pièce jointe, suppression de message, réponse
à un fil, invitation dans un salon, changement d'avatar de salon, mention, accès à l'aide,
présence du favicon, désactivation de la création d'un espace, désactivation de la création
de chat 1-1, thème La Bulle en clair et en sombre, SSO.
```

## Commentaire de bilan

À déposer en fin de montée. Il sert à la recette et à la montée suivante, donc il doit être
factuel — y compris sur ce qui n'a pas été fait :

- **Méthode** : ce qui a été rebasé, ce qui a été cherry-pické et pourquoi.
- **Points d'attention traités** : les régressions silencieuses attrapées, les API renommées, les
  tests re-hébergés. C'est la partie qui a le plus de valeur pour le lecteur suivant.
- **État de vérification** : chiffres des trois suites, lint, build, en distinguant explicitement
  les échecs préexistants à l'amont (avec la preuve : worktree de contrôle).
- **Reste à faire** : recette visuelle, push et CI, adaptation du `config.json` de déploiement.
