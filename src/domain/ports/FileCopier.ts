/**
 * Port — copie d'un fichier vers un emplacement donné.
 *
 * Contrat : l'adapter s'assure que le dossier parent de `cheminDestination`
 * existe (création récursive si besoin). Une destination déjà existante est
 * ÉCRASÉE sans préavis — le use case ExporterCommande est déterministe,
 * un re-run produit les mêmes fichiers.
 *
 * L'erreur `FichierSourceIntrouvable` est métier : on la remonte si la
 * photo source n'existe pas sur le disque (dossier déplacé, supprimé…).
 */
export class FichierSourceIntrouvable extends Error {
  constructor(cheminSource: string) {
    super(`Fichier source introuvable : "${cheminSource}".`);
    this.name = "FichierSourceIntrouvable";
  }
}

export interface FileCopier {
  copier(cheminSource: string, cheminDestination: string): Promise<void>;
}
