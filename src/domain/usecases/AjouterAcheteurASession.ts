import type { Acheteur } from "../entities/Acheteur";
import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case — ajoute un acheteur à une session existante.
 *
 * La validation métier (unicité du nom dans la session) est **déléguée à
 * l'agrégat** (`session.ajouterAcheteur`). Le use case ne fait qu'orchestrer
 * le chargement, la mutation via la méthode de domaine, et la persistance.
 *
 * Pattern classique Vernon : le use case charge l'agrégat, appelle une
 * méthode de domaine, sauvegarde. L'agrégat reste le gardien de ses
 * invariants ; le use case gère la transaction.
 */
export interface AjouterAcheteurASessionEntree {
  readonly sessionId: string;
  readonly nom: string;
  readonly email?: string;
  readonly telephone?: string;
}

export class AjouterAcheteurASessionUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(entree: AjouterAcheteurASessionEntree): Promise<Acheteur> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    const acheteur = session.ajouterAcheteur({
      nom: entree.nom,
      email: entree.email,
      telephone: entree.telephone,
    });
    await this.sessionRepository.save(session);
    return acheteur;
  }
}
