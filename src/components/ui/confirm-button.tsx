"use client";
import { Button } from "@/components/ui/button";

// A submit button that asks for confirmation before letting its parent <form>
// submit. Lets a server component keep `<form action={serverAction}>` while still
// guarding destructive actions.
export function ConfirmButton({
  message,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { message: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
