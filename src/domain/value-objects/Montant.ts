/**
 * Value Object — montant monétaire en centimes d'euros.
 *
 * Jamais de `number` flottant pour de l'argent : `0.1 + 0.2 !== 0.3` en
 * IEEE 754 (cf. https://floating-point-gui.de). On stocke des entiers de
 * centimes, on convertit à l'affichage.
 *
 * Opérations : immuables (chaque opération retourne un nouveau Montant).
 * On n'expose pas de soustraction tant qu'on n'en a pas besoin — YAGNI.
 */
export class Montant {
  readonly centimes: number;

  constructor(centimes: number) {
    if (!Number.isInteger(centimes)) {
      throw new Error(
        `Montant: les centimes doivent être un entier (reçu ${centimes}).`,
      );
    }
    if (centimes < 0) {
      throw new Error(`Montant: valeur négative refusée (reçu ${centimes}).`);
    }
    this.centimes = centimes;
  }

  static depuisEuros(euros: number): Montant {
    return new Montant(Math.round(euros * 100));
  }

  ajouter(autre: Montant): Montant {
    return new Montant(this.centimes + autre.centimes);
  }

  multiplierPar(quantite: number): Montant {
    if (!Number.isInteger(quantite) || quantite < 0) {
      throw new Error(
        `Montant.multiplierPar: quantité entière positive attendue (reçu ${quantite}).`,
      );
    }
    return new Montant(this.centimes * quantite);
  }

  egale(autre: Montant): boolean {
    return this.centimes === autre.centimes;
  }

  toString(): string {
    return `${(this.centimes / 100).toFixed(2)} €`;
  }
}
