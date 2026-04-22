import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileRemover } from "../ports/FileRemover";
import type { SessionRepository } from "../ports/SessionRepository";
import { joinChemin } from "./ExporterCommande";

/**
 * Use case — supprime des fichiers du `dossierExport` identifiés comme
 * orphelins par le contrôle de cohérence (plus rattachés à aucun tirage).
 *
 * Défense en profondeur : on re-calcule l'ensemble des fichiers ATTENDUS
 * par les commandes courantes, et on refuse de supprimer un chemin qui
 * serait dans cet ensemble. Sans ça, un changement de commande entre
 * le rapport et le clic de l'utilisateur pourrait supprimer un fichier
 * redevenu valide.
 *
 * Garde-fou supplémentaire : on refuse tout chemin qui ne commence pas
 * par le `dossierExport` de la session. Le dossier source reste
 * intouchable en toutes circonstances.
 */
export class CheminHorsDossierExport extends Error {
  constructor(chemin: string) {
    super(
      `Le chemin "${chemin}" sort du dossier export de la session : suppression refusée.`,
    );
    this.name = "CheminHorsDossierExport";
  }
}

export interface SupprimerOrphelinsExportEntree {
  readonly sessionId: string;
  readonly cheminsAbsolus: readonly string[];
}

export interface SupprimerOrphelinsExportResultat {
  readonly fichiersSupprimes: number;
  /** Chemins ignorés parce que redevenus attendus par une commande. */
  readonly ignoresCarAttendus: number;
}

export class SupprimerOrphelinsExportUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
    private readonly fileRemover: FileRemover,
  ) {}

  async execute(
    entree: SupprimerOrphelinsExportEntree,
  ): Promise<SupprimerOrphelinsExportResultat> {
    if (entree.cheminsAbsolus.length === 0) {
      return { fichiersSupprimes: 0, ignoresCarAttendus: 0 };
    }
    const session = await this.sessionRepository.findById(entree.sessionId);
    session.assertModifiable();
    const commandes = await this.commandeRepository.findBySessionId(
      entree.sessionId,
    );

    const dossierExport = session.dossierExport.valeur;
    for (const chemin of entree.cheminsAbsolus) {
      if (!chemin.startsWith(dossierExport)) {
        throw new CheminHorsDossierExport(chemin);
      }
    }

    const attendus = new Set<string>();
    for (const c of commandes) {
      const acheteur = session.acheteurs.find((a) => a.id === c.acheteurId);
      if (!acheteur) continue;
      let cibles: ReadonlyArray<{ sousDossier: string; nomFichier: string }>;
      try {
        cibles = c.nomsFichiersExport({
          nom: acheteur.nom,
          email: acheteur.email?.valeur,
        });
      } catch {
        // Email manquant pour un tirage numérique : aucune cible
        // calculable, on laisse l'ensemble vide pour cette commande.
        cibles = [];
      }
      for (const cible of cibles) {
        attendus.add(
          joinChemin(dossierExport, cible.sousDossier, cible.nomFichier),
        );
      }
    }

    let supprimes = 0;
    let ignores = 0;
    for (const chemin of entree.cheminsAbsolus) {
      if (attendus.has(chemin)) {
        ignores += 1;
        continue;
      }
      if (await this.fileRemover.supprimerSiExiste(chemin)) {
        supprimes += 1;
      }
    }
    return { fichiersSupprimes: supprimes, ignoresCarAttendus: ignores };
  }
}
