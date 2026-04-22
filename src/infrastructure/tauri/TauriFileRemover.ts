import { exists, readDir, remove } from "@tauri-apps/plugin-fs";
import type { FileRemover } from "@/domain/ports/FileRemover";

/**
 * Adapter Tauri — supprime fichiers et dossiers vides via
 * `@tauri-apps/plugin-fs`. Best-effort : retourne `false` plutôt que de
 * lever quand la cible n'existe pas (cas normal en concurrence ou
 * après suppression manuelle).
 */
export class TauriFileRemover implements FileRemover {
  async supprimerSiExiste(chemin: string): Promise<boolean> {
    if (!(await exists(chemin))) return false;
    await remove(chemin);
    return true;
  }

  async supprimerDossierSiVide(chemin: string): Promise<boolean> {
    if (!(await exists(chemin))) return false;
    const entries = await readDir(chemin);
    if (entries.length > 0) return false;
    await remove(chemin);
    return true;
  }
}
