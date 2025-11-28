"use client";

import { forwardRef, InputHTMLAttributes } from "react";

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, className = "", ...rest }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}

        <input
          ref={ref}
          className={
            "w-full h-11 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" +
            (className ? " " + className : "")
          }
          {...rest}
        />

        {error && (
          <p className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";

export default AuthInput;
