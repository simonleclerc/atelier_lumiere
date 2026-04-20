import { open, save } from "@tauri-apps/plugin-dialog";
import type { SauvegardeFichierPicker } from "@/ui/ports/SauvegardeFichierPicker";

export class TauriSauvegardeFichierPicker implements SauvegardeFichierPicker {
  async choisirPourExport(nomParDefaut: string): Promise<string | null> {
    const resultat = await save({
      defaultPath: nomParDefaut,
      title: "Exporter la sauvegarde",
      filters: [{ name: "Sauvegarde atelier_lumiere", extensions: ["json"] }],
    });
    return typeof resultat === "string" ? resultat : null;
  }

  async choisirPourImport(): Promise<string | null> {
    const resultat = await open({
      multiple: false,
      directory: false,
      title: "Importer une sauvegarde",
      filters: [{ name: "Sauvegarde atelier_lumiere", extensions: ["json"] }],
    });
    return typeof resultat === "string" ? resultat : null;
  }
}
