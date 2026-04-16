import { readDir } from "@tauri-apps/plugin-fs";
import {
  DossierIntrouvable,
  type FileSystemScanner,
} from "@/domain/ports/FileSystemScanner";
import type { CheminDossier } from "@/domain/value-objects/CheminDossier";

/**
 * Adapter Tauri du port FileSystemScanner.
 *
 * Responsabilités :
 *  - lire le contenu du dossier via `@tauri-apps/plugin-fs`
 *  - filtrer les fichiers `{n}.jpg` (n entier ≥ 1)
 *  - convertir les erreurs d'IO en erreurs MÉTIER (`DossierIntrouvable`)
 *
 * Si demain on passe sur navigateur / serveur, on écrit un autre adapter
 * (HTTP, fs natif node, S3…) à côté. Le domaine et le use case ne changent pas.
 */
const REGEX_PHOTO = /^(\d+)\.jpe?g$/i;

export class TauriFileSystemScanner implements FileSystemScanner {
  async scanPhotos(chemin: CheminDossier): Promise<readonly number[]> {
    let entrees;
    try {
      entrees = await readDir(chemin.valeur);
    } catch {
      throw new DossierIntrouvable(chemin.valeur);
    }
    const numeros: number[] = [];
    for (const entree of entrees) {
      if (!entree.isFile) continue;
      const match = REGEX_PHOTO.exec(entree.name);
      if (!match) continue;
      const n = Number.parseInt(match[1], 10);
      if (Number.isInteger(n) && n >= 1) {
        numeros.push(n);
      }
    }
    return numeros.sort((a, b) => a - b);
  }
}
