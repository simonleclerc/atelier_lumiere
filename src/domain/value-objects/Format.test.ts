import { describe, it, expect } from "vitest";
import { Format } from "./Format";

describe("Format (Value Object)", () => {
  it("expose les 4 valeurs du catalogue fermé", () => {
    expect(Format.TOUS).toHaveLength(4);
    expect(Format.TOUS.map((f) => f.toDossierName())).toEqual([
      "15x23",
      "20x30",
      "30x45",
      "Numerique",
    ]);
  });

  it("parse une valeur valide via depuis()", () => {
    expect(Format.depuis("20x30").egale(Format._20x30)).toBe(true);
  });

  it("rejette une valeur hors catalogue", () => {
    expect(() => Format.depuis("18x24")).toThrow(/Format inconnu/);
  });

  it("égale deux instances de même valeur (identité par valeur)", () => {
    expect(Format.depuis("15x23").egale(Format._15x23)).toBe(true);
  });
});
