import type { Session } from "../entities/Session";
import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case de lecture — charge une session complète (avec ses acheteurs)
 * par son id. Utilisé par la page détail.
 *
 * Trivial aujourd'hui, mais en tant que classe pour garder la cohérence :
 * si demain on veut charger aussi les commandes associées, c'est ici qu'on
 * composera, pas dans le composant UI.
 */
export class TrouverSessionParIdUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  execute(id: string): Promise<Session> {
    return this.sessionRepository.findById(id);
  }
}
