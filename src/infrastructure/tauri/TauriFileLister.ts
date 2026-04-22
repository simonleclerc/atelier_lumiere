import { exists, readDir } from "@tauri-apps/plugin-fs";
import type { FileLister } from "@/domain/ports/FileLister";

/**
 * Adapter Tauri — lit un répertoire via `@tauri-apps/plugin-fs` et filtre
 * soit les fichiers, soit les sous-dossiers directs. Retourne `[]` si le
 * dossier n'existe pas (cas normal : jamais exporté, format inutilisé).
 */
export class TauriFileLister implements FileLister {
  async listerFichiers(dossier: string): Promise<readonly string[]> {
    if (!(await exists(dossier))) return [];
    const entries = await readDir(dossier);
    return entries.filter((e) => e.isFile).map((e) => e.name);
  }

  async listerDossiers(dossier: string): Promise<readonly string[]> {
    if (!(await exists(dossier))) return [];
    const entries = await readDir(dossier);
    return entries.filter((e) => e.isDirectory).map((e) => e.name);
  }
}
