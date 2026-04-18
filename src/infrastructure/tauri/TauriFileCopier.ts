import { copyFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import {
  FichierSourceIntrouvable,
  type FileCopier,
} from "@/domain/ports/FileCopier";

/**
 * Adapter Tauri — copie un fichier via `@tauri-apps/plugin-fs`, crée le
 * dossier parent de la destination si besoin, traduit une erreur fs en
 * `FichierSourceIntrouvable` si la photo source a disparu.
 */
export class TauriFileCopier implements FileCopier {
  async copier(cheminSource: string, cheminDestination: string): Promise<void> {
    const sourceExiste = await exists(cheminSource);
    if (!sourceExiste) {
      throw new FichierSourceIntrouvable(cheminSource);
    }
    const dossierParent = dossierParentDe(cheminDestination);
    if (dossierParent) {
      const parentExiste = await exists(dossierParent);
      if (!parentExiste) {
        await mkdir(dossierParent, { recursive: true });
      }
    }
    await copyFile(cheminSource, cheminDestination);
  }
}

function dossierParentDe(chemin: string): string {
  const sep = chemin.includes("\\") ? "\\" : "/";
  const index = chemin.lastIndexOf(sep);
  return index === -1 ? "" : chemin.slice(0, index);
}
