import { describe, it, expect } from "vitest";
import { Format } from "./Format";
import { GrilleTarifaire } from "./GrilleTarifaire";
import { Montant } from "./Montant";

describe("GrilleTarifaire (Value Object)", () => {
  const grilleComplete = () =>
    new GrilleTarifaire([
      [Format._15x23, new Montant(800)],
      [Format._20x30, new Montant(1200)],
      [Format._30x45, new Montant(1800)],
      [Format.NUMERIQUE, new Montant(500)],
    ]);

  it("rejette une grille incomplète", () => {
    expect(
      () =>
        new GrilleTarifaire([
          [Format._15x23, new Montant(800)],
          [Format._20x30, new Montant(1200)],
        ]),
    ).toThrow(/formats manquants/);
  });

  it("renvoie le prix pour chaque format du catalogue", () => {
    const g = grilleComplete();
    expect(g.prixPour(Format._20x30).centimes).toBe(1200);
    expect(g.prixPour(Format.NUMERIQUE).centimes).toBe(500);
  });

  it("avecPrixModifie retourne un nouveau VO sans muter l'original", () => {
    const avant = grilleComplete();
    const apres = avant.avecPrixModifie(Format._20x30, new Montant(1500));
    expect(apres.prixPour(Format._20x30).centimes).toBe(1500);
    expect(avant.prixPour(Format._20x30).centimes).toBe(1200);
    expect(apres.prixPour(Format._15x23).centimes).toBe(800);
  });
});
