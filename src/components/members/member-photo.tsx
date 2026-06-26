"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import { MemberAvatar } from "@/components/members/member-avatar";

/**
 * A member avatar that, when it has a real photo, is clickable to view the full
 * image in a lightbox. Falls back to a plain (non-clickable) avatar when there's
 * no photo. The overlay is portaled to <body> because the surrounding `.glass`
 * cards use backdrop-filter, which would otherwise trap a fixed overlay inside
 * the card instead of covering the viewport.
 */
export function MemberPhoto({
  name,
  photoUrl,
  size = "lg",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "default" | "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // lock scroll while open
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!photoUrl) return <MemberAvatar name={name} photoUrl={photoUrl} size={size} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View photo"
        aria-label={`View ${name}'s photo`}
        className="cursor-pointer rounded-full transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <MemberAvatar name={name} photoUrl={photoUrl} size={size} />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${name}'s photo`}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <XIcon className="size-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
