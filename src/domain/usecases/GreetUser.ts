import type { GreetingService } from "../ports/GreetingService";

/**
 * Use case : un scénario métier, exprimé dans le langage du domaine.
 *
 * Reçoit ses dépendances via le constructeur (inversion de dépendance).
 * Le use case ne connaît que des PORTS, jamais d'adapters concrets.
 *
 * NB : "GreetUser" est un exercice de câblage sur le template de démo.
 * Il sera supprimé quand on introduira le vrai domaine (Client, Facture…).
 */
export class GreetUserUseCase {
  constructor(private readonly greetingService: GreetingService) {}

  execute(name: string): Promise<string> {
    return this.greetingService.greet(name);
  }
}
