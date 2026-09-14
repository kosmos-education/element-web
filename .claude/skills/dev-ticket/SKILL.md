---
name: dev-ticket
description: Tracer toute tâche de développement de ce dépôt dans un ticket Jira SCAT et faire suivre son statut au travail réel. À utiliser dès qu'une demande implique de modifier le code (« corrige… », « ajoute… », « implémente… », « on attaque SCAT-… »), dès qu'une implémentation est terminée et prête pour la revue, et dès que l'utilisateur valide le travail (« c'est bon », « validé », « tu peux merger ») — c'est à ce moment-là que le merge Git est joué. Ne pas utiliser pour une simple consultation ou recherche Jira (voir jira-cst), ni pour une montée de version d'Element (voir element-upgrade).
---

# Suivi du ticket pendant une tâche de dev

Sur ce dépôt, **le code ne bouge jamais sans ticket**, et le statut du ticket dit l'état réel du
travail — pas l'inverse. Un ticket rattrapé après coup ne sert ni à la recette ni à la montée de
version suivante.

Jira : instance `cst.kosmos.fr`, projet **SCAT** (« Skolengo - La Bulle »), MCP `mcp-atlassian`.
Conventions de rédaction (types, composants, style des résumés et des descriptions, modèle de
commentaire de bilan) : `.claude/skills/element-upgrade/references/jira.md`.

## Le workflow

```
Open → A réaliser → En cours → Revue en cours → En recette → Closed
```

Le skill couvre `En cours`, `Revue en cours` et `En recette`. `Closed` appartient à la recette,
ne jamais le jouer.

**Les libellés de statut et de transition diffèrent** (le statut est `A réaliser`, la transition
`À réaliser`). Ne jamais coder un nom de transition en dur : appeler `jira_get_transitions`, lire
les transitions réellement offertes, et choisir celle qui mène au statut visé. Si aucune n'y mène,
le dire à l'utilisateur plutôt que d'improviser un autre chemin.

## 1. Pas de code sans ticket

Avant la première modification de fichier, établir la clé du ticket, dans cet ordre :

1. **Donnée par l'utilisateur**, ou déductible du contexte Git : branche courante
   `kosmos/SCAT-<n>-<slug>`, ou dernier commit `SCAT-<n> …`. La confirmer avec `jira_get_issue`
   (vérifier que le résumé correspond bien à la demande — une branche peut traîner).
2. **Sinon, chercher un ticket existant** : `jira_search`, par exemple
   `project = SCAT AND status not in (Closed, Rejected) AND text ~ "<mots-clés>"`.
3. **Sinon, proposer un ticket** : type, résumé, description. Ne le créer avec
   `jira_create_issue` **qu'après accord explicite** de l'utilisateur.

Rédaction : résumé en français, sans préfixe ni code, à l'infinitif ou en substantif d'action.
Description et commentaires en **markup wiki Jira** (`h3.`, `*` pour les listes, `{{code}}`,
`_emphase_`) — jamais en Markdown, le MCP le convertit mal. Écrire le contenu demandé, sans
exposer le mécanisme interne ni ajouter de méta-commentaire.

## 2. Début d'implémentation → `En cours`

Au moment de la **première modification de fichier**, pas à la lecture du code ni pendant
l'analyse.

Depuis `Open`, le workflow n'offre pas de raccourci : jouer d'abord la transition vers
`A réaliser`, puis celle vers `En cours`. Si le ticket est déjà en `En cours` ou plus loin, ne
rien faire.

Convention Git corrélée : branche `kosmos/SCAT-<n>-<slug>`, messages de commit préfixés
`SCAT-<n>`, en français.

## 3. Travail terminé → `Revue en cours`, puis rendre la main

Quand l'implémentation est finie **et vérifiée** (tests ciblés, `tsc --noEmit`, lint — cf.
`PENSE-BETE.md`), dans cet ordre :

1. Déposer un **commentaire de bilan** factuel : ce qui a été réalisé et pourquoi ainsi, fichiers
   modifiés, résultat des tests — y compris ce qui n'a pas été fait.
2. Transitionner vers `Revue en cours`.
3. **S'arrêter.** Annoncer que la main revient à l'utilisateur pour la revue. Ne jamais enchaîner
   sur `En recette` de sa propre initiative, même si tout est vert.

## 4. Validation de l'utilisateur → merge, puis `En recette`

Déclenché par un accord explicite (« c'est bon », « validé », « tu peux merger »). Deux actions,
dans cet ordre : d'abord le merge s'il y a lieu (§5), ensuite la transition vers `En recette`. Un
merge en échec ou en conflit interrompt la séquence : rendre la main **sans** transitionner.

## 5. Règle de merge

Ce dépôt est un fork dont la branche de livraison est **un tag upstream + une série de commits
Kosmos strictement linéaires** — aucun commit de fusion Kosmos dans l'historique.
Préserver cette linéarité :

```bash
git switch <branche-source> && git rebase <branche-cible>
git switch <branche-cible>  && git merge --ff-only <branche-source>
```

Jamais de `git merge` qui créerait un commit de fusion.

Quel merge jouer, d'après le champ épic du ticket (`jira_get_issue`) et les branches existantes :

| Situation | Merge |
| --- | --- |
| Le ticket a sa propre branche `kosmos/SCAT-<n>-<slug>` **et** son épic a une branche `kosmos/SCAT-<epic>-<slug>` | branche du ticket → branche de l'épic |
| C'est **l'épic** qui passe en recette, son travail étant commité sur sa branche (cas `kosmos/SCAT-53-refonte-page-accueil`, qui porte les commits SCAT-54…SCAT-59) | branche de l'épic → `kosmos/release/vX.Y.Z` courante |
| Ticket hors épic, avec branche dédiée | branche du ticket → branche de release courante |
| Travail déjà commité sur la branche de release | rien à merger |

Une story d'épic dont le travail vit directement sur la branche d'épic ne déclenche **aucun**
merge : elle partira avec l'épic.

**Ne pas pousser.** Après le merge, montrer l'état (`git log --oneline -5`, position de la branche
cible par rapport à son `origin/`) et demander s'il faut pousser. Ne pousser qu'après un oui.

## Garde-fous

- Ne transitionner que le ticket de la tâche en cours, jamais un autre.
- Une transition attendue absente de `jira_get_transitions` (droits, workflow propre au type
  d'issue) se signale à l'utilisateur ; elle ne se contourne pas.
- Rebase en conflit : s'arrêter, rendre la main, laisser le ticket dans son statut.
