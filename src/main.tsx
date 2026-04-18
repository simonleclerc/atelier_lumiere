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
      passerCommande={container.passerCommande}
      trouverCommandeParId={container.trouverCommandeParId}
      ajouterLigneACommande={container.ajouterLigneACommande}
      retirerLigneDeCommande={container.retirerLigneDeCommande}
      exporterCommande={container.exporterCommande}
      dossierPicker={container.dossierPicker}
    />
  </React.StrictMode>,
);
