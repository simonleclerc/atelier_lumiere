import type { CommandeRepository } from "../ports/CommandeRepository";

export interface RetirerLigneDeCommandeEntree {
  readonly commandeId: string;
  readonly ligneId: string;
}

export class RetirerLigneDeCommandeUseCase {
  constructor(private readonly commandeRepository: CommandeRepository) {}

  async execute(entree: RetirerLigneDeCommandeEntree): Promise<void> {
    const commande = await this.commandeRepository.findById(entree.commandeId);
    commande.retirerLigne(entree.ligneId);
    await this.commandeRepository.save(commande);
  }
}
