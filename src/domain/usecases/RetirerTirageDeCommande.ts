import type { CommandeRepository } from "../ports/CommandeRepository";
import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case — retire un tirage d'une commande. Si la commande n'a plus
 * aucun tirage après le retrait, elle est **supprimée automatiquement**
 * (cohérent avec la création implicite : une commande n'existe que si
 * elle contient au moins un tirage).
 *
 * Charge la session pour vérifier qu'elle n'est pas archivée — une
 * session gelée ne doit accepter aucune mutation, y compris sur ses
 * commandes filles.
 */
export interface RetirerTirageDeCommandeEntree {
  readonly commandeId: string;
  readonly tirageId: string;
}

export interface RetirerTirageDeCommandeResultat {
  readonly commandeSupprimee: boolean;
}

export class RetirerTirageDeCommandeUseCase {
  constructor(
    private readonly commandeRepository: CommandeRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(
    entree: RetirerTirageDeCommandeEntree,
  ): Promise<RetirerTirageDeCommandeResultat> {
    const commande = await this.commandeRepository.findById(entree.commandeId);
    const session = await this.sessionRepository.findById(commande.sessionId);
    session.assertModifiable();
    const { devenueVide } = commande.retirerTirage(entree.tirageId);
    if (devenueVide) {
      await this.commandeRepository.delete(commande.id);
      return { commandeSupprimee: true };
    }
    await this.commandeRepository.save(commande);
    return { commandeSupprimee: false };
  }
}
