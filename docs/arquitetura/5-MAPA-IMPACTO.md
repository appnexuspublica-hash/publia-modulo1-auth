# Mapa de Impacto

## Status

**Sprint:** A0.2 – Engenharia Reversa

**Documento:** 15-MAPA-IMPACTO

**Situação:** Em elaboração

**Objetivo:**
Identificar os pontos críticos da arquitetura do Publ.IA, classificando os componentes de acordo com o impacto de possíveis alterações e estabelecendo regras para evolução segura do sistema.

---

# Objetivo

O Mapa de Impacto identifica os componentes cuja alteração pode provocar efeitos em outros módulos do sistema.

Seu principal objetivo é orientar a análise de impacto antes de qualquer modificação no código.

---

# Classificação de Impacto

A arquitetura adota três níveis de impacto.

## 🔴 Alto Impacto

Arquivos compartilhados entre múltiplos domínios.

Uma alteração pode afetar:

- Core
- Essencial
- Estratégico
- Governança

Toda alteração exige análise de impacto.

---

## 🟡 Médio Impacto

Arquivos utilizados por um único domínio, mas com múltiplas dependências internas.

A alteração exige validação funcional.

---

## 🟢 Baixo Impacto

Arquivos específicos de um módulo.

Possuem baixo risco de propagação de alterações.

---

# Componentes Críticos

Os seguintes componentes são considerados críticos.

| Área | Impacto | Observação |
|-------|----------|------------|
| Core | 🔴 | Infraestrutura compartilhada |
| OpenAI | 🔴 | Utilizado por vários fluxos |
| Supabase | 🔴 | Banco, autenticação e storage |
| Processamento PDF | 🔴 | Compartilhado entre domínios |
| Storage | 🔴 | Infraestrutura comum |

---

# Arquivos Compartilhados

Os seguintes diretórios deverão ser tratados como compartilhados.

```text
src/app/chat/

src/app/api/chat/

src/app/api/upload-pdf/

src/lib/pdf/

src/lib/openai/

src/lib/supabase/

src/lib/storage/
```

Toda alteração nesses componentes exige análise de impacto.

---

# Domínios

## Core

Impacto:

🔴 Alto

Motivo:

Infraestrutura compartilhada.

---

## Essencial

Impacto:

🟡 Médio

Motivo:

Compartilha parte da infraestrutura com o Estratégico.

---

## Estratégico

Impacto:

🟡 Médio

Motivo:

Compartilha componentes do fluxo principal.

---

## Governança

Impacto:

🟢 Baixo

Motivo:

Arquitetura independente.

---

# Critérios para Alteração

Antes de modificar qualquer componente deverão ser respondidas as seguintes perguntas.

## 1

Qual domínio será afetado?

---

## 2

Existem arquivos compartilhados?

---

## 3

Existe reutilização desse componente?

---

## 4

Há impacto no custo operacional?

---

## 5

Será necessário atualizar a documentação?

---

# Checklist de Análise de Impacto

Antes de qualquer alteração confirmar:

- [ ] O problema é real.
- [ ] O componente foi identificado.
- [ ] O impacto foi analisado.
- [ ] A arquitetura será preservada.
- [ ] O custo permanece adequado.
- [ ] A documentação será atualizada.

---

# Recomendações

Para preservar a estabilidade do Publ.IA recomenda-se:

1. modificar apenas o necessário;
2. reutilizar componentes existentes;
3. evitar duplicação de código;
4. documentar alterações arquiteturais;
5. realizar testes após alterações em componentes críticos.

---

# Relação com os ADRs

Este documento implementa na prática as decisões:

- ADR-001 — Evolução por Domínios.
- ADR-002 — Governança Independente.
- ADR-003 — Blindagem de Arquivos Compartilhados.
- ADR-004 — Simplicidade.
- ADR-005 — Qualidade e Confiabilidade.
- ADR-006 — Implementar apenas soluções que agreguem valor.

---

# Resultado Esperado

Ao consultar este documento o desenvolvedor deverá conseguir responder rapidamente:

- Onde posso alterar com segurança?
- Quais arquivos exigem análise de impacto?
- Quais domínios serão afetados?
- Como preservar a arquitetura do Publ.IA?

Este documento passa a ser referência obrigatória antes de alterações em componentes compartilhados.