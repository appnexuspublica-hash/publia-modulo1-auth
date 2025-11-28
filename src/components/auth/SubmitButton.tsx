"use client";

import { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loadingText?: string;
}

const SubmitButton = ({
  children,
  loadingText = "Enviando...",
  className = "",
  disabled,
  ...rest
}: SubmitButtonProps) => {
  const { pending } = useFormStatus();

  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={
        "inline-flex h-11 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" +
        (className ? " " + className : "")
      }
      {...rest}
    >
      {pending ? loadingText : children}
    </button>
  );
};

export default SubmitButton;
