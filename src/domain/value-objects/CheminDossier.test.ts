import { describe, it, expect } from "vitest";
import { CheminDossier } from "./CheminDossier";

describe("CheminDossier (Value Object)", () => {
  it("accepte un chemin POSIX absolu", () => {
    expect(new CheminDossier("/Users/copain/photos").valeur).toBe(
      "/Users/copain/photos",
    );
  });

  it("accepte un chemin Windows absolu", () => {
    expect(new CheminDossier("C:\\Users\\copain\\photos").valeur).toBe(
      "C:\\Users\\copain\\photos",
    );
  });

  it("refuse un chemin vide", () => {
    expect(() => new CheminDossier("   ")).toThrow(/vide/);
  });

  it("refuse un chemin relatif", () => {
    expect(() => new CheminDossier("photos/spectacle")).toThrow(/relatif/);
  });

  it("égalité par valeur", () => {
    const a = new CheminDossier("/a/b");
    const b = new CheminDossier("/a/b");
    expect(a.egale(b)).toBe(true);
  });
});
