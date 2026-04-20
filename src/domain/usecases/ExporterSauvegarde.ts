import type { CommandeRepository } from "../ports/CommandeRepository";
import type { SauvegardeFichierIO } from "../ports/SauvegardeFichierIO";
import type { SessionRepository } from "../ports/SessionRepository";
import { serialiser } from "./SauvegardeFormat";

/**
 * Use case — exporte l'intégralité des données (sessions + commandes) dans
 * un fichier JSON versionné au chemin choisi par l'utilisateur.
 *
 * **Pas de transformation métier** ici : on charge tout, on sérialise
 * avec le format stable de `SauvegardeFormat`, on écrit le fichier via
 * le port `SauvegardeFichierIO`. L'intérêt du use case : centraliser
 * l'orchestration et exposer un point unique testable.
 *
 * Note : les photos sources ne sont PAS incluses. Le backup couvre
 * uniquement les métadonnées (sessions, acheteurs, grilles, commandes).
 */
export interface ExporterSauvegardeResultat {
  readonly nbSessions: number;
  readonly nbCommandes: number;
}

export class ExporterSauvegardeUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
    private readonly fichierIO: SauvegardeFichierIO,
  ) {}

  async execute(chemin: string): Promise<ExporterSauvegardeResultat> {
    const [sessions, commandes] = await Promise.all([
      this.sessionRepository.findAll(),
      this.commandeRepository.findAll(),
    ]);
    const contenu = serialiser({ sessions, commandes });
    await this.fichierIO.ecrire(chemin, contenu);
    return { nbSessions: sessions.length, nbCommandes: commandes.length };
  }
}
