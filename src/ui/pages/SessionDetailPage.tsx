import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { AcheteurForm } from "@/ui/components/AcheteurForm";
import { AjouterTiragesForm } from "@/ui/components/AjouterTiragesForm";
import { GrilleTarifaireEditor } from "@/ui/components/GrilleTarifaireEditor";
import { SessionForm } from "@/ui/components/SessionForm";
import { StatutBadge } from "@/ui/components/StatutBadge";
import type { Acheteur } from "@/domain/entities/Acheteur";
import { slugifierNomAcheteur, type Commande } from "@/domain/entities/Commande";
import type { Session } from "@/domain/entities/Session";
import { Montant } from "@/domain/value-objects/Montant";
import { StatutExport } from "@/domain/value-objects/StatutExport";
import type { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import type { AjouterTirageACommandeUseCase } from "@/domain/usecases/AjouterTirageACommande";
import type {
  ControlerCoherenceSessionResultat,
  ControlerCoherenceSessionUseCase,
} from "@/domain/usecases/ControlerCoherenceSession";
import type { ExporterCommandeUseCase } from "@/domain/usecases/ExporterCommande";
import type { ExporterSessionUseCase } from "@/domain/usecases/ExporterSession";
import type { ListerCommandesDeSessionUseCase } from "@/domain/usecases/ListerCommandesDeSession";
import type { ModifierAcheteurUseCase } from "@/domain/usecases/ModifierAcheteur";
import type { ModifierInfosSessionUseCase } from "@/domain/usecases/ModifierInfosSession";
import type { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";
import type { RescannerDossierSourceUseCase } from "@/domain/usecases/RescannerDossierSource";
import type { RetirerTirageDeCommandeUseCase } from "@/domain/usecases/RetirerTirageDeCommande";
import type { SupprimerOrphelinsExportUseCase } from "@/domain/usecases/SupprimerOrphelinsExport";
import type { TrouverSessionParIdUseCase } from "@/domain/usecases/TrouverSessionParId";
import type { DossierPicker } from "@/ui/ports/DossierPicker";

interface Props {
  sessionId: string;
  ajouterAcheteur: AjouterAcheteurASessionUseCase;
  modifierAcheteur: ModifierAcheteurUseCase;
  modifierInfosSession: ModifierInfosSessionUseCase;
  modifierPrix: ModifierPrixSessionUseCase;
  trouverSession: TrouverSessionParIdUseCase;
  listerCommandes: ListerCommandesDeSessionUseCase;
  ajouterTirage: AjouterTirageACommandeUseCase;
  retirerTirage: RetirerTirageDeCommandeUseCase;
  exporterCommande: ExporterCommandeUseCase;
  exporterSession: ExporterSessionUseCase;
  controlerCoherenceSession: ControlerCoherenceSessionUseCase;
  rescannerDossierSource: RescannerDossierSourceUseCase;
  supprimerOrphelinsExport: SupprimerOrphelinsExportUseCase;
  dossierPicker: DossierPicker;
  onRetour: () => void;
}

type TriAcheteurs = "ajout" | "alpha" | "ca" | "photos";

const OPTIONS_TRI: { id: TriAcheteurs; label: string }[] = [
  { id: "ajout", label: "Ordre d'ajout" },
  { id: "alpha", label: "Alphabétique" },
  { id: "ca", label: "Chiffre d'affaires" },
  { id: "photos", label: "Nombre de tirages" },
];

export function SessionDetailPage({
  sessionId,
  ajouterAcheteur,
  modifierAcheteur,
  modifierInfosSession,
  modifierPrix,
  trouverSession,
  listerCommandes,
  ajouterTirage,
  retirerTirage,
  exporterCommande,
  exporterSession,
  controlerCoherenceSession,
  rescannerDossierSource,
  supprimerOrphelinsExport,
  dossierPicker,
  onRetour,
}: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [commandes, setCommandes] = useState<readonly Commande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [editionSession, setEditionSession] = useState(false);
  const [nouvelAcheteurOuvert, setNouvelAcheteurOuvert] = useState(false);
  const [acheteurEnEdition, setAcheteurEnEdition] = useState<string | null>(null);
  const [triPar, setTriPar] = useState<TriAcheteurs>("ajout");
  const [confirmationRenommage, setConfirmationRenommage] = useState<{
    ancienNom: string;
    nouveauNom: string;
    resoudre: (ok: boolean) => void;
  } | null>(null);
  const [coherenceOuverte, setCoherenceOuverte] = useState(false);
  const [rapportCoherence, setRapportCoherence] =
    useState<ControlerCoherenceSessionResultat | null>(null);
  const [chargementCoherence, setChargementCoherence] = useState(false);
  const [actionCoherenceEnCours, setActionCoherenceEnCours] = useState(false);
  const [cheminsASupprimer, setCheminsASupprimer] = useState<Set<string>>(
    new Set(),
  );
  const [rescanEnCours, setRescanEnCours] = useState(false);

  const recharger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [s, cmds] = await Promise.all([
        trouverSession.execute(sessionId),
        listerCommandes.execute(sessionId),
      ]);
      setSession(s);
      setCommandes(cmds);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setChargement(false);
    }
  }, [sessionId, trouverSession, listerCommandes]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const commandeParAcheteur = useMemo(() => {
    const map = new Map<string, Commande>();
    for (const c of commandes) map.set(c.acheteurId, c);
    return map;
  }, [commandes]);

  const acheteursTries = useMemo(() => {
    if (!session) return [];
    const ca = (acheteurId: string) =>
      commandeParAcheteur
        .get(acheteurId)
        ?.total(session.grilleTarifaire).centimes ?? 0;
    const photos = (acheteurId: string) =>
      commandeParAcheteur.get(acheteurId)?.nombreTirages() ?? 0;

    const copie = [...session.acheteurs];
    switch (triPar) {
      case "alpha":
        return copie.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      case "ca":
        return copie.sort((a, b) => ca(b.id) - ca(a.id));
      case "photos":
        return copie.sort((a, b) => photos(b.id) - photos(a.id));
      case "ajout":
      default:
        return copie;
    }
  }, [session, commandeParAcheteur, triPar]);

  if (chargement) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (erreur || !session) {
    return (
      <section className="flex flex-col gap-4">
        <Button variant="ghost" onClick={onRetour}>
          ← Retour
        </Button>
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {erreur ?? "Session introuvable."}
        </p>
      </section>
    );
  }

  if (editionSession) {
    return (
      <section className="flex flex-col gap-4">
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => setEditionSession(false)}
        >
          ← Annuler l'édition
        </Button>
        <SessionForm
          dossierPicker={dossierPicker}
          valeursInitiales={{
            commanditaire: session.commanditaire,
            referent: session.referent,
            date: session.date,
            type: session.type,
            dossierSource: session.dossierSource.valeur,
            dossierExport: session.dossierExport.valeur,
          }}
          titre="Modifier la session"
          libelleSubmit="Enregistrer les modifications"
          libelleSubmitEnCours="Enregistrement…"
          onAnnuler={() => setEditionSession(false)}
          onSoumettre={async (valeurs) => {
            try {
              await modifierInfosSession.execute({
                sessionId: session.id,
                ...valeurs,
              });
              toast.success("Session mise à jour", {
                description: valeurs.commanditaire,
              });
              setEditionSession(false);
              recharger();
            } catch (err) {
              toast.error("Mise à jour impossible", {
                description: err instanceof Error ? err.message : String(err),
              });
            }
          }}
        />
      </section>
    );
  }

  async function rescanner(): Promise<void> {
    setRescanEnCours(true);
    try {
      const r = await rescannerDossierSource.execute({ sessionId });
      if (r.ajoutes.length === 0 && r.retires.length === 0) {
        toast.success("Dossier source inchangé");
      } else {
        const morceaux: string[] = [];
        if (r.ajoutes.length > 0) {
          morceaux.push(
            `${r.ajoutes.length} ajoutée${r.ajoutes.length > 1 ? "s" : ""}`,
          );
        }
        if (r.retires.length > 0) {
          morceaux.push(
            `${r.retires.length} retirée${r.retires.length > 1 ? "s" : ""}`,
          );
        }
        toast.success(`Photos mises à jour : ${morceaux.join(", ")}`);
      }
      await recharger();
    } catch (err) {
      toast.error("Rescan impossible", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRescanEnCours(false);
    }
  }

  async function chargerRapportCoherence(): Promise<void> {
    setChargementCoherence(true);
    try {
      const r = await controlerCoherenceSession.execute({ sessionId });
      setRapportCoherence(r);
      setCheminsASupprimer(
        new Set(r.orphelinsExport.map((o) => o.cheminAbsolu)),
      );
    } catch (err) {
      toast.error("Contrôle de cohérence impossible", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setChargementCoherence(false);
    }
  }

  async function ouvrirControleCoherence(): Promise<void> {
    setCoherenceOuverte(true);
    await chargerRapportCoherence();
  }

  async function retirerTiragesFantomes(): Promise<void> {
    if (!rapportCoherence) return;
    setActionCoherenceEnCours(true);
    let retires = 0;
    let erreurs = 0;
    for (const f of rapportCoherence.photosFantomes) {
      for (const tid of f.tirageIds) {
        try {
          await retirerTirage.execute({
            commandeId: f.commandeId,
            tirageId: tid,
          });
          retires += 1;
        } catch {
          erreurs += 1;
        }
      }
    }
    if (erreurs === 0) {
      toast.success(`${retires} tirage${retires > 1 ? "s" : ""} fantôme${retires > 1 ? "s" : ""} retiré${retires > 1 ? "s" : ""}`);
    } else {
      toast.warning(
        `${retires} retiré${retires > 1 ? "s" : ""}, ${erreurs} échec${erreurs > 1 ? "s" : ""}`,
      );
    }
    await recharger();
    await chargerRapportCoherence();
    setActionCoherenceEnCours(false);
  }

  async function reexporterCommandesIncompletes(): Promise<void> {
    if (!rapportCoherence) return;
    setActionCoherenceEnCours(true);
    let ok = 0;
    let echec = 0;
    for (const e of rapportCoherence.exportsIncomplets) {
      try {
        await exporterCommande.execute({ commandeId: e.commandeId });
        ok += 1;
      } catch {
        echec += 1;
      }
    }
    if (echec === 0) {
      toast.success(`${ok} commande${ok > 1 ? "s" : ""} ré-exportée${ok > 1 ? "s" : ""}`);
    } else {
      toast.warning(
        `${ok} ré-exportée${ok > 1 ? "s" : ""}, ${echec} échec${echec > 1 ? "s" : ""}`,
      );
    }
    await recharger();
    await chargerRapportCoherence();
    setActionCoherenceEnCours(false);
  }

  async function supprimerOrphelinsSelectionnes(): Promise<void> {
    const chemins = [...cheminsASupprimer];
    if (chemins.length === 0) return;
    setActionCoherenceEnCours(true);
    try {
      const r = await supprimerOrphelinsExport.execute({
        sessionId,
        cheminsAbsolus: chemins,
      });
      const suffixe =
        r.ignoresCarAttendus > 0
          ? ` · ${r.ignoresCarAttendus} ignoré${r.ignoresCarAttendus > 1 ? "s" : ""} (redevenu${r.ignoresCarAttendus > 1 ? "s" : ""} attendu${r.ignoresCarAttendus > 1 ? "s" : ""})`
          : "";
      toast.success(
        `${r.fichiersSupprimes} fichier${r.fichiersSupprimes > 1 ? "s" : ""} supprimé${r.fichiersSupprimes > 1 ? "s" : ""}${suffixe}`,
      );
      await recharger();
      await chargerRapportCoherence();
    } catch (err) {
      toast.error("Suppression impossible", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setActionCoherenceEnCours(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button variant="ghost" className="self-start" onClick={onRetour}>
          ← Retour aux sessions
        </Button>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold">{session.commanditaire}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {session.type} · {session.date.toLocaleDateString("fr-FR")}
            </span>
            <Button
              variant="outline"
              onClick={rescanner}
              disabled={rescanEnCours}
            >
              {rescanEnCours ? "Rescan…" : "Rescanner les photos"}
            </Button>
            <Button
              variant="outline"
              onClick={ouvrirControleCoherence}
              disabled={chargementCoherence}
            >
              Contrôler la cohérence
            </Button>
            <Button variant="outline" onClick={() => setEditionSession(true)}>
              Modifier
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Référent : {session.referent} · {session.nombrePhotos()} photo
          {session.nombrePhotos() > 1 ? "s" : ""}
        </p>
      </header>

      <RecapSession
        session={session}
        commandes={commandes}
        exporterSession={exporterSession}
        onExport={recharger}
      />

      <GrilleTarifaireEditor
        session={session}
        modifierPrix={modifierPrix}
        onMaj={recharger}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Acheteurs ({session.acheteurs.length})
          </h2>
          <div className="flex items-center gap-2">
            {session.acheteurs.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Trier par
                <select
                  value={triPar}
                  onChange={(e) =>
                    setTriPar(e.currentTarget.value as TriAcheteurs)
                  }
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {OPTIONS_TRI.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!nouvelAcheteurOuvert && (
              <Button onClick={() => setNouvelAcheteurOuvert(true)}>
                Nouvel acheteur
              </Button>
            )}
          </div>
        </div>

        {nouvelAcheteurOuvert && (
          <AcheteurForm
            onAnnuler={() => setNouvelAcheteurOuvert(false)}
            onSoumettre={async (valeurs) => {
              try {
                const ajoute = await ajouterAcheteur.execute({
                  sessionId: session.id,
                  ...valeurs,
                });
                toast.success("Acheteur inscrit", { description: ajoute.nom });
                setNouvelAcheteurOuvert(false);
                recharger();
              } catch (err) {
                toast.error("Inscription impossible", {
                  description: err instanceof Error ? err.message : String(err),
                });
              }
            }}
          />
        )}

        {session.acheteurs.length === 0 && !nouvelAcheteurOuvert && (
          <p className="text-sm text-muted-foreground">
            Aucun acheteur inscrit sur cette session.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {acheteursTries.map((a) =>
            acheteurEnEdition === a.id ? (
              <AcheteurForm
                key={a.id}
                valeursInitiales={{
                  nom: a.nom,
                  email: a.email?.valeur,
                  telephone: a.telephone,
                }}
                titre={`Modifier ${a.nom}`}
                libelleSubmit="Enregistrer"
                libelleSubmitEnCours="Enregistrement…"
                onAnnuler={() => setAcheteurEnEdition(null)}
                onSoumettre={async (valeurs) => {
                  try {
                    if (
                      slugVaChanger(a.nom, valeurs.nom) &&
                      commandeParAcheteur.has(a.id)
                    ) {
                      const ok = await new Promise<boolean>((resolve) => {
                        setConfirmationRenommage({
                          ancienNom: a.nom,
                          nouveauNom: valeurs.nom,
                          resoudre: resolve,
                        });
                      });
                      if (!ok) return;
                    }
                    const ancienEmail = a.email?.valeur;
                    const cmdAcheteur = commandeParAcheteur.get(a.id);
                    const { acheteur: modifie, fichiersRenommes } =
                      await modifierAcheteur.execute({
                        sessionId: session.id,
                        acheteurId: a.id,
                        ...valeurs,
                      });

                    // Rattrapage : si l'email vient d'être ajouté (vide
                    // → rempli) et que la commande contient au moins un
                    // tirage numérique, on déclenche l'export
                    // automatiquement pour livrer les fichiers digitaux
                    // qui n'avaient jamais pu être créés faute d'email.
                    const emailVientDEtreAjoute =
                      !ancienEmail && !!modifie.email?.valeur;
                    const aDuNumerique = !!cmdAcheteur?.tirages.some((t) =>
                      t.format.estNumerique(),
                    );
                    if (
                      emailVientDEtreAjoute &&
                      aDuNumerique &&
                      cmdAcheteur
                    ) {
                      try {
                        const r = await exporterCommande.execute({
                          commandeId: cmdAcheteur.id,
                        });
                        toast.success(
                          `Acheteur mis à jour · ${r.fichiersCrees} fichier${r.fichiersCrees > 1 ? "s" : ""} numérique${r.fichiersCrees > 1 ? "s" : ""} exporté${r.fichiersCrees > 1 ? "s" : ""}`,
                          { description: modifie.nom },
                        );
                      } catch (err) {
                        toast.warning(
                          "Acheteur mis à jour, mais l'export numérique automatique a échoué",
                          {
                            description:
                              err instanceof Error
                                ? err.message
                                : String(err),
                          },
                        );
                      }
                    } else {
                      toast.success("Acheteur mis à jour", {
                        description:
                          fichiersRenommes > 0
                            ? `${modifie.nom} · ${fichiersRenommes} fichier${fichiersRenommes > 1 ? "s" : ""} renommé${fichiersRenommes > 1 ? "s" : ""}`
                            : modifie.nom,
                      });
                    }
                    setAcheteurEnEdition(null);
                    recharger();
                  } catch (err) {
                    toast.error("Mise à jour impossible", {
                      description:
                        err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
              />
            ) : (
              <AcheteurCard
                key={a.id}
                acheteur={a}
                commande={commandeParAcheteur.get(a.id) ?? null}
                session={session}
                ajouterTirage={ajouterTirage}
                retirerTirage={retirerTirage}
                exporterCommande={exporterCommande}
                onModifier={() => setAcheteurEnEdition(a.id)}
                onMaj={recharger}
              />
            ),
          )}
        </div>
      </section>

      <Dialog
        open={confirmationRenommage !== null}
        onOpenChange={(open) => {
          if (!open && confirmationRenommage) {
            confirmationRenommage.resoudre(false);
            setConfirmationRenommage(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer les fichiers déjà exportés ?</DialogTitle>
            <DialogDescription>
              {confirmationRenommage && (
                <>
                  Le changement de nom «&nbsp;
                  <strong>{confirmationRenommage.ancienNom}</strong>&nbsp;» →
                  «&nbsp;<strong>{confirmationRenommage.nouveauNom}</strong>
                  &nbsp;» modifie le préfixe utilisé pour nommer les fichiers
                  exportés de cet acheteur. Les fichiers présents sur disque
                  sous l'ancien préfixe seront renommés automatiquement pour
                  suivre le nouveau nom. Aucune donnée n'est supprimée.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (confirmationRenommage) {
                  confirmationRenommage.resoudre(false);
                  setConfirmationRenommage(null);
                }
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (confirmationRenommage) {
                  confirmationRenommage.resoudre(true);
                  setConfirmationRenommage(null);
                }
              }}
            >
              Renommer et enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={coherenceOuverte}
        onOpenChange={(open) => {
          if (!open) {
            setCoherenceOuverte(false);
            setRapportCoherence(null);
            setCheminsASupprimer(new Set());
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Contrôle de cohérence</DialogTitle>
            <DialogDescription>
              Compare les commandes avec le contenu réel du dossier export.
              Le dossier source n'est jamais modifié.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto text-sm">
            {chargementCoherence && (
              <p className="text-muted-foreground">Analyse en cours…</p>
            )}
            {!chargementCoherence && rapportCoherence && (
              <>
                {rapportCoherence.photosFantomes.length === 0 &&
                  rapportCoherence.exportsIncomplets.length === 0 &&
                  rapportCoherence.orphelinsExport.length === 0 && (
                    <p className="text-muted-foreground">
                      Tout est cohérent, aucune action nécessaire.
                    </p>
                  )}

                {rapportCoherence.photosFantomes.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h4 className="font-semibold">
                      Photos fantômes ({rapportCoherence.photosFantomes.length})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Référencées dans une commande mais absentes du dossier
                      source.
                    </p>
                    <ul className="flex flex-col gap-0.5 text-xs">
                      {rapportCoherence.photosFantomes.map((f) => {
                        const ach = session.acheteurs.find(
                          (a) => a.id === f.acheteurId,
                        );
                        return (
                          <li
                            key={`${f.commandeId}-${f.photoNumero}`}
                            className="flex justify-between"
                          >
                            <span>
                              {ach?.nom ?? f.acheteurId} · photo n°
                              {f.photoNumero}
                            </span>
                            <span className="text-muted-foreground">
                              {f.tirageIds.length} tirage
                              {f.tirageIds.length > 1 ? "s" : ""}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={retirerTiragesFantomes}
                      disabled={actionCoherenceEnCours}
                      className="self-start"
                    >
                      Retirer tous ces tirages
                    </Button>
                  </section>
                )}

                {rapportCoherence.exportsIncomplets.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h4 className="font-semibold">
                      Exports à refaire (
                      {rapportCoherence.exportsIncomplets.length})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      La photo existe en source mais des fichiers d'export
                      manquent sur disque.
                    </p>
                    <ul className="flex flex-col gap-0.5 text-xs">
                      {rapportCoherence.exportsIncomplets.map((e) => {
                        const ach = session.acheteurs.find(
                          (a) => a.id === e.acheteurId,
                        );
                        return (
                          <li
                            key={e.commandeId}
                            className="flex justify-between"
                          >
                            <span>{ach?.nom ?? e.acheteurId}</span>
                            <span className="text-muted-foreground">
                              {e.fichiersManquants}/{e.fichiersAttendus} manquant
                              {e.fichiersManquants > 1 ? "s" : ""}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={reexporterCommandesIncompletes}
                      disabled={actionCoherenceEnCours}
                      className="self-start"
                    >
                      Ré-exporter les commandes concernées
                    </Button>
                  </section>
                )}

                {rapportCoherence.orphelinsExport.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h4 className="font-semibold">
                      Fichiers orphelins dans l'export (
                      {rapportCoherence.orphelinsExport.length})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Fichiers présents dans le dossier export qui ne
                      correspondent à aucune commande courante (tirages
                      retirés, acheteurs supprimés, anciens noms après
                      renommage…). Décoche ceux que tu veux garder.
                    </p>
                    <ul className="flex flex-col gap-0.5 text-xs">
                      {rapportCoherence.orphelinsExport.map((o) => {
                        const coche = cheminsASupprimer.has(o.cheminAbsolu);
                        const acheteur = o.acheteurIdConnu
                          ? session.acheteurs.find(
                              (a) => a.id === o.acheteurIdConnu,
                            )
                          : null;
                        const libelleAcheteur = acheteur
                          ? acheteur.nom
                          : "(acheteur supprimé)";
                        return (
                          <li key={o.cheminAbsolu}>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={coche}
                                onChange={(ev) => {
                                  setCheminsASupprimer((prev) => {
                                    const next = new Set(prev);
                                    if (ev.currentTarget.checked)
                                      next.add(o.cheminAbsolu);
                                    else next.delete(o.cheminAbsolu);
                                    return next;
                                  });
                                }}
                              />
                              <span>
                                {libelleAcheteur} · photo n°{o.photoNumero} ·{" "}
                                {o.sousDossier} · ex. {o.exemplaire}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={supprimerOrphelinsSelectionnes}
                      disabled={
                        actionCoherenceEnCours ||
                        cheminsASupprimer.size === 0
                      }
                      className="self-start"
                    >
                      Supprimer {cheminsASupprimer.size} fichier
                      {cheminsASupprimer.size > 1 ? "s" : ""}
                    </Button>
                  </section>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCoherenceOuverte(false)}
              disabled={actionCoherenceEnCours}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function slugVaChanger(ancienNom: string, nouveauNom: string): boolean {
  try {
    return (
      slugifierNomAcheteur(ancienNom) !== slugifierNomAcheteur(nouveauNom)
    );
  } catch {
    return false;
  }
}

function RecapSession({
  session,
  commandes,
  exporterSession,
  onExport,
}: {
  session: Session;
  commandes: readonly Commande[];
  exporterSession: ExporterSessionUseCase;
  onExport: () => void;
}) {
  const [exportEnCours, setExportEnCours] = useState(false);

  const caTotal = commandes.reduce(
    (somme, c) => somme.ajouter(c.total(session.grilleTarifaire)),
    new Montant(0),
  );
  const tiragesTotal = commandes.reduce((n, c) => n + c.nombreTirages(), 0);
  const acheteursActifs = commandes.filter((c) => !c.estVide()).length;

  if (commandes.length === 0) return null;

  async function exporterTout(): Promise<void> {
    if (commandes.length > 3) {
      const confirme = window.confirm(
        `Exporter les ${commandes.length} commandes de cette session vers ${session.dossierExport.valeur} ?`,
      );
      if (!confirme) return;
    }
    setExportEnCours(true);
    try {
      const r = await exporterSession.execute({ sessionId: session.id });
      const cheminMsg = session.dossierExport.valeur;
      const descriptionBase =
        r.orphelinsSupprimes > 0
          ? `${cheminMsg}\n${r.orphelinsSupprimes} orphelin${r.orphelinsSupprimes > 1 ? "s" : ""} nettoyé${r.orphelinsSupprimes > 1 ? "s" : ""}`
          : cheminMsg;
      if (r.erreurs.length === 0) {
        toast.success(
          `${r.commandesReussies} commande${r.commandesReussies > 1 ? "s" : ""} · ${r.fichiersCrees} fichier${r.fichiersCrees > 1 ? "s" : ""} exporté${r.fichiersCrees > 1 ? "s" : ""}`,
          { description: descriptionBase },
        );
      } else {
        const details = r.erreurs
          .map((e) => {
            const ach = session.acheteurs.find((a) => a.id === e.acheteurId);
            return `• ${ach?.nom ?? e.acheteurId} : ${e.message}`;
          })
          .join("\n");
        const descriptionErreurs =
          r.orphelinsSupprimes > 0
            ? `${r.orphelinsSupprimes} orphelin${r.orphelinsSupprimes > 1 ? "s" : ""} nettoyé${r.orphelinsSupprimes > 1 ? "s" : ""}\n${details}`
            : details;
        toast.warning(
          `${r.commandesReussies}/${r.commandesTotales} commandes exportées · ${r.fichiersCrees} fichier${r.fichiersCrees > 1 ? "s" : ""}`,
          { description: descriptionErreurs, duration: 10000 },
        );
      }
    } catch (err) {
      toast.error("Export de la session impossible", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExportEnCours(false);
      // Recharge toujours : certaines commandes peuvent avoir leur
      // statut muté (complet ou erreur) même si la promesse globale rejette.
      onExport();
    }
  }

  const statutSession = StatutExport.agreger(commandes.map((c) => c.statut));

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Récapitulatif</h2>
          <StatutBadge statut={statutSession} />
        </div>
        <Button onClick={exporterTout} disabled={exportEnCours}>
          {exportEnCours
            ? "Export…"
            : `Exporter toute la session (${commandes.length})`}
        </Button>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Chiffre d'affaires</dt>
          <dd className="text-lg font-semibold">{caTotal.toString()}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Tirages</dt>
          <dd className="text-lg font-semibold">{tiragesTotal}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">
            Acheteurs actifs / total
          </dt>
          <dd className="text-lg font-semibold">
            {acheteursActifs} / {session.acheteurs.length}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function AcheteurCard({
  acheteur,
  commande,
  session,
  ajouterTirage,
  retirerTirage,
  exporterCommande,
  onModifier,
  onMaj,
}: {
  acheteur: Acheteur;
  commande: Commande | null;
  session: Session;
  ajouterTirage: AjouterTirageACommandeUseCase;
  retirerTirage: RetirerTirageDeCommandeUseCase;
  exporterCommande: ExporterCommandeUseCase;
  onModifier: () => void;
  onMaj: () => void;
}) {
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);

  const nombreTirages = commande?.nombreTirages() ?? 0;
  const total = commande?.total(session.grilleTarifaire) ?? new Montant(0);

  const aDuNumeriqueSansEmail =
    !acheteur.email &&
    !!commande?.tirages.some((t) => t.format.estNumerique());

  async function exporter(): Promise<void> {
    if (!commande) return;
    setExportEnCours(true);
    try {
      const r = await exporterCommande.execute({ commandeId: commande.id });
      const description =
        r.orphelinsSupprimes > 0
          ? `${session.dossierExport.valeur}\n${r.orphelinsSupprimes} orphelin${r.orphelinsSupprimes > 1 ? "s" : ""} nettoyé${r.orphelinsSupprimes > 1 ? "s" : ""}`
          : session.dossierExport.valeur;
      toast.success(
        `${r.fichiersCrees} fichier${r.fichiersCrees > 1 ? "s" : ""} exporté${r.fichiersCrees > 1 ? "s" : ""}`,
        { description },
      );
    } catch (err) {
      toast.error("Export échoué", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExportEnCours(false);
      // Recharge la session dans les deux cas : le statut de la commande a
      // été muté côté repo (complet sur succès, erreur sur échec) par le
      // use case, l'UI doit le refléter.
      onMaj();
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{acheteur.nom}</h3>
            {commande && <StatutBadge statut={commande.statut} />}
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {acheteur.email && <span>{acheteur.email.valeur}</span>}
            {acheteur.telephone && <span>{acheteur.telephone}</span>}
            {!acheteur.email && !acheteur.telephone && (
              <span>aucun contact</span>
            )}
          </div>
          {commande?.statut.estEnErreur() && commande.statut.messageErreur && (
            <p className="text-xs text-destructive">
              {commande.statut.messageErreur}
            </p>
          )}
          {aDuNumeriqueSansEmail && (
            <p className="flex items-center gap-1.5 text-xs text-amber-500">
              <TriangleAlertIcon className="size-3.5" />
              Email requis pour livrer le numérique. L'export sera lancé
              automatiquement dès que l'email sera renseigné.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {commande && (
            <span className="text-xs text-muted-foreground">
              {nombreTirages} tirage{nombreTirages > 1 ? "s" : ""} ·{" "}
              {total.toString()}
            </span>
          )}
          <Button variant="ghost" onClick={onModifier}>
            Modifier
          </Button>
          {!ajoutOuvert && (
            <Button variant="outline" onClick={() => setAjoutOuvert(true)}>
              Ajouter des photos
            </Button>
          )}
        </div>
      </header>

      {ajoutOuvert && (
        <AjouterTiragesForm
          session={session}
          acheteurId={acheteur.id}
          ajouterTirage={ajouterTirage}
          onAjoutes={() => {
            setAjoutOuvert(false);
            onMaj();
          }}
          onAnnuler={() => setAjoutOuvert(false)}
        />
      )}

      {commande && commande.tirages.length > 0 && (
        <>
          <ul className="flex flex-col gap-2 border-t border-border/50 pt-3">
            {commande.tirages.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <div className="flex flex-1 flex-col">
                  <span className="text-sm">
                    Photo n°{t.photoNumero} · {t.format.toDossierName()} · ×
                    {t.quantite}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.montantUnitaire(session.grilleTarifaire).toString()} /
                    tirage → {t.total(session.grilleTarifaire).toString()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const confirme = window.confirm(
                      `Retirer la photo n°${t.photoNumero} (${t.format.toDossierName()} · ×${t.quantite}) ?`,
                    );
                    if (!confirme) return;
                    try {
                      const r = await retirerTirage.execute({
                        commandeId: commande.id,
                        tirageId: t.id,
                      });
                      toast.success(
                        r.commandeSupprimee
                          ? "Dernière photo retirée — commande supprimée"
                          : "Photo retirée",
                      );
                      onMaj();
                    } catch (err) {
                      toast.error("Retrait impossible", {
                        description:
                          err instanceof Error ? err.message : String(err),
                      });
                    }
                  }}
                >
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t border-border pt-3">
            <Button onClick={exporter} disabled={exportEnCours}>
              {exportEnCours ? "Export…" : "Exporter la commande"}
            </Button>
          </div>
        </>
      )}
    </article>
  );
}
