PUBL.IA GOVERNANÇA — BASELINE V15.8

Objetivo
Consolidar um único contrato compartilhado para persistência e reidratação
do resultado do Governança.

Invariantes
- backend cria governance_result pelo mesmo módulo usado para leitura;
- cliente valida e normaliza o snapshot antes de renderizar;
- Base legal, evidências e canais permanecem separados;
- itens inválidos e duplicados são descartados;
- metadata legado só é usado quando governance_result não existe.

Validação
npm run validate:baseline
npm run typecheck
