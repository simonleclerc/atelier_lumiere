import type { CheminDossier } from "../value-objects/CheminDossier";

/**
 * Port — scanne un dossier et rend les numéros de photos trouvés.
 *
 * Contrat : retourne la liste des fichiers `{n}.jpg` où `n` est un entier ≥ 1,
 * sous forme de numéros entiers (1, 2, 3…). Les fichiers non numériques,
 * les extensions autres que .jpg, les sous-dossiers sont ignorés
 * silencieusement — c'est à l'adapter de respecter cette règle métier.
 *
 * L'erreur `DossierIntrouvable` est levée si le chemin n'existe pas :
 * c'est une erreur MÉTIER, pas un détail de filesystem.
 */
export class DossierIntrouvable extends Error {
  constructor(chemin: string) {
    super(`Dossier introuvable : "${chemin}".`);
    this.name = "DossierIntrouvable";
  }
}

export interface FileSystemScanner {
  scanPhotos(chemin: CheminDossier): Promise<readonly number[]>;
}
