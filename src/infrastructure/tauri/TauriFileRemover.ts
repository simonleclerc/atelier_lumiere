import { exists, remove } from "@tauri-apps/plugin-fs";
import type { FileRemover } from "@/domain/ports/FileRemover";

/**
 * Adapter Tauri — supprime un fichier via `@tauri-apps/plugin-fs`.
 * Best-effort : retourne `false` si le fichier n'existe pas (plutôt que
 * de lever). Utilisé pour nettoyer les orphelins d'un ré-export.
 */
export class TauriFileRemover implements FileRemover {
  async supprimerSiExiste(chemin: string): Promise<boolean> {
    if (!(await exists(chemin))) return false;
    await remove(chemin);
    return true;
  }
}
