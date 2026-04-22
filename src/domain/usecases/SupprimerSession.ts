import { slugifierNomAcheteur } from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileLister } from "../ports/FileLister";
import type { FileRemover } from "../ports/FileRemover";
import type { SessionRepository } from "../ports/SessionRepository";
import { nettoyerExportSession } from "./nettoyerExportSession";

/**
 * Use case — supprime intégralement une session : fichiers d'export
 * créés au nom de cette session, commandes, et finalement la session
 * elle-même. **Le dossier source n'est jamais touché** — les originaux
 * du photographe restent intacts.
 *
 * Sémantique hard-delete : aucune information n'est conservée. Pour un
 * archivage qui garde les données mais nettoie les fichiers, voir
 * `ArchiverSessionUseCase`.
 */
export interface SupprimerSessionEntree {
  readonly sessionId: string;
}

export interface SupprimerSessionResultat {
  readonly fichiersSupprimes: number;
  readonly commandesSupprimees: number;
}

export class SupprimerSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
    private readonly fileLister: FileLister,
    private readonly fileRemover: FileRemover,
  ) {}

  async execute(
    entree: SupprimerSessionEntree,
  ): Promise<SupprimerSessionResultat> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    const commandes = await this.commandeRepository.findBySessionId(
      entree.sessionId,
    );

    const slugs = new Set<string>();
    for (const a of session.acheteurs) {
      try {
        slugs.add(slugifierNomAcheteur(a.nom));
      } catch {
        // nom pathologique, ignorer
      }
    }

    const { fichiersSupprimes } = await nettoyerExportSession({
      dossierExport: session.dossierExport.valeur,
      slugs,
      fileLister: this.fileLister,
      fileRemover: this.fileRemover,
    });

    for (const c of commandes) {
      await this.commandeRepository.delete(c.id);
    }
    await this.sessionRepository.delete(entree.sessionId);

    return { fichiersSupprimes, commandesSupprimees: commandes.length };
  }
}
