# NOTES-DDD — manuel du projet atelier_lumiere

Ce document suit le projet au fil de l'eau : ce qu'on a livré slice par slice, les **patterns DDD** qu'on a introduits, et le *pourquoi* derrière chaque décision. Il sert autant de référence produit que d'aide-mémoire pédagogique sur Clean Architecture et DDD.

À relire en parallèle du code — chaque pattern est illustré par un fichier précis.

---

## Ubiquitous language (glossaire)

Le vocabulaire **métier** utilisé dans le code. À respecter partout : variables, classes, fichiers.

| Terme | Nature | Définition |
|---|---|---|
| **Session** | Agrégat racine | Un événement shooté (studio ou spectacle). Contient ses Photos et ses Acheteurs. |
| **Photo** | Entité fille de Session | Fichier JPEG numéroté (1..N), scoped à sa session. Pas de cycle de vie hors session. |
| **Commanditaire** | Champ texte sur Session | Lieu/compagnie/production qui a commandé le shoot. Pas d'entité réutilisable (YAGNI). |
| **Référent** | Champ texte sur Session | Contact côté commanditaire. |
| **Acheteur** | Entité fille de Session | Particulier/pro qui achète des tirages. Rattaché à une session, pas réutilisable cross-session. |
| **Commande** | Agrégat racine | `sessionId` + `acheteurId` + lignes. Cycle de vie distinct de la Session (arrive après le shoot). |
| **LigneCommande** | Entité fille de Commande | `{ id, photoNumero, format, quantite, montantUnitaire }`. Montant snapshot figé à la création. |
| **Format** | VO | Catalogue fermé : `15x23`, `20x30`, `30x45`, `Numerique`. |
| **Montant** | VO | Centimes d'euros (jamais de float pour de l'argent). |
| **GrilleTarifaire** | VO dans Session | Mapping Format → Montant, ajustable par session via `Session.modifierPrix`. |
| **TypeSession** | Union type | `"Studio" \| "Spectacle"`. |
| **Email** | VO | Normalisé (trim + lowercase), validation regex basique. |
| **CheminDossier** | VO | Chemin absolu POSIX ou Windows, validé. |

---

## Topologie actuelle des agrégats

```
┌──────────────────────────────────────────────────────────┐
│ Session (agrégat racine)                                 │
│  ├── Photo (entité fille, identité = numéro)             │
│  ├── Acheteur (entité fille, identité = id)              │
│  └── GrilleTarifaire (VO, remplaçable via modifierPrix)  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Commande (agrégat racine)                                │
│  ├── sessionId (référence par ID)                        │
│  ├── acheteurId (référence par ID, acheteur de la session) │
│  └── LigneCommande[] (entités filles, identité = id)     │
│       └─ montantUnitaire SNAPSHOT (figé à la création)   │
└──────────────────────────────────────────────────────────┘
```

**Références inter-agrégats : toujours par ID, jamais par objet.** Règle Vernon, *Implementing DDD*, chap. Aggregates : « Reference Other Aggregates By Identity ».

---

## Règles de couches (Clean Architecture)

Garanties par discipline (à terme : ESLint boundaries), jamais transgresser :

- `src/domain/` n'importe **jamais** depuis `@tauri-apps/*`, React, Node (`fs`, `path`), ni navigateur (`window`, `document`).
- `src/domain/` n'importe **jamais** depuis `src/infrastructure/` ni `src/ui/`.
- `src/ui/` ne parle au domaine **qu'à travers les use cases**, pas les entités directement.
- `src/infrastructure/` **implémente** les ports définis dans `src/domain/ports/`.
- `src/app/container.ts` est le **seul endroit** qui connaît les implémentations concrètes.

Conséquence directe : le domaine est **testable sans Tauri, sans React, sans filesystem**. Démonstration vivante dans `CreerSession.test.ts` et `AjouterAcheteurASession.test.ts`.

---

# Journal des slices

## Slice 1 — Créer une Session + scanner son dossier source

