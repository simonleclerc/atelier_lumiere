import { slugifierNomAcheteur } from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileLister } from "../ports/FileLister";
import type { FileRemover } from "../ports/FileRemover";
import type { SessionRepository } from "../ports/SessionRepository";
import { nettoyerExportSession } from "./nettoyerExportSession";

/**
 * Use case — archive une session : nettoie l'intégralité de ses
 * fichiers d'export (papier ET numérique, sous-dossiers email
 * compris) puis bascule la session en mode archivé.
 *
 * Les commandes, acheteurs et tous les autres états du domaine sont
 * **conservés intacts** — c'est la différence fondamentale avec
 * `SupprimerSessionUseCase`. Une session archivée reste consultable
 * mais ne peut plus être modifiée tant qu'elle n'est pas désarchivée
 * via `DesarchiverSessionUseCase`.
 *
 * Le dossier source n'est jamais touché : seules les reproductions
 * exportées disparaissent, les originaux du photographe restent où
 * ils sont.
 */
export interface ArchiverSessionEntree {
  readonly sessionId: string;
}

export interface ArchiverSessionResultat {
  readonly fichiersSupprimes: number;
}

export class ArchiverSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
    private readonly fileLister: FileLister,
    private readonly fileRemover: FileRemover,
  ) {}

  async execute(
    entree: ArchiverSessionEntree,
  ): Promise<ArchiverSessionResultat> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    if (session.archivee) {
      // Idempotent : déjà archivée, rien à faire (et de toute façon
      // assertModifiable lèverait au prochain archiver()).
      return { fichiersSupprimes: 0 };
    }
    // findBySessionId est utilisé surtout pour matcher la sémantique
    // d'autres use cases (vérifier l'existence de commandes), bien que
    // les slugs soient calculés depuis les acheteurs.
    await this.commandeRepository.findBySessionId(entree.sessionId);

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

    session.archiver();
    await this.sessionRepository.save(session);

    return { fichiersSupprimes };
  }
}
