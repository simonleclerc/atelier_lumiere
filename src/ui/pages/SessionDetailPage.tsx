import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/ui/components/ui/button";
import { AcheteurForm } from "@/ui/components/AcheteurForm";
import { AjouterTiragesForm } from "@/ui/components/AjouterTiragesForm";
import { GrilleTarifaireEditor } from "@/ui/components/GrilleTarifaireEditor";
import { SessionForm } from "@/ui/components/SessionForm";
import type { Acheteur } from "@/domain/entities/Acheteur";
import type { Commande } from "@/domain/entities/Commande";
import type { Session } from "@/domain/entities/Session";
import { Montant } from "@/domain/value-objects/Montant";
import type { AjouterAcheteurASessionUseCase } from "@/domain/usecases/AjouterAcheteurASession";
import type { AjouterTirageACommandeUseCase } from "@/domain/usecases/AjouterTirageACommande";
import type { ExporterCommandeUseCase } from "@/domain/usecases/ExporterCommande";
import type { ExporterSessionUseCase } from "@/domain/usecases/ExporterSession";
import type { ListerCommandesDeSessionUseCase } from "@/domain/usecases/ListerCommandesDeSession";
import type { ModifierAcheteurUseCase } from "@/domain/usecases/ModifierAcheteur";
import type { ModifierInfosSessionUseCase } from "@/domain/usecases/ModifierInfosSession";
import type { ModifierPrixSessionUseCase } from "@/domain/usecases/ModifierPrixSession";
import type { RetirerTirageDeCommandeUseCase } from "@/domain/usecases/RetirerTirageDeCommande";
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
                    const modifie = await modifierAcheteur.execute({
                      sessionId: session.id,
                      acheteurId: a.id,
                      ...valeurs,
                    });
                    toast.success("Acheteur mis à jour", {
                      description: modifie.nom,
                    });
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
    </section>
  );
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
      if (r.erreurs.length === 0) {
        toast.success(
          `${r.commandesReussies} commande${r.commandesReussies > 1 ? "s" : ""} · ${r.fichiersCrees} fichier${r.fichiersCrees > 1 ? "s" : ""} exporté${r.fichiersCrees > 1 ? "s" : ""}`,
          { description: cheminMsg },
        );
      } else {
        const details = r.erreurs
          .map((e) => {
            const ach = session.acheteurs.find((a) => a.id === e.acheteurId);
            return `• ${ach?.nom ?? e.acheteurId} : ${e.message}`;
          })
          .join("\n");
        toast.warning(
          `${r.commandesReussies}/${r.commandesTotales} commandes exportées · ${r.fichiersCrees} fichier${r.fichiersCrees > 1 ? "s" : ""}`,
          { description: details, duration: 10000 },
        );
      }
      onExport();
    } catch (err) {
      toast.error("Export de la session impossible", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Récapitulatif</h2>
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

  async function exporter(): Promise<void> {
    if (!commande) return;
    setExportEnCours(true);
    try {
      const r = await exporterCommande.execute({ commandeId: commande.id });
      toast.success(
        `${r.fichiersCrees} fichier${r.fichiersCrees > 1 ? "s" : ""} exporté${r.fichiersCrees > 1 ? "s" : ""}`,
        { description: session.dossierExport.valeur },
      );
    } catch (err) {
      toast.error("Export échoué", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-base font-semibold">{acheteur.nom}</h3>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {acheteur.email && <span>{acheteur.email.valeur}</span>}
            {acheteur.telephone && <span>{acheteur.telephone}</span>}
            {!acheteur.email && !acheteur.telephone && (
              <span>aucun contact</span>
            )}
          </div>
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
