PUBL.IA GOVERNANÇA V15.0 — SANEAMENTO ARQUITETURAL

Esta atualização remove o pipeline governance-v2 e ativa apenas src/lib/governance-core.
A rota deixa de importar classificadores, recoveries, bundles e finalizadores legados.
O cliente deixa de criar links jurídicos e institucionais por regex.
Mensagens novas persistem governance_result com Base legal, evidências e canais separados.

Antes da extração, remova src/lib/governance-v2.
Depois execute npm run validate:governance-v15 e npm run typecheck.
