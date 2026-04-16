import { open } from "@tauri-apps/plugin-dialog";
import type { DossierPicker } from "@/ui/ports/DossierPicker";

export class TauriDossierPicker implements DossierPicker {
  async choisir(titre: string): Promise<string | null> {
    const resultat = await open({
      directory: true,
      multiple: false,
      title: titre,
    });
    return typeof resultat === "string" ? resultat : null;
  }
}
