import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/ui/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/ui/components/ui/combobox";
import type { Session } from "@/domain/entities/Session";
import type { AjouterTirageACommandeUseCase } from "@/domain/usecases/AjouterTirageACommande";
import { Format } from "@/domain/value-objects/Format";

interface Props {
  session: Session;
  acheteurId: string;
  ajouterTirage: AjouterTirageACommandeUseCase;
  onAjoutes: () => void;
  onAnnuler: () => void;
}

export function AjouterTiragesForm({
  session,
  acheteurId,
  ajouterTirage,
  onAjoutes,
  onAnnuler,
}: Props) {
  const [numerosSelectionnes, setNumerosSelectionnes] = useState<number[]>([]);
  const [format, setFormat] = useState<string>(Format.TOUS[0].toDossierName());
  const [quantite, setQuantite] = useState("1");
  const [enCours, setEnCours] = useState(false);

  const items = session.photos.map((p) => p.numero);
  const formatEstNumerique = Format.depuis(format).estNumerique();

  function changerFormat(nouveauFormat: string): void {
    setFormat(nouveauFormat);
    // Invariant métier : un fichier numérique = 1 exemplaire max.
    // On reset la quantité pour éviter que l'utilisateur soumette un
    // formulaire déjà invalide depuis un précédent choix.
    if (Format.depuis(nouveauFormat).estNumerique()) {
      setQuantite("1");
    }
  }

  async function soumettre(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setEnCours(true);
    try {
      if (numerosSelectionnes.length === 0) {
        throw new Error("Sélectionne au moins une photo.");
      }
      const quantiteNum = Number(quantite);
      for (const n of numerosSelectionnes) {
        await ajouterTirage.execute({
          sessionId: session.id,
          acheteurId,
          photoNumero: n,
          format,
          quantite: quantiteNum,
        });
      }
      const nb = numerosSelectionnes.length;
      toast.success(`${nb} photo${nb > 1 ? "s" : ""} ajoutée${nb > 1 ? "s" : ""}`, {
        description: `Format ${format} · quantité ${quantiteNum} par photo`,
      });
      onAjoutes();
    } catch (err) {
      toast.error("Ajout impossible", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={soumettre}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <h4 className="text-sm font-semibold">Ajouter des photos</h4>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Photo(s)
          <Combobox
            items={items}
            multiple
            value={numerosSelectionnes}
            onValueChange={setNumerosSelectionnes}
          >
            <ComboboxChips>
              <ComboboxValue>
                {numerosSelectionnes.map((n) => (
                  <ComboboxChip key={n}>n°{n}</ComboboxChip>
                ))}
              </ComboboxValue>
              <ComboboxChipsInput
                placeholder={
                  numerosSelectionnes.length === 0
                    ? "Chercher un numéro…"
                    : ""
                }
                autoFocus
                disabled={session.photos.length === 0}
              />
            </ComboboxChips>
            <ComboboxContent>
              <ComboboxEmpty>Aucune photo trouvée.</ComboboxEmpty>
              <ComboboxList>
                {(n: number) => (
                  <ComboboxItem key={n} value={n}>
                    Photo n°{n}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Format
          <select
            value={format}
            onChange={(e) => changerFormat(e.currentTarget.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Format.TOUS.map((f) => {
              const nom = f.toDossierName();
              return (
                <option key={nom} value={nom}>
                  {nom} ({session.grilleTarifaire.prixPour(f).toString()})
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Quantité
          <input
            type="number"
            min={1}
            max={formatEstNumerique ? 1 : undefined}
            value={quantite}
            onChange={(e) => setQuantite(e.currentTarget.value)}
            disabled={formatEstNumerique}
            required
            className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
      </div>
      {formatEstNumerique && (
        <p className="text-xs text-muted-foreground">
          Le format numérique est livré en 1 exemplaire par photo — un
          fichier digital ne se duplique pas.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onAnnuler}>
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={
            enCours ||
            session.photos.length === 0 ||
            numerosSelectionnes.length === 0
          }
        >
          {enCours ? "…" : "Ajouter"}
        </Button>
      </div>
      {session.photos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucune photo détectée dans le dossier source de cette session.
        </p>
      )}
    </form>
  );
}
