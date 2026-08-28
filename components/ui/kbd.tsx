import * as React from "react";
import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 max-h-full items-center justify-center gap-0.5 rounded border border-border bg-muted/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none shadow-xs",
        className
      )}
      {...props}
    />
  );
}

export { Kbd };
