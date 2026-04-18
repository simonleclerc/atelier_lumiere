import { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import { ListerSessionsUseCase } from "@/domain/usecases/ListerSessions";
import { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";
import { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";
import { InMemoryGrilleTarifaireParDefautProvider } from "@/infrastructure/inMemory/InMemoryGrilleTarifaireParDefautProvider";
import { TauriDossierPicker } from "@/infrastructure/tauri/TauriDossierPicker";
import { TauriFileSystemScanner } from "@/infrastructure/tauri/TauriFileSystemScanner";
import { TauriSessionRepository } from "@/infrastructure/tauri/TauriSessionRepository";

/**
 * Composition root — le SEUL endroit du projet qui câble les adapters concrets
 * aux use cases. Pour porter l'app sur une autre plateforme (web, mobile,
 * serveur), c'est ici, et ici seulement, qu'on échange les adapters.
 *
 * Exemple : remplacer `TauriSessionRepository` par `HttpSessionRepository`
 * — aucune autre ligne du projet ne change.
 */
const sessionRepository = new TauriSessionRepository();
const fileSystemScanner = new TauriFileSystemScanner();
const grilleParDefaut = new InMemoryGrilleTarifaireParDefautProvider();
const dossierPicker = new TauriDossierPicker();

export const container = {
  creerSession: new CreerSessionUseCase(
    sessionRepository,
    fileSystemScanner,
    grilleParDefaut,
  ),
  listerSessions: new ListerSessionsUseCase(sessionRepository),
  trouverSessionParId: new TrouverSessionParIdUseCase(sessionRepository),
  ajouterAcheteurASession: new AjouterAcheteurASessionUseCase(
    sessionRepository,
  ),
  modifierPrixSession: new ModifierPrixSessionUseCase(sessionRepository),
  dossierPicker,
};

export type Container = typeof container;
