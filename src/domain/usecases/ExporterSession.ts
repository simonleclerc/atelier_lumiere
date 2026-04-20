import type { CommandeRepository } from "../ports/CommandeRepository";
import type { ExporterCommandeUseCase } from "./ExporterCommande";

/**
 * Use case orchestrateur — exporte toutes les commandes d'une session en
 * un seul appel.
 *
 * **Pattern "use case orchestrateur"** : au lieu de dupliquer la logique
 * d'export (chargement session, boucle sur les tirages, copie fichier),
 * on délègue à `ExporterCommandeUseCase` pour chaque commande de la
 * session. Direction d'appel unidirectionnelle (orchestrateur → unité),
 * pas de cycle. Légitime en Clean Architecture tant que l'orchestrateur
 * vit dans la même couche applicative que celui qu'il délègue.
 *
 * **Échecs partiels assumés** : si une commande échoue (photo manquante
 * du dossier source, par exemple), on continue pour les autres et on
 * rapporte l'erreur. Le photographe obtient le maximum de fichiers
 * exportés sur un seul click, et voit ensuite à l'UI ce qui reste à
 * corriger. Comportement voulu : un batch partiellement réussi vaut
 * mieux qu'un batch entièrement bloqué par une erreur locale.
 */
export interface ExporterSessionEntree {
  readonly sessionId: string;
}

export interface EchecExportCommande {
  readonly commandeId: string;
  readonly acheteurId: string;
  readonly message: string;
}

export interface ExporterSessionResultat {
  readonly commandesTotales: number;
  readonly commandesReussies: number;
  readonly fichiersCrees: number;
  readonly erreurs: readonly EchecExportCommande[];
}

export class ExporterSessionUseCase {
  constructor(
    private readonly commandeRepository: CommandeRepository,
    private readonly exporterCommande: ExporterCommandeUseCase,
  ) {}

  async execute(
    entree: ExporterSessionEntree,
  ): Promise<ExporterSessionResultat> {
    const commandes = await this.commandeRepository.findBySessionId(
      entree.sessionId,
    );
    let fichiersCrees = 0;
    const erreurs: EchecExportCommande[] = [];

    for (const commande of commandes) {
      try {
        const r = await this.exporterCommande.execute({
          commandeId: commande.id,
        });
        fichiersCrees += r.fichiersCrees;
      } catch (err) {
        erreurs.push({
          commandeId: commande.id,
          acheteurId: commande.acheteurId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      commandesTotales: commandes.length,
      commandesReussies: commandes.length - erreurs.length,
      fichiersCrees,
      erreurs,
    };
  }
}
