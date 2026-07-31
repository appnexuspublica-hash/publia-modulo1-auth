# Resumo hierárquico de PDFs — Governança v15.20

## Objetivo

Corrigir o uso de busca vetorial limitada para a ação de resumir PDFs selecionados.

## Regra aplicada

- Perguntas específicas sobre PDFs continuam usando recuperação vetorial por relevância.
- Pedidos de resumo dos PDFs selecionados passam a processar sequencialmente o texto extraído completo.
- O texto é dividido em blocos grandes, cada bloco recebe um resumo fiel e os resumos parciais são consolidados.
- A observação genérica de que apenas trechos foram acessados é proibida quando a cobertura foi integral.
- Limitações são informadas somente quando o texto não está disponível ou excede o limite seguro de processamento.

## Limites de segurança

- Até cinco PDFs selecionados, preservando a regra anterior.
- Até 420.000 caracteres processados por PDF em uma única solicitação.
- Duas chamadas parciais simultâneas para reduzir risco de sobrecarga.
- Nenhuma alteração em fontes institucionais, provedores, persistência, streaming ou regras gerais de resposta.

## Arquivos

- `src/app/api/governance/chat/route.ts`
- `src/lib/governance/chat/pdf-context.ts`
- `src/lib/governance/chat/pdf-summary.ts`
