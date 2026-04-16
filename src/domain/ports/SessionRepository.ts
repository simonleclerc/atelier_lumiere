import type { Session } from "../entities/Session";

/**
 * Port (Alistair Cockburn, Hexagonal Architecture) — le domaine déclare ses
 * besoins en langage métier. L'infrastructure (TauriSessionRepository,
 * plus tard HttpSessionRepository ou InMemorySessionRepository pour les tests)
 * implémente concrètement. Le domaine ne sait PAS comment une session
 * est persistée.
 *
 * Règles respectées :
 *  - Signatures en objets du domaine (Session), pas de DTO infra.
 *  - Erreurs = exceptions métier (`SessionIntrouvable` à terme). Pas de
 *    `Result<T, TauriError>` qui ferait fuiter l'infra.
 */
export class SessionIntrouvable extends Error {
  constructor(id: string) {
    super(`Session introuvable pour l'id "${id}".`);
    this.name = "SessionIntrouvable";
  }
}

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findById(id: string): Promise<Session>;
  findAll(): Promise<readonly Session[]>;
}
