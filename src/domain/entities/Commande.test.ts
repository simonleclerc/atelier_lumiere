import { describe, it, expect } from "vitest";
import { Format } from "../value-objects/Format";
import { Montant } from "../value-objects/Montant";
import { Commande, LigneCommandeIntrouvable } from "./Commande";
import { LigneCommande } from "./LigneCommande";

function ligneDemo(quantite = 1, montant = 1200): LigneCommande {
  return LigneCommande.creer({
    photoNumero: 1,
    format: Format._20x30,
    quantite,
    montantUnitaire: new Montant(montant),
  });
}

describe("Commande (agrégat racine)", () => {
  it("se crée vide avec sessionId + acheteurId", () => {
    const c = Commande.creer({ sessionId: "sess-1", acheteurId: "ach-1" });
    expect(c.id).toBeTruthy();
    expect(c.lignes).toHaveLength(0);
    expect(c.total().centimes).toBe(0);
    expect(c.nombreTirages()).toBe(0);
  });

  it("refuse un sessionId vide", () => {
    expect(() =>
      Commande.creer({ sessionId: "  ", acheteurId: "ach-1" }),
    ).toThrow(/sessionId/);
  });

  it("refuse un acheteurId vide", () => {
    expect(() =>
      Commande.creer({ sessionId: "sess-1", acheteurId: "  " }),
    ).toThrow(/acheteurId/);
  });

  it("ajouterLigne accumule les lignes et cumule le total", () => {
    const c = Commande.creer({ sessionId: "s", acheteurId: "a" });
    c.ajouterLigne(ligneDemo(2, 1200));
    c.ajouterLigne(ligneDemo(1, 800));
    expect(c.lignes).toHaveLength(2);
    expect(c.total().centimes).toBe(2400 + 800);
    expect(c.nombreTirages()).toBe(3);
  });

  it("retirerLigne supprime par id", () => {
    const c = Commande.creer({ sessionId: "s", acheteurId: "a" });
    const l = ligneDemo();
    c.ajouterLigne(l);
    c.retirerLigne(l.id);
    expect(c.lignes).toHaveLength(0);
  });

  it("retirerLigne lève sur id inconnu", () => {
    const c = Commande.creer({ sessionId: "s", acheteurId: "a" });
    expect(() => c.retirerLigne("inconnu")).toThrow(LigneCommandeIntrouvable);
  });
});
