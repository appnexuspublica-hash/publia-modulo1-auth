# Upload de PDF em produção — Governança v15.20

## Problema

O navegador enviava o arquivo completo para `/api/upload-pdf`. Em produção, PDFs maiores podiam ser bloqueados pela camada da Vercel antes de a rota Next.js receber a requisição.

## Correção

1. A rota autentica o usuário, valida a conversa, tamanho e limites.
2. A rota cria um token de upload assinado para um caminho restrito ao usuário e à conversa.
3. O navegador envia o PDF diretamente ao Supabase Storage.
4. A rota registra o PDF no banco após o upload.
5. A indexação continua pelo endpoint já existente.

Nenhuma chave privilegiada é enviada ao navegador.
