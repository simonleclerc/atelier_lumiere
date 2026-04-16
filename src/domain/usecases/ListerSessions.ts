import type { Session } from "../entities/Session";
import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case de lecture. Trivial aujourd'hui, mais existe en tant que classe
 * pour rester cohérent avec le style "un use case = une classe" — ça permet
 * d'ajouter de la logique plus tard (tri, filtres, projection) sans toucher
 * à l'UI.
 */
export class ListerSessionsUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  execute(): Promise<readonly Session[]> {
    return this.sessionRepository.findAll();
  }
}
