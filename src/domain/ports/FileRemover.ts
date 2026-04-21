/**
 * Port du domaine — supprime un fichier. Utilisé pour nettoyer les
 * orphelins lors d'un ré-export (tirages retirés depuis le dernier
 * export).
 *
 * Sémantique best-effort : retourne `false` si le fichier n'existe pas
 * (cas normal — concurrence, suppression manuelle, race avec un autre
 * export). Propage les autres erreurs (droits, FS read-only).
 */
export interface FileRemover {
  supprimerSiExiste(chemin: string): Promise<boolean>;
}
