PUBL.IA GOVERNANÇA — BASELINE V15.9

Objetivo
Eliminar a dupla classificação da mesma pergunta no fluxo ativo.

Regra consolidada
A rota cria um único GovernanceQueryPlan. Esse mesmo objeto controla:
- decisão de pesquisa oficial;
- seleção de provedores;
- instrução temática;
- formato da resposta;
- telemetria;
- orquestração de evidências.

Nenhum comportamento de resposta foi deliberadamente alterado.

Validação
npm run validate:baseline
npm run typecheck
