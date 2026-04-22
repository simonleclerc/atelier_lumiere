import { describe, it, expect } from "vitest";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import {
  Commande,
  EmailAcheteurRequisPourNumerique,
  estFichierExportDeSlug,
  parserNomFichierExport,
  QuantiteNumeriqueInvalide,
  slugifierNomAcheteur,
  TirageIntrouvable,
} from "./Commande";

function commandeDemo(): Commande {
  return Commande.creer({ sessionId: "sess-1", acheteurId: "ach-1" });
}

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
}

describe("Commande (agrégat racine avec tirages)", () => {
  it("se crée vide", () => {
    const c = commandeDemo();
    expect(c.id).toBeTruthy();
    expect(c.tirages).toHaveLength(0);
    expect(c.estVide()).toBe(true);
    expect(c.total(grille()).centimes).toBe(0);
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
      });
      const t2 = c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 2,
      });
      expect(c.tirages).toHaveLength(1);
      expect(t2.id).toBe(t1.id);
      expect(c.tirages[0].quantite).toBe(3);
    });

    it("distingue deux tirages avec même photo mais formats différents", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 1,
      });
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._15x23,
        quantite: 1,
      });
      expect(c.tirages).toHaveLength(2);
    });

    describe("invariant numérique : 1 exemplaire max par photo", () => {
      it("accepte un tirage numérique avec quantité 1", () => {
        const c = commandeDemo();
        c.ajouterTirage({
          photoNumero: 145,
          format: Format.NUMERIQUE,
          quantite: 1,
        });
        expect(c.tirages).toHaveLength(1);
        expect(c.tirages[0].quantite).toBe(1);
      });

      it("accepte plusieurs tirages numériques sur des photos différentes", () => {
        const c = commandeDemo();
        c.ajouterTirage({
          photoNumero: 1,
          format: Format.NUMERIQUE,
          quantite: 1,
        });
        c.ajouterTirage({
          photoNumero: 2,
          format: Format.NUMERIQUE,
          quantite: 1,
        });
        expect(c.tirages).toHaveLength(2);
      });

      it("refuse d'ajouter un numérique avec quantité > 1", () => {
        const c = commandeDemo();
        expect(() =>
          c.ajouterTirage({
            photoNumero: 145,
            format: Format.NUMERIQUE,
            quantite: 2,
          }),
        ).toThrow(QuantiteNumeriqueInvalide);
      });

      it("refuse une consolidation qui ferait dépasser 1 (1 + 1)", () => {
        const c = commandeDemo();
        c.ajouterTirage({
          photoNumero: 145,
          format: Format.NUMERIQUE,
          quantite: 1,
        });
        expect(() =>
          c.ajouterTirage({
            photoNumero: 145,
            format: Format.NUMERIQUE,
            quantite: 1,
          }),
        ).toThrow(QuantiteNumeriqueInvalide);
        // le premier tirage reste intact
        expect(c.tirages[0].quantite).toBe(1);
      });

      it("laisse les formats papier consolider normalement", () => {
        const c = commandeDemo();
        c.ajouterTirage({
          photoNumero: 145,
          format: Format._20x30,
          quantite: 2,
        });
        c.ajouterTirage({
          photoNumero: 145,
          format: Format._20x30,
          quantite: 3,
        });
        expect(c.tirages[0].quantite).toBe(5);
      });
    });
  });

  describe("retirerTirage", () => {
    it("retire et retourne devenueVide=false s'il reste des tirages", () => {
      const c = commandeDemo();
      const t1 = c.ajouterTirage({
        photoNumero: 1,
        format: Format._20x30,
        quantite: 1,
      });
      c.ajouterTirage({
        photoNumero: 2,
        format: Format._20x30,
        quantite: 1,
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
    it("cumule sur tous les tirages avec les prix de la grille donnée", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 1,
        format: Format._20x30,
        quantite: 2,
      });
      c.ajouterTirage({
        photoNumero: 2,
        format: Format._15x23,
        quantite: 3,
      });
      expect(c.nombreTirages()).toBe(5);
      expect(c.total(grille()).centimes).toBe(2400 + 2400);
    });

    it("reflète un changement de grille (pas de snapshot figé)", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 1,
        format: Format._20x30,
        quantite: 2,
      });
      expect(c.total(grille()).centimes).toBe(2400);
      const nouvelleGrille = grille().avecPrixModifie(
        Format._20x30,
        new Montant(2000),
      );
      expect(c.total(nouvelleGrille).centimes).toBe(4000);
    });
  });

  describe("nomsFichiersExport", () => {
    it("produit une instruction par exemplaire, avec indexGlobal plat et compteur par tirage", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 2,
      });
      c.ajouterTirage({
        photoNumero: 7,
        format: Format.NUMERIQUE,
        quantite: 1,
      });
      const instructions = c.nomsFichiersExport({
        nom: "Martin Dupont",
        email: "martin@example.com",
      });
      expect(instructions).toEqual([
        {
          sousDossier: "20x30",
          nomFichier: "martin_dupont1.145.1.jpg",
          photoNumero: 145,
        },
        {
          sousDossier: "20x30",
          nomFichier: "martin_dupont2.145.2.jpg",
          photoNumero: 145,
        },
        {
          sousDossier: "Numerique/martin@example.com",
          nomFichier: "martin_dupont3.7.1.jpg",
          photoNumero: 7,
        },
      ]);
    });

    it("exemplaireDansTirage repart à 1 pour une même photo commandée dans deux formats", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._15x23,
        quantite: 2,
      });
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 1,
      });
      const instructions = c.nomsFichiersExport({ nom: "Martin" });
      expect(instructions.map((i) => i.nomFichier)).toEqual([
        "martin1.145.1.jpg",
        "martin2.145.2.jpg",
        "martin3.145.1.jpg",
      ]);
    });

    it("normalise l'email fourni (trim + lowercase) pour le sous-dossier numérique", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 1,
        format: Format.NUMERIQUE,
        quantite: 1,
      });
      const instructions = c.nomsFichiersExport({
        nom: "Martin",
        email: "  Martin@Example.COM  ",
      });
      expect(instructions[0].sousDossier).toBe(
        "Numerique/martin@example.com",
      );
    });

    it("lève EmailAcheteurRequisPourNumerique si un tirage numérique est présent sans email", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 1,
      });
      c.ajouterTirage({
        photoNumero: 7,
        format: Format.NUMERIQUE,
        quantite: 1,
      });
      expect(() => c.nomsFichiersExport({ nom: "Martin" })).toThrow(
        EmailAcheteurRequisPourNumerique,
      );
    });

    it("ne requiert pas d'email si la commande n'a pas de tirage numérique", () => {
      const c = commandeDemo();
      c.ajouterTirage({
        photoNumero: 145,
        format: Format._20x30,
        quantite: 1,
      });
      const instructions = c.nomsFichiersExport({ nom: "Martin" });
      expect(instructions).toHaveLength(1);
      expect(instructions[0].sousDossier).toBe("20x30");
    });
  });
});

