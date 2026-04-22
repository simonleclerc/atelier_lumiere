import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case — désarchive une session, qui redevient modifiable.
 *
 * Les fichiers d'export précédemment supprimés par l'archivage **ne
 * sont pas restaurés** (impossible : on n'avait gardé aucune trace
 * dans l'archive). Si l'utilisateur veut récupérer les fichiers
 * physiques, il devra ré-exporter manuellement les commandes après
 * désarchivage.
 */
export interface DesarchiverSessionEntree {
  readonly sessionId: string;
}

export class DesarchiverSessionUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(entree: DesarchiverSessionEntree): Promise<void> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    if (!session.archivee) return; // idempotent
    session.desarchiver();
    await this.sessionRepository.save(session);
  }
}
