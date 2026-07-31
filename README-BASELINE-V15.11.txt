PUBL.IA GOVERNANÇA — BASELINE V15.11

Objetivo
Eliminar cópias paralelas de fontes e referências nas mensagens novas.

Contrato canônico
metadata.governance_result
- legal_references
- evidence_sources
- consultation_channels
- evidence_status

Compatibilidade
O cliente continua lendo metadata.references e metadata.sources apenas em mensagens antigas que não possuem governance_result.

Validação
npm run validate:baseline
npm run typecheck
