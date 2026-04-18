import { describe, it, expect } from "vitest";
import { Acheteur } from "./Acheteur";

describe("Acheteur (entité fille de Session)", () => {
  it("accepte nom seul (email/tel optionnels)", () => {
    const a = Acheteur.creer({ nom: "Martin Dupont" });
    expect(a.id).toBeTruthy();
    expect(a.nom).toBe("Martin Dupont");
    expect(a.email).toBeUndefined();
    expect(a.telephone).toBeUndefined();
  });

  it("refuse un nom vide", () => {
    expect(() => Acheteur.creer({ nom: "   " })).toThrow(/nom/);
  });

  it("construit l'email en VO si fourni", () => {
    const a = Acheteur.creer({
      nom: "Anne",
      email: "ANNE@example.com",
    });
    expect(a.email?.valeur).toBe("anne@example.com");
  });

  it("propage une erreur si l'email est invalide", () => {
    expect(() =>
      Acheteur.creer({ nom: "Anne", email: "pas-un-email" }),
    ).toThrow(/invalide/);
  });

  it("ignore un email vide (trim)", () => {
    const a = Acheteur.creer({ nom: "X", email: "   " });
    expect(a.email).toBeUndefined();
  });

  it("NE VÉRIFIE PAS l'unicité du nom (c'est le job de l'agrégat Session)", () => {
    // Deux acheteurs homonymes cohabitent au niveau entité — l'invariant
    // d'unicité est scopé à la Session et vérifié par Session.ajouterAcheteur.
    const a = Acheteur.creer({ nom: "Martin" });
    const b = Acheteur.creer({ nom: "Martin" });
    expect(a.nom).toBe("Martin");
    expect(b.nom).toBe("Martin");
    expect(a.id).not.toBe(b.id);
  });
});
