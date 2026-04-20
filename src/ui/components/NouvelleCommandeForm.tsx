import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/ui/components/ui/button";
import type { Session } from "@/domain/entities/Session";
import type { PasserCommandeUseCase } from "@/domain/usecases/PasserCommande";
import { Format } from "@/domain/value-objects/Format";

interface Props {
  session: Session;
  acheteurId: string;
  passerCommande: PasserCommandeUseCase;
  onAjoutees: () => void;
  onAnnuler: () => void;
}

export function NouvelleCommandeForm({
  session,
  acheteurId,
  passerCommande,
  onAjoutees,
  onAnnuler,
}: Props) {
  const [photosSaisie, setPhotosSaisie] = useState("");
  const [format, setFormat] = useState<string>(Format.TOUS[0].toDossierName());
  const [quantite, setQuantite] = useState("1");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setEnCours(true);
    try {
      const numeros = parserNumerosPhotos(photosSaisie);
      if (numeros.length === 0) {
        throw new Error(
          "Indique au moins un numéro de photo (ex : 145 ou 1,3,155).",
        );
      }
      const quantiteNum = Number(quantite);
      let creees = 0;
      for (const n of numeros) {
        await passerCommande.execute({
          sessionId: session.id,
          acheteurId,
          photoNumero: n,
          format,
          quantite: quantiteNum,
        });
        creees += 1;
      }
      toast.success(
        `${creees} commande${creees > 1 ? "s" : ""} créée${creees > 1 ? "s" : ""}`,
        { description: `Format ${format} · quantité ${quantiteNum} par photo` },
      );
      onAjoutees();
    } catch (err) {
      toast.error("Création de commande impossible", {
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
      <h4 className="text-sm font-semibold">Nouvelle commande</h4>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Photo(s)
          <input
            type="text"
            value={photosSaisie}
            onChange={(e) => setPhotosSaisie(e.currentTarget.value)}
            placeholder="145 ou 1,3,155"
            required
            autoFocus
            className="min-w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.currentTarget.value)}
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
            value={quantite}
            onChange={(e) => setQuantite(e.currentTarget.value)}
            required
            className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onAnnuler}>
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={enCours || session.photos.length === 0}
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

/**
 * Accepte "145", "1,3,155", "  7 , 12 ,3  ". Rejette tout ce qui n'est pas
 * entier ≥ 1. Dédoublonne en préservant l'ordre de saisie.
 */
function parserNumerosPhotos(saisie: string): number[] {
  const morceaux = saisie
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const numeros: number[] = [];
  const vus = new Set<number>();
  for (const m of morceaux) {
    const n = Number(m);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(
        `"${m}" n'est pas un numéro de photo valide (entier ≥ 1 attendu).`,
      );
    }
    if (!vus.has(n)) {
      vus.add(n);
      numeros.push(n);
    }
  }
  return numeros;
}
