import { describe, it, expect } from "vitest";
import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";
import {
  Commande,
  slugifierNomAcheteur,
  TirageIntrouvable,
} from "./Commande";

function commandeDemo(): Commande {
  return Commande.creer({ sessionId: "sess-1", acheteurId: "ach-1" });
}

describe("Commande (agrégat racine avec tirages)", () => {
  it("se crée vide", () => {
    const c = commandeDemo();
    expect(c.id).toBeTruthy();
    expect(c.tirages).toHaveLength(0);
    expect(c.estVide()).toBe(true);
    expect(c.total().centimes).toBe(0);
  });

  it("refuse sessionId vide", () => {
    expect(() =>
      Commande.creer({ sessionId: "  ", acheteurId: "a" }),
    ).toThrow(/sessionId/);
  });

  it("refuse acheteurId vide", () => {
    expect(() =>
      Commande.creer({ sessionId: "s", acheteurId: "  " }),
    ).toThrow(/acheteurId/);
  });

  describe("ajouterTirage", () => {
    it("crée un tirage quand (photo, format) n'existe pas", () => {
      const c = commandeDemo();
      const t = c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 2,
        montantUnitaire: new Montant(1200),
      });
      expect(c.tirages).toHaveLength(1);
      expect(c.tirages[0].id).toBe(t.id);
    });

    it("CONSOLIDE (incrémente quantité) quand (photo, format) existe déjà", () => {
      const c = commandeDemo();
      const t1 = c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 1,
        montantUnitaire: new Montant(1200),
      });
      const t2 = c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 2,
        montantUnitaire: new Montant(9999), // ignoré, on garde le snapshot d'origine
      });
      expect(c.tirages).toHaveLength(1);
      expect(t2.id).toBe(t1.id);
      expect(c.tirages[0].quantite).toBe(3);
      expect(c.tirages[0].montantUnitaire.centimes).toBe(1200);
    });

    it("distingue deux tirages avec même photo mais formats différents", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 1,
        montantUnitaire: new Montant(1200),
      });
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._15x23,
        quantite: 1,
        montantUnitaire: new Montant(800),
      });
      expect(c.tirages).toHaveLength(2);
    });
  });

  describe("retirerTirage", () => {
    it("retire et retourne devenueVide=false s'il reste des tirages", () => {
      const c = commandeDemo();
      const t1 = c.ajouterTirage({
        photoNumero: 1,
        format: Format._20x30,
        quantite: 1,
        montantUnitaire: new Montant(1200),
      });
      c.ajouterTirage({
        photoNumero: 2,
        format: Format._20x30,
        quantite: 1,
        montantUnitaire: new Montant(1200),
      });
      const { devenueVide } = c.retirerTirage(t1.id);
      expect(devenueVide).toBe(false);
      expect(c.tirages).toHaveLength(1);
    });

    it("retourne devenueVide=true quand on retire le dernier tirage", () => {
      const c = commandeDemo();
      const t = c.ajouterTirage({
        photoNumero: 1,
        format: Format._20x30,
        quantite: 1,
        montantUnitaire: new Montant(1200),
      });
      const { devenueVide } = c.retirerTirage(t.id);
      expect(devenueVide).toBe(true);
      expect(c.estVide()).toBe(true);
    });

    it("lève TirageIntrouvable sur id inconnu", () => {
      const c = commandeDemo();
      expect(() => c.retirerTirage("inconnu")).toThrow(TirageIntrouvable);
    });
  });

  describe("total / nombreTirages", () => {
    it("cumule sur tous les tirages", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 1,
        format: Format._20x30,
        quantite: 2,
        montantUnitaire: new Montant(1200),
      });
      c.ajouterTirage({
        photoNumero: 2,
        format: Format._15x23,
        quantite: 3,
        montantUnitaire: new Montant(800),
      });
      expect(c.nombreTirages()).toBe(5);
      expect(c.total().centimes).toBe(2400 + 2400);
    });
  });

  describe("nomsFichiersExport", () => {
    it("produit une instruction par exemplaire, dans le sous-dossier du format", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 2,
        montantUnitaire: new Montant(1200),
      });
      c.ajouterTirage({
        photoNumero: 7,
        format: Format.NUMERIQUE,
        quantite: 1,
        montantUnitaire: new Montant(500),
      });
      const instructions = c.nomsFichiersExport("Martin Dupont");
      expect(instructions).toEqual([
        {
          sousDossier: "20x30",
          nomFichier: "martin_dupont_145_1.jpg",
          photoNumero: 145,
        },
        {
          sousDossier: "20x30",
          nomFichier: "martin_dupont_145_2.jpg",
          photoNumero: 145,
        },
        {
          sousDossier: "Numerique",
          nomFichier: "martin_dupont_7_1.jpg",
          photoNumero: 7,
        },
      ]);
    });
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