**Valeur métier** : le photographe ouvre l'app, saisit une nouvelle session (commanditaire, référent, date, type, dossiers source/export), l'app scanne le dossier source et affiche la liste des sessions avec leur nombre de photos.

**Livrables** :
- VOs : `Format`, `CheminDossier`, `Montant`, `GrilleTarifaire`, `TypeSession`
- Entités : `Photo` (fille), `Session` (agrégat racine)
- Ports : `SessionRepository`, `FileSystemScanner`, `GrilleTarifaireParDefautProvider`
- Use cases : `CreerSessionUseCase`, `ListerSessionsUseCase`
- Adapters : `TauriSessionRepository`, `TauriFileSystemScanner`, `TauriDossierPicker`, `InMemoryGrilleTarifaireParDefautProvider`
- UI : `SessionsPage`, `NouvelleSessionForm`
- Rust : plugins `tauri-plugin-fs` et `tauri-plugin-dialog`
- Vitest + 23 tests initiaux

### Patterns DDD introduits

#### Value Object (Evans, *DDD*, chap. 5)

**Identité par valeur, immuable, pas de cycle de vie propre.** Deux VOs de même contenu sont interchangeables. Toute la validation se fait dans le constructeur.

> Exemple : `Format._20x30` et un autre `Format` de valeur `"20x30"` sont identiques ; `new CheminDossier("/a/b")` rejette un chemin relatif.

**Pourquoi ne pas utiliser `string` partout** : primitive obsession (Fowler, *Refactoring*). Rien n'empêche de passer un email à la place d'un id ou d'un chemin à la place d'un nom. Le VO rend l'intention visible dans les signatures et porte la validation une fois pour toutes.

**Fichiers** : `src/domain/value-objects/*.ts`.

#### Entité fille dans un agrégat

**Identité (par id) mais pas de cycle de vie propre hors de la racine.** On ne crée, modifie ni supprime une photo indépendamment de sa session.

> Exemple : `Photo`. Son numéro est unique *dans* la session, pas globalement. L'extraire comme agrégat à part serait une « anemic aggregate fallacy » (Vernon).

**Fichier** : `src/domain/entities/Photo.ts`.

#### Agrégat racine

**Point d'entrée unique pour manipuler un cluster d'objets cohérents.** Garant des invariants transactionnels : une `Session` qu'on arrive à construire est, par définition, valide (dates OK, dossiers distincts, numéros de photos uniques, etc.).

> La factory `Session.creer(...)` sépare la **création business** (nouvel id généré) de la **reconstitution** via `new Session(donnees)` (id déjà connu, utilisé par le repo). Pattern « reconstitution vs création », utile dès qu'on persiste.

**Fichier** : `src/domain/entities/Session.ts`.

#### Port & Adapter (Cockburn, *Hexagonal Architecture*)

**Le domaine déclare ses besoins (port) en langage métier, l'infrastructure implémente (adapter).** Les erreurs remontées par un port sont **métier** (`DossierIntrouvable`, `SessionIntrouvable`), jamais techniques (`TauriError`, `FsError`).

> Exemple : `FileSystemScanner.scanPhotos(chemin)` retourne `Promise<readonly number[]>`. Aucun type Tauri dans la signature. Demain on écrit un `HttpFileSystemScanner` ou un `InMemoryFileSystemScanner` (pour les tests), rien ne change côté domaine.

**Fichiers** : `src/domain/ports/*.ts` (interfaces), `src/infrastructure/**/*.ts` (implémentations).

#### Use case (Robert C. Martin, *Clean Architecture*)

**Classe qui orchestre un scénario métier complet**, reçoit ses dépendances (ports) par constructeur (inversion de dépendance). Ne protège pas les invariants lui-même — c'est le job des entités/VOs.

> Exemple : `CreerSessionUseCase` charge la grille par défaut, scanne le dossier, instancie la Session, la sauve.

**Fichiers** : `src/domain/usecases/*.ts`.

#### Composition root

**Unique endroit qui connaît les implémentations concrètes.** Tout le reste du code manipule des interfaces. Changer de stack = changer ce fichier.

**Fichier** : `src/app/container.ts`.

