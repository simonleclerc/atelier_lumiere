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
  /**
   * Supprime la session de manière idempotente : ne lève pas si l'id
   * n'existe pas. Le nettoyage des données liées (commandes, fichiers
   * d'export) est de la responsabilité du use case appelant.
   */
  delete(id: string): Promise<void>;
  /**
   * Remplace TOUTES les sessions stockées par celles passées en argument.
   * Utilisé exclusivement par `ImporterSauvegarde`. Implémentation
   * atomique côté infra (écrire tout en une fois, pas un delete puis
   * saves multiples).
   */
  replaceAll(sessions: readonly Session[]): Promise<void>;
}
