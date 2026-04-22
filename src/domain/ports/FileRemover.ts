/**
 * Port du domaine — supprime des fichiers et des dossiers vides.
 *
 * `supprimerSiExiste` : supprime un fichier. Retourne `false` si le
 * fichier n'existe pas (cas normal — concurrence, suppression manuelle,
 * race avec un autre export). Propage les autres erreurs (droits, FS
 * read-only).
 *
 * `supprimerDossierSiVide` : supprime un dossier UNIQUEMENT s'il est
 * vide. Retourne `false` si le dossier n'existe pas, ou s'il contient
 * encore des fichiers/sous-dossiers. Sémantique safe-by-design : aucun
 * risque de supprimer accidentellement le contenu d'un dossier
 * partagé. Utilisé pour nettoyer les sous-dossiers d'export laissés
 * vides après une suppression de session.
 */
export interface FileRemover {
  supprimerSiExiste(chemin: string): Promise<boolean>;
  supprimerDossierSiVide(chemin: string): Promise<boolean>;
}
