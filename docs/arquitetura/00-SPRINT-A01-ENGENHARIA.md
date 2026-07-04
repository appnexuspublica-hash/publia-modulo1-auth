# Sprint A0.1 – Engenharia e Arquitetura

## Objetivo

A Sprint A0.1 teve como objetivo estabelecer os princípios arquiteturais do Publ.IA antes da implementação de novas funcionalidades.

Nesta sprint não foram realizadas alterações de código. O foco foi definir uma arquitetura capaz de evoluir de forma incremental, segura e com baixo custo operacional.

---

# Visão Geral

O Publ.IA é uma plataforma de Inteligência Artificial voltada ao apoio da administração pública municipal.

Seu objetivo é permitir consultas inteligentes sobre documentos institucionais, legislação, normas e demais conteúdos oficiais.

A arquitetura foi concebida para privilegiar:

- simplicidade;
- estabilidade;
- manutenção facilitada;
- baixo custo operacional;
- evolução incremental.

---

# Domínios Oficiais

A arquitetura foi organizada em quatro domínios principais.

## Core

Infraestrutura compartilhada.

Responsabilidades:

- Supabase
- OpenAI
- Upload de PDFs
- Processamento de PDFs
- Storage
- Serviços compartilhados

O Core não deve conter regras de negócio.

---

## Essencial

Fluxo principal de atendimento ao usuário.

---

## Estratégico

Compartilha infraestrutura com o Essencial, porém contempla funcionalidades de maior valor agregado.

---

## Governança

Domínio independente destinado às funcionalidades administrativas e institucionais.

Sempre que possível deverá possuir rotas, serviços e componentes próprios.

---

# Princípios Arquiteturais

Durante esta sprint foram aprovados os seguintes princípios:

1. Resolver problemas reais do usuário.
2. Manter a solução simples.
3. Priorizar baixo custo operacional.
4. Preservar a arquitetura existente.
5. Evitar crescimento desnecessário da complexidade.
6. Evoluir em pequenas entregas.
7. Analisar impacto antes de alterar arquivos compartilhados.

---

# ADRs aprovadas

## ADR-001

Evolução por domínios.

## ADR-002

Governança independente.

## ADR-003

Arquivos compartilhados somente após análise de impacto.

## ADR-004

Priorizar simplicidade.

## ADR-005

Qualidade acima de quantidade de funcionalidades.

## ADR-006

Toda implementação deve responder:

- resolve problema real?
- mantém simplicidade?
- preserva arquitetura?
- mantém baixo custo?

Caso contrário, registrar no backlog.

---

# Estratégia de Blindagem

Arquivos compartilhados deverão ser tratados como áreas críticas.

Antes de qualquer alteração será obrigatória análise de impacto.

---

# Resultado da Sprint

Ao término da Sprint A0.1 ficou estabelecida a base arquitetural do Publ.IA.

Nenhum módulo funcional foi alterado.

A sprint concentrou-se exclusivamente na definição da engenharia do projeto.

---

# Próxima Sprint

Sprint A0.2 – Engenharia Reversa.

Objetivos:

- mapear dependências;
- identificar fluxos;
- classificar módulos;
- localizar pontos críticos;
- produzir matriz de impacto.

Essa documentação passa a servir como referência para todas as futuras evoluções do projeto.