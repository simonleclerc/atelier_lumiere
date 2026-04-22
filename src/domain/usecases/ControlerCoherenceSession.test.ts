import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import { Session } from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { FileLister } from "../ports/FileLister";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { ControlerCoherenceSessionUseCase } from "./ControlerCoherenceSession";

function grille(): GrilleTarifaire {
  return new GrilleTarifaire([
    [Format._15x23, new Montant(800)],
    [Format._20x30, new Montant(1200)],
    [Format._30x45, new Montant(1800)],
    [Format.NUMERIQUE, new Montant(500)],
  ]);
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
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
  async replaceAll(commandes: readonly Commande[]): Promise<void> {
    this.map.clear();
    commandes.forEach((c) => this.map.set(c.id, c));
  }
}

class FakeFileLister implements FileLister {
  readonly dossiers = new Map<string, Set<string>>();
  ajouter(dossier: string, fichier: string): void {
    if (!this.dossiers.has(dossier)) this.dossiers.set(dossier, new Set());
    this.dossiers.get(dossier)!.add(fichier);
  }
  async listerFichiers(dossier: string): Promise<readonly string[]> {
    return [...(this.dossiers.get(dossier) ?? new Set())];
  }
}

function sessionAvec(numeros: number[]): {
  session: Session;
  acheteurId: string;
} {
  const session = Session.creer({
    commanditaire: "X",
    referent: "Y",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/src"),
    dossierExport: new CheminDossier("/exp"),
    grilleTarifaire: grille(),
    photoNumeros: numeros,
  });
  const acheteur = session.ajouterAcheteur({ nom: "Martin" });
  return { session, acheteurId: acheteur.id };
}

