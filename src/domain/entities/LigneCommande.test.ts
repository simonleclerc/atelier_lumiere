import { describe, it, expect } from "vitest";
import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";
import { LigneCommande } from "./LigneCommande";

describe("LigneCommande (entité fille de Commande)", () => {
  it("construit une ligne valide et calcule son total", () => {
    const l = LigneCommande.creer({
      photoNumero: 145,
      format: Format._20x30,
      quantite: 3,
      montantUnitaire: new Montant(1200),
    });
    expect(l.id).toBeTruthy();
    expect(l.total().centimes).toBe(3600);
  });

  it("refuse un photoNumero < 1", () => {
    expect(() =>
      LigneCommande.creer({
        photoNumero: 0,
        format: Format._20x30,
        quantite: 1,
        montantUnitaire: new Montant(1200),
      }),
    ).toThrow(/photoNumero/);
  });

  it("refuse une quantité < 1", () => {
    expect(() =>
      LigneCommande.creer({
        photoNumero: 1,
        format: Format._20x30,
        quantite: 0,
        montantUnitaire: new Montant(1200),
      }),
    ).toThrow(/quantite/);
  });

  it("capture le montantUnitaire en snapshot (le champ reste figé)", () => {
    const l = LigneCommande.creer({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 2,
      montantUnitaire: new Montant(1200),
    });
    expect(l.montantUnitaire.centimes).toBe(1200);
    expect(l.total().centimes).toBe(2400);
  });
});
