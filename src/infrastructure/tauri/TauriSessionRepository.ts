import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { Photo } from "@/domain/entities/Photo";
import { Session } from "@/domain/entities/Session";
import {
  SessionIntrouvable,
  type SessionRepository,
} from "@/domain/ports/SessionRepository";
import { CheminDossier } from "@/domain/value-objects/CheminDossier";
import { Format } from "@/domain/value-objects/Format";
import { GrilleTarifaire } from "@/domain/value-objects/GrilleTarifaire";
import { Montant } from "@/domain/value-objects/Montant";
import { parseTypeSession } from "@/domain/value-objects/TypeSession";

/**
 * Adapter Tauri — persistance JSON dans `AppData/sessions.json`.
 *
 * Limites assumées en V1 : lecture / écriture complète à chaque opération
 * (pas de batch, pas de cache). Pour quelques dizaines de sessions c'est
 * amplement suffisant. Migration vers SQLite (plugin-sql) triviale plus
 * tard parce que le domaine ne sera pas touché.
 */
const FICHIER = "sessions.json";

interface GrilleJson {
  readonly format: string;
  readonly centimes: number;
}

interface SessionJson {
  readonly id: string;
  readonly commanditaire: string;
  readonly referent: string;
  readonly date: string;
  readonly type: string;
  readonly dossierSource: string;
  readonly dossierExport: string;
  readonly grilleTarifaire: readonly GrilleJson[];
  readonly photos: readonly number[];
}

export class TauriSessionRepository implements SessionRepository {
  async save(session: Session): Promise<void> {
    const raws = await this.loadRaw();
    const filtered = raws.filter((r) => r.id !== session.id);
    filtered.push(toJson(session));
    await this.ensureAppDir();
    await writeTextFile(FICHIER, JSON.stringify(filtered, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  }

  async findById(id: string): Promise<Session> {
    const sessions = await this.findAll();
    const trouvee = sessions.find((s) => s.id === id);
    if (!trouvee) throw new SessionIntrouvable(id);
    return trouvee;
  }

  async findAll(): Promise<readonly Session[]> {
    const raws = await this.loadRaw();
    return raws.map(fromJson);
  }

  private async ensureAppDir(): Promise<void> {
    const ok = await exists("", { baseDir: BaseDirectory.AppData });
    if (!ok) {
      await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true });
    }
  }

  private async loadRaw(): Promise<SessionJson[]> {
    const present = await exists(FICHIER, { baseDir: BaseDirectory.AppData });
    if (!present) return [];
    const content = await readTextFile(FICHIER, {
      baseDir: BaseDirectory.AppData,
    });
    if (!content.trim()) return [];
    return JSON.parse(content) as SessionJson[];
  }
}

function toJson(session: Session): SessionJson {
  return {
    id: session.id,
    commanditaire: session.commanditaire,
    referent: session.referent,
    date: session.date.toISOString(),
    type: session.type,
    dossierSource: session.dossierSource.valeur,
    dossierExport: session.dossierExport.valeur,
    grilleTarifaire: session.grilleTarifaire
      .toEntrees()
      .map(([f, m]) => ({ format: f.toDossierName(), centimes: m.centimes })),
    photos: session.photos.map((p) => p.numero),
  };
}

function fromJson(raw: SessionJson): Session {
  return new Session({
    id: raw.id,
    commanditaire: raw.commanditaire,
    referent: raw.referent,
    date: new Date(raw.date),
    type: parseTypeSession(raw.type),
    dossierSource: new CheminDossier(raw.dossierSource),
    dossierExport: new CheminDossier(raw.dossierExport),
    grilleTarifaire: new GrilleTarifaire(
      raw.grilleTarifaire.map(
        (e) => [Format.depuis(e.format), new Montant(e.centimes)] as const,
      ),
    ),
    photos: raw.photos.map((n) => new Photo(n)),
  });
}
