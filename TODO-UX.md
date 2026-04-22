# TODO — UX / confort de vie

Liste des features de confort de vie à implémenter. Pas de priorisation figée, à réordonner quand on attaque.

## Édition de l'existant

- [x] Éditer une session : dossiers source/export, référent, et tout ce qu'on crée au départ <!-- ne rescanne pas le dossier source — séparé, cf section Synchro -->
- [x] Si la grille tarifaire change, mettre à jour les commandes et leur prix (à préciser quand la facture existera — snapshot figé après facturation)
- [x] Modifier un acheteur (nom, email, téléphone) avec revalidation de l'unicité dans la session
- [x] Si le nom d'un acheteur change après export : les fichiers déjà exportés sont renommés automatiquement (best-effort), avec dialog de confirmation <!-- port FileRenamer + adapter Tauri + use case ModifierAcheteur orchestre ; confirmation uniquement si le slug change ET l'acheteur a une commande -->


## Synchronisation export ↔ commandes

- [x] Resynchroniser l'export d'une commande pour un acheteur <!-- ports FileLister + FileRemover ; ExporterCommande scanne tous les sous-dossiers de format avec un match strict `{slug}_{photo}_{i}.jpg` (évite la confusion martin vs martin_dupont) et supprime les orphelins avant la copie. Compteur remonté dans les toasts. -->
- [x] Resynchroniser l'export de toute une session <!-- bouton Exporter toute la session, continue sur échec partiel avec rapport détaillé -->

- [x] Voir si l'export est à jour pour une commande <!-- badge statut (pas-exporté/incomplet/erreur/complet) sur chaque acheteur, message d'erreur visible sous le nom ; pas de diff fichier-par-fichier — on se base sur l'état capturé au dernier export et sur les modifications depuis -->
- [x] Voir si l'export est à jour pour toutes les commandes d'une session <!-- badge agrégé dans le récapitulatif de la session, priorité erreur > mixte > complet/pas-exporté -->

- [x] Rescanner le dossier source <!-- bouton "Rescanner les photos" sur la page session ; use case RescannerDossierSource + Session.remplacerPhotos, retourne le diff (ajoutées/retirées) affiché en toast -->
- [x] Contrôler la cohérence d'une session <!-- bouton qui croise commandes × dossier source × dossier export ; 3 catégories : photos fantômes (tirage qui pointe vers un fichier source absent → retirer les tirages), exports à refaire (fichier attendu manquant dans le dossier export → ré-exporter la commande), orphelins dans l'export (fichiers {slug}_N_i.jpg plus rattachés à aucun tirage courant → suppression opt-in avec checkboxes). Le dossier SOURCE n'est JAMAIS modifié. Use cases ControlerCoherenceSession + SupprimerOrphelinsExport -->

## Saisie de commande

- [x] Select avec recherche et sélection multiple pour choisir les photos <!-- shadcn Combobox + ComboboxChips (base-ui) ; photos sélectionnées affichées en chips supprimables, la frappe clavier filtre la liste. Ancienne saisie texte libre "1,3,155,176" abandonnée au profit du combobox -->
- [ ] Raccourcis clavier pour ajouter des photos aux commandes : tabulation correcte entre les champs + validation

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

## other
- [x] mettre une limite sur les photo numerique, une seule max <!-- invariant Commande.ajouterTirage : quantité ≤ 1 pour un tirage numérique (consolidation incluse). Plusieurs photos en numérique autorisées (1 exemplaire chacune), cohérent avec la future offre "70€ = numérique de toutes les photos". UI : input quantité désactivé à 1 quand format = NUMERIQUE -->
- [ ] rajouter une offre sur la session, si un montant est dépassé (par exemple 70€), alors on inclut le format numérique de toutes les photos commandées gratuitement.
  - il faudra prendre en compte ca au scan, si l'offre est active, on les rajoute. A l'inverse si les numériques sont toutes dispo mais que la commande n'est plus au bon montant => on supprimer les numériques
  - a voir ensemble, mais peut etre gerer ca avec des event => lorsque le montant d'une commande change -> on fait le check si il faut toucher les fichiers numériques
- [x] la gestion des photos numérique se fait comme ceci : dans le dossier numérique, il faut faire un dossier avec l'email de l'acheteur comme nom, et on colle dedans les photos numériques, avec la meme logique habituelle de nommage <!-- Commande.nomsFichiersExport prend maintenant { nom, email }, sousDossier = "Numerique/{email}" pour les numériques. Email requis à l'export (EmailAcheteurRequisPourNumerique), validation à l'export seulement (la saisie reste libre, ligne 52 à faire pour l'avertissement). ModifierAcheteur déplace les fichiers quand l'email change (comme pour le nom). Coherence check scanne les sous-dossiers email pour détecter les orphelins. Port FileLister.listerDossiers ajouté. -->
- [x] si il y a au moins une photo en numérique, il faut un avertissement comme quoi l'email doit etre mis si ce n'est pas le cas, une fois qu'il est mis il faut déclencher l'export numérique pour rattraper <!-- bandeau orange dans la carte d'acheteur quand commande contient du numérique sans email. Quand l'email passe vide → rempli, exporterCommande est appelé en chaîne après modifierAcheteur, toast combiné. -->
- [ ] il faut pouvoir supprimer une session (avec confirmation), on nettoye tous les dossier d'export, on ne touche pas au dossier source, on ne garde plus aucune info, c'est du hard delete
- [ ] il faut pouvoir archiver une session (avec confirmation), elle n'est plus dans la liste active, ca nettoie le dossier d'export (pour gagner de la place), mais ca garde l'état des commandes et autre data. plus rien n'est modifiable