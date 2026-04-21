/**
 * Port du domaine — renomme un fichier. Utilisé pour nettoyer les exports
 * quand le nom d'un acheteur change (les fichiers `slug_N°_i.jpg` sur
 * disque doivent suivre le nouveau slug pour ne pas laisser d'orphelins).
 *
 * Sémantique best-effort : si la source n'existe pas, on retourne `false`
 * plutôt que de lever (cas normal — l'utilisateur a pu déplacer ou
 * supprimer les fichiers à la main, ou la commande n'a jamais été
 * exportée). Toute autre erreur (destination bloquée, FS en lecture seule,
 * droits) est propagée.
 */
export interface FileRenamer {
  renommerSiExiste(
    cheminSource: string,
    cheminDestination: string,
  ): Promise<boolean>;
}