#### Snapshot de VO (pas de référence partagée)

La `GrilleTarifaire` est **copiée** dans chaque Session au moment de sa création, pas référencée vers une source globale. Ça garantit qu'une commande émise à une date donnée reflète les prix de ce jour-là, même si la grille globale change plus tard. Anti-pattern classique à éviter : tenir un pointeur vers une config mutable et réécrire rétroactivement les factures passées.

---

## Slice 2 — Acheteur (puis refactor en entité fille)

**Valeur métier** : inscrire des acheteurs et les voir dans la session à laquelle ils sont rattachés.

**Parcours important à retenir** : cette slice a été modélisée initialement en **agrégat racine autonome** (avec `AcheteurRepository`, unicité globale du nom, fichier JSON séparé) puis **refactorée en entité fille de Session** suite à la clarification métier « pas de réutilisation cross-session ». Les deux modélisations sont visibles dans `git log` — il vaut la peine de les comparer.

**Livrables finaux** :
- VO `Email`
- Entité fille `Acheteur` (nom + email? + téléphone?)
- Méthode `Session.ajouterAcheteur(params)` (invariant d'unicité par session)
- Use cases `AjouterAcheteurASessionUseCase`, `TrouverSessionParIdUseCase`
- UI : `SessionDetailPage` + `NouvelAcheteurForm`
- `TauriSessionRepository` persiste désormais les acheteurs **dans** le JSON de la session

### Patterns DDD introduits

#### Invariant de collection vs invariant d'agrégat

**Un invariant qui dépend de plusieurs instances vit au niveau du *regard* nécessaire pour le vérifier.**

- **Modélisation 1 (initiale)** : Acheteur = agrégat racine, unicité globale du nom. Le regard global appartient au **repo**. Donc la vérification vit dans le **use case** qui appelle `acheteurRepository.existeParNom(nom)`. L'entité reste pure, elle n'a pas accès au repo.

- **Modélisation 2 (actuelle)** : Acheteur = entité fille de Session. Le regard nécessaire est limité à la Session elle-même — donc la vérification vit **dans l'agrégat**, dans `Session.ajouterAcheteur`. Aucun repo requis.

**Règle à retenir** : un invariant ne vit pas dans l'entité parce qu'on « pourrait le mettre là », il vit là où est le regard qu'il réclame. Changer le scope métier = changer l'endroit où l'invariant vit.

**Piège à éviter** : passer le repo en argument du constructeur de l'entité pour valider l'unicité. Interdit — un constructeur qui fait de l'I/O est un signal d'erreur de modélisation.

#### Persistance par agrégat

**Un agrégat = une transaction = un fichier/une ligne DB.** Les entités filles sont persistées **dans** la représentation de leur racine.

> Exemple : `TauriSessionRepository` stocke tout dans `sessions.json`. Il n'existe **pas** de `acheteurs.json`. Avoir un fichier séparé pour les acheteurs aurait été un mauvais signal suggérant qu'ils sont un agrégat autonome.

#### Cohérence inter-agrégats (pour plus tard)

Quand la slice 3b arrivera avec `Commande` comme agrégat séparé, l'invariant « la photo référencée existe bien dans la session » sera résolu dans le **use case**, pas dans le constructeur de `Commande`.

Règle Vernon : **cohérence immédiate intra-agrégat, cohérence éventuelle inter-agrégats.**

#### Tests avec doubles in-memory

Démonstration que le domaine pur se teste **sans Tauri, sans filesystem, sans React** : les tests des use cases injectent des implémentations in-memory des ports. Voir `AjouterAcheteurASession.test.ts` pour l'exemple canonique.

---

## Slice 3a — Édition de la grille tarifaire par session

**Valeur métier** : ajuster les prix par format, session par session, avant de saisir les premières commandes.

**Livrables** :
- `GrilleTarifaire.avecPrixModifie(format, montant)` (nouveau VO dérivé)
- `Session.modifierPrix(format, montant)` (méthode d'agrégat)
- Use case `ModifierPrixSessionUseCase`
- Composant UI `GrilleTarifaireEditor` intégré à `SessionDetailPage`

### Pattern DDD introduit

#### Évolution immutable du VO + mutation contrôlée de l'agrégat

Deux patterns d'immutabilité côte à côte, bien distincts :

| | Value Object | Entité / Agrégat |
|---|---|---|
| Mutation | **Jamais**. On construit un nouveau VO à chaque évolution. | **Oui**, via méthodes qui protègent les invariants. |
| Exemple | `grille.avecPrixModifie(format, montant)` renvoie une nouvelle grille, sans toucher à l'original. | `session.modifierPrix(format, montant)` met à jour le champ privé `_grilleTarifaire` de la Session. |

**Subtilité clé** : l'agrégat fait évoluer son état **en échangeant son VO contre un nouveau**, pas en mutant le VO lui-même. C'est la combinaison propre des deux règles — le VO ne mute jamais, mais il peut être remplacé.

**Fichiers** : `src/domain/value-objects/GrilleTarifaire.ts` (`avecPrixModifie`), `src/domain/entities/Session.ts` (`modifierPrix`).

#### Préparation du pattern snapshot (utile en slice 3b)

Modifier la grille d'une session plus tard **n'impactera pas** les commandes déjà émises, parce qu'une `LigneCommande` capturera son montant à la création (pattern « snapshot »). Le commentaire dans `Session.modifierPrix` le note pour mémoire.

---

## Slice 3b — Commande (agrégat séparé + cross-aggregate invariants)

**Valeur métier** : le photographe saisit une commande pour un acheteur d'une session : liste de lignes `photo × format × quantité` avec prix unitaire visible et total calculé.

**Livrables** :
- Entité fille `LigneCommande` (id, photoNumero, format, quantité, **montantUnitaire snapshot**, méthode `total()`)
- Agrégat racine `Commande` (sessionId, acheteurId, dateCreation, `_lignes` mutable, méthodes `ajouterLigne`/`retirerLigne`/`total`/`nombreTirages`)
- Port `CommandeRepository` + erreurs `CommandeIntrouvable`, `LigneCommandeIntrouvable`
- Use cases `PasserCommandeUseCase`, `AjouterLigneACommandeUseCase`, `RetirerLigneDeCommandeUseCase`, `ListerCommandesDeSessionUseCase`, `TrouverCommandeParIdUseCase`
- Adapter `TauriCommandeRepository` → `commandes.json` séparé de `sessions.json`
- UI : `CommandePage` (saisie + affichage des lignes et total), intégration dans `SessionDetailPage` (bouton « Passer une commande » + liste des commandes par acheteur), 3ᵉ vue dans `App.tsx`

### Patterns DDD introduits

#### Agrégats séparés avec références par ID

**Commande** est un agrégat à part, pas une entité fille de Session — parce que leurs **cycles de vie divergent**. Une session est créée au shoot et figée peu après ; les commandes arrivent dans les semaines/mois qui suivent.

La Commande ne connaît que des **IDs** : `sessionId: string`, `acheteurId: string`. **Pas** d'objet `Session` embarqué, **pas** d'objet `Acheteur` embarqué. Règle Vernon : « Reference Other Aggregates By Identity ».

Conséquence : l'invariant « cet acheteur existe dans cette session » ne peut **pas** être vérifié dans le constructeur de `Commande` (elle n'a pas la session sous la main). Il est vérifié dans le **use case** `PasserCommandeUseCase`, qui charge la Session et inspecte ses acheteurs.

#### Cross-aggregate invariant dans le use case

Deux règles cross-aggregate sont implémentées :

| Règle | Use case | Fichier |
|---|---|---|
| L'acheteur appartient bien à la session | `PasserCommandeUseCase` | `src/domain/usecases/PasserCommande.ts` |
| La photo référencée existe dans la session | `AjouterLigneACommandeUseCase` | `src/domain/usecases/AjouterLigneACommande.ts` |

Règle Vernon : **cohérence immédiate intra-agrégat, cohérence éventuelle inter-agrégats.** On vérifie au moment de la mutation — pas de garantie globale en permanence, ce qui serait impossible sans verrous partagés entre agrégats.

#### Pattern Snapshot

**Le cas d'école** qui a motivé tout le soin porté à `GrilleTarifaire` depuis la slice 3a.

`LigneCommande.montantUnitaire` est **capturé au moment où la ligne est créée**, depuis `session.grilleTarifaire.prixPour(format)`. Une fois la ligne créée, son prix ne bouge plus — même si le copain modifie la grille de la session la semaine suivante.

Le test `AjouterLigneACommande.test.ts::fige le prix à la création même si la grille change plus tard (snapshot)` démontre ça en dur.

**Piège évité** : tenir un pointeur vers la grille ou la session depuis la ligne. Toute modification de la grille repeindrait les factures passées, ce qui serait un bug fonctionnel très sérieux (erreur fiscale en aval).

#### Entité fille avec identité propre

`LigneCommande` a un **id stable** (UUID) distinct de son contenu. Deux lignes `{ photo 145, 20x30, quantité 1 }` dans la même commande sont des entités distinctes si elles ont des ids différents. Ça permet de référencer une ligne précise pour la retirer (`Commande.retirerLigne(ligneId)`) sans collision.

Contrairement à un VO (identité par valeur), l'entité fille est la bonne réponse quand on veut pouvoir adresser précisément un élément de la collection.

#### Méthode de calcul dans l'agrégat

`Commande.total()` et `Commande.nombreTirages()` sont des méthodes de l'agrégat qui **dérivent** leur résultat de l'état interne (`_lignes`). Ça évite de recalculer ça dans l'UI ou de stocker un total redondant dans le JSON (duplication de source de vérité).

**Règle** : toute information dérivable d'un agrégat se calcule via une méthode de cet agrégat. Pas de champs « total stocké » — sauf si on a besoin de les indexer pour des raisons de perfs.

---

## Slice 4 — Export physique des fichiers

**Valeur métier** : le moment le plus concret pour le photographe — cliquer « Exporter » sur une commande produit les fichiers renommés et rangés dans le dossier d'export de la session, prêts à être envoyés à l'imprimeur.

**Livrables** :
- Port `FileCopier` (`copier(source, destination)`) + erreur métier `FichierSourceIntrouvable`
- Méthode de domaine pur `LigneCommande.nomsFichiersExport(nomAcheteur)` qui produit la liste des cibles `{ sousDossier, nomFichier }` pour une ligne
- Fonction pure `slugifierNomAcheteur(nom)` exportée pour le nommage filesystem-safe (trim, lowercase, NFD, strip accents, espaces→underscore, strip chars non-safe)
- Use case `ExporterCommandeUseCase` qui orchestre charge commande → charge session → retrouve acheteur → boucle lignes × quantité → copie
- Adapter `TauriFileCopier` (plugin-fs : `mkdir -p` automatique du dossier parent puis `copyFile`)
- UI : bouton « Exporter vers le dossier » dans `CommandePage` avec feedback `N fichiers exportés dans {chemin}`

### Patterns DDD introduits

#### Méthode de domaine pure qui produit des instructions (pas qui fait l'I/O)

`LigneCommande.nomsFichiersExport(nomAcheteur)` retourne **une liste d'instructions** (`{ sousDossier, nomFichier }[]`) pour l'export. Elle **ne fait pas** l'I/O — c'est le use case qui fait les `copier()`.

Conséquence précieuse : cette méthode est 100 % pure, testable unitairement en trois lignes, réutilisable si on change d'adapter (HTTP, S3, ZIP à télécharger…).

**Règle** : quand tu es tenté de mettre une méthode qui fait un appel externe dans une entité, demande-toi si tu peux séparer (le QUOI dans l'entité, le COMMENT dans le use case). C'est presque toujours possible, et presque toujours un gain.

**Fichier** : `src/domain/entities/LigneCommande.ts` — la méthode est à côté de `total()`, toutes les deux pures, toutes les deux testées.

#### Idempotence d'un use case

`ExporterCommandeUseCase` est **idempotent** : relancer l'export produit les mêmes fichiers aux mêmes emplacements (écrasement assumé). Pas de suivi d'état « déjà exporté » en V1 — la présence des fichiers dans le dossier d'export suffit au copain.

**Règle** : quand un use case est déterministe à partir de son état en base, éviter d'ajouter un état mutant (« exportée », « facturée »…) tant qu'il ne répond pas à une vraie question métier. C'est du YAGNI appliqué aux agrégats.

#### Erreurs métier traduites par l'adapter

Le `TauriFileCopier` attrape les erreurs de plugin-fs et remonte des erreurs métier : `FichierSourceIntrouvable` si la photo source a disparu (dossier déplacé, fichier supprimé). Le domaine ne voit jamais un `FsError` Tauri. Rappel de la règle : « les ports parlent le langage du domaine ».

#### Réutilisation d'une erreur cross-aggregate

`ExporterCommande` réutilise `AcheteurNAppartientPasASession` (déjà définie dans `PasserCommande.ts`) quand l'acheteur a disparu de la session entre le moment de la commande et le moment de l'export. Même sémantique métier, pas de duplication — on importe. Si le pattern se multiplie, on factorisera dans un fichier d'erreurs partagées.

---

# Points d'attention récurrents

Les **3 frictions Clean Archi** sur lesquelles un dev React débute en DDD se casse les dents. À relire régulièrement.

## 1. « Où je mets ce bout de logique ? »

Réflexe React à corriger : mettre la validation dans le composant ou le hook.

- La **logique qui protège un invariant métier** vit dans l'entité/VO (ex : `Session` valide que source ≠ export dans son constructeur).
- L'**orchestration d'un scénario** vit dans le use case (ex : `CreerSessionUseCase` charge la grille, scanne, instancie, persiste).
- L'**UI** ne fait que **déclencher et afficher**.

## 2. Ports qui fuient l'infrastructure

Une signature de port ne doit **jamais** exposer :
- un type Tauri (`Result<T, TauriError>`, `FileInfo` du plugin…)
- un détail de stockage (colonne DB, chemin de fichier…)

Les erreurs remontées sont **métier** (`PhotoIntrouvable`, `DossierIntrouvable`, `SessionIntrouvable`, `NomAcheteurDejaUtiliseDansSession`). Les erreurs techniques brutes restent enfermées dans l'adapter, traduites au passage.

## 3. YAGNI contrôlé

On ne modélise **que** ce qui a un invariant métier aujourd'hui.

- Commanditaire et Référent = simples `string` sur la Session tant qu'il n'y a pas de besoin de réutilisation.
- La grille par défaut est en dur dans un adapter `InMemory`, pas une entité `Configuration`.
- Pas d'abstraction « pour le jour où » — on extrait quand le besoin se manifeste.

---

# Auteurs de référence

Les sources citées dans les commentaires du code, à picorer en fonction des questions qui viennent :

- **Eric Evans** — *Domain-Driven Design* (le livre bleu). Les concepts fondateurs : Entity, Value Object, Aggregate, Repository, Ubiquitous Language.
- **Vaughn Vernon** — *Implementing Domain-Driven Design* (le livre rouge). Plus pratique, excellentes règles sur les agrégats : « Reference Other Aggregates By Identity », cohérence intra vs inter-agrégats.
- **Alistair Cockburn** — *Hexagonal Architecture* (article). Les ports & adapters.
- **Robert C. Martin** — *Clean Architecture*. Les use cases et l'inversion de dépendance.
- **Martin Fowler** — *Refactoring*. Concept de primitive obsession, et plein d'autres code smells.

---

# Roadmap restante

- **Slice 5 — Facture PDF** : nouveau port `PdfRenderer`, choix de lib à trancher (`pdf-lib` vs `@react-pdf/renderer`).

Questions encore ouvertes côté métier (voir le discovery) :
- Q7 — prix réels du copain (la grille par défaut est en dur à 8/12/18/5 € aujourd'hui).
- Q8 — statut pro, TVA, numérotation des factures (bloque la slice 5).
