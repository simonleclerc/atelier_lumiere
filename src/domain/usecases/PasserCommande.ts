import { Commande } from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case — ouvre une commande vide pour un acheteur d'une session.
 *
 * **Cross-aggregate invariant ICI** : « l'acheteur référencé appartient
 * bien à la session pointée ». Cette règle ne peut pas vivre dans le
 * constructeur de `Commande` — la Commande ne voit que des IDs, pas les
 * objets. Elle vit donc dans le use case, qui charge la Session pour
 * vérifier. C'est le pattern Vernon « cohérence immédiate intra-agrégat,
 * cohérence éventuelle inter-agrégats ».
 *
 * Si l'acheteur disparaît plus tard (cas théorique avec une suppression),
 * la commande garde son acheteurId mais deviendra "orpheline" — c'est
 * acceptable tant qu'on résout la référence avec tolérance à l'UI.
 */
export class AcheteurNAppartientPasASession extends Error {
  constructor(acheteurId: string, sessionId: string) {
    super(
      `L'acheteur "${acheteurId}" n'est pas inscrit sur la session "${sessionId}".`,
    );
    this.name = "AcheteurNAppartientPasASession";
  }
}

export interface PasserCommandeEntree {
  readonly sessionId: string;
  readonly acheteurId: string;
}

export class PasserCommandeUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
  ) {}

  async execute(entree: PasserCommandeEntree): Promise<Commande> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    const acheteurPresent = session.acheteurs.some(
      (a) => a.id === entree.acheteurId,
    );
    if (!acheteurPresent) {
      throw new AcheteurNAppartientPasASession(
        entree.acheteurId,
        entree.sessionId,
      );
    }

    const commande = Commande.creer({
      sessionId: entree.sessionId,
      acheteurId: entree.acheteurId,
    });
    await this.commandeRepository.save(commande);
    return commande;
  }
}
