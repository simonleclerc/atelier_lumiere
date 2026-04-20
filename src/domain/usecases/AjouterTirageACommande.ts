import { Commande } from "../entities/Commande";
import type { Tirage } from "../entities/Tirage";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { SessionRepository } from "../ports/SessionRepository";
import { Format } from "../value-objects/Format";
import {
  AcheteurNAppartientPasASession,
  PhotoIntrouvableDansSession,
} from "./erreurs-cross-aggregate";

/**
 * Use case — ajoute un tirage à la commande d'un acheteur d'une session.
 *
 * Trois règles cross-aggregate vérifiées ICI :
 *  1. L'acheteur appartient bien à la session
 *  2. La photo existe bien dans la session
 *  3. Le montant unitaire est capturé en SNAPSHOT depuis la grille de la
 *     session au moment de l'ajout
 *
 * **Pattern UPSERT** : la contrainte métier "une seule Commande par
 * (sessionId, acheteurId)" est garantie ici via `findByAcheteur`. Si
 * aucune commande n'existe pour ce couple, on en crée une vide, sinon on
 * réutilise l'existante. La création de la Commande est ainsi IMPLICITE —
 * elle n'a pas de use case dédié, elle naît au premier tirage.
 *
 * La consolidation d'un tirage avec même (photo, format) est déléguée à
 * l'agrégat (`commande.ajouterTirage`) — c'est un invariant d'agrégat,
 * pas de use case.
 */
export interface AjouterTirageACommandeEntree {
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly photoNumero: number;
  readonly format: string;
  readonly quantite: number;
}

export interface AjouterTirageACommandeResultat {
  readonly commande: Commande;
  readonly tirage: Tirage;
  readonly commandeCreee: boolean;
}

export class AjouterTirageACommandeUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
  ) {}

  async execute(
    entree: AjouterTirageACommandeEntree,
  ): Promise<AjouterTirageACommandeResultat> {
    const session = await this.sessionRepository.findById(entree.sessionId);

    if (!session.acheteurs.some((a) => a.id === entree.acheteurId)) {
      throw new AcheteurNAppartientPasASession(
        entree.acheteurId,
        entree.sessionId,
      );
    }
    if (!session.photos.some((p) => p.numero === entree.photoNumero)) {
      throw new PhotoIntrouvableDansSession(
        entree.photoNumero,
        entree.sessionId,
      );
    }

    const format = Format.depuis(entree.format);
    const montantUnitaire = session.grilleTarifaire.prixPour(format);

    const existante = await this.commandeRepository.findByAcheteur(
      entree.sessionId,
      entree.acheteurId,
    );
    const commande =
      existante ??
      Commande.creer({
        sessionId: entree.sessionId,
        acheteurId: entree.acheteurId,
      });

    const tirage = commande.ajouterTirage({
      photoNumero: entree.photoNumero,
      format,
      quantite: entree.quantite,
      montantUnitaire,
    });

    await this.commandeRepository.save(commande);
    return { commande, tirage, commandeCreee: existante === null };
  }
}
