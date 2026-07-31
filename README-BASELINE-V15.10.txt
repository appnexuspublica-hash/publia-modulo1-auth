PUBL.IA GOVERNANÇA — BASELINE V15.10

Base:
publia-modulo1-auth-atual(20).zip

Objetivo:
Unificar a finalização e a política de sugestões entre respostas streaming,
não streaming, persistidas e transitórias.

Mudança funcional:
Perguntas do Diário Oficial deixam de receber sugestões em todos os caminhos,
inclusive quando a conversa é removida durante a geração ou persistência.

Validação:
npm run validate:baseline
npm run typecheck

Limitações:
A validação ponta a ponta depende de Supabase e OpenAI configurados.
O evento SSE "replace" deve ser confirmado em teste no navegador.
