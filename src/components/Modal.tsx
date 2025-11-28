
"use client";
import { ReactNode } from "react";
export default function Modal({ open, title, children, onClose }:{open:boolean; title:string; children:ReactNode; onClose:()=>void}){
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="card p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <div className="text-sm text-gray-700 mb-4">{children}</div>
        <div className="text-right"><button className="btn" onClick={onClose}>OK</button></div>
      </div>
    </div>
  );
}

