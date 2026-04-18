import type { Commande } from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";

export class ListerCommandesDeSessionUseCase {
  constructor(private readonly commandeRepository: CommandeRepository) {}

  execute(sessionId: string): Promise<readonly Commande[]> {
    return this.commandeRepository.findBySessionId(sessionId);
  }
}
