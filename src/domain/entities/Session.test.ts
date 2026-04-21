import { describe, it, expect } from "vitest";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import {
  AcheteurIntrouvableDansSession,
  NomAcheteurDejaUtiliseDansSession,
  Session,
} from "./Session";

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

  it("démarre sans acheteur", () => {
    const s = Session.creer(entreeValide);
    expect(s.acheteurs).toHaveLength(0);
  });

  it("ajouterAcheteur ajoute un acheteur à l'agrégat", () => {
    const s = Session.creer(entreeValide);
    const a = s.ajouterAcheteur({ nom: "Martin Dupont" });
    expect(s.acheteurs).toHaveLength(1);
    expect(s.acheteurs[0].id).toBe(a.id);
    expect(s.acheteurs[0].nom).toBe("Martin Dupont");
  });

  it("ajouterAcheteur refuse un homonyme (trim + case-insensitive)", () => {
    const s = Session.creer(entreeValide);
    s.ajouterAcheteur({ nom: "Martin Dupont" });
    expect(() =>
      s.ajouterAcheteur({ nom: "  martin dupont  " }),
    ).toThrow(/déjà inscrit/);
    expect(s.acheteurs).toHaveLength(1);
  });

  it("ajouterAcheteur accepte deux Martin distingués", () => {
    const s = Session.creer(entreeValide);
    s.ajouterAcheteur({ nom: "Martin Dupont" });
    s.ajouterAcheteur({ nom: "Martin Blanc" });
    expect(s.acheteurs).toHaveLength(2);
  });

  it("modifierPrix remplace le prix d'un format de la grille", () => {
    const s = Session.creer(entreeValide);
    expect(s.grilleTarifaire.prixPour(Format._20x30).centimes).toBe(1200);
    s.modifierPrix(Format._20x30, new Montant(1500));
    expect(s.grilleTarifaire.prixPour(Format._20x30).centimes).toBe(1500);
    expect(s.grilleTarifaire.prixPour(Format._15x23).centimes).toBe(800);
  });

  describe("modifierInfos", () => {
    it("met à jour les champs éditables", () => {
      const s = Session.creer(entreeValide);
      s.modifierInfos({
        commanditaire: "Nouveau Lieu",
        referent: "Nouveau Contact",
        date: new Date("2026-06-01"),
        type: "Studio",
        dossierSource: new CheminDossier("/x/src"),
        dossierExport: new CheminDossier("/x/export"),
      });
      expect(s.commanditaire).toBe("Nouveau Lieu");
      expect(s.referent).toBe("Nouveau Contact");
      expect(s.type).toBe("Studio");
      expect(s.dossierSource.valeur).toBe("/x/src");
    });

    it("rejette source = export", () => {
      const s = Session.creer(entreeValide);
      const chemin = new CheminDossier("/identique");
      expect(() =>
        s.modifierInfos({
          commanditaire: "X",
          referent: "Y",
          date: new Date("2026-01-01"),
          type: "Studio",
          dossierSource: chemin,
          dossierExport: chemin,
        }),
      ).toThrow(/distincts/);
    });

    it("ne touche pas aux photos ni aux acheteurs", () => {
      const s = Session.creer(entreeValide);
      s.ajouterAcheteur({ nom: "Martin" });
      s.modifierInfos({
        commanditaire: "Z",
        referent: "Z",
        date: new Date("2026-01-02"),
        type: "Studio",
        dossierSource: new CheminDossier("/new/src"),
        dossierExport: new CheminDossier("/new/export"),
      });
      expect(s.photos.map((p) => p.numero)).toEqual([1, 2, 3]);
      expect(s.acheteurs).toHaveLength(1);
      expect(s.acheteurs[0].nom).toBe("Martin");
    });
  });

  describe("modifierAcheteur", () => {
    it("met à jour le nom et conserve l'id", () => {
      const s = Session.creer(entreeValide);
      const ajoute = s.ajouterAcheteur({ nom: "Martin" });
      const modifie = s.modifierAcheteur(ajoute.id, {
        nom: "Martin Dupont",
        email: "martin@example.com",
      });
      expect(modifie.id).toBe(ajoute.id);
      expect(modifie.nom).toBe("Martin Dupont");
      expect(modifie.email?.valeur).toBe("martin@example.com");
      expect(s.acheteurs).toHaveLength(1);
      expect(s.acheteurs[0].id).toBe(ajoute.id);
    });

    it("rejette un id inconnu", () => {
      const s = Session.creer(entreeValide);
      expect(() => s.modifierAcheteur("id-bidon", { nom: "X" })).toThrow(
        AcheteurIntrouvableDansSession,
      );
    });

    it("rejette un nom déjà utilisé par UN AUTRE acheteur", () => {
      const s = Session.creer(entreeValide);
      s.ajouterAcheteur({ nom: "Martin Dupont" });
      const b = s.ajouterAcheteur({ nom: "Martin Blanc" });
      expect(() => s.modifierAcheteur(b.id, { nom: "martin dupont" })).toThrow(
        NomAcheteurDejaUtiliseDansSession,
      );
    });

    it("accepte que l'acheteur garde son propre nom lors d'un update partiel", () => {
      const s = Session.creer(entreeValide);
      const a = s.ajouterAcheteur({ nom: "Martin", email: "old@x.com" });
      const modifie = s.modifierAcheteur(a.id, {
        nom: "Martin",
        email: "new@x.com",
      });
      expect(modifie.nom).toBe("Martin");
      expect(modifie.email?.valeur).toBe("new@x.com");
    });
  });

  describe("remplacerPhotos", () => {
    it("remplace la liste et retourne le diff", () => {
      const s = Session.creer({ ...entreeValide, photoNumeros: [1, 2, 3] });
      const diff = s.remplacerPhotos([2, 3, 4, 5]);
      expect(s.photos.map((p) => p.numero)).toEqual([2, 3, 4, 5]);
      expect(diff.ajoutes).toEqual([4, 5]);
      expect(diff.retires).toEqual([1]);
    });

    it("retourne des diffs vides si le contenu est identique", () => {
      const s = Session.creer({ ...entreeValide, photoNumeros: [1, 2, 3] });
      const diff = s.remplacerPhotos([3, 1, 2]);
      expect(diff.ajoutes).toEqual([]);
      expect(diff.retires).toEqual([]);
    });

    it("ignore les numéros invalides sans crash", () => {
      const s = Session.creer({ ...entreeValide, photoNumeros: [1] });
      const diff = s.remplacerPhotos([1, 2, 0, -3, 2]);
      expect(s.photos.map((p) => p.numero)).toEqual([1, 2]);
      expect(diff.ajoutes).toEqual([2]);
      expect(diff.retires).toEqual([]);
    });
  });
});
