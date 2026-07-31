# Supabase Security Warnings — Lote 3B

Baseline preservado: Governança v15.20.

Este lote separa as sete funções organizacionais em:

- wrappers `SECURITY INVOKER` no schema `public`, preservando assinaturas e chamadas existentes;
- implementações privilegiadas `SECURITY DEFINER` no schema não exposto `private`.

A criação de organização foi restringida a `service_role`, conforme regra aprovada. A criação de conversa permanece disponível para `authenticated`, mas o endpoint público deixou de ser `SECURITY DEFINER`.

Nenhuma regra de resposta, provedor, fonte, persistência ou comportamento do chat foi alterado.
