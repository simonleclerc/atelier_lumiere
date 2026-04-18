import type { SessionRepository } from "../ports/SessionRepository";
import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";

/**
 * Use case — ajuste le prix d'un format sur la grille d'une session.
 *
 * Orchestre : charge la Session, délègue la mutation à l'agrégat (qui
 * garde ses invariants), sauve. L'entrée est en primitifs parce que
 * c'est ce que fournira l'UI (format en string, centimes en number).
 */
export interface ModifierPrixSessionEntree {
  readonly sessionId: string;
  readonly format: string;
  readonly centimes: number;
}

export class ModifierPrixSessionUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(entree: ModifierPrixSessionEntree): Promise<void> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    session.modifierPrix(
      Format.depuis(entree.format),
      new Montant(entree.centimes),
    );
    await this.sessionRepository.save(session);
  }
}
