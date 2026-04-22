import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case — supprime une commande, après vérification que sa session
 * n'est pas archivée (les sessions archivées sont gelées : aucune
 * mutation, ni sur la session, ni sur ses commandes).
 *
 * Reste idempotent sur un id inconnu (ne lève pas), comportement hérité
 * pour permettre des appels en double sans incident.
 */
export class SupprimerCommandeUseCase {
  constructor(
    private readonly commandeRepository: CommandeRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(commandeId: string): Promise<void> {
    let commande;
    try {
      commande = await this.commandeRepository.findById(commandeId);
    } catch (err) {
      if (err instanceof CommandeIntrouvable) return;
      throw err;
    }
    const session = await this.sessionRepository.findById(commande.sessionId);
    session.assertModifiable();
    await this.commandeRepository.delete(commandeId);
  }
}
