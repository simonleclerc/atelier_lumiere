import { Commande } from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { SessionRepository } from "../ports/SessionRepository";
import { Format } from "../value-objects/Format";

/**
 * Use case — crée une commande pour un acheteur d'une session.
 *
 * Trois règles cross-aggregate vérifiées ICI :
 *  1. L'acheteur référencé appartient bien à la session pointée
 *  2. La photo référencée existe bien dans la session
 *  3. Le montant unitaire est capturé en SNAPSHOT depuis la grille de la
 *     session au moment de la création (pattern snapshot : une commande
 *     ne change jamais de prix après émission, même si la grille bouge)
 *
 * Règle Vernon : cohérence immédiate intra-agrégat, cohérence éventuelle
 * inter-agrégats. On vérifie au moment de la mutation.
 */
export class AcheteurNAppartientPasASession extends Error {
  constructor(acheteurId: string, sessionId: string) {
    super(
      `L'acheteur "${acheteurId}" n'est pas inscrit sur la session "${sessionId}".`,
    );
    this.name = "AcheteurNAppartientPasASession";
  }
}

export class PhotoIntrouvableDansSession extends Error {
  constructor(photoNumero: number, sessionId: string) {
    super(
      `Photo n°${photoNumero} introuvable dans la session "${sessionId}".`,
    );
    this.name = "PhotoIntrouvableDansSession";
  }
}

export interface PasserCommandeEntree {
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly photoNumero: number;
  readonly format: string;
  readonly quantite: number;
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

    const photoPresente = session.photos.some(
      (p) => p.numero === entree.photoNumero,
    );
    if (!photoPresente) {
      throw new PhotoIntrouvableDansSession(
        entree.photoNumero,
        entree.sessionId,
      );
    }

    const format = Format.depuis(entree.format);
    const montantUnitaire = session.grilleTarifaire.prixPour(format);

    const commande = Commande.creer({
      sessionId: entree.sessionId,
      acheteurId: entree.acheteurId,
      photoNumero: entree.photoNumero,
      format,
      quantite: entree.quantite,
      montantUnitaire,
    });
    await this.commandeRepository.save(commande);
    return commande;
  }
}
