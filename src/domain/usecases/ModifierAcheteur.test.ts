import { describe, it, expect } from "vitest";
import { Commande } from "../entities/Commande";
import {
  AcheteurIntrouvableDansSession,
  NomAcheteurDejaUtiliseDansSession,
  Session,
} from "../entities/Session";
import {
  CommandeIntrouvable,
  type CommandeRepository,
} from "../ports/CommandeRepository";
import type { FileRenamer } from "../ports/FileRenamer";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { ModifierAcheteurUseCase } from "./ModifierAcheteur";

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
    commanditaire: "X",
    referent: "Y",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/a"),
    dossierExport: new CheminDossier("/b"),
    grilleTarifaire: grille(),
    photoNumeros: [1, 2],
  });
  const acheteur = session.ajouterAcheteur({ nom: "Martin" });
  return { session, acheteur };
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

/**
 * Fake FS : contient un set de fichiers "présents" sur disque. `renommerSiExiste`
 * déplace la clé dans le set et retourne `true`, ou retourne `false` si absent.
 */
class FakeFileRenamer implements FileRenamer {
  readonly fichiers: Set<string>;
  readonly appels: Array<{ src: string; dst: string; renomme: boolean }> = [];

  constructor(fichiersPresents: string[] = []) {
    this.fichiers = new Set(fichiersPresents);
  }

  async renommerSiExiste(src: string, dst: string): Promise<boolean> {
    const present = this.fichiers.has(src);
    if (present) {
      this.fichiers.delete(src);
      this.fichiers.add(dst);
    }
    this.appels.push({ src, dst, renomme: present });
    return present;
  }
}

describe("ModifierAcheteurUseCase", () => {
  it("met à jour l'acheteur et persiste la session", async () => {
    const { session, acheteur } = setup();
    const sessions = new InMemorySessionRepo([session]);
    const commandes = new InMemoryCommandeRepo();
    const fs = new FakeFileRenamer();
    const useCase = new ModifierAcheteurUseCase(sessions, commandes, fs);

    const { acheteur: result } = await useCase.execute({
      sessionId: session.id,
      acheteurId: acheteur.id,
      nom: "Martin Dupont",
      email: "martin@x.com",
    });

    expect(result.id).toBe(acheteur.id);
    expect(result.nom).toBe("Martin Dupont");
    const rechargee = await sessions.findById(session.id);
    expect(rechargee.acheteurs[0].email?.valeur).toBe("martin@x.com");
  });

  it("remonte AcheteurIntrouvableDansSession si id inconnu", async () => {
    const { session } = setup();
    const sessions = new InMemorySessionRepo([session]);
    const commandes = new InMemoryCommandeRepo();
    const fs = new FakeFileRenamer();
    const useCase = new ModifierAcheteurUseCase(sessions, commandes, fs);

    await expect(
      useCase.execute({
        sessionId: session.id,
        acheteurId: "inconnu",
        nom: "X",
      }),
    ).rejects.toBeInstanceOf(AcheteurIntrouvableDansSession);
  });

  it("remonte le conflit d'unicité du nom", async () => {
    const { session, acheteur } = setup();
    const autre = session.ajouterAcheteur({ nom: "Alice" });
    const sessions = new InMemorySessionRepo([session]);
    const commandes = new InMemoryCommandeRepo();
    const fs = new FakeFileRenamer();
    const useCase = new ModifierAcheteurUseCase(sessions, commandes, fs);

    await expect(
      useCase.execute({
        sessionId: session.id,
        acheteurId: autre.id,
        nom: "martin",
      }),
    ).rejects.toBeInstanceOf(NomAcheteurDejaUtiliseDansSession);
    expect(acheteur.nom).toBe("Martin");
  });

  it("renomme les fichiers exportés quand le slug change", async () => {
    const { session, acheteur } = setup();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 2,
    });
    commande.ajouterTirage({
      photoNumero: 2,
      format: Format._20x30,
      quantite: 1,
    });

    const fichiersAvant = [
      "/b/15x23/martin_1_1.jpg",
      "/b/15x23/martin_1_2.jpg",
      "/b/20x30/martin_2_1.jpg",
    ];
    const sessions = new InMemorySessionRepo([session]);
    const commandes = new InMemoryCommandeRepo([commande]);
    const fs = new FakeFileRenamer(fichiersAvant);
    const useCase = new ModifierAcheteurUseCase(sessions, commandes, fs);

    const { fichiersRenommes } = await useCase.execute({
      sessionId: session.id,
      acheteurId: acheteur.id,
      nom: "Martin Dupont",
    });

    expect(fichiersRenommes).toBe(3);
    expect([...fs.fichiers].sort()).toEqual([
      "/b/15x23/martin_dupont_1_1.jpg",
      "/b/15x23/martin_dupont_1_2.jpg",
      "/b/20x30/martin_dupont_2_1.jpg",
    ]);
  });

  it("ne renomme rien quand le slug reste identique (casse, espaces)", async () => {
    const { session, acheteur } = setup();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });

    const sessions = new InMemorySessionRepo([session]);
    const commandes = new InMemoryCommandeRepo([commande]);
    const fs = new FakeFileRenamer(["/b/15x23/martin_1_1.jpg"]);
    const useCase = new ModifierAcheteurUseCase(sessions, commandes, fs);

    const { fichiersRenommes } = await useCase.execute({
      sessionId: session.id,
      acheteurId: acheteur.id,
      nom: "  MARTIN  ",
    });

    expect(fichiersRenommes).toBe(0);
    expect(fs.appels).toHaveLength(0);
    expect(fs.fichiers.has("/b/15x23/martin_1_1.jpg")).toBe(true);
  });

  it("reste best-effort si les fichiers sont absents (commande jamais exportée)", async () => {
    const { session, acheteur } = setup();
    const commande = Commande.creer({
      sessionId: session.id,
      acheteurId: acheteur.id,
    });
    commande.ajouterTirage({
      photoNumero: 1,
      format: Format._15x23,
      quantite: 1,
    });

    const sessions = new InMemorySessionRepo([session]);
    const commandes = new InMemoryCommandeRepo([commande]);
    const fs = new FakeFileRenamer();
    const useCase = new ModifierAcheteurUseCase(sessions, commandes, fs);

    const { fichiersRenommes } = await useCase.execute({
      sessionId: session.id,
      acheteurId: acheteur.id,
      nom: "Jean",
    });

    expect(fichiersRenommes).toBe(0);
    expect(fs.appels).toHaveLength(1);
    expect(fs.appels[0].renomme).toBe(false);
  });

  it("ne renomme rien quand il n'y a pas de commande pour cet acheteur", async () => {
    const { session, acheteur } = setup();
    const sessions = new InMemorySessionRepo([session]);
    const commandes = new InMemoryCommandeRepo();
    const fs = new FakeFileRenamer(["/b/15x23/martin_1_1.jpg"]);
    const useCase = new ModifierAcheteurUseCase(sessions, commandes, fs);

    const { fichiersRenommes } = await useCase.execute({
      sessionId: session.id,
      acheteurId: acheteur.id,
      nom: "Jean",
    });

    expect(fichiersRenommes).toBe(0);
    expect(fs.appels).toHaveLength(0);
  });
});
