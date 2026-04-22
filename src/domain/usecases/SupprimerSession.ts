import {
  estFichierExportDeSlug,
  slugifierNomAcheteur,
} from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileLister } from "../ports/FileLister";
import type { FileRemover } from "../ports/FileRemover";
import type { SessionRepository } from "../ports/SessionRepository";
import { Format } from "../value-objects/Format";
import { joinChemin } from "./ExporterCommande";

/**
 * Use case — supprime intégralement une session : fichiers d'export
 * créés au nom de cette session, commandes, et finalement la session
 * elle-même. **Le dossier source n'est jamais touché** — les originaux
 * du photographe restent intacts.
 *
 * Sémantique hard-delete : aucune information n'est conservée. Les
 * fichiers d'export sont identifiés par le slug des acheteurs de la
 * session (papier ET numérique, y compris dans les sous-dossiers email
 * du Numérique). Cas couverts :
 *  - Acheteurs encore présents : leurs slugs servent à filtrer.
 *  - Acheteurs déjà supprimés mais commandes encore liées : les slugs
 *    issus des commandes seraient perdus, mais ils sont déjà couverts
 *    par les acheteurs au moment où la session est supprimée — la
 *    commande appartient à un acheteur de la session.
 *
 * Ordre des opérations : nettoyage disque d'abord, puis suppression
 * des commandes, puis suppression de la session. Si le nettoyage
 * disque échoue partiellement, les autres étapes ne sont pas tentées
 * et l'utilisateur peut retenter.
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

    const fichiersSupprimes = await this.nettoyerExports(
      session.dossierExport.valeur,
      slugs,
    );
    await this.nettoyerDossiersVides(session.dossierExport.valeur);

    for (const c of commandes) {
      await this.commandeRepository.delete(c.id);
    }
    await this.sessionRepository.delete(entree.sessionId);

    return { fichiersSupprimes, commandesSupprimees: commandes.length };
  }

  /**
   * Tente de supprimer les sous-dossiers laissés vides par le nettoyage
   * de fichiers. Best-effort : `supprimerDossierSiVide` retourne false
   * et n'échoue pas si un dossier contient encore des fichiers (autre
   * session sur le même dossierExport, par exemple).
   *
   * Ordre : on commence par les sous-dossiers email du Numérique, puis
   * les racines de format. Une racine ne peut être vide qu'après ses
   * enfants. Le `dossierExport` lui-même n'est jamais touché (il
   * appartient à l'utilisateur, pas à la session).
   */
  private async nettoyerDossiersVides(dossierExport: string): Promise<void> {
    for (const format of Format.TOUS) {
      const racine = format.toDossierName();
      const dossierRacine = joinChemin(dossierExport, racine);
      if (format.estNumerique()) {
        const sousEmails = await this.fileLister.listerDossiers(dossierRacine);
        for (const email of sousEmails) {
          await this.fileRemover.supprimerDossierSiVide(
            joinChemin(dossierRacine, email),
          );
        }
      }
      await this.fileRemover.supprimerDossierSiVide(dossierRacine);
    }
  }

  /**
   * Scanne tous les sous-dossiers de format (et tous les sous-dossiers
   * email pour le Numérique) à la recherche de fichiers dont le nom
   * matche l'un des slugs des acheteurs de la session, et les supprime.
   */
  private async nettoyerExports(
    dossierExport: string,
    slugs: Set<string>,
  ): Promise<number> {
    if (slugs.size === 0) return 0;
    let supprimes = 0;
    for (const format of Format.TOUS) {
      const dossiersAScanner = await this.dossiersAScanner(
        dossierExport,
        format,
      );
      for (const sousDossier of dossiersAScanner) {
        const dossier = joinChemin(dossierExport, sousDossier);
        const fichiers = await this.fileLister.listerFichiers(dossier);
        for (const nom of fichiers) {
          let matche = false;
          for (const slug of slugs) {
            if (estFichierExportDeSlug(nom, slug)) {
              matche = true;
              break;
            }
          }
          if (!matche) continue;
          const absolu = joinChemin(dossierExport, sousDossier, nom);
          if (await this.fileRemover.supprimerSiExiste(absolu)) {
            supprimes += 1;
          }
        }
      }
    }
    return supprimes;
  }

  private async dossiersAScanner(
    dossierExport: string,
    format: Format,
  ): Promise<readonly string[]> {
    const racine = format.toDossierName();
    if (!format.estNumerique()) return [racine];
    const sousEmails = await this.fileLister.listerDossiers(
      joinChemin(dossierExport, racine),
    );
    return [racine, ...sousEmails.map((email) => `${racine}/${email}`)];
  }
}
