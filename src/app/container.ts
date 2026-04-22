import { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import { AjouterTirageACommandeUseCase } from "@/domain/usecases/AjouterTirageACommande";
import { ArchiverSessionUseCase } from "@/domain/usecases/ArchiverSession";
import { ControlerCoherenceSessionUseCase } from "@/domain/usecases/ControlerCoherenceSession";
import { DesarchiverSessionUseCase } from "@/domain/usecases/DesarchiverSession";
import { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import { ExporterCommandeUseCase } from "@/domain/usecases/ExporterCommande";
import { ExporterSauvegardeUseCase } from "@/domain/usecases/ExporterSauvegarde";
import { ExporterSessionUseCase } from "@/domain/usecases/ExporterSession";
import { ImporterSauvegardeUseCase } from "@/domain/usecases/ImporterSauvegarde";
import { ListerCommandesDeSessionUseCase } from "@/domain/usecases/ListerCommandesDeSession";
import { ListerSessionsUseCase } from "@/domain/usecases/ListerSessions";
import { ModifierAcheteurUseCase } from "@/domain/usecases/ModifierAcheteur";
import { ModifierInfosSessionUseCase } from "@/domain/usecases/ModifierInfosSession";
import { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";
import { RescannerDossierSourceUseCase } from "@/domain/usecases/RescannerDossierSource";
import { RetirerTirageDeCommandeUseCase } from "@/domain/usecases/RetirerTirageDeCommande";
import { SupprimerCommandeUseCase } from "@/domain/usecases/SupprimerCommande";
import { SupprimerOrphelinsExportUseCase } from "@/domain/usecases/SupprimerOrphelinsExport";
import { SupprimerSessionUseCase } from "@/domain/usecases/SupprimerSession";
import { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";
import { InMemoryGrilleTarifaireParDefautProvider } from "@/infrastructure/inMemory/InMemoryGrilleTarifaireParDefautProvider";
import { TauriCommandeRepository } from "@/infrastructure/tauri/TauriCommandeRepository";
import { TauriDossierPicker } from "@/infrastructure/tauri/TauriDossierPicker";
import { TauriFileCopier } from "@/infrastructure/tauri/TauriFileCopier";
import { TauriFileLister } from "@/infrastructure/tauri/TauriFileLister";
import { TauriFileRemover } from "@/infrastructure/tauri/TauriFileRemover";
import { TauriFileRenamer } from "@/infrastructure/tauri/TauriFileRenamer";
import { TauriFileSystemScanner } from "@/infrastructure/tauri/TauriFileSystemScanner";
import { TauriSauvegardeFichierIO } from "@/infrastructure/tauri/TauriSauvegardeFichierIO";
import { TauriSauvegardeFichierPicker } from "@/infrastructure/tauri/TauriSauvegardeFichierPicker";
import { TauriSessionRepository } from "@/infrastructure/tauri/TauriSessionRepository";

/**
 * Composition root — le SEUL endroit du projet qui câble les adapters concrets
 * aux use cases.
 */
const sessionRepository = new TauriSessionRepository();
const commandeRepository = new TauriCommandeRepository();
const fileSystemScanner = new TauriFileSystemScanner();
const fileCopier = new TauriFileCopier();
const fileLister = new TauriFileLister();
const fileRemover = new TauriFileRemover();
const fileRenamer = new TauriFileRenamer();
const sauvegardeFichierIO = new TauriSauvegardeFichierIO();
const grilleParDefaut = new InMemoryGrilleTarifaireParDefautProvider();
const dossierPicker = new TauriDossierPicker();
const sauvegardeFichierPicker = new TauriSauvegardeFichierPicker();

// Extrait en variable pour que `ExporterSessionUseCase` puisse le composer.
const exporterCommande = new ExporterCommandeUseCase(
  commandeRepository,
  sessionRepository,
  fileCopier,
  fileLister,
  fileRemover,
);

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
  modifierAcheteur: new ModifierAcheteurUseCase(
    sessionRepository,
    commandeRepository,
    fileRenamer,
  ),
  modifierInfosSession: new ModifierInfosSessionUseCase(sessionRepository),
  modifierPrixSession: new ModifierPrixSessionUseCase(sessionRepository),

  ajouterTirageACommande: new AjouterTirageACommandeUseCase(
    sessionRepository,
    commandeRepository,
  ),
  retirerTirageDeCommande: new RetirerTirageDeCommandeUseCase(
    commandeRepository,
    sessionRepository,
  ),
  listerCommandesDeSession: new ListerCommandesDeSessionUseCase(
    commandeRepository,
  ),
  exporterCommande,
  exporterSession: new ExporterSessionUseCase(
    commandeRepository,
    sessionRepository,
    exporterCommande,
  ),
  supprimerCommande: new SupprimerCommandeUseCase(
    commandeRepository,
    sessionRepository,
  ),

  controlerCoherenceSession: new ControlerCoherenceSessionUseCase(
    sessionRepository,
    commandeRepository,
    fileLister,
  ),
  rescannerDossierSource: new RescannerDossierSourceUseCase(
    sessionRepository,
    fileSystemScanner,
  ),
  supprimerOrphelinsExport: new SupprimerOrphelinsExportUseCase(
    sessionRepository,
    commandeRepository,
    fileRemover,
  ),
  supprimerSession: new SupprimerSessionUseCase(
    sessionRepository,
    commandeRepository,
    fileLister,
    fileRemover,
  ),
  archiverSession: new ArchiverSessionUseCase(
    sessionRepository,
    commandeRepository,
    fileLister,
    fileRemover,
  ),
  desarchiverSession: new DesarchiverSessionUseCase(sessionRepository),

  exporterSauvegarde: new ExporterSauvegardeUseCase(
    sessionRepository,
    commandeRepository,
    sauvegardeFichierIO,
  ),
  importerSauvegarde: new ImporterSauvegardeUseCase(
    sessionRepository,
    commandeRepository,
    sauvegardeFichierIO,
  ),

  dossierPicker,
  sauvegardeFichierPicker,
};

export type Container = typeof container;
