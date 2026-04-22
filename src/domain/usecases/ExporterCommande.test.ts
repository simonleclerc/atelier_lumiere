import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session } from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { FileCopier } from "../ports/FileCopier";
import type { FileLister } from "../ports/FileLister";
import type { FileRemover } from "../ports/FileRemover";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { AcheteurNAppartientPasASession } from "./erreurs-cross-aggregate";
import { ExporterCommandeUseCase, joinChemin } from "./ExporterCommande";

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
}

function setup() {
  const session = Session.creer({
    commanditaire: "Théâtre",
    referent: "Claude",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/Users/copain/src"),
    dossierExport: new CheminDossier("/Users/copain/export"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 145, 300],
  });
  const acheteur = session.ajouterAcheteur({
    nom: "Martin Dupont",
    email: "martin@example.com",
  });
  const commande = Commande.creer({
    sessionId: session.id,
    acheteurId: acheteur.id,
  });
  commande.ajouterTirage({
    photoNumero: 145,
    format: Format._20x30,
    quantite: 3,
  });
  commande.ajouterTirage({
    photoNumero: 1,
    format: Format.NUMERIQUE,
    quantite: 1,
  });
  return { session, commande };
}

class InMemorySessionRepo implements SessionRepository {
  readonly map = new Map<string, Session>();
  constructor(initial: Session[] = []) {
    initial.forEach((s) => this.map.set(s.id, s));
  }
  async save(s: Session): Promise<void> {
    this.map.set(s.id, s);
  }
  async findById(id: string): Promise<Session> {
    const s = this.map.get(id);
    if (!s) throw new SessionIntrouvable(id);
    return s;
  }
  async findAll(): Promise<readonly Session[]> {
    return Array.from(this.map.values());
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
  async replaceAll(sessions: readonly Session[]): Promise<void> {
    this.map.clear();
    sessions.forEach((s) => this.map.set(s.id, s));
  }
}

class InMemoryCommandeRepo implements CommandeRepository {
  readonly map = new Map<string, Commande>();
  constructor(initial: Commande[] = []) {
    initial.forEach((c) => this.map.set(c.id, c));
  }
  async save(c: Commande): Promise<void> {
    this.map.set(c.id, c);
  }
  async findById(id: string): Promise<Commande> {
    const c = this.map.get(id);
    if (!c) throw new CommandeIntrouvable(id);
    return c;
  }
  async findAll(): Promise<readonly Commande[]> {
    return Array.from(this.map.values());
  }
  async findBySessionId(sessionId: string): Promise<readonly Commande[]> {
    return Array.from(this.map.values()).filter(
      (c) => c.sessionId === sessionId,
    );
  }
  async findByAcheteur(
    sessionId: string,
    acheteurId: string,
  ): Promise<Commande | null> {
    return (
      Array.from(this.map.values()).find(
        (c) => c.sessionId === sessionId && c.acheteurId === acheteurId,
      ) ?? null
    );
  }
  async replaceAll(commandes: readonly Commande[]): Promise<void> {
    this.map.clear();
    commandes.forEach((c) => this.map.set(c.id, c));
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

class FakeFileCopier implements FileCopier {
  readonly copies: { source: string; destination: string }[] = [];
  readonly sourcesQuiEchouent = new Set<string>();
  async copier(cheminSource: string, cheminDestination: string): Promise<void> {
    if (this.sourcesQuiEchouent.has(cheminSource)) {
      throw new Error(`source introuvable : ${cheminSource}`);
    }
    this.copies.push({ source: cheminSource, destination: cheminDestination });
  }
}

/**
 * Fake FS : un map `dossier -> Set<nomFichier>` qui simule le contenu
 * disque. `listerFichiers` retourne [] pour un dossier inconnu (cohérent
 * avec la sémantique du port). `supprimerSiExiste` retire du set et
 * retourne true, ou false si absent.
 */
class FakeFileSystem implements FileLister, FileRemover {
  readonly dossiers = new Map<string, Set<string>>();
  readonly suppressions: string[] = [];

  ajouter(dossier: string, nomFichier: string): void {
    if (!this.dossiers.has(dossier)) this.dossiers.set(dossier, new Set());
    this.dossiers.get(dossier)!.add(nomFichier);
  }

  async listerFichiers(dossier: string): Promise<readonly string[]> {
    return [...(this.dossiers.get(dossier) ?? new Set())];
  }

  /**
   * Sous-dossiers directs : dérivés des clés de `dossiers` qui commencent
   * par `dossier/` et n'ont qu'un segment supplémentaire.
   */
  async listerDossiers(dossier: string): Promise<readonly string[]> {
    const prefixe = dossier.endsWith("/") ? dossier : `${dossier}/`;
    const sous = new Set<string>();
    for (const cle of this.dossiers.keys()) {
      if (!cle.startsWith(prefixe)) continue;
      const reste = cle.slice(prefixe.length);
      if (!reste) continue;
      const segment = reste.split("/")[0];
      sous.add(segment);
    }
    return [...sous];
  }

  async supprimerSiExiste(chemin: string): Promise<boolean> {
    const sep = chemin.includes("\\") ? "\\" : "/";
    const idx = chemin.lastIndexOf(sep);
    const dossier = chemin.slice(0, idx);
    const nom = chemin.slice(idx + 1);
    const set = this.dossiers.get(dossier);
    if (!set?.has(nom)) return false;
    set.delete(nom);
    this.suppressions.push(chemin);
    return true;
  }
}

function monter(
  commandes: Commande[],
  sessions: Session[],
): {
  useCase: ExporterCommandeUseCase;
  sRepo: InMemorySessionRepo;
  cRepo: InMemoryCommandeRepo;
  copier: FakeFileCopier;
  fs: FakeFileSystem;
} {
  const sRepo = new InMemorySessionRepo(sessions);
  const cRepo = new InMemoryCommandeRepo(commandes);
  const copier = new FakeFileCopier();
  const fs = new FakeFileSystem();
  const useCase = new ExporterCommandeUseCase(cRepo, sRepo, copier, fs, fs);
  return { useCase, sRepo, cRepo, copier, fs };
}

describe("ExporterCommandeUseCase", () => {
  it("copie les fichiers de tous les tirages avec les bons chemins", async () => {
    const { session, commande } = setup();
    const { useCase, copier } = monter([commande], [session]);

    const resultat = await useCase.execute({ commandeId: commande.id });

    expect(resultat.fichiersCrees).toBe(4); // 3 + 1
    expect(resultat.orphelinsSupprimes).toBe(0);
    expect(copier.copies).toEqual([
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont1.145.1.jpg",
      },
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont2.145.2.jpg",
      },
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont3.145.3.jpg",
      },
      {
        source: "/Users/copain/src/1.jpg",
        destination: "/Users/copain/export/Numerique/martin@example.com/martin_dupont4.1.1.jpg",
      },
    ]);
  });

