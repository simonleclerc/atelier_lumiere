import type { GrilleTarifaire } from "../value-objects/GrilleTarifaire";

/**
 * Port — fournit la grille tarifaire "par défaut" globale, lue au moment où
 * on crée une Session. La Session en fait ensuite une COPIE (cf. commentaire
 * dans GrilleTarifaire.ts), donc modifier le provider plus tard n'affecte
 * pas les sessions existantes.
 *
 * Implémentation V1 : `InMemoryGrilleTarifaireParDefautProvider` avec une
 * grille codée en dur. Plus tard : lecture depuis un fichier de config
 * édité par le copain, voire depuis un back-end partagé si l'app migre.
 */
export interface GrilleTarifaireParDefautProvider {
  charger(): Promise<GrilleTarifaire>;
}
