PUBL.IA — BASELINE V15.6

Objetivo
- Congelar os comportamentos que já funcionam no Governança e no Essencial.
- Impedir regressões de roteamento, referências, persistência e tipografia.
- Não altera a lógica de resposta em produção.

Comandos
- npm run validate:governance-baseline
- npm run validate:baseline
- npm run typecheck

O validador determinístico cobre
- classificação de 16 famílias de perguntas;
- provedores obrigatórios e opcionais;
- formato esperado da resposta;
- pacotes jurídicos consolidados;
- deduplicação de Lei, Decreto, TCU e Compras.gov.br;
- ausência de títulos formados apenas por domínios;
- arquitetura limpa do governance-core;
- persistência de governance_result;
- tipografia do rodapé do Publia Essencial.

Limite da suíte
Ela não chama OpenAI, Supabase nem a internet. O teste funcional integrado continua necessário para conteúdo vivo, streaming, banco, RLS, idempotência e recarga de conversa.
