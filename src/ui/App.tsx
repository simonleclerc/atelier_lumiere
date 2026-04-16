import { SessionsPage } from "@/ui/pages/SessionsPage";
import type { CreerSessionUseCase } from "@/domain/usecases/CreerSession";
import type { ListerSessionsUseCase } from "@/domain/usecases/ListerSessions";
import type { DossierPicker } from "@/ui/ports/DossierPicker";

interface AppProps {
  creerSession: CreerSessionUseCase;
  listerSessions: ListerSessionsUseCase;
  dossierPicker: DossierPicker;
}

function App({ creerSession, listerSessions, dossierPicker }: AppProps) {
  return (
    <SessionsPage
      creerSession={creerSession}
      listerSessions={listerSessions}
      dossierPicker={dossierPicker}
    />
  );
}

export default App;
