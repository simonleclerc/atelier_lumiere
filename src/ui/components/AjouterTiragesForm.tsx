import { useMemo, useState } from "react";
import { CheckIcon, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/components/ui/popover";
import { cn } from "@/ui/lib/utils";
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
  const [photosSaisie, setPhotosSaisie] = useState("");
  const [format, setFormat] = useState<string>(Format.TOUS[0].toDossierName());
  const [quantite, setQuantite] = useState("1");
  const [enCours, setEnCours] = useState(false);
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);

  // Les numéros valides dans la saisie courante. Si l'utilisateur est
  // en train de taper "1,3,a,5", on garde [1, 3, 5] comme sélection
  // visible dans le popover — la validation stricte se fait au submit.
  const numerosSelectionnes = useMemo(
    () => parserNumerosPhotosTolerant(photosSaisie),
    [photosSaisie],
  );
  const setSelectionnes = new Set(numerosSelectionnes);

  function toggleNumero(n: number): void {
    const present = setSelectionnes.has(n);
    const nouveaux = present
      ? numerosSelectionnes.filter((x) => x !== n)
      : [...numerosSelectionnes, n];
    setPhotosSaisie(nouveaux.join(","));
  }

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
      for (const n of numeros) {
        await ajouterTirage.execute({
          sessionId: session.id,
          acheteurId,
          photoNumero: n,
          format,
          quantite: quantiteNum,
        });
      }
      toast.success(
        `${numeros.length} photo${numeros.length > 1 ? "s" : ""} ajoutée${numeros.length > 1 ? "s" : ""}`,
        { description: `Format ${format} · quantité ${quantiteNum} par photo` },
      );
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
          <div className="flex items-stretch gap-1">
            <input
              type="text"
              value={photosSaisie}
              onChange={(e) => setPhotosSaisie(e.currentTarget.value)}
              placeholder="145 ou 1,3,155"
              required
              autoFocus
              className="min-w-[140px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Popover open={selecteurOuvert} onOpenChange={setSelecteurOuvert}>
              <PopoverTrigger
                type="button"
                disabled={session.photos.length === 0}
                aria-label="Parcourir les photos"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "shrink-0 px-3 py-2",
                )}
              >
                <ImageIcon className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Rechercher un numéro…" />
                  <CommandList>
                    <CommandEmpty>Aucune photo trouvée.</CommandEmpty>
                    <CommandGroup>
                      {session.photos.map((p) => {
                        const selectionne = setSelectionnes.has(p.numero);
                        return (
                          <CommandItem
                            key={p.numero}
                            value={String(p.numero)}
                            onSelect={() => toggleNumero(p.numero)}
                          >
                            <CheckIcon
                              className={cn(
                                "size-4",
                                selectionne ? "opacity-100" : "opacity-0",
                              )}
                            />
                            Photo n°{p.numero}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                  <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    <span>
                      {numerosSelectionnes.length} photo
                      {numerosSelectionnes.length > 1 ? "s" : ""} sélectionnée
                      {numerosSelectionnes.length > 1 ? "s" : ""}
                    </span>
                    {numerosSelectionnes.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => setPhotosSaisie("")}
                      >
                        Tout désélectionner
                      </button>
                    )}
                  </div>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
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

/**
 * Version tolérante pour nourrir le popover pendant la frappe : ignore
 * les morceaux invalides au lieu de lever. Sert uniquement à calculer
 * l'état visuel du sélecteur tant que l'utilisateur tape ; la
 * validation stricte reste `parserNumerosPhotos` au submit.
 */
function parserNumerosPhotosTolerant(saisie: string): number[] {
  const numeros: number[] = [];
  const vus = new Set<number>();
  for (const m of saisie.split(",")) {
    const trim = m.trim();
    if (!trim) continue;
    const n = Number(trim);
    if (!Number.isInteger(n) || n < 1) continue;
    if (!vus.has(n)) {
      vus.add(n);
      numeros.push(n);
    }
  }
  return numeros;
}
