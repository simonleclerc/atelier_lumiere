import { describe, it, expect } from "vitest";
import { StatutExport } from "./StatutExport";

describe("StatutExport", () => {
  describe("factories + predicats", () => {
    it("pasExporte", () => {
      const s = StatutExport.pasExporte();
      expect(s.estPasExporte()).toBe(true);
      expect(s.estComplet()).toBe(false);
      expect(s.messageErreur).toBeUndefined();
    });

    it("complet", () => {
      expect(StatutExport.complet().estComplet()).toBe(true);
    });

    it("incomplet", () => {
      expect(StatutExport.incomplet().estIncomplet()).toBe(true);
    });

    it("enErreur stocke le message", () => {
      const s = StatutExport.enErreur("fichier manquant");
      expect(s.estEnErreur()).toBe(true);
      expect(s.messageErreur).toBe("fichier manquant");
    });

    it("enErreur tombe sur un message par défaut si on passe du vide", () => {
      const s = StatutExport.enErreur("   ");
      expect(s.messageErreur).toBe("Erreur inconnue");
    });
  });

  describe("agreger", () => {
    const pasExporte = StatutExport.pasExporte();
    const incomplet = StatutExport.incomplet();
    const complet = StatutExport.complet();
    const erreur = StatutExport.enErreur("bug");

    it("aucune commande → pas-exporte", () => {
      expect(StatutExport.agreger([]).estPasExporte()).toBe(true);
    });

    it("au moins une erreur → erreur (priorité absolue)", () => {
      expect(
        StatutExport.agreger([complet, erreur, pasExporte]).estEnErreur(),
      ).toBe(true);
    });

    it("tout complet → complet", () => {
      expect(
        StatutExport.agreger([complet, complet, complet]).estComplet(),
      ).toBe(true);
    });

    it("tout pas-exporte → pas-exporte", () => {
      expect(
        StatutExport.agreger([pasExporte, pasExporte]).estPasExporte(),
      ).toBe(true);
    });

    it("mix pas-exporte + complet → incomplet", () => {
      expect(
        StatutExport.agreger([pasExporte, complet]).estIncomplet(),
      ).toBe(true);
    });

    it("mix incomplet + complet → incomplet", () => {
      expect(
        StatutExport.agreger([incomplet, complet]).estIncomplet(),
      ).toBe(true);
    });

    it("un seul incomplet → incomplet", () => {
      expect(StatutExport.agreger([incomplet]).estIncomplet()).toBe(true);
    });

    it("n'agrège pas les messages d'erreur (détail visible par commande)", () => {
      const agrege = StatutExport.agreger([erreur]);
      expect(agrege.messageErreur).toBeUndefined();
    });
  });
});
