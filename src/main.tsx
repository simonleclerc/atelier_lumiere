import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/ui/App";
import { container } from "@/app/container";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App
      creerSession={container.creerSession}
      listerSessions={container.listerSessions}
      ajouterAcheteurASession={container.ajouterAcheteurASession}
      modifierAcheteur={container.modifierAcheteur}
      modifierInfosSession={container.modifierInfosSession}
      modifierPrixSession={container.modifierPrixSession}
      trouverSessionParId={container.trouverSessionParId}
      listerCommandesDeSession={container.listerCommandesDeSession}
      ajouterTirageACommande={container.ajouterTirageACommande}
      retirerTirageDeCommande={container.retirerTirageDeCommande}
      exporterCommande={container.exporterCommande}
      exporterSession={container.exporterSession}
      controlerCoherenceSession={container.controlerCoherenceSession}
      rescannerDossierSource={container.rescannerDossierSource}
      supprimerOrphelinsExport={container.supprimerOrphelinsExport}
      exporterSauvegarde={container.exporterSauvegarde}
      importerSauvegarde={container.importerSauvegarde}
      dossierPicker={container.dossierPicker}
      sauvegardeFichierPicker={container.sauvegardeFichierPicker}
    />
  </React.StrictMode>,
);
