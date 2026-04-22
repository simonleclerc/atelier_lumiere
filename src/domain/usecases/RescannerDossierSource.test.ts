import { describe, it, expect } from "vitest";
import { Session } from "../entities/Session";
import {
  DossierIntrouvable,
  type FileSystemScanner,
} from "../ports/FileSystemScanner";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "../ports/SessionRepository";
import { CheminDossier } from "../value-objects/CheminDossier";
import { Format } from "../value-objects/Format";
import { GrilleTarifaire } from "../value-objects/GrilleTarifaire";
import { Montant } from "../value-objects/Montant";
import { RescannerDossierSourceUseCase } from "./RescannerDossierSource";

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
  readonly savesAppels: string[] = [];
  constructor(initial: Session[] = []) {
    initial.forEach((s) => this.map.set(s.id, s));
  }
  async save(s: Session): Promise<void> {
    this.savesAppels.push(s.id);
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

class FakeScanner implements FileSystemScanner {
  constructor(private readonly resultat: readonly number[]) {}
  async scanPhotos(): Promise<readonly number[]> {
    return this.resultat;
  }
}

function sessionAvec(numeros: number[]): Session {
  return Session.creer({
    commanditaire: "X",
    referent: "Y",
    date: new Date("2026-04-01"),
    type: "Spectacle",
    dossierSource: new CheminDossier("/src"),
    dossierExport: new CheminDossier("/exp"),
    grilleTarifaire: grille(),
    photoNumeros: numeros,
  });
}

describe("RescannerDossierSourceUseCase", () => {
  it("met à jour session.photos avec le contenu actuel du disque et retourne le diff", async () => {
    const session = sessionAvec([1, 2, 3]);
    const repo = new InMemorySessionRepo([session]);
    const useCase = new RescannerDossierSourceUseCase(
      repo,
      new FakeScanner([2, 3, 4, 5]),
    );

    const r = await useCase.execute({ sessionId: session.id });

    expect(r.ajoutes).toEqual([4, 5]);
    expect(r.retires).toEqual([1]);
    const rechargee = await repo.findById(session.id);
    expect(rechargee.photos.map((p) => p.numero)).toEqual([2, 3, 4, 5]);
  });

  it("ne persiste pas si rien n'a changé", async () => {
    const session = sessionAvec([1, 2]);
    const repo = new InMemorySessionRepo([session]);
    const useCase = new RescannerDossierSourceUseCase(
      repo,
      new FakeScanner([1, 2]),
    );

    const r = await useCase.execute({ sessionId: session.id });

    expect(r.ajoutes).toEqual([]);
    expect(r.retires).toEqual([]);
    expect(repo.savesAppels).toEqual([]);
  });

  it("propage DossierIntrouvable du scanner", async () => {
    const session = sessionAvec([1]);
    const repo = new InMemorySessionRepo([session]);
    const scanner: FileSystemScanner = {
      async scanPhotos() {
        throw new DossierIntrouvable("/src");
      },
    };
    const useCase = new RescannerDossierSourceUseCase(repo, scanner);

    await expect(
      useCase.execute({ sessionId: session.id }),
    ).rejects.toBeInstanceOf(DossierIntrouvable);
  });
});
