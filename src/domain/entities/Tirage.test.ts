import { describe, it, expect } from "vitest";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { Tirage } from "./Tirage";

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
}

describe("Tirage (entité fille de Commande)", () => {
  it("construit un tirage valide et calcule son total depuis la grille", () => {
    const t = Tirage.creer({
      photoNumero: 145,
      format: Format._20x30,
      quantite: 3,
    });
    expect(t.id).toBeTruthy();
    expect(t.total(grille()).centimes).toBe(3600);
    expect(t.montantUnitaire(grille()).centimes).toBe(1200);
  });

  it("reflète un changement de grille (pas de snapshot)", () => {
    const t = Tirage.creer({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 2,
    });
    expect(t.total(grille()).centimes).toBe(2400);
    const nouvelleGrille = grille().avecPrixModifie(
      Format._20x30,
      new Montant(1500),
    );
    expect(t.total(nouvelleGrille).centimes).toBe(3000);
  });

  it("refuse un photoNumero < 1", () => {
    expect(() =>
      Tirage.creer({ photoNumero: 0, format: Format._20x30, quantite: 1 }),
    ).toThrow(/photoNumero/);
  });

  it("refuse une quantité < 1", () => {
    expect(() =>
      Tirage.creer({ photoNumero: 1, format: Format._20x30, quantite: 0 }),
    ).toThrow(/quantite/);
  });

  it("egaleContenu détecte l'identité de (photo, format)", () => {
    const t = Tirage.creer({
      photoNumero: 145,
      format: Format._20x30,
      quantite: 1,
    });
    expect(t.egaleContenu(145, Format._20x30)).toBe(true);
    expect(t.egaleContenu(145, Format._15x23)).toBe(false);
    expect(t.egaleContenu(146, Format._20x30)).toBe(false);
  });

  it("avecQuantiteCumulee retourne un nouveau Tirage qté augmentée, même id", () => {
    const t = Tirage.creer({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 2,
    });
    const cumule = t.avecQuantiteCumulee(3);
    expect(cumule.id).toBe(t.id);
    expect(cumule.quantite).toBe(5);
    expect(t.quantite).toBe(2); // immutabilité de l'original
  });
});
