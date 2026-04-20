import type { CommandeRepository } from "../ports/CommandeRepository";
import type { SauvegardeFichierIO } from "../ports/SauvegardeFichierIO";
import type { SessionRepository } from "../ports/SessionRepository";
import { desserialiser } from "./SauvegardeFormat";

/**
 * Use case — remplace TOUTES les données actuelles par celles d'un
 * fichier de sauvegarde.
 *
 * **Comportement destructif assumé** : c'est un "restore", pas un merge.
 * L'UI est responsable de la confirmation utilisateur avant d'appeler ce
 * use case. Côté domaine, on considère que l'utilisateur sait ce qu'il
 * fait à ce stade.
 *
 * Stratégie : on lit le fichier, on reconstitue les entités via
 * `desserialiser` (qui valide le schéma et lève `SauvegardeInvalide` si
 * le fichier n'est pas conforme). Si la validation passe, on écrase
 * toutes les sessions puis toutes les commandes via `replaceAll`.
 *
 * Non-atomique entre les deux repos : si `replaceAll(sessions)` réussit
 * mais `replaceAll(commandes)` échoue, on peut se retrouver avec des
 * sessions nouvelles et des anciennes commandes. Tolérable en V1 (app
 * locale mono-utilisateur, crash disque improbable entre deux
 * `writeTextFile`). Une transaction atomique sera ajoutée si on passe
 * sur une vraie base (SQLite avec `BEGIN/COMMIT`).
 */
export interface ImporterSauvegardeResultat {
  readonly nbSessions: number;
  readonly nbCommandes: number;
}

export class ImporterSauvegardeUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
    private readonly fichierIO: SauvegardeFichierIO,
  ) {}

  async execute(chemin: string): Promise<ImporterSauvegardeResultat> {
    const contenu = await this.fichierIO.lire(chemin);
    const donnees = desserialiser(contenu);
    await this.sessionRepository.replaceAll(donnees.sessions);
    await this.commandeRepository.replaceAll(donnees.commandes);
    return {
      nbSessions: donnees.sessions.length,
      nbCommandes: donnees.commandes.length,
    };
  }
}
