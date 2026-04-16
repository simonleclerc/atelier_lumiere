import { describe, it, expect } from "vitest";
import { Montant } from "./Montant";

describe("Montant (Value Object)", () => {
  it("refuse un nombre non entier de centimes", () => {
    expect(() => new Montant(12.5)).toThrow(/entier/);
  });

  it("refuse un montant négatif", () => {
    expect(() => new Montant(-1)).toThrow(/négative/);
  });

  it("convertit depuis des euros en arrondissant au centime", () => {
    expect(Montant.depuisEuros(8.9).centimes).toBe(890);
  });

  it("ajoute sans muter (immuable)", () => {
    const a = new Montant(500);
    const b = new Montant(250);
    const somme = a.ajouter(b);
    expect(somme.centimes).toBe(750);
    expect(a.centimes).toBe(500);
    expect(b.centimes).toBe(250);
  });

  it("multiplie par une quantité entière", () => {
    expect(new Montant(1200).multiplierPar(3).centimes).toBe(3600);
  });
});
