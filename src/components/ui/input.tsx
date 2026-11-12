import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, autoCapitalize, ...props }, ref) => {
    // Capitalize the first letter for free-text fields. Opt out with
    // autoCapitalize="none" (emails-as-text, passwords, codes, search).
    const shouldCap = (type === undefined || type === "text") && autoCapitalize !== "none" && autoCapitalize !== "off";
    const handleChange = shouldCap
      ? (e: React.ChangeEvent<HTMLInputElement>) => {
          const v = e.target.value;
          if (v && v[0] !== v[0].toUpperCase()) e.target.value = v[0].toUpperCase() + v.slice(1);
          onChange?.(e);
        }
      : onChange;
    return (
      <input
        type={type}
        ref={ref}
        autoCapitalize={autoCapitalize}
        onChange={handleChange}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
