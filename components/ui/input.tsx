import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  variant?: "default" | "small"
}

function Input({ className, type, style, variant = "default", ...props }: InputProps) {
  const numberInputStyle = type === "number" 
    ? { 
        ...style,
        MozAppearance: "textfield" as const,
      }
    : style;

  const variantClasses = variant === "small" 
    ? "h-7 px-2 py-0.5 text-sm"
    : "h-9 px-3 py-1 text-base md:text-sm";

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses,
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        type === "number" && "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0",
        className
      )}
      style={numberInputStyle}
      {...props}
    />
  )
}

export { Input }
