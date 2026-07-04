# Arquitetura do Publ.IA

# Índice

- [Sprint A0.1 – Engenharia](00-SPRINT-A01-ENGENHARIA.md)
- [Inventário](01-INVENTARIO.md)
- [Rotas](02-ROTAS.md)
- [Módulos](03-MODULOS.md)
- [Compartilhamento](04-COMPARTILHAMENTO.md)
- [Banco](05-BANCO.md)
- [Variáveis de Ambiente](06-VARIAVEIS-AMBIENTE.md)
- [Blindagem](07-BLINDAGEM.md)
- [Mapa Inicial A0.2](08-MAPA-INICIAL-A02.md)

## Objetivo

Esta pasta reúne toda a documentação de engenharia e arquitetura do Publ.IA.

O objetivo é permitir que qualquer desenvolvedor compreenda rapidamente a estrutura do sistema, seus módulos, dependências e princípios arquiteturais antes de realizar qualquer alteração.

Toda evolução do projeto deve respeitar os princípios definidos nesta documentação.

---

# Filosofia do Projeto

O Publ.IA foi concebido para evoluir de forma:

- Simples
- Incremental
- Segura
- Econômica
- Sustentável

A arquitetura existe para proteger o projeto e facilitar sua evolução, evitando aumento desnecessário da complexidade.

---

# Princípios Oficiais

Toda alteração deverá responder às seguintes perguntas:

1. Resolve um problema real do usuário?
2. Mantém a solução simples?
3. Preserva a arquitetura existente?
4. Mantém baixo custo operacional?
5. Evita regressões?
6. Possui análise de impacto?

Caso alguma resposta seja negativa, a implementação deverá ser reavaliada ou registrada no Backlog.

---

# Organização da Documentação

## Sprint A0.1 – Engenharia e Arquitetura

Documento responsável pela definição da arquitetura do projeto.

- 00-SPRINT-A01-ENGENHARIA.md

---

## Inventário do Projeto

Descrição da estrutura geral do sistema.

- 01-INVENTARIO.md

---

## Rotas

Mapeamento das rotas da aplicação.

- 02-ROTAS.md

---

## Módulos

Descrição dos módulos existentes.

- 03-MODULOS.md

---

## Compartilhamento

Arquivos compartilhados entre módulos e seus riscos.

- 04-COMPARTILHAMENTO.md

---

## Banco de Dados

Estrutura do banco e entidades principais.

- 05-BANCO.md

---

## Variáveis de Ambiente

Documentação das variáveis necessárias ao funcionamento do sistema.

- 06-VARIAVEIS-AMBIENTE.md

---

## Blindagem

Estratégias para evitar regressões durante a evolução do projeto.

- 07-BLINDAGEM.md

---

## Sprint A0.2 – Engenharia Reversa

Documentação produzida a partir da análise do código existente.

- 08-MAPA-INICIAL-A02.md
- 09-MATRIZ-DEPENDENCIAS.md *(em elaboração)*
- 10-FLUXO-CORE.md *(planejado)*
- 11-FLUXO-ESSENCIAL.md *(planejado)*
- 12-FLUXO-ESTRATEGICO.md *(planejado)*
- 13-FLUXO-GOVERNANCA.md *(planejado)*
- 14-FLUXO-PDF.md *(planejado)*
- 15-MAPA-IMPACTO.md *(planejado)*
- 16-RELATORIO-SPRINT-A02.md *(planejado)*

---

# Domínios Arquiteturais

O Publ.IA está organizado em quatro domínios principais.

## Core

Serviços compartilhados.

Responsabilidades:

- Supabase
- OpenAI
- Storage
- Upload de PDFs
- Processamento de PDFs

O Core não deve conter regras de negócio.

---

## Essencial

Fluxo principal de atendimento ao usuário.

---

## Estratégico

Compartilha infraestrutura com o Essencial e concentra funcionalidades estratégicas.

---

## Governança

Módulo independente destinado às funcionalidades administrativas e institucionais.

Sempre que possível deve evoluir utilizando suas próprias rotas, serviços e componentes.

---

# Processo de Evolução

Toda nova funcionalidade deverá seguir a seguinte sequência:

1. Analisar a arquitetura.
2. Identificar dependências.
3. Avaliar impacto.
4. Implementar a menor solução possível.
5. Validar funcionamento.
6. Atualizar a documentação.

---

# Objetivo da Documentação

Esta documentação constitui a referência oficial da arquitetura do Publ.IA.

Ela deverá evoluir continuamente junto com o projeto, servindo como base para decisões técnicas, planejamento de novas funcionalidades e prevenção de regressões.

Antes de alterar qualquer módulo compartilhado, consulte esta documentação e realize a análise de impacto correspondente.