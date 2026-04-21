import { AcheteurIntrouvableDansSession } from "../entities/Session";
import type { Acheteur } from "../entities/Acheteur";
import { slugifierNomAcheteur } from "../entities/Commande";
import type { CommandeRepository } from "../ports/CommandeRepository";
import type { FileRenamer } from "../ports/FileRenamer";
import type { SessionRepository } from "../ports/SessionRepository";
import { joinChemin } from "./ExporterCommande";

/**
 * Use case — édite un acheteur dans sa session et nettoie les fichiers
 * exportés si le slug change. La validation d'unicité du nom est
 * déléguée à `Session.modifierAcheteur` (invariant d'agrégat).
 *
 * Quand le slug d'export change, les fichiers déjà présents sur disque
 * sous l'ancien slug sont renommés vers le nouveau slug. Best-effort :
 * fichier manquant = skip silencieux (cas normal pour une commande
 * jamais exportée, un fichier déplacé à la main, etc.).
 */
export interface ModifierAcheteurEntree {
  readonly sessionId: string;
  readonly acheteurId: string;
  readonly nom: string;
  readonly email?: string;
  readonly telephone?: string;
}

export interface ModifierAcheteurSortie {
  readonly acheteur: Acheteur;
  readonly fichiersRenommes: number;
}

export class ModifierAcheteurUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly commandeRepository: CommandeRepository,
    private readonly fileRenamer: FileRenamer,
  ) {}

  async execute(
    entree: ModifierAcheteurEntree,
  ): Promise<ModifierAcheteurSortie> {
    const session = await this.sessionRepository.findById(entree.sessionId);
    const acheteurAvant = session.acheteurs.find(
      (a) => a.id === entree.acheteurId,
    );
    if (!acheteurAvant) {
      throw new AcheteurIntrouvableDansSession(entree.acheteurId);
    }
    const ancienNom = acheteurAvant.nom;

    const acheteur = session.modifierAcheteur(entree.acheteurId, {
      nom: entree.nom,
      email: entree.email,
      telephone: entree.telephone,
    });
    await this.sessionRepository.save(session);

    const fichiersRenommes = await this.renommerExportsSiSlugChange(
      ancienNom,
      acheteur.nom,
      entree.sessionId,
      entree.acheteurId,
      session.dossierExport.valeur,
    );

    return { acheteur, fichiersRenommes };
  }

  private async renommerExportsSiSlugChange(
    ancienNom: string,
    nouveauNom: string,
    sessionId: string,
    acheteurId: string,
    dossierExport: string,
  ): Promise<number> {
    if (slugifierNomAcheteur(ancienNom) === slugifierNomAcheteur(nouveauNom)) {
      return 0;
    }
    const commande = await this.commandeRepository.findByAcheteur(
      sessionId,
      acheteurId,
    );
    if (!commande) return 0;

    const anciens = commande.nomsFichiersExport(ancienNom);
    const nouveaux = commande.nomsFichiersExport(nouveauNom);
    let renommes = 0;
    for (let i = 0; i < anciens.length; i += 1) {
      const src = joinChemin(
        dossierExport,
        anciens[i].sousDossier,
        anciens[i].nomFichier,
      );
      const dst = joinChemin(
        dossierExport,
        nouveaux[i].sousDossier,
        nouveaux[i].nomFichier,
      );
      const ok = await this.fileRenamer.renommerSiExiste(src, dst);
      if (ok) renommes += 1;
    }
    return renommes;
  }
}
