import { describe, it, expect } from "vitest";
import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";
import { LigneCommande, slugifierNomAcheteur } from "./LigneCommande";

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

  it("nomsFichiersExport produit N cibles dans le sous-dossier du format", () => {
    const l = LigneCommande.creer({
      photoNumero: 145,
      format: Format._20x30,
      quantite: 3,
      montantUnitaire: new Montant(1200),
    });
    const cibles = l.nomsFichiersExport("Martin Dupont");
    expect(cibles).toEqual([
      { sousDossier: "20x30", nomFichier: "martin_dupont_145_1.jpg" },
      { sousDossier: "20x30", nomFichier: "martin_dupont_145_2.jpg" },
      { sousDossier: "20x30", nomFichier: "martin_dupont_145_3.jpg" },
    ]);
  });

  it("nomsFichiersExport traite Numerique comme les autres formats", () => {
    const l = LigneCommande.creer({
      photoNumero: 7,
      format: Format.NUMERIQUE,
      quantite: 2,
      montantUnitaire: new Montant(500),
    });
    const cibles = l.nomsFichiersExport("Anne");
    expect(cibles.every((c) => c.sousDossier === "Numerique")).toBe(true);
    expect(cibles.map((c) => c.nomFichier)).toEqual([
      "anne_7_1.jpg",
      "anne_7_2.jpg",
    ]);
  });
});

describe("slugifierNomAcheteur", () => {
  it("normalise espaces, casse, accents", () => {
    expect(slugifierNomAcheteur("Jean-François Müller")).toBe(
      "jean-francois_muller",
    );
  });

  it("strip les caractères non filesystem-safe", () => {
    expect(slugifierNomAcheteur("Bob / Alice")).toBe("bob__alice");
  });

  it("refuse un nom qui ne laisse aucun caractère exploitable", () => {
    expect(() => slugifierNomAcheteur("   ")).toThrow();
    expect(() => slugifierNomAcheteur("???")).toThrow(/exploitable/);
  });
});
