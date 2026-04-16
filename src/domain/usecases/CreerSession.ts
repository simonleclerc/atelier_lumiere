import { Session } from "../entities/Session";
import type { FileSystemScanner } from "../ports/FileSystemScanner";
import type { GrilleTarifaireParDefautProvider } from "../ports/GrilleTarifaireParDefautProvider";
import type { SessionRepository } from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { parseTypeSession } from "../value-objects/TypeSession";

/**
 * Use case (Clean Architecture, Robert C. Martin) — orchestre un cas d'usage
 * métier complet en langage du domaine. Reçoit ses dépendances (ports) par
 * le constructeur : inversion de dépendance. Aucun import `@tauri-apps/*`.
 *
 * Responsabilités ICI :
 *  - orchestrer (charger grille, scanner dossier, construire Session, sauver)
 *  - NON protéger les invariants : c'est le job de la Session elle-même
 *  - NON connaître l'UI : cette fonction peut être appelée depuis un test,
 *    un CLI, une route HTTP, n'importe quoi.
 */
export interface CreerSessionEntree {
  readonly commanditaire: string;
  readonly referent: string;
  readonly date: Date;
  readonly type: string;
  readonly dossierSource: string;
  readonly dossierExport: string;
}

export class CreerSessionUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly fileSystemScanner: FileSystemScanner,
    private readonly grilleParDefautProvider: GrilleTarifaireParDefautProvider,
  ) {}

  async execute(entree: CreerSessionEntree): Promise<Session> {
    const dossierSource = new CheminDossier(entree.dossierSource);
    const dossierExport = new CheminDossier(entree.dossierExport);
    const type = parseTypeSession(entree.type);

    const [grille, numeros] = await Promise.all([
      this.grilleParDefautProvider.charger(),
      this.fileSystemScanner.scanPhotos(dossierSource),
    ]);

    const session = Session.creer({
      commanditaire: entree.commanditaire,
      referent: entree.referent,
      date: entree.date,
      type,
      dossierSource,
      dossierExport,
      grilleTarifaire: grille,
      photoNumeros: numeros,
    });

    await this.sessionRepository.save(session);
    return session;
  }
}
