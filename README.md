# Atelier Lumière

Application de bureau pour gérer les ventes de tirages photo à l'issue d'un spectacle ou d'un événement. Le photographe y inscrit ses acheteurs, enregistre les commandes (formats papier et fichiers numériques) et exporte automatiquement les fichiers vers le dossier de l'imprimeur, avec un nommage prêt pour la production.

- **Plateformes** : macOS (installeur `.dmg`, universel Intel + Apple Silicon) et Windows (installeur `.msi`).
- **Interface** : 100 % française.
- **Données** : stockées localement sur la machine, sauvegardables en un fichier JSON.

---

## Sommaire

1. [Installation](#installation)
2. [Premiers pas](#premiers-pas)
3. [Guide d'utilisation](#guide-dutilisation)
   - [Liste des sessions](#liste-des-sessions)
   - [Créer ou modifier une session](#créer-ou-modifier-une-session)
   - [Fiche session](#fiche-session)
   - [Grille tarifaire](#grille-tarifaire)
   - [Acheteurs](#acheteurs)
   - [Commandes et tirages](#commandes-et-tirages)
   - [Exporter vers l'imprimeur](#exporter-vers-limprimeur)
   - [Statuts d'export](#statuts-dexport)
   - [Rescanner les photos](#rescanner-les-photos)
   - [Contrôler la cohérence](#contrôler-la-cohérence)
   - [Sauvegarder et restaurer](#sauvegarder-et-restaurer)
4. [Convention de nommage des fichiers exportés](#convention-de-nommage-des-fichiers-exportés)
5. [Limites connues et FAQ](#limites-connues-et-faq)
6. [Signaler un problème](#signaler-un-problème)

---

## Installation

Les installeurs sont disponibles sur la [page des releases](https://github.com/simonleclerc/atelier_lumiere/releases).

| Système | Fichier à télécharger |
| --- | --- |
| macOS (Intel ou Apple Silicon) | `atelier_lumiere_x.y.z_universal.dmg` |
| Windows 10/11 | `atelier_lumiere_x.y.z_x64-setup.exe` ou `atelier_lumiere_x.y.z_x64_en-US.msi` |

### Premier lancement (important)

L'application n'est pas encore signée auprès d'Apple ni de Microsoft. Au premier lancement, le système d'exploitation affichera un avertissement. Ce n'est pas un problème de sécurité, c'est simplement l'absence de certificat commercial.

- **macOS** : ouvrez le Finder, faites un **clic droit** sur `Atelier Lumière.app` puis **Ouvrir**. Confirmez dans la boîte de dialogue. Les lancements suivants se font normalement.
- **Windows** : au message « Windows a protégé votre ordinateur », cliquez sur **Informations complémentaires** puis sur **Exécuter quand même**.

---

## Premiers pas

1. **Préparez le dossier source.** Placez toutes les photos de la séance dans un même dossier, nommées avec leur numéro d'ordre suivi de `.jpg` : `1.jpg`, `2.jpg`, `145.jpg`, etc. Les fichiers qui ne suivent pas cette convention sont ignorés.
2. **Préparez le dossier d'export.** Créez un dossier vide qui servira de destination pour les fichiers à imprimer. Il doit être **différent** du dossier source (l'application refusera d'utiliser le même).
3. **Lancez l'application** et cliquez sur **Nouvelle session**. Remplissez les informations, choisissez les deux dossiers, validez.
4. **Ouvrez la session** en cliquant dessus dans la liste, et commencez à inscrire vos acheteurs.

Le dossier source n'est **jamais modifié** par l'application. Vos originaux sont en sécurité.

---

## Guide d'utilisation

### Liste des sessions

L'écran d'accueil liste toutes les sessions créées, de la plus récente à la plus ancienne. Trois boutons en entête :

- **Nouvelle session** : ouvre le formulaire de création.
- **Sauvegarder** : enregistre toutes vos données (sessions + commandes) dans un fichier JSON, à l'emplacement de votre choix. Utile pour archiver, transférer sur une autre machine ou faire un point de restauration avant une grosse modification.
- **Importer** : restaure les données depuis un fichier JSON créé par **Sauvegarder**. ⚠️ Attention : cette opération **remplace toutes les données actuelles** de l'application. Une confirmation est demandée.

Un clic sur une session dans la liste ouvre sa fiche détaillée.

### Créer ou modifier une session

Le formulaire demande :

- **Commanditaire** (obligatoire) : par exemple le nom du théâtre ou de l'événement.
- **Référent** (obligatoire) : la personne de contact côté commanditaire.
- **Date** : la date de l'événement.
- **Type** : catégorie libre (par exemple « Spectacle », « Concert », « Mariage »).
- **Dossier source** (obligatoire) : cliquez sur **Choisir…** et sélectionnez le dossier contenant les photos numérotées.
- **Dossier export** (obligatoire) : cliquez sur **Choisir…** et sélectionnez un dossier vide qui recevra les fichiers exportés. Il doit être distinct du dossier source.

Le bouton **Créer la session** (ou **Enregistrer les modifications** en édition) valide le formulaire.

### Fiche session

En haut de la fiche, à côté du nom du commanditaire :

- **Rescanner les photos** : relit le dossier source pour mettre à jour la liste des photos disponibles.
- **Contrôler la cohérence** : ouvre un outil de diagnostic (voir plus bas).
- **Modifier** : rouvre le formulaire de session pour changer une information (nom, dossiers, date…).

La fiche est découpée en plusieurs sections : grille tarifaire, liste des acheteurs, récapitulatif.

### Grille tarifaire

Chaque session a sa propre grille tarifaire. Les formats proposés sont fixes :

- **15×23** (tirage papier)
- **20×30** (tirage papier)
- **30×45** (tirage papier)
- **Numérique** (fichier digital livré à l'acheteur)

Pour chaque format, saisissez le prix en euros et cliquez sur **Enregistrer**. Le bouton n'est actif que si le prix a été modifié ; sinon il affiche **À jour**.

⚠️ Modifier un prix impacte **immédiatement** le total de toutes les commandes non facturées de la session. Pour une session déjà en cours, fixez vos prix avant d'enregistrer les commandes, ou prévenez vos acheteurs.

### Acheteurs

- **Nouvel acheteur** : ouvre le formulaire. Seul le **nom** est obligatoire ; l'email et le téléphone sont optionnels. Deux acheteurs ne peuvent pas porter le même nom dans une même session (à l'espace et à la casse près).
- **Trier par** : quand vous avez plusieurs acheteurs, un menu permet de les classer par :
  - Ordre d'ajout
  - Alphabétique
  - Chiffre d'affaires (total de la commande décroissant)
  - Nombre de tirages (décroissant)

Chaque acheteur est présenté dans une carte avec ses coordonnées, son statut d'export, le total de sa commande et ses tirages. Deux boutons par carte :

- **Modifier** : rouvre le formulaire de l'acheteur. Si vous changez le nom et que des fichiers ont déjà été exportés, une fenêtre de confirmation propose de **renommer automatiquement** les fichiers existants pour qu'ils correspondent au nouveau nom. Aucune donnée n'est supprimée.
- **Ajouter des photos** : ouvre le formulaire de saisie d'une commande.

### Commandes et tirages

Chaque acheteur a **une seule commande** dans une session donnée. Une commande est une collection de **tirages** (une photo dans un format, en une ou plusieurs quantités).

Le formulaire **Ajouter des photos** propose :

- **Photo(s)** : un sélecteur multi-choix avec recherche. Tapez pour filtrer par numéro, cliquez sur une ou plusieurs photos pour les ajouter comme « puces » (chips). Re-cliquer sur une photo la retire.
- **Format** : le format d'impression. Le prix en vigueur dans la grille tarifaire est affiché à côté de chaque option.
- **Quantité** : le nombre d'exemplaires à produire de chaque photo sélectionnée.
- **Ajouter** : valide le formulaire.

Si plusieurs photos sont sélectionnées et qu'une quantité de 2 est indiquée, l'application crée un tirage par photo, chacun en 2 exemplaires.

**Règle pour le format numérique** : un fichier digital est livré en **1 exemplaire maximum par photo**. Le champ quantité est automatiquement verrouillé à 1 dès que vous choisissez le format numérique. Plusieurs photos en numérique dans la même commande restent possibles (chacune en 1 exemplaire).

Dans la liste des tirages d'une commande, chaque ligne peut être retirée individuellement via le bouton **Retirer** (avec confirmation). Si c'était le dernier tirage de la commande, la commande est supprimée automatiquement.

### Exporter vers l'imprimeur

Deux boutons selon le périmètre :

- **Exporter** (dans la carte d'un acheteur) : exporte uniquement la commande de cet acheteur.
- **Exporter toute la session (N)** (dans le récapitulatif en bas de la fiche) : exporte toutes les commandes d'un coup. Une confirmation est demandée au-delà de 3 acheteurs. Si certaines commandes échouent (photo source manquante, par exemple), les autres continuent d'être exportées, et un rapport détaillé est affiché.

À chaque export, l'application :

1. **Copie** les photos originales du dossier source vers `{dossier_export}/{format}/` en les renommant selon la convention (voir plus bas).
2. **Nettoie les orphelins** : si la commande a changé depuis le dernier export (tirage retiré, format changé…), les anciens fichiers devenus inutiles sont supprimés pour que le contenu du dossier d'export reflète exactement l'état actuel de la commande.

Un toast (notification en haut à droite) confirme le nombre de fichiers créés et, le cas échéant, le nombre d'orphelins supprimés.

### Statuts d'export

Chaque commande affiche un badge de statut qui indique l'état de ses fichiers sur disque :

- **Pas exporté** : la commande n'a jamais été exportée.
- **Incomplet** : la commande a été exportée au moins une fois, puis modifiée (ajout ou retrait de tirages). Un nouvel export est nécessaire pour remettre les fichiers à jour.
- **Erreur** : le dernier export a échoué ; le message d'erreur est visible sous le nom.
- **Complet** : la commande est exportée et les fichiers correspondent à son état actuel.

Le récapitulatif en bas de la fiche session affiche un statut **agrégé** pour toute la session (priorité : erreur > incomplet > complet > pas exporté).

### Rescanner les photos

Si vous ajoutez, retirez ou renommez des fichiers dans le dossier source **après** la création de la session, la liste des photos disponibles dans l'application ne se met pas à jour toute seule. Cliquez sur **Rescanner les photos** pour synchroniser. Un toast vous indique combien de photos ont été ajoutées et combien ont été retirées. Si rien n'a changé, le toast le confirme.

Cette action ne touche **aucun fichier** : elle relit simplement le contenu du dossier source.

### Contrôler la cohérence

L'outil **Contrôler la cohérence** ouvre un diagnostic en trois sections. Chaque section propose une action corrective. **Le dossier source n'est jamais modifié** par ces actions, quelles qu'elles soient.

**1. Photos fantômes**
Liste les tirages qui pointent vers une photo absente du dossier source (par exemple, un fichier effacé ou déplacé à la main). Le bouton **Retirer tous ces tirages** supprime ces lignes des commandes concernées. Si une commande se retrouve vide après cela, elle est supprimée automatiquement.

**2. Exports à refaire**
Liste les commandes dont un ou plusieurs fichiers attendus dans le dossier d'export manquent sur disque (fichier supprimé manuellement, disque externe débranché au moment d'un export précédent…). Le bouton **Ré-exporter les commandes concernées** relance l'export uniquement pour ces commandes.

**3. Fichiers orphelins dans l'export**
Liste les fichiers présents dans le dossier d'export qui ne correspondent plus à aucun tirage courant : restes de commandes d'acheteurs supprimés, tirages retirés, ou fichiers portant un ancien nom après un renommage. Cochez ceux que vous voulez supprimer (tous sont cochés par défaut) puis cliquez sur **Supprimer N fichier(s)**. Les fichiers encore attendus par une commande ne seront jamais supprimés, même si la case est cochée : l'application revérifie juste avant la suppression.

### Sauvegarder et restaurer

Depuis la liste des sessions :

- **Sauvegarder** produit un fichier JSON versionné contenant **toutes** les sessions et commandes. Les photos ne sont **pas** incluses (ce sont vos fichiers originaux, ils restent où ils sont).
- **Importer** lit un fichier JSON et **remplace** entièrement les données actuelles. Une confirmation est demandée.

Usages typiques :

- Avant une grosse modification, faire une sauvegarde pour pouvoir revenir en arrière.
- Transférer les données d'une session sur une autre machine.
- Archiver une saison terminée.

---

## Convention de nommage des fichiers exportés

Chaque fichier exporté suit le format :

```
{dossier_export}/{format}/{slug-acheteur}{indexGlobal}.{numéro-photo}.{exemplaire}.jpg
```

Par exemple, pour Martin Dupont qui commande 3 exemplaires en 20×30 de la photo 145 puis 1 fichier numérique de la photo 1 :

```
{dossier_export}/20x30/martin_dupont1.145.1.jpg
{dossier_export}/20x30/martin_dupont2.145.2.jpg
{dossier_export}/20x30/martin_dupont3.145.3.jpg
{dossier_export}/Numerique/martin_dupont4.1.1.jpg
```

Signification des trois segments numériques :

- **indexGlobal** (`1`, `2`, `3`, `4`…) — compteur unique sur tous les exemplaires de la commande. Il donne d'un coup d'œil le nombre total de tirages d'un acheteur.
- **numéro-photo** — le numéro de la photo d'origine.
- **exemplaire** — le numéro de copie à l'intérieur d'un même tirage (reparti de 1 à chaque nouveau tirage).

Le **slug** est calculé à partir du nom de l'acheteur : passage en minuscules, accents retirés, espaces convertis en `_`, caractères spéciaux supprimés. Exemple : « Martin Dupont » devient `martin_dupont`, « Jean-François Müller » devient `jean-francois_muller`.

Si deux acheteurs d'une même session risquent de produire le même slug, le formulaire vous le signalera à la création.

---

## Limites connues et FAQ

**Les installeurs ne sont pas signés.** Un avertissement s'affiche au premier lancement sur Mac et Windows (voir [Installation](#premier-lancement-important)).

**Un acheteur = une seule commande par session.** Si un même client vient vous voir deux fois lors d'une même séance, ajoutez simplement ses nouveaux tirages à sa commande existante.

**Un fichier numérique = un seul exemplaire par photo.** L'interface l'enforce automatiquement. Si un acheteur veut deux versions différentes du même fichier, choisissez un format papier.

**Où sont stockées les données ?** L'application utilise le dossier applicatif système (`~/Library/Application Support/com.atelierlumiere.app` sur macOS, `%APPDATA%\com.atelierlumiere.app` sur Windows). Pour garder une trace hors de ce dossier, utilisez **Sauvegarder** régulièrement.

**Puis-je utiliser un dossier réseau / NAS pour l'export ?** Oui, tant que le système le voit comme un dossier local. Les performances dépendent du réseau.

**Puis-je travailler à plusieurs sur les mêmes données ?** Pas pour l'instant : l'application est mono-utilisateur. Le fichier JSON produit par **Sauvegarder** peut cependant être partagé pour transférer une session d'une machine à l'autre.

---

## Signaler un problème

Un bug, une suggestion, une question : ouvrez une issue sur la [page GitHub du projet](https://github.com/simonleclerc/atelier_lumiere/issues).
