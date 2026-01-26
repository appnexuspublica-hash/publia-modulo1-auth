
"use client";
import { useState } from "react";
export default function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <input {...props} type={show ? "text" : "password"} className="input flex-1" />
      <button type="button" className="btn" onClick={() => setShow(s=>!s)}>{show?"Ocultar":"Mostrar"}</button>
    </div>
  );
}

