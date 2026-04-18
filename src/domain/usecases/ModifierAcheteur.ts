import type { Acheteur } from "../entities/Acheteur";
import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case — édite un acheteur dans sa session. La validation d'unicité du
 * nom est déléguée à `Session.modifierAcheteur` (invariant d'agrégat).
 *
 * NB : si le nom change, les fichiers déjà exportés pour cet acheteur gardent
 * l'ancien nom sur disque — à re-synchroniser manuellement via un futur
 * ré-export (cf. TODO-UX).
 */
export interface ModifierAcheteurEntree {
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly nom: string;
  readonly email?: string;
  readonly telephone?: string;
}

export class ModifierAcheteurUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(entree: ModifierAcheteurEntree): Promise<Acheteur> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    const acheteur = session.modifierAcheteur(entree.acheteurId, {
      nom: entree.nom,
      email: entree.email,
      telephone: entree.telephone,
    });
    await this.sessionRepository.save(session);
    return acheteur;
  }
}
