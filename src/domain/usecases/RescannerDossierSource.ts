import type { FileSystemScanner } from "../ports/FileSystemScanner";
import type { SessionRepository } from "../ports/SessionRepository";

/**
 * Use case — re-scanne le dossier source de la session et met à jour
 * `session.photos` pour refléter l'état réel sur disque.
 *
 * Utile quand le photographe ajoute, renomme ou retire des photos dans
 * le dossier source après la création de la session : sans rescan,
 * `session.photos` reste figée à la liste initiale et le sélecteur de
 * photos des commandes n'est pas à jour.
 *
 * Retourne le diff (ajoutés / retirés) pour que l'UI puisse le
 * présenter. **N'AGIT QUE SUR la liste de la session** — les commandes
 * existantes ne sont pas modifiées. Si un numéro retiré est encore
 * référencé par un tirage, il apparaîtra en "photo fantôme" au prochain
 * contrôle de cohérence ; c'est l'action correctrice du user, pas de
 * celui-ci.
 */
export interface RescannerDossierSourceEntree {
  readonly sessionId: string;
}

export interface RescannerDossierSourceResultat {
  readonly ajoutes: readonly number[];
  readonly retires: readonly number[];
}

export class RescannerDossierSourceUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly fileSystemScanner: FileSystemScanner,
  ) {}

  async execute(
    entree: RescannerDossierSourceEntree,
  ): Promise<RescannerDossierSourceResultat> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    const numeros = await this.fileSystemScanner.scanPhotos(
      session.dossierSource,
    );
    const { ajoutes, retires } = session.remplacerPhotos(numeros);
    if (ajoutes.length > 0 || retires.length > 0) {
      await this.sessionRepository.save(session);
    }
    return { ajoutes, retires };
  }
}
