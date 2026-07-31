PUBL.IA GOVERNANÇA — BASELINE V15.7

Objetivo
- Garantir que a recarga de conversas use exatamente o snapshot governance_result persistido pelo backend.
- Impedir que o cliente reconstrua ou reclassifique Base legal, Fontes consultadas e Canais oficiais em mensagens novas.

Regra de leitura
1. governance_result (fonte de verdade para mensagens v15.7)
2. metadata.references (compatibilidade histórica)
3. metadata.sources (compatibilidade histórica mais antiga)

Validação
- npm run validate:baseline
- npm run typecheck

Nenhuma regra de recuperação, classificação temática, autenticação, RLS, rate limit, streaming ou geração foi alterada nesta versão.
