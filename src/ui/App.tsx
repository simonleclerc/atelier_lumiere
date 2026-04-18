import { useState } from "react";
import { SessionsPage } from "@/ui/pages/SessionsPage";
import { SessionDetailPage } from "@/ui/pages/SessionDetailPage";
import type { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import type { ListerSessionsUseCase } from "@/domain/usecases/ListerSessions";
import type { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import type { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";
import type { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";
import type { DossierPicker } from "@/ui/ports/DossierPicker";

interface AppProps {
  creerSession: CreerSessionUseCase;
  listerSessions: ListerSessionsUseCase;
  ajouterAcheteurASession: AjouterAcheteurASessionUseCase;
  modifierPrixSession: ModifierPrixSessionUseCase;
  trouverSessionParId: TrouverSessionParIdUseCase;
  dossierPicker: DossierPicker;
}

type Vue = { nom: "liste" } | { nom: "detail"; sessionId: string };

function App({
  creerSession,
  listerSessions,
  ajouterAcheteurASession,
  modifierPrixSession,
  trouverSessionParId,
  dossierPicker,
}: AppProps) {
  const [vue, setVue] = useState<Vue>({ nom: "liste" });

  return (
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
          modifierPrix={modifierPrixSession}
          trouverSession={trouverSessionParId}
          onRetour={() => setVue({ nom: "liste" })}
        />
      )}
    </main>
  );
}

export default App;
