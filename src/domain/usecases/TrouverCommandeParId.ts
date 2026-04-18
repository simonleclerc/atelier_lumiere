import type { Commande } from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";

export class TrouverCommandeParIdUseCase {
  constructor(private readonly commandeRepository: CommandeRepository) {}

  execute(id: string): Promise<Commande> {
    return this.commandeRepository.findById(id);
  }
}
