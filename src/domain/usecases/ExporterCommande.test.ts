import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session } from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { FileCopier } from "../ports/FileCopier";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { ExporterCommandeUseCase, joinChemin } from "./ExporterCommande";
import { AcheteurNAppartientPasASession } from "./PasserCommande";

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
  const acheteur = session.ajouterAcheteur({ nom: "Martin Dupont" });
  const commande = Commande.creer({
    sessionId: session.id,
    acheteurId: acheteur.id,
    photoNumero: 145,
    format: Format._20x30,
    quantite: 3,
    montantUnitaire: new Montant(1200),
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
  async findBySessionId(sessionId: string): Promise<readonly Commande[]> {
    return Array.from(this.map.values()).filter(
      (c) => c.sessionId === sessionId,
    );
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

class FakeFileCopier implements FileCopier {
  readonly copies: { source: string; destination: string }[] = [];
  async copier(cheminSource: string, cheminDestination: string): Promise<void> {
    this.copies.push({ source: cheminSource, destination: cheminDestination });
  }
}

describe("ExporterCommandeUseCase", () => {
  it("copie N fichiers selon la quantité dans le sous-dossier du format", async () => {
    const { session, commande } = setup();
    const sRepo = new InMemorySessionRepo([session]);
    const cRepo = new InMemoryCommandeRepo([commande]);
    const copier = new FakeFileCopier();
    const useCase = new ExporterCommandeUseCase(cRepo, sRepo, copier);

    const resultat = await useCase.execute({ commandeId: commande.id });

    expect(resultat.fichiersCrees).toBe(3);
    expect(copier.copies).toEqual([
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont_145_1.jpg",
      },
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont_145_2.jpg",
      },
      {
        source: "/Users/copain/src/145.jpg",
        destination: "/Users/copain/export/20x30/martin_dupont_145_3.jpg",
      },
    ]);
  });

  it("gère le format Numerique via son propre sous-dossier", async () => {
    const session = Session.creer({
      commanditaire: "X",
      referent: "Y",
      date: new Date("2026-04-01"),
      type: "Spectacle",
      dossierSource: new CheminDossier("/a"),
      dossierExport: new CheminDossier("/b"),
      grilleTarifaire: grille(),
      photoNumeros: [7],
    });
    const acheteur = session.ajouterAcheteur({ nom: "Anne" });
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
      photoNumero: 7,
      format: Format.NUMERIQUE,
      quantite: 2,
      montantUnitaire: new Montant(500),
    });
    const copier = new FakeFileCopier();
    const useCase = new ExporterCommandeUseCase(
      new InMemoryCommandeRepo([commande]),
      new InMemorySessionRepo([session]),
      copier,
    );

    await useCase.execute({ commandeId: commande.id });

    expect(copier.copies.map((c) => c.destination)).toEqual([
      "/b/Numerique/anne_7_1.jpg",
      "/b/Numerique/anne_7_2.jpg",
    ]);
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
    const useCase = new ExporterCommandeUseCase(
      new InMemoryCommandeRepo([commande]),
      new InMemorySessionRepo([sessionSansAcheteur]),
      new FakeFileCopier(),
    );

    await expect(
      useCase.execute({ commandeId: commande.id }),
    ).rejects.toBeInstanceOf(AcheteurNAppartientPasASession);
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
