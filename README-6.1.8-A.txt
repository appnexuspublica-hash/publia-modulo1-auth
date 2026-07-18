Módulo 6.1.8-A — Índice estruturado de atos do Diário Oficial

1. Aplique o SQL:
   supabase/migrations/20260717_618a_official_gazette_acts.sql

2. Copie os arquivos src/ para o projeto, preservando os caminhos.

3. Reprocesse uma edição de teste do Diário Oficial.

4. Valide no Supabase:
   select act_type, act_number, act_year, edition_number, publication_date, title
   from governance_official_gazette_acts
   order by created_at desc
   limit 50;

5. Rode:
   npm run lint
   npm run build

Escopo preservado:
- chat/route.ts não foi alterado;
- streaming, memória, prompts, interface e sincronização não foram alterados;
- o processamento existente de chunks foi mantido;
- o novo índice é preenchido após a gravação dos chunks.
