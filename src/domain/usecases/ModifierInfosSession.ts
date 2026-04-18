import type { SessionRepository } from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { parseTypeSession } from "../value-objects/TypeSession";

/**
 * Use case — édite les infos d'une session (commanditaire, référent, date,
 * type, dossiers). Charge, mute via la méthode de domaine, sauve.
 *
 * Les chemins arrivent en string côté UI → on construit les VO
 * `CheminDossier` ici pour bénéficier de leur validation.
 */
export interface ModifierInfosSessionEntree {
  readonly sessionId: string;
  readonly commanditaire: string;
  readonly referent: string;
  readonly date: Date;
  readonly type: string;
  readonly dossierSource: string;
  readonly dossierExport: string;
}

export class ModifierInfosSessionUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(entree: ModifierInfosSessionEntree): Promise<void> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    session.modifierInfos({
      commanditaire: entree.commanditaire,
      referent: entree.referent,
      date: entree.date,
      type: parseTypeSession(entree.type),
      dossierSource: new CheminDossier(entree.dossierSource),
      dossierExport: new CheminDossier(entree.dossierExport),
    });
    await this.sessionRepository.save(session);
  }
}
