#!/usr/bin/env python3
"""Vérifie que les sélecteurs du thème La Bulle correspondent encore à du code réel.

Le thème surcharge des classes et des attributs de l'application (`.mx_SpacePanel`,
`[data-testid="room-name"]`…). Quand l'amont en renomme un, la règle CSS continue de
compiler et devient simplement sans effet : aucun conflit git, aucun test en échec, mais
la customisation a disparu de l'écran. C'est le mode de régression le plus coûteux d'une
montée de version, parce qu'il ne se voit qu'en recette visuelle.

Ce script extrait les ancrages des fichiers de surcharge et vérifie que chacun existe
encore dans les sources (hors snapshots, qui peuvent être périmés eux aussi) :

  - les classes `mx_*` ;
  - les classes NON préfixées chaînées à une classe `mx_*` (`.mx_SpacePanel.newUi`) —
    c'est le cas le plus sournois, car la moitié `mx_` du sélecteur survit et masque la
    disparition du qualificatif ;
  - les attributs stables `[data-*="valeur"]`, sur lesquels s'appuient les surcharges qui
    visent des composants aux classes CSS-module hachées.

Usage :
    .claude/skills/element-upgrade/scripts/audit-selecteurs-theme.py

Sortie : code 0 si tout est ancré, 1 s'il reste des ancrages orphelins.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

# Fichiers de surcharge du thème. Compléter si de nouveaux fichiers apparaissent.
OVERRIDE_GLOBS = [
    "apps/web/res/themes/la-bulle-light/css/*overrides*.pcss",
    "apps/web/res/themes/la-bulle-dark/css/*overrides*.pcss",
]

# Où un ancrage doit se trouver pour être considéré comme vivant.
SEARCH_PATHS = [
    "apps/web/src",
    "apps/web/res/css",
    "packages/shared-components/src",
]

# Certaines surcharges s'accrochent à des attributs posés par la bibliothèque de
# composants, pas par notre code (`[data-color]` vient du <Avatar> de Compound).
# Ils sont donc absents des sources et doivent être cherchés dans la dépendance —
# c'est un contrat avec elle, à revérifier quand elle change de version.
THIRD_PARTY_PATHS = [
    "node_modules/@vector-im/compound-web/dist",
]

CLASS_TOKEN = r"\.(-?[A-Za-z_][A-Za-z0-9_-]*)"


def repo_root() -> Path:
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(out.stdout.strip())


def strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def selector_lines(css: str) -> list[str]:
    """Lignes qui ouvrent un bloc de règle, donc porteuses de sélecteurs."""
    lines = []
    for raw in css.splitlines():
        line = raw.strip()
        if not line or line.startswith("@") or line.startswith("--"):
            continue
        if "{" in line:
            lines.append(line.split("{", 1)[0].strip())
    return lines


def collect_anchors(root: Path) -> dict[str, set[str]]:
    """Retourne {ancrage: {fichiers de surcharge qui le référencent}}.

    Un ancrage est soit `mx_Foo` / `newUi` (classe), soit `data-testid="room-name"`.
    """
    found: dict[str, set[str]] = {}

    def record(anchor: str, path: Path) -> None:
        found.setdefault(anchor, set()).add(str(path.relative_to(root)))

    for pattern in OVERRIDE_GLOBS:
        for path in sorted(root.glob(pattern)):
            text = strip_comments(path.read_text(encoding="utf-8"))

            for selector in selector_lines(text):
                # Sélecteurs composés : `.mx_Foo.bar` → on veut vérifier `bar` aussi.
                # Sans cela, la survie de `.mx_Foo` masque la disparition de `.bar`.
                for compound in re.finditer(rf"(?:{CLASS_TOKEN}){{2,}}", selector):
                    for cls in re.findall(CLASS_TOKEN, compound.group(0)):
                        record(cls, path)

                for cls in re.findall(CLASS_TOKEN, selector):
                    if cls.startswith("mx_"):
                        record(cls, path)

                # Attributs stables, seul point d'accroche fiable sur les composants
                # dont les classes sont hachées par les CSS modules.
                for attr, value in re.findall(
                    r"\[(data-[A-Za-z0-9_-]+)\s*=\s*[\"']([^\"']+)[\"']\]", selector
                ):
                    record(attr, path)
                    # La valeur n'est vérifiable que si c'est un identifiant littéral
                    # (`room-name`, `primary-filters`). Les valeurs courtes, numériques
                    # ou booléennes sont calculées à l'exécution et n'apparaissent jamais
                    # telles quelles dans les sources : les chercher produirait des faux
                    # positifs (`data-color="1"` est posé par `data-color={index}`).
                    if (
                        len(value) >= 4
                        and value.lower() not in {"true", "false"}
                        and re.search(r"[A-Za-z]", value)
                    ):
                        record(value, path)

    return found


def is_alive(root: Path, anchor: str) -> str | None:
    """Retourne la provenance de l'ancrage ("sources" / "compound"), ou None s'il est mort."""
    result = subprocess.run(
        ["git", "grep", "-lw", "--", anchor, "--", *SEARCH_PATHS],
        capture_output=True,
        text=True,
        cwd=root,
    )
    # Les snapshots sont exclus : ils peuvent être périmés et attesteraient à tort
    # de la survie d'un ancrage que le code ne pose plus.
    hits = [
        line
        for line in result.stdout.splitlines()
        if "__snapshots__" not in line and "__vis__" not in line
    ]
    if hits:
        return "sources"

    for path in THIRD_PARTY_PATHS:
        target = root / path
        if not target.exists():
            continue
        found = subprocess.run(
            ["grep", "-rlFw", "--", anchor, str(target)],
            capture_output=True,
            text=True,
        )
        if found.stdout.strip():
            return "compound"

    return None


def main() -> int:
    root = repo_root()
    anchors = collect_anchors(root)

    if not anchors:
        print(
            "Aucun fichier de surcharge trouvé. Les chemins du thème ont-ils changé ?\n"
            "Vérifier OVERRIDE_GLOBS dans ce script.",
            file=sys.stderr,
        )
        return 1

    print(f"{len(anchors)} ancrages référencés par le thème La Bulle")
    print("(classes mx_, qualificatifs de sélecteurs composés, attributs data-*)\n")

    dead: dict[str, set[str]] = {}
    third_party: list[str] = []
    for anchor, srcs in sorted(anchors.items()):
        origin = is_alive(root, anchor)
        if origin is None:
            dead[anchor] = srcs
        elif origin == "compound":
            third_party.append(anchor)

    if third_party:
        print(
            "Ancrages fournis par la bibliothèque Compound, pas par notre code — à\n"
            "revérifier lors d'une montée de version de @vector-im/compound-web :"
        )
        for anchor in third_party:
            print(f"  · {anchor}")
        print()

    if not dead:
        print("→ Tous les ancrages sont encore présents dans le code.")
        return 0

    print("ANCRAGES ORPHELINS — ces règles sont devenues inopérantes :\n")
    for anchor, sources in dead.items():
        label = anchor if anchor.startswith("data-") else f".{anchor}"
        print(f"  ✗ {label}")
        for src in sorted(sources):
            print(f"      référencé par {src}")
    print(
        "\nPour chacun, retrouver le remplaçant amont : le PCSS d'origine de l'app\n"
        "(`git show <TAG_CIBLE>:apps/web/res/css/structures/<fichier>.pcss`) montre sur\n"
        "quel sélecteur la règle native a migré. Réancrer la surcharge, puis mettre à jour\n"
        "le marqueur correspondant dans docs/kosmos-customizations.md.\n"
        "\nUn faux positif est possible si un ancrage n'existe que dans du code généré ou\n"
        "hors des chemins scrutés : vérifier avant de conclure, et corriger SEARCH_PATHS."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
