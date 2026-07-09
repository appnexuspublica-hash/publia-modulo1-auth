// src/app/governanca/components/GovernanceFooter.tsx
"use client";

const footerLinks = [
  {
    label: "Sobre o Publ.IA",
    href: "https://nexuspublica.com.br/publia",
  },
  {
    label: "Termos de Uso",
    href: "https://nexuspublica.com.br/termos-de-uso",
  },
  {
    label: "Política de Privacidade",
    href: "https://nexuspublica.com.br/politica-de-privacidade",
  },
  {
    label: "Fale Conosco",
    href: "https://nexuspublica.com.br/contato",
  },
];

export default function GovernanceFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-[#dedede] pt-5 text-center text-xs text-slate-500">
      <p className="font-medium text-slate-600">
        © {currentYear} Nexus Pública • Publ.IA Governança v3.0
      </p>

      <nav
        aria-label="Links institucionais do Publ.IA"
        className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
      >
        {footerLinks.map((link, index) => (
          <span key={link.href} className="inline-flex items-center gap-3">
            {index > 0 ? (
              <span aria-hidden="true" className="text-slate-300">
                •
              </span>
            ) : null}

            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-500 transition hover:text-[#0f3a4a]"
            >
              {link.label}
            </a>
          </span>
        ))}
      </nav>
    </footer>
  );
}
