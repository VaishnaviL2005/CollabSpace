import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm",
          // Placeholder
          "placeholder:text-muted-foreground",
          // File input styles
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Focus styles - accessible focus ring
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-0 focus-visible:shadow-none",
          // Hover state
          "hover:border-muted-foreground/50",
          // Transition
          "transition-colors duration-200",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
          // Default border
          error ? "border-destructive focus-visible:ring-destructive" : "border-input",
          className,
        )}
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
