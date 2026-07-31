PUBL.IA GOVERNANÇA v14.0

Esta atualização reconstrói o núcleo de evidências do Governança e preserva autenticação, RLS, idempotência, rate limit, streaming e persistência.

Pipeline V2 ativo por padrão.
Para retorno emergencial ao legado, defina em .env.local:
GOVERNANCE_PIPELINE_VERSION=legacy

Validações:
npm run validate:governance-v14
npm run typecheck

Arquivos antigos preservados:
- src/app/api/governance/chat/route.v14.0.bak
- package.v14.0.bak
