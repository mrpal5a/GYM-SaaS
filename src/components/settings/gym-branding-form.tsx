"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateGymBrandingAction } from "@/actions/gym";
import { resizeImageFile } from "@/lib/images/resize";

export function GymBrandingForm({
  name,
  logoUrl,
  address,
}: {
  name: string;
  logoUrl: string | null;
  address: string | null;
}) {
  const [state, action, pending] = useActionState(updateGymBrandingAction, null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) toast.success("Branding updated");
  }, [state]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(logoUrl);
      return;
    }
    setProcessing(true);
    try {
      const resized = await resizeImageFile(file, 512);
      // Replace the input's file with the downscaled one so the form submits it.
      const dt = new DataTransfer();
      dt.items.add(resized);
      if (inputRef.current) inputRef.current.files = dt.files;
      setPreview(URL.createObjectURL(resized));
    } catch {
      setPreview(URL.createObjectURL(file));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Gym name</Label>
        <Input id="name" name="name" required defaultValue={name} maxLength={120} />
        <p className="text-xs text-muted-foreground">
          Shown in the app header and on every invoice.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          rows={2}
          maxLength={300}
          defaultValue={address ?? ""}
          placeholder="12 MG Road, Indiranagar, Bengaluru 560038"
        />
        <p className="text-xs text-muted-foreground">
          Shown in the header of each member&apos;s joining form.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="logo">Logo</Label>
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40">
            {preview ? (
              <Image
                src={preview}
                alt="Logo preview"
                width={64}
                height={64}
                className="size-16 object-cover"
                unoptimized
              />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <Input
            ref={inputRef}
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {processing
            ? "Optimizing image…"
            : "Any image works — it's auto-resized to a 512px logo before upload."}
        </p>
      </div>

      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || processing}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
