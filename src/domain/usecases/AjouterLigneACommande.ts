import { LigneCommande } from "../entities/LigneCommande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { SessionRepository } from "../ports/SessionRepository";
import { Format } from "../value-objects/Format";

/**
 * Use case — ajoute une ligne (photo × format × quantité) à une commande
 * existante. Deux boulots cross-agrégat faits ICI :
 *
 *  1. **Validation** : la photo référencée existe bien dans la session
 *     pointée par la commande.
 *  2. **Snapshot du prix** : on lit la grille tarifaire de la session
 *     MAINTENANT pour capturer le montant unitaire dans la ligne. Cette
 *     ligne ne changera plus de prix, même si la grille évolue plus tard.
 *
 * C'est l'endroit canonique où le pattern snapshot prend tout son sens :
 * la cohérence temporelle des factures dépend de cette capture.
 */
export class PhotoIntrouvableDansSession extends Error {
  constructor(photoNumero: number, sessionId: string) {
    super(
      `Photo n°${photoNumero} introuvable dans la session "${sessionId}".`,
    );
    this.name = "PhotoIntrouvableDansSession";
  }
}

export interface AjouterLigneACommandeEntree {
  readonly commandeId: string;
  readonly photoNumero: number;
  readonly format: string;
  readonly quantite: number;
}

export class AjouterLigneACommandeUseCase {
  constructor(
    private readonly commandeRepository: CommandeRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(entree: AjouterLigneACommandeEntree): Promise<LigneCommande> {
    const commande = await this.commandeRepository.findById(entree.commandeId);
    const session = await this.sessionRepository.findById(commande.sessionId);

    const photoPresente = session.photos.some(
      (p) => p.numero === entree.photoNumero,
    );
    if (!photoPresente) {
      throw new PhotoIntrouvableDansSession(
        entree.photoNumero,
        commande.sessionId,
      );
    }

    const format = Format.depuis(entree.format);
    const montantUnitaire = session.grilleTarifaire.prixPour(format);

    const ligne = LigneCommande.creer({
      photoNumero: entree.photoNumero,
      format,
      quantite: entree.quantite,
      montantUnitaire,
    });
    commande.ajouterLigne(ligne);
    await this.commandeRepository.save(commande);
    return ligne;
  }
}
