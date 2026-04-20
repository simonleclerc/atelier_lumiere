import type { CommandeRepository } from "../ports/CommandeRepository";

/**
 * Use case — supprime une commande. Simple : une commande = un tirage,
 * donc supprimer une commande retire l'intégralité de ce tirage-là de
 * la session.
 */
export class SupprimerCommandeUseCase {
  constructor(private readonly commandeRepository: CommandeRepository) {}

  async execute(commandeId: string): Promise<void> {
    await this.commandeRepository.delete(commandeId);
  }
}
