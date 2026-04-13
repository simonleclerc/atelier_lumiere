import { invoke } from "@tauri-apps/api/core";
import type { GreetingService } from "../../domain/ports/GreetingService";

/**
 * Adapter Tauri : implémente le port GreetingService en appelant la commande Rust `greet`.
 *
 * C'est le SEUL fichier du projet autorisé à importer depuis @tauri-apps/*.
 * Si demain on passe sur web, on écrit un HttpGreetingService ici
 * (dans un dossier voisin infrastructure/http/) sans rien changer au domaine ni à l'UI.
 */
export class TauriGreetingService implements GreetingService {
  greet(name: string): Promise<string> {
    return invoke<string>("greet", { name });
  }
}
