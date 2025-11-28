"use client";

import { forwardRef, InputHTMLAttributes, useState } from "react";

interface AuthPasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const AuthPasswordInput = forwardRef<HTMLInputElement, AuthPasswordInputProps>(
  ({ label, error, className = "", ...rest }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            type={visible ? "text" : "password"}
            className={
              "w-full h-11 rounded-md border border-gray-300 bg-white px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" +
              (className ? " " + className : "")
            }
            {...rest}
          />

          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-2 flex items-center text-xs text-gray-500 hover:text-gray-700"
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthPasswordInput.displayName = "AuthPasswordInput";

export default AuthPasswordInput;
