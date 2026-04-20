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
 * Deux règles cross-aggregate vérifiées ICI :
 *  1. L'acheteur appartient bien à la session
 *  2. La photo existe bien dans la session
 *
 * **Pas de snapshot du prix** : le Tirage ne stocke plus de
 * `montantUnitaire` (cf. doc de l'entité). Le prix est lu à la volée
 * dans `session.grilleTarifaire` au moment du calcul d'un total. Modifier
 * la grille plus tard affecte immédiatement les commandes existantes —
 * comportement voulu tant qu'on n'a pas de factures.
 *
 * **Pattern UPSERT** : la contrainte "une seule Commande par
 * (sessionId, acheteurId)" est garantie ici via `findByAcheteur`. Si
 * aucune commande n'existe, on en crée une vide ; sinon on réutilise
 * l'existante. La création de la Commande est IMPLICITE — pas de use
 * case dédié, elle naît au premier tirage.
 *
 * Consolidation si même (photo, format) : déléguée à l'agrégat
 * (`commande.ajouterTirage`). C'est un invariant d'agrégat, pas de use case.
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

    // On construit le VO Format pour valider la chaîne dès l'entrée du
    // use case (erreur claire si le client envoie un format bidon).
    const format = Format.depuis(entree.format);

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
    });

    await this.commandeRepository.save(commande);
    return { commande, tirage, commandeCreee: existante === null };
  }
}
