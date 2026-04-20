/**
 * Port UI — dialog natif pour choisir un fichier de sauvegarde, en
 * lecture ou en écriture.
 *
 * Deux méthodes distinctes plutôt qu'un seul `choisir(mode)` : les dialogs
 * save et open ont des ergonomies différentes (proposer un nom par défaut
 * à l'enregistrement, filtrer les fichiers *.json à l'ouverture). Les
 * séparer rend l'intention visible à l'appel.
 */
export interface SauvegardeFichierPicker {
  /**
   * Ouvre un dialog de sauvegarde. Retourne le chemin choisi par
   * l'utilisateur, ou `null` s'il a annulé.
   */
  choisirPourExport(nomParDefaut: string): Promise<string | null>;
  /**
   * Ouvre un dialog d'ouverture filtré sur `*.json`. Retourne le chemin
   * choisi, ou `null` si annulé.
   */
  choisirPourImport(): Promise<string | null>;
}
