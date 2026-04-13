/**
 * Port : le domaine déclare ce dont il a besoin, sans savoir comment c'est fait.
 *
 * Un adapter (Tauri, HTTP, in-memory pour les tests…) implémentera cette interface.
 * Ce fichier ne doit contenir AUCUN import externe (ni React, ni Tauri, ni Node).
 */
export interface GreetingService {
  greet(name: string): Promise<string>;
}
