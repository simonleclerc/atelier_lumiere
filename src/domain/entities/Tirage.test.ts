import { describe, it, expect } from "vitest";
import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";
import { Tirage } from "./Tirage";

describe("Tirage (entité fille de Commande)", () => {
  it("construit un tirage valide et calcule son total", () => {
    const t = Tirage.creer({
      photoNumero: 145,
      format: Format._20x30,
      quantite: 3,
      montantUnitaire: new Montant(1200),
    });
    expect(t.id).toBeTruthy();
    expect(t.total().centimes).toBe(3600);
  });

  it("refuse un photoNumero < 1", () => {
    expect(() =>
      Tirage.creer({
        photoNumero: 0,
        format: Format._20x30,
        quantite: 1,
        montantUnitaire: new Montant(1200),
      }),
    ).toThrow(/photoNumero/);
  });

  it("refuse une quantité < 1", () => {
    expect(() =>
      Tirage.creer({
        photoNumero: 1,
        format: Format._20x30,
        quantite: 0,
        montantUnitaire: new Montant(1200),
      }),
    ).toThrow(/quantite/);
  });

  it("egaleContenu détecte l'identité de (photo, format)", () => {
    const t = Tirage.creer({
      photoNumero: 145,
      format: Format._20x30,
      quantite: 1,
      montantUnitaire: new Montant(1200),
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
      montantUnitaire: new Montant(1200),
    });
    const cumule = t.avecQuantiteCumulee(3);
    expect(cumule.id).toBe(t.id);
    expect(cumule.quantite).toBe(5);
    expect(cumule.total().centimes).toBe(6000);
    expect(t.quantite).toBe(2); // immutabilité de l'original
  });
});
