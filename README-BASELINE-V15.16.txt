PUBL.IA GOVERNANÇA — BASELINE V15.16

Objetivo
Recuperar de forma idempotente uma resposta já concluída quando o cliente repete a mesma requisição após perder a resposta HTTP/SSE original.

Alterações
- A checagem idempotente distingue requisição disponível, em processamento, concluída e indisponível.
- Quando a mensagem do usuário e a resposta do assistente já existem para o mesmo client_request_id, a rota retorna o envelope persistido com HTTP 200.
- Nenhuma nova pesquisa, chamada OpenAI ou persistência é executada no retry concluído.
- Requisições ainda em processamento continuam retornando HTTP 409 com Retry-After.

Pipeline
governance-v15.16-recoverable-idempotency

Validação
npm run validate:baseline
npm run typecheck
