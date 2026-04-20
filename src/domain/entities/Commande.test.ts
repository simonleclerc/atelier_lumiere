import { describe, it, expect } from "vitest";
import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";
import { Commande, slugifierNomAcheteur } from "./Commande";

function commandeDemo(overrides: Partial<Parameters<typeof Commande.creer>[0]> = {}) {
  return Commande.creer({
    sessionId: "sess-1",
    acheteurId: "ach-1",
    photoNumero: 145,
    format: Format._20x30,
    quantite: 3,
    montantUnitaire: new Montant(1200),
    ...overrides,
  });
}

describe("Commande (agrégat racine)", () => {
  it("se crée avec son contenu et calcule son total", () => {
    const c = commandeDemo();
    expect(c.id).toBeTruthy();
    expect(c.photoNumero).toBe(145);
    expect(c.quantite).toBe(3);
    expect(c.nombreTirages()).toBe(3);
    expect(c.total().centimes).toBe(3600);
  });

  it("refuse un sessionId vide", () => {
    expect(() => commandeDemo({ sessionId: "  " })).toThrow(/sessionId/);
  });

  it("refuse un acheteurId vide", () => {
    expect(() => commandeDemo({ acheteurId: "  " })).toThrow(/acheteurId/);
  });

  it("refuse un photoNumero < 1", () => {
    expect(() => commandeDemo({ photoNumero: 0 })).toThrow(/photoNumero/);
  });

  it("refuse une quantité < 1", () => {
    expect(() => commandeDemo({ quantite: 0 })).toThrow(/quantite/);
  });

  it("capture le montantUnitaire en snapshot", () => {
    const c = commandeDemo({ quantite: 2, montantUnitaire: new Montant(1500) });
    expect(c.montantUnitaire.centimes).toBe(1500);
    expect(c.total().centimes).toBe(3000);
  });

  it("nomsFichiersExport produit N cibles dans le sous-dossier du format", () => {
    const c = commandeDemo();
    const cibles = c.nomsFichiersExport("Martin Dupont");
    expect(cibles).toEqual([
      { sousDossier: "20x30", nomFichier: "martin_dupont_145_1.jpg" },
      { sousDossier: "20x30", nomFichier: "martin_dupont_145_2.jpg" },
      { sousDossier: "20x30", nomFichier: "martin_dupont_145_3.jpg" },
    ]);
  });

  it("nomsFichiersExport traite Numerique comme les autres formats", () => {
    const c = commandeDemo({
      photoNumero: 7,
      format: Format.NUMERIQUE,
      quantite: 2,
      montantUnitaire: new Montant(500),
    });
    const cibles = c.nomsFichiersExport("Anne");
    expect(cibles.every((x) => x.sousDossier === "Numerique")).toBe(true);
    expect(cibles.map((x) => x.nomFichier)).toEqual([
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
