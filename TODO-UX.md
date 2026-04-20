# TODO — UX / confort de vie

Liste des features de confort de vie à implémenter. Pas de priorisation figée, à réordonner quand on attaque.

## Édition de l'existant

- [x] Éditer une session : dossiers source/export, référent, et tout ce qu'on crée au départ <!-- ne rescanne pas le dossier source — séparé, cf section Synchro -->
- [x] Si la grille tarifaire change, mettre à jour les commandes et leur prix (à préciser quand la facture existera — snapshot figé après facturation)
- [x] Modifier un acheteur (nom, email, téléphone) avec revalidation de l'unicité dans la session
- [ ] Si le nom d'un acheteur change après export : renommer ou supprimer les anciens fichiers pour ne pas laisser d'orphelins sur le disque

## Synchronisation export ↔ commandes

- [ ] Resynchroniser l'export d'une commande pour un acheteur <!-- aujourd'hui le bouton Exporter de chaque commande est idempotent (écrase), il ne nettoie pas les anciens fichiers si des tirages ont été retirés — reste à faire -->
- [x] Resynchroniser l'export de toute une session <!-- bouton Exporter toute la session, continue sur échec partiel avec rapport détaillé -->

- [x] Voir si l'export est à jour pour une commande <!-- badge statut (pas-exporté/incomplet/erreur/complet) sur chaque acheteur, message d'erreur visible sous le nom ; pas de diff fichier-par-fichier — on se base sur l'état capturé au dernier export et sur les modifications depuis -->
- [x] Voir si l'export est à jour pour toutes les commandes d'une session <!-- badge agrégé dans le récapitulatif de la session, priorité erreur > mixte > complet/pas-exporté -->

- [ ] Rescanner le dossier source (si les photos dedans ont changé)
- [ ] Détecter les photos fantômes (référencées dans une commande mais disparues du dossier source)

## Saisie de commande

- [x] Select avec recherche et sélection multiple pour choisir les photos, **en plus** de l'input texte actuel <!-- cmdk + popover shadcn, bouton icône image à droite de l'input ; l'input texte reste source de vérité, le popover coche/décoche en mettant à jour la chaîne -->
- [ ] Raccourcis clavier pour ajouter des photos aux commandes : tabulation correcte entre les champs + validation
- [x] Saisie multi-photos : syntaxe type `1,3,155,176` pour les numéros, avec un seul champ format et un seul champ quantité → ajoute les photos 1, 3, 155, 176 avec le format et la quantité désignés

## Récap & reporting

- [x] Écran de récap de session : chiffre d'affaires total, total de photos, nombre de clients, détail par client (nom, nombre de photos, prix total)
- [x] Tri des acheteurs : date d'ajout, ordre alphabétique, prix total, nombre de photos

## Feedback visuel

- [x] Toasts de succès et d'erreur (sonner déjà installé)
- [ ] Loading / barre de progression pendant un export complet de session

## Robustesse & sécurité des données

- [x] Confirmation avant suppression (partout) <!-- fait pour retirer une ligne de commande ; reste à étendre quand on ajoutera d'autres suppressions -->

- [ ] Pas de delete physique : soft delete uniquement
- [x] Backup / export des données de l'app (pas juste les photos) + import pour restaurer