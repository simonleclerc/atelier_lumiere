import { describe, it, expect } from "vitest";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { Session } from "./Session";

function grilleParDefaut(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
}

const entreeValide = {
  commanditaire: "Théâtre du Soleil",
  referent: "Claude Martin",
  date: new Date("2026-03-14"),
  type: "Spectacle" as const,
  dossierSource: new CheminDossier("/Users/copain/source"),
  dossierExport: new CheminDossier("/Users/copain/export"),
  grilleTarifaire: grilleParDefaut(),
  photoNumeros: [3, 1, 2],
};

describe("Session (agrégat racine)", () => {
  it("construit une session valide et trie les photos par numéro", () => {
    const s = Session.creer(entreeValide);
    expect(s.id).toBeTruthy();
    expect(s.commanditaire).toBe("Théâtre du Soleil");
    expect(s.photos.map((p) => p.numero)).toEqual([1, 2, 3]);
    expect(s.nombrePhotos()).toBe(3);
  });

  it("refuse une date invalide", () => {
    expect(() =>
      Session.creer({ ...entreeValide, date: new Date("pas-une-date") }),
    ).toThrow(/date invalide/i);
  });

  it("refuse un commanditaire vide", () => {
    expect(() =>
      Session.creer({ ...entreeValide, commanditaire: "   " }),
    ).toThrow(/commanditaire/i);
  });

  it("refuse source = export (risque d'écrasement)", () => {
    const chemin = new CheminDossier("/Users/copain/photos");
    expect(() =>
      Session.creer({
        ...entreeValide,
        dossierSource: chemin,
        dossierExport: chemin,
      }),
    ).toThrow(/distincts/);
  });

  it("refuse des numéros de photos dupliqués", () => {
    expect(() =>
      Session.creer({ ...entreeValide, photoNumeros: [1, 2, 2] }),
    ).toThrow(/dupliqués/);
  });
});
