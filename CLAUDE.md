# atelier_lumiere

Petit outil custom pour aider un copain dans son business. Manipulation de fichiers (renommer, copier, organiser) et génération de factures PDF.

## Utilisateur du projet

Le dev est un **développeur web**, principalement React. Il découvre Tauri et approfondit Clean Architecture / DDD avec ce projet. Pas d'expérience Rust (et l'objectif est de ne quasi pas en écrire).

## Stack technique

- **Tauri 2** — runtime desktop cross-platform (Mac + Windows prioritaires)
- **React + TypeScript + Vite** — frontend (template Tauri officiel)
- **Tailwind CSS** + **shadcn/ui** — styling et composants
- **pdf-lib** ou **@react-pdf/renderer** — génération de factures PDF (à trancher au moment venu)
- **Zustand** (si besoin) — state management léger

Pas de Next.js (overkill), pas de CRA (deprecated). Vite est juste le bundler/dev server, invisible au quotidien.

## Plateformes cibles

- **Phase 1** : Mac + Windows (desktop natif via Tauri)
- **Phase 2** (éventuelle) : web hébergé, puis mobile

La phase 2 est la raison pour laquelle la clean architecture est critique (voir plus bas).

## Distribution

- Installeurs `.dmg` (Mac) et `.msi`/`.exe` (Windows) générés par `npm run tauri build`
- Pipeline **GitHub Actions** pour builder Mac + Windows en parallèle au tag git
- **Non signé au départ** — le client contourne l'avertissement la première fois
- À envisager si sérieux : Apple Developer (99 $/an) puis certificat Windows (~200-400 €/an)
- Repo idéalement **public** pour bénéficier de minutes GitHub Actions illimitées

## Architecture — Clean Architecture / Hexagonal / DDD

### Contrainte non négociable

**La logique métier ne doit JAMAIS dépendre de Tauri.** Demain cette app peut tourner sur un serveur, dans un navigateur, sur mobile. Le domaine doit être 100 % portable.

### Structure cible

```
atelier_lumiere/
├── src/
│   ├── domain/              # Cœur métier — ZÉRO dépendance externe
│   │   ├── entities/        # Client, Facture, LigneFacture, Dossier…
│   │   ├── value-objects/   # Montant, Siret, CheminDossier…
│   │   ├── usecases/        # GenererFacture, RenommerDossierClient…
│   │   └── ports/           # Interfaces: FileStorage, PdfRenderer, ClockPort…
│   │
│   ├── infrastructure/      # Adapters — implémentent les ports
│   │   ├── tauri/           # TauriFileStorage, TauriDialog… (desktop)
│   │   └── http/            # Futur — HttpFileStorage, ApiClient… (serveur)
│   │
│   ├── ui/                  # Composants React (vues + hooks)
│   │   ├── components/
│   │   └── pages/
│   │
│   └── app/                 # Composition root — câble domain + infra + UI
│       ├── container.ts     # Injection de dépendances
│       └── main.tsx
│
└── src-tauri/               # Code Rust (touché quasi jamais)
```

### Règles d'import (à vérifier systématiquement)

- `domain/` n'importe **jamais** depuis `@tauri-apps/*`, React, ni `infrastructure/`
- `domain/` n'importe **jamais** depuis Node.js (`fs`, `path`…) ni le navigateur (`window`, `document`)
- `ui/` ne parle au domaine **qu'à travers les usecases**, pas les entités directement
- `infrastructure/` implémente les **ports** définis dans `domain/ports/`
- La composition root (`app/container.ts`) est le **seul endroit** qui connaît les implémentations concrètes

### Patterns DDD à utiliser

- **Entities** : identité (un Client a un ID stable même si son nom change)
- **Value Objects** : identité par valeur, immuables (un Montant, un Siret)
- **Aggregates** : racine qui garantit les invariants (Facture est racine, LigneFacture vit dedans)
- **Repositories** : abstraction du stockage (`FactureRepository` dans `ports/`)
- **Use cases** : un cas d'usage métier = une classe/fonction (`GenererFactureUseCase`)
- **Ubiquitous language** : le code parle le vocabulaire du métier du copain, pas du tech

## Mode pédagogique — IMPORTANT

le dev veut **apprendre Clean Architecture et DDD** à travers ce projet. À chaque décision d'architecture ou d'implémentation :

1. **Nommer le pattern** utilisé (« ici on introduit un Value Object parce que… »)
2. **Expliquer le pourquoi** avant le comment (« on sépare port et adapter pour que… »)
3. **Faire le lien avec l'objectif de portabilité** (« si demain on passe sur serveur, cette classe ne bouge pas, on change juste l'adapter »)
4. **Proposer des choix** plutôt que d'imposer, quand plusieurs options sont légitimes (« on pourrait faire A ou B, voilà les trade-offs »)
5. **Pointer les mauvaises pratiques** si le dev propose quelque chose qui casse la clean archi, en expliquant pourquoi
6. **Vérifier la compréhension** sur les concepts neufs — demander à le dev de reformuler ou d'appliquer avant de passer à la suite
7. **Référencer les sources** (Eric Evans, Vaughn Vernon, Alistair Cockburn, Robert C. Martin) quand un concept mérite une lecture approfondie

Pas de cours magistral : la pédagogie se fait **au fil du code**, en lien direct avec ce qu'on est en train de construire.

## Commandes (à remplir au fur et à mesure)

- Installation : _à définir_
- Dev : `npm run tauri dev`
- Build : `npm run tauri build`
- Tests : _à définir (vitest probablement)_

## Décisions ouvertes

- Lib PDF : `pdf-lib` (bas niveau, flexible) vs `@react-pdf/renderer` (composant React, plus ergonomique)
- State management : Zustand seulement si le useState/useContext ne suffit pas
- Tests : stratégie à définir (domain en unitaire pur, infra en intégration)

Je chargerai automatiquement le CLAUDE.md et on pourra attaquer. Étapes logiques ensuite :
1. git init + initialiser le repo
2. npm create tauri-app@latest pour bootstrapper le projet
3. Installer Tailwind + shadcn/ui
4. Première itération : modéliser le domaine (entités Client/Facture) avant de toucher à l'UI ou à Tauri — c'est le cœur de la démarche DDD   