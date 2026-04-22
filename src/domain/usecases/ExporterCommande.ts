import {
  estFichierExportDeSlug,
  slugifierNomAcheteur,
} from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileCopier } from "../ports/FileCopier";
import type { FileLister } from "../ports/FileLister";
import type { FileRemover } from "../ports/FileRemover";
import type { SessionRepository } from "../ports/SessionRepository";
import { Format } from "../value-objects/Format";
import { AcheteurNAppartientPasASession } from "./erreurs-cross-aggregate";

/**
 * Use case — exporte physiquement les fichiers d'une commande.
 *
 * La photo source du dossier source de la session est copiée dans
 * `dossierExport/{format}/` en N exemplaires (N = quantité), renommés
 * `{slug}{indexGlobal}.{photo}.{i}.jpg` (voir
 * `Commande.nomsFichiersExport` pour la sémantique des trois
 * segments numériques).
 *
 * Idempotent : relancer l'export réécrase les mêmes fichiers. En plus, un
 * ré-export **nettoie les orphelins** — les fichiers sur disque qui
 * portent le slug de l'acheteur mais qui ne sont plus dans la commande
 * (tirages retirés depuis le dernier export, format changé…) sont
 * supprimés avant la copie. Résultat : le dossier export reflète
 * exactement l'état courant de la commande.
 *
 * Choix de design : le NOMMAGE et les sous-dossiers sont calculés par
 * `Commande.nomsFichiersExport` (méthode pure), et la reconnaissance
 * d'un fichier appartenant à un slug par `estFichierExportDeSlug`
 * (pur, exporté du même agrégat). Le use case ne fait qu'orchestrer
 * l'I/O via ses ports.
 */
export interface ExporterCommandeEntree {
  readonly commandeId: string;
}

export interface ExporterCommandeResultat {
  readonly fichiersCrees: number;
  readonly orphelinsSupprimes: number;
}

export class ExporterCommandeUseCase {
  constructor(
    private readonly commandeRepository: CommandeRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly fileCopier: FileCopier,
    private readonly fileLister: FileLister,
    private readonly fileRemover: FileRemover,
  ) {}

  async execute(
    entree: ExporterCommandeEntree,
  ): Promise<ExporterCommandeResultat> {
    const commande = await this.commandeRepository.findById(entree.commandeId);
    const session = await this.sessionRepository.findById(commande.sessionId);
    const acheteur = session.acheteurs.find((a) => a.id === commande.acheteurId);
    if (!acheteur) {
      throw new AcheteurNAppartientPasASession(
        commande.acheteurId,
        commande.sessionId,
      );
    }

    const cibles = commande.nomsFichiersExport(acheteur.nom);
    const slug = slugifierNomAcheteur(acheteur.nom);
    let orphelinsSupprimes = 0;
    try {
      orphelinsSupprimes = await this.nettoyerOrphelins(
        session.dossierExport.valeur,
        slug,
        cibles,
      );
      for (const cible of cibles) {
        const cheminSource = joinChemin(
          session.dossierSource.valeur,
          `${cible.photoNumero}.jpg`,
        );
        const cheminDestination = joinChemin(
          session.dossierExport.valeur,
          cible.sousDossier,
          cible.nomFichier,
        );
        await this.fileCopier.copier(cheminSource, cheminDestination);
      }
    } catch (err) {
      // Enregistre l'échec sur l'agrégat puis re-lance — pattern
      // « instrumentation » : le use case ne masque pas l'erreur, il la
      // capture pour le rapport d'état avant de la remonter à l'appelant.
      const message = err instanceof Error ? err.message : String(err);
      commande.enregistrerExportEchec(message);
      await this.commandeRepository.save(commande);
      throw err;
    }
    commande.enregistrerExportReussi();
    await this.commandeRepository.save(commande);
    return { fichiersCrees: cibles.length, orphelinsSupprimes };
  }

  /**
   * Nettoie les fichiers sur disque qui portent le slug de cet acheteur
   * mais qui ne sont plus dans la liste des cibles actuelles. Parcourt
   * TOUS les formats (pas seulement ceux de la commande courante), car
   * un tirage peut avoir été retiré d'un format qui n'est plus utilisé.
   */
  private async nettoyerOrphelins(
    dossierExport: string,
    slug: string,
    cibles: ReadonlyArray<{ sousDossier: string; nomFichier: string }>,
  ): Promise<number> {
    const attendus = new Set(
      cibles.map((c) => joinChemin(c.sousDossier, c.nomFichier)),
    );
    let supprimes = 0;
    for (const format of Format.TOUS) {
      const sousDossier = format.toDossierName();
      const dossier = joinChemin(dossierExport, sousDossier);
      const fichiers = await this.fileLister.listerFichiers(dossier);
      for (const nom of fichiers) {
        if (!estFichierExportDeSlug(nom, slug)) continue;
        const cle = joinChemin(sousDossier, nom);
        if (attendus.has(cle)) continue;
        const absolu = joinChemin(dossierExport, sousDossier, nom);
        if (await this.fileRemover.supprimerSiExiste(absolu)) {
          supprimes += 1;
        }
      }
    }
    return supprimes;
  }
}

/**
 * Utile uniquement pour l'export — une implémentation pure qui n'introduit
 * pas de dépendance Node.js dans le domaine. Conserve le séparateur du
 * chemin racine (détection `\` = Windows) pour rester cohérent.
 */
function joinChemin(base: string, ...suites: string[]): string {
  const sep = base.includes("\\") ? "\\" : "/";
  const parties = [base, ...suites].map((p, i) =>
    i === 0 ? p.replace(/[\\/]+$/, "") : p.replace(/^[\\/]+|[\\/]+$/g, ""),
  );
  return parties.filter((p) => p.length > 0).join(sep);
}

// Export utilitaire pour les tests unitaires.
export { joinChemin };
