# Journal des modifications

Toutes les modifications notables apportées à Atelier Lumière sont consignées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adhère à [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-04-23

Cycle de vie des sessions, livraison du numérique par email, et confort visuel.

### Ajouté

- **Suppression d'une session** depuis la fiche de session, avec dialog de confirmation explicite. La suppression nettoie tous les fichiers d'export que la session a créés (papier et numérique, sous-dossiers compris) et les sous-dossiers laissés vides. Le dossier source n'est jamais touché.
- **Archivage d'une session** : nouveau bouton **Archiver** qui supprime les fichiers d'export pour libérer de l'espace mais conserve toutes les données de la session (commandes, acheteurs, statistiques, statuts). La session bascule en lecture seule, avec un bandeau dédié et tous les boutons de modification masqués. Bouton **Désarchiver** pour la rendre de nouveau modifiable.
- **Liste des sessions** organisée en deux sections : **Actives** et **Archivées** (la section archivées est masquée si vide).
- **Tirages numériques rangés par email** : les fichiers numériques sont désormais exportés dans `Numerique/{email}/` au lieu d'un unique dossier `Numerique/`. Un dossier par acheteur, plus simple à transmettre individuellement.
- **Bandeau d'avertissement** sur la carte d'un acheteur quand sa commande contient au moins un tirage numérique mais qu'aucun email n'est renseigné. Dès que l'email est ajouté, l'export numérique est lancé automatiquement pour rattraper les fichiers qui n'avaient pas pu être créés.
- **Renommage automatique des fichiers numériques** quand l'email d'un acheteur change : les fichiers migrent vers le nouveau sous-dossier email (au même titre que ce qui était déjà fait pour les changements de nom).
- **Bouton Rescanner les photos** sur la fiche session : synchronise la liste des photos avec le contenu actuel du dossier source si vous l'avez modifié hors application. Toast affichant le diff (photos ajoutées / retirées) ou confirmant l'absence de changement.
- **Contrôle de cohérence** au niveau session, en trois sections (photos fantômes, exports à refaire, fichiers orphelins dans le dossier d'export). Chaque section propose une action corrective. Le dossier source reste intouchable en toutes circonstances.

### Modifié

- **Thème de l'application** : passage en thème sombre par défaut (mieux adapté aux longues sessions de travail post-spectacle).
- **Convention de nommage des fichiers numériques** : intégration du sous-dossier email (`Numerique/{email}/...`). Les fichiers exportés avant cette version restent dans `Numerique/` à la racine et seront détectés comme orphelins par le contrôle de cohérence.
- **Sauvegarde JSON** : le format de sauvegarde inclut maintenant l'état d'archivage des sessions. Les sauvegardes 0.1.0 restent lisibles (les sessions sont importées comme non archivées).

## [0.1.0] — 2026-04-22

Première release publique.

### Ajouté

- **Sessions** : création, édition et suppression de sessions photo. Paramètres : commanditaire, référent, date, type d'événement, dossier source et dossier d'export.
- **Grille tarifaire** : un prix par format et par session, modifiable à tout moment. Formats disponibles : 15×23, 20×30, 30×45 et numérique.
- **Acheteurs** : ajout, édition (nom, email, téléphone) et inscription sur une session. Tri des acheteurs par ordre d'ajout, alphabétique, chiffre d'affaires ou nombre de tirages.
- **Commandes et tirages** : une commande par couple session/acheteur, plusieurs tirages par commande. Sélecteur de photos multi-sélection avec recherche, consolidation automatique des doublons (même photo et même format = incrémentation de la quantité).
- **Règle métier** : un tirage numérique est limité à 1 exemplaire par photo (interface désactive l'input quantité automatiquement). Plusieurs photos peuvent être commandées en numérique dans la même commande.
- **Export physique** : copie des photos originales vers `{dossier_export}/{format}/` avec renommage `{slug}{indexGlobal}.{photo}.{exemplaire}.jpg`.
- **Export par acheteur** et **export de toute la session en un clic**, avec rapport d'erreurs partielles en cas d'échec sur certaines commandes.
- **Nettoyage automatique des orphelins** lors d'un ré-export : les fichiers ne correspondant plus à l'état actuel de la commande sont supprimés.
- **Statuts d'export** : badges visuels par commande (Pas exporté, Incomplet, Erreur, Complet) et statut agrégé au niveau de la session.
- **Renommage automatique** des fichiers déjà exportés quand le nom d'un acheteur change, avec fenêtre de confirmation.
- **Rescan du dossier source** : met à jour la liste des photos disponibles si le contenu du dossier a évolué depuis la création de la session. Affiche le diff des photos ajoutées et retirées.
- **Contrôle de cohérence** au niveau session, en trois sections :
  - Photos fantômes (tirages pointant vers une photo absente du dossier source).
  - Exports à refaire (fichiers attendus manquants sur disque).
  - Fichiers orphelins dans l'export (fichiers qui ne correspondent à aucune commande courante).
  Chaque section propose une action corrective. Le dossier source n'est jamais modifié.
- **Sauvegarde et restauration** : export et import de l'ensemble des données (sessions + commandes) au format JSON versionné.
- **Récapitulatif de session** : chiffre d'affaires total, nombre total de tirages, nombre d'acheteurs actifs.
- **Notifications** : toasts de succès, d'avertissement et d'erreur sur toutes les actions importantes.

### Techniques

- Application desktop construite avec **Tauri 2**, **React** et **TypeScript**.
- Architecture en couches : domaine métier pur, ports et adapters.
- Bundles distribués : `.dmg` universel (Intel + Apple Silicon) pour macOS, `.msi` pour Windows.

[0.2.0]: https://github.com/simonleclerc/atelier_lumiere/releases/tag/v0.2.0
[0.1.0]: https://github.com/simonleclerc/atelier_lumiere/releases/tag/v0.1.0