describe("Commande — statut d'export", () => {
  it("est pas-exporte à la création", () => {
    const c = commandeDemo();
    expect(c.statut.estPasExporte()).toBe(true);
  });

  it("enregistrerExportReussi passe le statut à complet", () => {
    const c = commandeDemo();
    c.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    c.enregistrerExportReussi();
    expect(c.statut.estComplet()).toBe(true);
  });

  it("enregistrerExportEchec passe le statut à erreur + message", () => {
    const c = commandeDemo();
    c.enregistrerExportEchec("fichier /src/99.jpg manquant");
    expect(c.statut.estEnErreur()).toBe(true);
    expect(c.statut.messageErreur).toBe("fichier /src/99.jpg manquant");
  });

  it("ajouterTirage passe complet → incomplet", () => {
    const c = commandeDemo();
    c.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    c.enregistrerExportReussi();
    c.ajouterTirage({
      photoNumero: 2,
      format: Format._20x30,
      quantite: 1,
    });
    expect(c.statut.estIncomplet()).toBe(true);
  });

  it("retirerTirage passe complet → incomplet", () => {
    const c = commandeDemo();
    const t1 = c.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    c.ajouterTirage({
      photoNumero: 2,
      format: Format._20x30,
      quantite: 1,
    });
    c.enregistrerExportReussi();
    c.retirerTirage(t1.id);
    expect(c.statut.estIncomplet()).toBe(true);
  });

  it("ajouterTirage sur pas-exporte reste pas-exporte", () => {
    const c = commandeDemo();
    c.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    expect(c.statut.estPasExporte()).toBe(true);
  });

  it("ajouterTirage sur erreur reste erreur", () => {
    const c = commandeDemo();
    c.enregistrerExportEchec("bug");
    c.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    expect(c.statut.estEnErreur()).toBe(true);
  });

  it("ajouterTirage sur incomplet reste incomplet", () => {
    const c = commandeDemo();
    c.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    c.enregistrerExportReussi();
    c.ajouterTirage({
      photoNumero: 2,
      format: Format._20x30,
      quantite: 1,
    });
    expect(c.statut.estIncomplet()).toBe(true);
    c.ajouterTirage({
      photoNumero: 3,
      format: Format._20x30,
      quantite: 1,
    });
    expect(c.statut.estIncomplet()).toBe(true);
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

describe("estFichierExportDeSlug", () => {
  it("matche {slug}{n}.{photo}.{i}.jpg", () => {
    expect(estFichierExportDeSlug("martin47.145.1.jpg", "martin")).toBe(true);
    expect(
      estFichierExportDeSlug("martin_dupont3.1.12.jpg", "martin_dupont"),
    ).toBe(true);
  });

  it("rejette un slug qui est préfixe d'un autre (évite les faux positifs)", () => {
    expect(estFichierExportDeSlug("martin_dupont1.1.1.jpg", "martin")).toBe(
      false,
    );
  });

  it("rejette les fichiers hors convention", () => {
    expect(estFichierExportDeSlug("martin1.145.1.png", "martin")).toBe(false);
    expect(estFichierExportDeSlug("martin1.145.jpg", "martin")).toBe(false);
    expect(estFichierExportDeSlug(".DS_Store", "martin")).toBe(false);
    // ancien format avec underscores : plus reconnu
    expect(estFichierExportDeSlug("martin_145_1.jpg", "martin")).toBe(false);
  });
});

describe("parserNomFichierExport", () => {
  it("extrait slug, indexGlobal, photoNumero, exemplaire", () => {
    expect(parserNomFichierExport("martin47.145.1.jpg")).toEqual({
      slug: "martin",
      indexGlobal: 47,
      photoNumero: 145,
      exemplaire: 1,
    });
    expect(parserNomFichierExport("martin_dupont3.12.5.jpg")).toEqual({
      slug: "martin_dupont",
      indexGlobal: 3,
      photoNumero: 12,
      exemplaire: 5,
    });
  });

  it("retourne null sur les fichiers hors convention", () => {
    expect(parserNomFichierExport(".DS_Store")).toBeNull();
    expect(parserNomFichierExport("martin1.145.jpg")).toBeNull();
    expect(parserNomFichierExport("martin_abc.1.1.jpg")).toBeNull();
    expect(parserNomFichierExport("martin1.145.1.png")).toBeNull();
    // ancien format avec underscores : plus reconnu
    expect(parserNomFichierExport("martin_145_1.jpg")).toBeNull();
  });
});
