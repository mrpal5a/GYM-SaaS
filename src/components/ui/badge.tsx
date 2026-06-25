import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        muted: "border-border bg-muted text-muted-foreground",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        danger:
          "border-destructive/20 bg-destructive/10 text-destructive",
        primary: "border-primary/20 bg-primary/10 text-primary",
      },
    },
    defaultVariants: { tone: "muted" },
  }
)

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
