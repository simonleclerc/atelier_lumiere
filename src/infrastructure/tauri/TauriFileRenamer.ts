import { exists, mkdir, rename } from "@tauri-apps/plugin-fs";
import type { FileRenamer } from "@/domain/ports/FileRenamer";

/**
 * Adapter Tauri — renomme un fichier via `@tauri-apps/plugin-fs`. Crée le
 * dossier parent de la destination si besoin. Retourne `false` si la
 * source n'existe pas (best-effort pour le nettoyage post-changement de
 * nom d'acheteur), propage les autres erreurs fs.
 */
export class TauriFileRenamer implements FileRenamer {
  async renommerSiExiste(
    cheminSource: string,
    cheminDestination: string,
  ): Promise<boolean> {
    if (!(await exists(cheminSource))) return false;
    const parent = dossierParentDe(cheminDestination);
    if (parent && !(await exists(parent))) {
      await mkdir(parent, { recursive: true });
    }
    await rename(cheminSource, cheminDestination);
    return true;
  }
}

function dossierParentDe(chemin: string): string {
  const sep = chemin.includes("\\") ? "\\" : "/";
  const index = chemin.lastIndexOf(sep);
  return index === -1 ? "" : chemin.slice(0, index);
}
