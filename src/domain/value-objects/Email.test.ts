import { describe, it, expect } from "vitest";
import { Email } from "./Email";

describe("Email (Value Object)", () => {
  it("normalise en trim + lowercase", () => {
    expect(new Email("  Jean@DUPONT.fr  ").valeur).toBe("jean@dupont.fr");
  });

  it("rejette une chaîne vide", () => {
    expect(() => new Email("   ")).toThrow(/vide/);
  });

  it("rejette un format manifestement invalide", () => {
    expect(() => new Email("pas-un-email")).toThrow(/invalide/);
    expect(() => new Email("pas@domaine")).toThrow(/invalide/);
  });

  it("égalité par valeur (après normalisation)", () => {
    expect(new Email("A@B.com").egale(new Email("a@b.com"))).toBe(true);
  });
});
