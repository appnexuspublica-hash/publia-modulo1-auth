Governança v15.1 — núcleo temático e recuperação institucional estável

Principais alterações:
- pacote jurídico compartilhado para contratação direta, dispensa por valor e fracionamento;
- Lei nº 14.133/2021 e Decreto nº 12.807/2025 usados de forma consistente;
- valores vigentes em 2026 consolidados no contexto jurídico;
- recuperação institucional não depende mais exclusivamente de indexing_status='indexed';
- chunks ativos ou pendentes de documentos aprovados podem ser consultados;
- extracted_text participa sempre do ranking de trechos;
- respostas sem documento institucional não podem preencher a lacuna com regras genéricas;
- documentos longos são resumidos por padrão, salvo pedido de transcrição integral.

Validação:
  npm run validate:governance-v15.1
  npm run typecheck
