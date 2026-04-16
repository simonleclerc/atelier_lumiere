import type { GrilleTarifaireParDefautProvider } from "@/domain/ports/GrilleTarifaireParDefautProvider";
import { Format } from "@/domain/value-objects/Format";
import { GrilleTarifaire } from "@/domain/value-objects/GrilleTarifaire";
import { Montant } from "@/domain/value-objects/Montant";

/**
 * Adapter V1 — grille par défaut codée en dur. Volontairement trivial :
 * tant que le copain n'a pas confirmé ses prix réels, on met des valeurs
 * plausibles. Le jour où on veut une édition UI, on remplace cet adapter
 * par une lecture de fichier de config, sans toucher au domaine.
 *
 * Placé dans `infrastructure/inMemory/` plutôt que `infrastructure/tauri/`
 * parce qu'il n'a aucune dépendance Tauri : c'est un adapter portable,
 * potentiellement réutilisable pour les tests d'autres use cases.
 */
export class InMemoryGrilleTarifaireParDefautProvider
  implements GrilleTarifaireParDefautProvider
{
  async charger(): Promise<GrilleTarifaire> {
    return new GrilleTarifaire([
      [Format._15x23, Montant.depuisEuros(8)],
      [Format._20x30, Montant.depuisEuros(12)],
      [Format._30x45, Montant.depuisEuros(18)],
      [Format.NUMERIQUE, Montant.depuisEuros(5)],
    ]);
  }
}
