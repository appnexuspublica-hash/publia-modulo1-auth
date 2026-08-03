# Resumo adaptativo rápido de PDFs — Governança v15.20

## Motivo

O fluxo anterior produzia resumos hierárquicos intermediários antes da resposta final. Com LDO, PPA e LOA, o log registrou aproximadamente 139 segundos no endpoint do chat, pois vários resumos parciais e consolidações eram feitos antes do primeiro token da resposta.

## Alteração

- O resumo de PDFs não faz mais chamadas intermediárias ao modelo antes da resposta principal.
- Quando o texto cabe no orçamento de contexto, ele é enviado integralmente.
- Quando o conjunto é grande, o sistema seleciona automaticamente linhas estruturais e trechos distribuídos do início ao fim de cada documento.
- Os PDFs são preparados em paralelo.
- A decisão é automática e invisível ao usuário.

## Preservado

- perguntas específicas continuam usando busca vetorial;
- seleção e autorização dos PDFs permanecem iguais;
- modelo, persistência, streaming e baseline v15.20 não foram alterados;
- nenhum controle novo foi adicionado à interface.

## Validação

```powershell
npm run validate:baseline
node scripts/validate-governance-pdf-summary-v15.20.mjs
```
