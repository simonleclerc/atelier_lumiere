import { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import { AjouterLigneACommandeUseCase } from "@/domain/usecases/AjouterLigneACommande";
import { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import { ExporterCommandeUseCase } from "@/domain/usecases/ExporterCommande";
import { ListerCommandesDeSessionUseCase } from "@/domain/usecases/ListerCommandesDeSession";
import { ListerSessionsUseCase } from "@/domain/usecases/ListerSessions";
import { ModifierAcheteurUseCase } from "@/domain/usecases/ModifierAcheteur";
import { ModifierInfosSessionUseCase } from "@/domain/usecases/ModifierInfosSession";
import { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";
import { PasserCommandeUseCase } from "@/domain/usecases/PasserCommande";
import { RetirerLigneDeCommandeUseCase } from "@/domain/usecases/RetirerLigneDeCommande";
import { TrouverCommandeParIdUseCase } from "@/domain/usecases/TrouverCommandeParId";
import { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";
import { InMemoryGrilleTarifaireParDefautProvider } from "@/infrastructure/inMemory/InMemoryGrilleTarifaireParDefautProvider";
import { TauriCommandeRepository } from "@/infrastructure/tauri/TauriCommandeRepository";
import { TauriDossierPicker } from "@/infrastructure/tauri/TauriDossierPicker";
import { TauriFileCopier } from "@/infrastructure/tauri/TauriFileCopier";
import { TauriFileSystemScanner } from "@/infrastructure/tauri/TauriFileSystemScanner";
import { TauriSessionRepository } from "@/infrastructure/tauri/TauriSessionRepository";

/**
 * Composition root — le SEUL endroit du projet qui câble les adapters concrets
 * aux use cases. Pour porter l'app sur une autre plateforme (web, mobile,
 * serveur), c'est ici, et ici seulement, qu'on échange les adapters.
 */
const sessionRepository = new TauriSessionRepository();
const commandeRepository = new TauriCommandeRepository();
const fileSystemScanner = new TauriFileSystemScanner();
const fileCopier = new TauriFileCopier();
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
  modifierAcheteur: new ModifierAcheteurUseCase(sessionRepository),
  modifierInfosSession: new ModifierInfosSessionUseCase(sessionRepository),
  modifierPrixSession: new ModifierPrixSessionUseCase(sessionRepository),

  passerCommande: new PasserCommandeUseCase(
    sessionRepository,
    commandeRepository,
  ),
  trouverCommandeParId: new TrouverCommandeParIdUseCase(commandeRepository),
  listerCommandesDeSession: new ListerCommandesDeSessionUseCase(
    commandeRepository,
  ),
  ajouterLigneACommande: new AjouterLigneACommandeUseCase(
    commandeRepository,
    sessionRepository,
  ),
  retirerLigneDeCommande: new RetirerLigneDeCommandeUseCase(commandeRepository),
  exporterCommande: new ExporterCommandeUseCase(
    commandeRepository,
    sessionRepository,
    fileCopier,
  ),

  dossierPicker,
};

export type Container = typeof container;
