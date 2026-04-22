# Journal des modifications

Toutes les modifications notables apportées à Atelier Lumière sont consignées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adhère à [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/simonleclerc/atelier_lumiere/releases/tag/v0.1.0
