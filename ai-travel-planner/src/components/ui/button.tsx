"use client";
import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "md", ...props }, ref) => {
    const base =
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";
    const variants = {
        default:
            "bg-[var(--primary-500)] text-[var(--neutral-900)] hover:bg-[var(--primary-600)] focus-visible:ring-[color:var(--primary-400)]",
        outline:
            "border border-gray-300 text-[var(--neutral-900)] hover:bg-[var(--primary-100)] hover:border-[color:var(--primary-300)] focus-visible:ring-[color:var(--primary-400)]",
        ghost: "text-[var(--neutral-900)] hover:bg-gray-100 focus-visible:ring-[color:var(--neutral-400)]",
    } as const;
    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-6 text-base",
    } as const;
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
