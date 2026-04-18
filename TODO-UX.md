# TODO — UX / confort de vie

Liste des features de confort de vie à implémenter. Pas de priorisation figée, à réordonner quand on attaque.

## Édition de l'existant

- [ ] Éditer une session : dossiers source/export, référent, et tout ce qu'on crée au départ
- [ ] Si la grille tarifaire change, mettre à jour les commandes et leur prix (à préciser quand la facture existera — snapshot figé après facturation)
- [ ] Modifier un acheteur et refaire son export : si le nom change, supprimer les anciennes photos ou les renommer (choisir le moins coûteux)

## Synchronisation export ↔ commandes

- [ ] Resynchroniser l'export d'une commande pour un acheteur
- [ ] Resynchroniser l'export de toute une session
- [ ] Voir si l'export est à jour pour une commande (diff commande ↔ fichiers exportés)
- [ ] Voir si l'export est à jour pour toutes les commandes d'une session
- [ ] Rescanner le dossier source (si les photos dedans ont changé)
- [ ] Détecter les photos fantômes (référencées dans une commande mais disparues du dossier source)

## Saisie de commande

- [ ] Select avec recherche quand on choisit une photo
- [ ] Raccourcis clavier pour ajouter des photos aux commandes : tabulation correcte entre les champs + validation
- [ ] Saisie multi-photos : syntaxe type `1,3,155,176` pour les numéros, avec un seul champ format et un seul champ quantité → ajoute les photos 1, 3, 155, 176 avec le format et la quantité désignés

## Récap & reporting

- [ ] Écran de récap de session : chiffre d'affaires total, total de photos, nombre de clients, détail par client (nom, nombre de photos, prix total)
- [ ] Tri des acheteurs : date d'ajout, ordre alphabétique, prix total, nombre de photos

## Feedback visuel

- [ ] Toasts de succès et d'erreur (sonner déjà installé)
- [ ] Loading / barre de progression pendant un export complet de session

## Robustesse & sécurité des données

- [ ] Confirmation avant suppression (partout)
- [ ] Pas de delete physique : soft delete uniquement
- [ ] Backup / export des données de l'app (pas juste les photos) + import pour restaurer