  it("ne copie rien pour une commande vide", async () => {
    const session = Session.creer({
      commanditaire: "X",
      referent: "Y",
      date: new Date("2026-04-01"),
      type: "Spectacle",
      dossierSource: new CheminDossier("/a"),
      dossierExport: new CheminDossier("/b"),
      grilleTarifaire: grille(),
      photoNumeros: [1],
    });
    const acheteur = session.ajouterAcheteur({ nom: "Alice" });
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    const { useCase, copier } = monter([commande], [session]);

    const resultat = await useCase.execute({ commandeId: commande.id });

    expect(resultat.fichiersCrees).toBe(0);
    expect(copier.copies).toHaveLength(0);
  });

  it("passe le statut de la commande à complet après un export réussi", async () => {
    const { session, commande } = setup();
    const { useCase, cRepo } = monter([commande], [session]);

    await useCase.execute({ commandeId: commande.id });

    const rechargee = await cRepo.findById(commande.id);
    expect(rechargee.statut.estComplet()).toBe(true);
  });

  it("passe le statut à erreur avec message si la copie échoue, et re-lance", async () => {
    const { session, commande } = setup();
    const { useCase, cRepo, copier } = monter([commande], [session]);
    copier.sourcesQuiEchouent.add("/Users/copain/src/145.jpg");

    await expect(
      useCase.execute({ commandeId: commande.id }),
    ).rejects.toThrow(/source introuvable/);

    const rechargee = await cRepo.findById(commande.id);
    expect(rechargee.statut.estEnErreur()).toBe(true);
    expect(rechargee.statut.messageErreur).toMatch(/source introuvable/);
  });

