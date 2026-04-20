/**
 * Port — accès fichier texte à un chemin arbitraire.
 *
 * Distinct des repositories (qui persistent dans AppData) : ici le chemin
 * est choisi par l'utilisateur via un dialog natif, il peut pointer
 * n'importe où (Desktop, cloud sync, clé USB). Utilisé exclusivement
 * par les use cases `ExporterSauvegarde` et `ImporterSauvegarde`.
 *
 * Erreurs remontées : métier (`SauvegardeIllisible`), pas techniques.
 */
export class SauvegardeIllisible extends Error {
  constructor(chemin: string, cause?: unknown) {
    const causeMsg =
      cause instanceof Error ? ` (${cause.message})` : "";
    super(`Sauvegarde illisible à "${chemin}"${causeMsg}.`);
    this.name = "SauvegardeIllisible";
  }
}

export interface SauvegardeFichierIO {
  lire(chemin: string): Promise<string>;
  ecrire(chemin: string, contenu: string): Promise<void>;
}
