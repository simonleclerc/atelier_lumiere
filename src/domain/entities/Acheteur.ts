import { Email } from "../value-objects/Email";

/**
 * Entité fille de Session (DDD).
 *
 * Note : cette classe était initialement modélisée comme agrégat racine
 * autonome — réutilisable cross-sessions. Décision métier revue : un
 * acheteur n'existe que dans le contexte d'une Session. Son cycle de vie
 * est donc lié à celui de la Session qui le contient.
 *
 * Conséquences :
 *  - Pas de `AcheteurRepository` : la persistance passe par la Session.
 *  - L'invariant d'unicité du nom est désormais un invariant d'agrégat
 *    (scope = la Session), vérifié dans `Session.ajouterAcheteur`, pas
 *    dans le constructeur de cette classe.
 *  - Deux acheteurs homonymes dans deux sessions différentes sont OK.
 *
 * Invariants protégés ICI (toujours vrais, indépendamment du contexte) :
 * id et nom non vides, email et téléphone cohérents s'ils sont fournis.
 */
export interface AcheteurDonnees {
  readonly id: string;
  readonly nom: string;
  readonly email?: Email;
  readonly telephone?: string;
}

export class Acheteur {
  readonly id: string;
  readonly nom: string;
  readonly email?: Email;
  readonly telephone?: string;

  constructor(donnees: AcheteurDonnees) {
    if (!donnees.id.trim()) {
      throw new Error("Acheteur: id vide refusé.");
    }
    const nom = donnees.nom.trim();
    if (!nom) {
      throw new Error("Acheteur: nom vide refusé.");
    }
    const telephone = donnees.telephone?.trim();

    this.id = donnees.id;
    this.nom = nom;
    this.email = donnees.email;
    this.telephone = telephone ? telephone : undefined;
  }

  static creer(params: {
    nom: string;
    email?: string;
    telephone?: string;
    id?: string;
  }): Acheteur {
    return new Acheteur({
      id: params.id ?? crypto.randomUUID(),
      nom: params.nom,
      email: params.email?.trim() ? new Email(params.email) : undefined,
      telephone: params.telephone,
    });
  }
}
