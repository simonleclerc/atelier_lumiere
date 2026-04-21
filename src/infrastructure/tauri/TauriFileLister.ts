import { exists, readDir } from "@tauri-apps/plugin-fs";
import type { FileLister } from "@/domain/ports/FileLister";

/**
 * Adapter Tauri — liste les fichiers (hors sous-dossiers et symlinks) d'un
 * répertoire via `@tauri-apps/plugin-fs`. Retourne `[]` si le dossier
 * n'existe pas (cas normal : session jamais exportée, ou format pas
 * encore utilisé).
 */
export class TauriFileLister implements FileLister {
  async listerFichiers(dossier: string): Promise<readonly string[]> {
    if (!(await exists(dossier))) return [];
    const entries = await readDir(dossier);
    return entries.filter((e) => e.isFile).map((e) => e.name);
  }
}