describe("ControlerCoherenceSessionUseCase", () => {
  it("retourne 3 listes vides quand tout est cohérent", async () => {
    const { session, acheteurId } = sessionAvec([1, 2]);
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileLister();
    fs.ajouter("/src", "1.jpg");
    fs.ajouter("/src", "2.jpg");
    fs.ajouter("/exp/15x23", "martin1.1.1.jpg");

    const useCase = new ControlerCoherenceSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.photosFantomes).toEqual([]);
    expect(r.exportsIncomplets).toEqual([]);
    expect(r.orphelinsExport).toEqual([]);
  });

  it("détecte les photos fantômes (référencées mais absentes du source)", async () => {
    const { session, acheteurId } = sessionAvec([1, 2]);
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    const t1 = commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });
    const t2 = commande.ajouterTirage({
      photoNumero: 1,
      format: Format._20x30,
      quantite: 1,
    });
    commande.ajouterTirage({
      photoNumero: 2,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileLister();
    fs.ajouter("/src", "2.jpg"); // 1.jpg absent
    fs.ajouter("/exp/15x23", "martin3.2.1.jpg");

    const useCase = new ControlerCoherenceSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.photosFantomes).toHaveLength(1);
    expect(r.photosFantomes[0]).toEqual({
      commandeId: commande.id,
      acheteurId,
      photoNumero: 1,
      tirageIds: expect.arrayContaining([t1.id, t2.id]),
    });
    // La photo 2 est présente en source et exportée : pas d'export manquant.
    expect(r.exportsIncomplets).toEqual([]);
  });

  it("détecte un export incomplet (fichier d'export manquant sur disque)", async () => {
    const { session, acheteurId } = sessionAvec([1]);
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 2, // attend 2 fichiers : martin1.1.1.jpg + martin2.1.2.jpg
    });
    const fs = new FakeFileLister();
    fs.ajouter("/src", "1.jpg");
    fs.ajouter("/exp/15x23", "martin1.1.1.jpg");
    // martin2.1.2.jpg manque

    const useCase = new ControlerCoherenceSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.photosFantomes).toEqual([]);
    expect(r.exportsIncomplets).toHaveLength(1);
    expect(r.exportsIncomplets[0]).toMatchObject({
      commandeId: commande.id,
      acheteurId,
      fichiersManquants: 1,
      fichiersAttendus: 2,
    });
  });

  it("ne compte pas les tirages fantômes dans les exports manquants", async () => {
    const { session, acheteurId } = sessionAvec([1, 2]);
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });
    commande.ajouterTirage({
      photoNumero: 2,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileLister();
    fs.ajouter("/src", "1.jpg"); // 2.jpg absent = photo 2 fantôme
    fs.ajouter("/exp/15x23", "martin1.1.1.jpg");

    const useCase = new ControlerCoherenceSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.photosFantomes).toHaveLength(1);
    expect(r.photosFantomes[0].photoNumero).toBe(2);
    // photo 1 OK, photo 2 fantôme (pas comptée en export manquant)
    expect(r.exportsIncomplets).toEqual([]);
  });

  it("détecte les orphelins dans le dossier export", async () => {
    const { session, acheteurId } = sessionAvec([1, 2]);
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileLister();
    fs.ajouter("/src", "1.jpg");
    fs.ajouter("/src", "2.jpg");
    fs.ajouter("/exp/15x23", "martin1.1.1.jpg"); // attendu
    fs.ajouter("/exp/15x23", "martin2.2.1.jpg"); // orphelin (tirage retiré)
    fs.ajouter("/exp/20x30", "alice3.5.1.jpg"); // orphelin (acheteur supprimé)

    const useCase = new ControlerCoherenceSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.orphelinsExport).toHaveLength(2);
    const cibles = r.orphelinsExport.map((o) => o.cheminAbsolu).sort();
    expect(cibles).toEqual([
      "/exp/15x23/martin2.2.1.jpg",
      "/exp/20x30/alice3.5.1.jpg",
    ]);
    // Slug "martin" matche l'acheteur existant ; "alice" non.
    const martin = r.orphelinsExport.find(
      (o) => o.nomFichier === "martin2.2.1.jpg",
    );
    expect(martin?.acheteurIdConnu).toBe(acheteurId);
    const alice = r.orphelinsExport.find(
      (o) => o.nomFichier === "alice3.5.1.jpg",
    );
    expect(alice?.acheteurIdConnu).toBeNull();
  });

  it("ignore les fichiers hors convention dans le dossier export", async () => {
    const { session, acheteurId } = sessionAvec([1]);
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileLister();
    fs.ajouter("/src", "1.jpg");
    fs.ajouter("/exp/15x23", "martin1.1.1.jpg");
    fs.ajouter("/exp/15x23", ".DS_Store");
    fs.ajouter("/exp/15x23", "notes.txt");
    fs.ajouter("/exp/15x23", "bizarre.jpg");

    const useCase = new ControlerCoherenceSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.orphelinsExport).toEqual([]);
  });

  it("ne propose JAMAIS de toucher au dossier source (pas de catégorie non-commandée)", async () => {
    const { session, acheteurId } = sessionAvec([1, 2, 3]);
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId,
    });
    commande.ajouterTirage({
      photoNumero: 2,
      format: Format._15x23,
      quantite: 1,
    });
    const fs = new FakeFileLister();
    // Photos 1 et 3 présentes en source mais jamais commandées : on
    // les ignore volontairement, le dossier source n'est pas touché.
    fs.ajouter("/src", "1.jpg");
    fs.ajouter("/src", "2.jpg");
    fs.ajouter("/src", "3.jpg");
    fs.ajouter("/exp/15x23", "martin1.2.1.jpg");

    const useCase = new ControlerCoherenceSessionUseCase(
      new InMemorySessionRepo([session]),
      new InMemoryCommandeRepo([commande]),
      fs,
    );

    const r = await useCase.execute({ sessionId: session.id });
    expect(r.photosFantomes).toEqual([]);
    expect(r.exportsIncomplets).toEqual([]);
    expect(r.orphelinsExport).toEqual([]);
  });
});