  it("rejette si l'acheteur a disparu de la session", async () => {
    const { session, commande } = setup();
    const sessionSansAcheteur = Session.creer({
      commanditaire: "X",
      referent: "Y",
      date: new Date("2026-04-01"),
      type: "Spectacle",
      dossierSource: new CheminDossier("/a"),
      dossierExport: new CheminDossier("/b"),
      grilleTarifaire: grille(),
      photoNumeros: [145, 1],
      id: session.id,
    });
    const { useCase } = monter([commande], [sessionSansAcheteur]);

    await expect(
      useCase.execute({ commandeId: commande.id }),
    ).rejects.toBeInstanceOf(AcheteurNAppartientPasASession);
  });

  describe("nettoyage des orphelins lors d'un ré-export", () => {
    it("supprime les fichiers du slug qui ne sont plus dans la commande", async () => {
      const { session, commande } = setup();
      const { useCase, fs } = monter([commande], [session]);
      // Simule un export précédent avec un tirage photo=300 format=15x23
      // qui a été retiré depuis.
      fs.ajouter("/Users/copain/export/15x23", "martin_dupont5.300.1.jpg");
      fs.ajouter("/Users/copain/export/15x23", "martin_dupont6.300.2.jpg");
      // Et un vieux fichier pour photo=145 en format abandonné (30x45)
      fs.ajouter("/Users/copain/export/30x45", "martin_dupont7.145.1.jpg");

      const r = await useCase.execute({ commandeId: commande.id });

      expect(r.orphelinsSupprimes).toBe(3);
      expect([...fs.suppressions].sort()).toEqual([
        "/Users/copain/export/15x23/martin_dupont5.300.1.jpg",
        "/Users/copain/export/15x23/martin_dupont6.300.2.jpg",
        "/Users/copain/export/30x45/martin_dupont7.145.1.jpg",
      ]);
    });

    it("ne touche pas aux fichiers d'autres acheteurs", async () => {
      const { session, commande } = setup();
      const { useCase, fs } = monter([commande], [session]);
      fs.ajouter("/Users/copain/export/20x30", "alice1.145.1.jpg");
      fs.ajouter("/Users/copain/export/20x30", "bob_dupont1.145.1.jpg");

      const r = await useCase.execute({ commandeId: commande.id });

      expect(r.orphelinsSupprimes).toBe(0);
      expect(fs.suppressions).toHaveLength(0);
    });

    it("ne confond pas un slug préfixe d'un autre (martin vs martin_dupont)", async () => {
      const session = Session.creer({
        commanditaire: "X",
        referent: "Y",
        date: new Date("2026-04-01"),
        type: "Spectacle",
        dossierSource: new CheminDossier("/a"),
        dossierExport: new CheminDossier("/b"),
        grilleTarifaire: grille(),
        photoNumeros: [1],
      });
      const martin = session.ajouterAcheteur({ nom: "Martin" });
      const cmd = Commande.creer({
        sessionId: session.id,
        acheteurId: martin.id,
      });
      cmd.ajouterTirage({
        photoNumero: 1,
        format: Format._15x23,
        quantite: 1,
      });
      const { useCase, fs } = monter([cmd], [session]);
      // Fichier d'un AUTRE acheteur "Martin Dupont" en ré-export
      fs.ajouter("/b/15x23", "martin_dupont1.1.1.jpg");
      // Fichier de Martin lui-même, orphelin (photo retirée fictive)
      fs.ajouter("/b/15x23", "martin2.2.1.jpg");

      const r = await useCase.execute({ commandeId: cmd.id });

      expect(r.orphelinsSupprimes).toBe(1);
      expect(fs.suppressions).toEqual(["/b/15x23/martin2.2.1.jpg"]);
      // martin_dupont1.1.1.jpg est resté
      expect(fs.dossiers.get("/b/15x23")?.has("martin_dupont1.1.1.jpg")).toBe(
        true,
      );
    });

    it("ignore les fichiers hors convention (.DS_Store, autres extensions, ancien format)", async () => {
      const { session, commande } = setup();
      const { useCase, fs } = monter([commande], [session]);
      fs.ajouter("/Users/copain/export/20x30", ".DS_Store");
      fs.ajouter("/Users/copain/export/20x30", "martin_dupont1.145.1.png");
      fs.ajouter("/Users/copain/export/20x30", "notes.txt");
      // Ancien format avec underscores : intentionnellement NON reconnu
      // comme orphelin par la nouvelle convention — un coup de
      // nettoyage manuel est attendu si l'utilisateur a d'anciens
      // exports.
      fs.ajouter("/Users/copain/export/20x30", "martin_dupont_145_1.jpg");

      const r = await useCase.execute({ commandeId: commande.id });

      expect(r.orphelinsSupprimes).toBe(0);
      expect(fs.suppressions).toHaveLength(0);
    });

    it("supprime les orphelins numériques dans un ancien sous-dossier email", async () => {
      const { session, commande } = setup();
      const { useCase, fs } = monter([commande], [session]);
      // Simule : l'acheteur avait un ancien email et a déjà des fichiers
      // numériques exportés dans l'ancien sous-dossier. Son email a
      // changé depuis, donc ces fichiers sont orphelins sous leur slug.
      fs.ajouter(
        "/Users/copain/export/Numerique/ancien@mail.com",
        "martin_dupont1.1.1.jpg",
      );
      fs.ajouter(
        "/Users/copain/export/Numerique/ancien@mail.com",
        "martin_dupont2.5.1.jpg",
      );

      const r = await useCase.execute({ commandeId: commande.id });

      expect(r.orphelinsSupprimes).toBe(2);
      expect([...fs.suppressions].sort()).toEqual([
        "/Users/copain/export/Numerique/ancien@mail.com/martin_dupont1.1.1.jpg",
        "/Users/copain/export/Numerique/ancien@mail.com/martin_dupont2.5.1.jpg",
      ]);
    });
  });
});

