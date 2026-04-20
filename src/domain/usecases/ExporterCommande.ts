import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileCopier } from "../ports/FileCopier";
import type { SessionRepository } from "../ports/SessionRepository";
import { AcheteurNAppartientPasASession } from "./erreurs-cross-aggregate";

/**
 * Use case — exporte physiquement les fichiers d'une commande.
 *
 * La photo source du dossier source de la session est copiée dans
 * `dossierExport/{format}/` en N exemplaires (N = quantité), renommés
 * `{acheteur}_{photo}_{i}.jpg`.
 *
 * Idempotent : relancer l'export réécrase les mêmes fichiers. Pas de suivi
 * d'état "commande exportée" en V1 — YAGNI, la présence des fichiers dans
 * le dossier export suffit au copain pour savoir où il en est.
 *
 * Choix de design : le NOMMAGE et les sous-dossiers sont calculés par
 * `Commande.nomsFichiersExport` (méthode pure). Le use case ne fait
 * qu'orchestrer l'I/O. Séparation : le domaine dit QUOI créer, le use
 * case dit QUAND et COMMENT le faire. C'est exactement la raison d'être
 * d'un use case.
 */
export interface ExporterCommandeEntree {
  readonly commandeId: string;
}

export interface ExporterCommandeResultat {
  readonly fichiersCrees: number;
}

export class ExporterCommandeUseCase {
  constructor(
    private readonly commandeRepository: CommandeRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly fileCopier: FileCopier,
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
    try {
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
    return { fichiersCrees: cibles.length };
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
