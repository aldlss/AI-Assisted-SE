"use client";
import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, id, ...props }, ref) => {
    const inner = (
      <input
        id={id}
        ref={ref}
        className={`block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        {...props}
      />
    );
    if (!label) return inner;
    return (
      <label className="grid gap-1">
        <span className="text-sm text-gray-700">{label}</span>
        {inner}
      </label>
    );
  }
);
Input.displayName = "Input";
