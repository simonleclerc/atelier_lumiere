import type { CommandeRepository } from "../ports/CommandeRepository";

/**
 * Use case — retire un tirage d'une commande. Si la commande n'a plus
 * aucun tirage après le retrait, elle est **supprimée automatiquement**
 * (cohérent avec la création implicite : une commande n'existe que si
 * elle contient au moins un tirage).
 */
export interface RetirerTirageDeCommandeEntree {
  readonly commandeId: string;
  readonly tirageId: string;
}

export interface RetirerTirageDeCommandeResultat {
  readonly commandeSupprimee: boolean;
}

export class RetirerTirageDeCommandeUseCase {
  constructor(private readonly commandeRepository: CommandeRepository) {}

  async execute(
    entree: RetirerTirageDeCommandeEntree,
  ): Promise<RetirerTirageDeCommandeResultat> {
    const commande = await this.commandeRepository.findById(entree.commandeId);
    const { devenueVide } = commande.retirerTirage(entree.tirageId);
    if (devenueVide) {
      await this.commandeRepository.delete(commande.id);
      return { commandeSupprimee: true };
    }
    await this.commandeRepository.save(commande);
    return { commandeSupprimee: false };
  }
}
