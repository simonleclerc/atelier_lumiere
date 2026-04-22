import { useState } from "react";
import { SessionsPage } from "@/ui/pages/SessionsPage";
import { SessionDetailPage } from "@/ui/pages/SessionDetailPage";
import type { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import type { ListerSessionsUseCase } from "@/domain/usecases/ListerSessions";
import type { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import type { ModifierAcheteurUseCase } from "@/domain/usecases/ModifierAcheteur";
import type { ModifierInfosSessionUseCase } from "@/domain/usecases/ModifierInfosSession";
import type { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";
import type { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";
import type { ListerCommandesDeSessionUseCase } from "@/domain/usecases/ListerCommandesDeSession";
import type { AjouterTirageACommandeUseCase } from "@/domain/usecases/AjouterTirageACommande";
import type { RetirerTirageDeCommandeUseCase } from "@/domain/usecases/RetirerTirageDeCommande";
import type { ArchiverSessionUseCase } from "@/domain/usecases/ArchiverSession";
import type { ControlerCoherenceSessionUseCase } from "@/domain/usecases/ControlerCoherenceSession";
import type { DesarchiverSessionUseCase } from "@/domain/usecases/DesarchiverSession";
import type { ExporterCommandeUseCase } from "@/domain/usecases/ExporterCommande";
import type { ExporterSauvegardeUseCase } from "@/domain/usecases/ExporterSauvegarde";
import type { ExporterSessionUseCase } from "@/domain/usecases/ExporterSession";
import type { ImporterSauvegardeUseCase } from "@/domain/usecases/ImporterSauvegarde";
import type { RescannerDossierSourceUseCase } from "@/domain/usecases/RescannerDossierSource";
import type { SupprimerOrphelinsExportUseCase } from "@/domain/usecases/SupprimerOrphelinsExport";
import type { SupprimerSessionUseCase } from "@/domain/usecases/SupprimerSession";
import type { DossierPicker } from "@/ui/ports/DossierPicker";
import type { SauvegardeFichierPicker } from "@/ui/ports/SauvegardeFichierPicker";
import { Toaster } from "@/ui/components/ui/sonner";

interface AppProps {
  creerSession: CreerSessionUseCase;
  listerSessions: ListerSessionsUseCase;
  ajouterAcheteurASession: AjouterAcheteurASessionUseCase;
  modifierAcheteur: ModifierAcheteurUseCase;
  modifierInfosSession: ModifierInfosSessionUseCase;
  modifierPrixSession: ModifierPrixSessionUseCase;
  trouverSessionParId: TrouverSessionParIdUseCase;
  listerCommandesDeSession: ListerCommandesDeSessionUseCase;
  ajouterTirageACommande: AjouterTirageACommandeUseCase;
  retirerTirageDeCommande: RetirerTirageDeCommandeUseCase;
  exporterCommande: ExporterCommandeUseCase;
  exporterSession: ExporterSessionUseCase;
  controlerCoherenceSession: ControlerCoherenceSessionUseCase;
  rescannerDossierSource: RescannerDossierSourceUseCase;
  supprimerOrphelinsExport: SupprimerOrphelinsExportUseCase;
  supprimerSession: SupprimerSessionUseCase;
  archiverSession: ArchiverSessionUseCase;
  desarchiverSession: DesarchiverSessionUseCase;
  exporterSauvegarde: ExporterSauvegardeUseCase;
  importerSauvegarde: ImporterSauvegardeUseCase;
  dossierPicker: DossierPicker;
  sauvegardeFichierPicker: SauvegardeFichierPicker;
}

type Vue = { nom: "liste" } | { nom: "detail"; sessionId: string };

function App({
  creerSession,
  listerSessions,
  ajouterAcheteurASession,
  modifierAcheteur,
  modifierInfosSession,
  modifierPrixSession,
  trouverSessionParId,
  listerCommandesDeSession,
  ajouterTirageACommande,
  retirerTirageDeCommande,
  exporterCommande,
  exporterSession,
  controlerCoherenceSession,
  rescannerDossierSource,
  supprimerOrphelinsExport,
  supprimerSession,
  archiverSession,
  desarchiverSession,
  exporterSauvegarde,
  importerSauvegarde,
  dossierPicker,
  sauvegardeFichierPicker,
}: AppProps) {
  const [vue, setVue] = useState<Vue>({ nom: "liste" });

  return (
    <>
      <Toaster position="top-right" richColors />
      <main className="mx-auto flex h-full max-w-3xl flex-col gap-6 p-8">
        {vue.nom === "liste" && (
          <SessionsPage
            creerSession={creerSession}
            listerSessions={listerSessions}
            exporterSauvegarde={exporterSauvegarde}
            importerSauvegarde={importerSauvegarde}
            dossierPicker={dossierPicker}
            sauvegardeFichierPicker={sauvegardeFichierPicker}
            onOuvrirSession={(sessionId) => setVue({ nom: "detail", sessionId })}
          />
        )}
        {vue.nom === "detail" && (
          <SessionDetailPage
            sessionId={vue.sessionId}
            ajouterAcheteur={ajouterAcheteurASession}
            modifierAcheteur={modifierAcheteur}
            modifierInfosSession={modifierInfosSession}
            modifierPrix={modifierPrixSession}
            trouverSession={trouverSessionParId}
            listerCommandes={listerCommandesDeSession}
            ajouterTirage={ajouterTirageACommande}
            retirerTirage={retirerTirageDeCommande}
            exporterCommande={exporterCommande}
            exporterSession={exporterSession}
            controlerCoherenceSession={controlerCoherenceSession}
            rescannerDossierSource={rescannerDossierSource}
            supprimerOrphelinsExport={supprimerOrphelinsExport}
            supprimerSession={supprimerSession}
            archiverSession={archiverSession}
            desarchiverSession={desarchiverSession}
            dossierPicker={dossierPicker}
            onRetour={() => setVue({ nom: "liste" })}
          />
        )}
      </main>
    </>
  );
}

export default App;
