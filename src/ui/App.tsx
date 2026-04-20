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
import type { PasserCommandeUseCase } from "@/domain/usecases/PasserCommande";
import type { ExporterCommandeUseCase } from "@/domain/usecases/ExporterCommande";
import type { SupprimerCommandeUseCase } from "@/domain/usecases/SupprimerCommande";
import type { DossierPicker } from "@/ui/ports/DossierPicker";
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
  passerCommande: PasserCommandeUseCase;
  exporterCommande: ExporterCommandeUseCase;
  supprimerCommande: SupprimerCommandeUseCase;
  dossierPicker: DossierPicker;
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
  passerCommande,
  exporterCommande,
  supprimerCommande,
  dossierPicker,
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
            dossierPicker={dossierPicker}
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
            passerCommande={passerCommande}
            exporterCommande={exporterCommande}
            supprimerCommande={supprimerCommande}
            dossierPicker={dossierPicker}
            onRetour={() => setVue({ nom: "liste" })}
          />
        )}
      </main>
    </>
  );
}

export default App;
