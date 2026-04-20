import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  SauvegardeIllisible,
  type SauvegardeFichierIO,
} from "@/domain/ports/SauvegardeFichierIO";

/**
 * Adapter Tauri — lit et écrit un fichier texte à un chemin absolu
 * choisi par l'utilisateur. Les permissions fs sont étendues (scope `**`
 * dans `capabilities/default.json`) donc le chemin peut être n'importe où.
 */
export class TauriSauvegardeFichierIO implements SauvegardeFichierIO {
  async lire(chemin: string): Promise<string> {
    try {
      return await readTextFile(chemin);
    } catch (err) {
      throw new SauvegardeIllisible(chemin, err);
    }
  }

  async ecrire(chemin: string, contenu: string): Promise<void> {
    await writeTextFile(chemin, contenu);
  }
}