describe("ExporterCommandeUseCase — email requis pour le numérique", () => {
  it("lève et marque la commande en erreur si l'acheteur n'a pas d'email", async () => {
    const session = Session.creer({
      commanditaire: "X",
      referent: "Y",
      date: new Date("2026-04-01"),
      type: "Spectacle",
      dossierSource: new CheminDossier("/src"),
      dossierExport: new CheminDossier("/exp"),
      grilleTarifaire: grille(),
      photoNumeros: [1],
    });
    const acheteur = session.ajouterAcheteur({ nom: "Alice" }); // pas d'email
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format.NUMERIQUE,
      quantite: 1,
    });
    const { useCase, cRepo } = monter([commande], [session]);

    await expect(
      useCase.execute({ commandeId: commande.id }),
    ).rejects.toThrow(/email/i);

    const rechargee = await cRepo.findById(commande.id);
    expect(rechargee.statut.estEnErreur()).toBe(true);
    expect(rechargee.statut.messageErreur).toMatch(/email/i);
  });
});

describe("joinChemin", () => {
  it("joint en POSIX par défaut", () => {
    expect(joinChemin("/a", "b", "c.jpg")).toBe("/a/b/c.jpg");
  });

  it("détecte les chemins Windows et garde le séparateur \\", () => {
    expect(joinChemin("C:\\Users\\x", "sub", "file.jpg")).toBe(
      "C:\\Users\\x\\sub\\file.jpg",
    );
  });

  it("normalise les séparateurs en excès", () => {
    expect(joinChemin("/a/", "/b/", "c")).toBe("/a/b/c");
  });
});
