# Fluxo PDF

## Status

**Sprint:** A0.2 – Engenharia Reversa

**Documento:** 14-FLUXO-PDF

**Situação:** Em elaboração

**Objetivo:**
Documentar o fluxo completo de upload, armazenamento, processamento e utilização de documentos PDF no Publ.IA, identificando responsabilidades, dependências e pontos de atenção arquiteturais.

---

# Objetivo

O fluxo de PDF permite que documentos sejam incorporados ao Publ.IA para apoiar consultas inteligentes realizadas pelos usuários.

Seu propósito é disponibilizar informações relevantes ao modelo de IA, utilizando apenas o contexto necessário, preservando desempenho e reduzindo custos operacionais.

---

# Responsabilidades

O fluxo PDF é responsável por:

- receber documentos enviados pelos usuários;
- armazenar os arquivos;
- extrair o conteúdo textual;
- preparar os dados para consulta;
- fornecer contexto ao fluxo de chat;
- reutilizar documentos já processados quando possível.

---

# Fluxo Geral

```text
Usuário
    │
    ▼
Upload de PDF
    │
    ▼
Storage
    │
    ▼
Processamento
    │
    ▼
Extração de Texto
    │
    ▼
Preparação do Contexto
    │
    ▼
Fluxo de Chat
    │
    ▼
OpenAI
    │
    ▼
Resposta ao Usuário
```

---

# Componentes Envolvidos

| Componente | Responsabilidade |
|------------|------------------|
| Interface de Upload | Receber o arquivo do usuário |
| API de Upload | Validar e encaminhar o documento |
| Storage | Armazenar o arquivo |
| Processador PDF | Extrair o conteúdo textual |
| Chat | Utilizar o contexto durante a consulta |
| OpenAI | Gerar a resposta |

---

# Dependências

O fluxo PDF depende de:

- Core;
- Storage;
- Processamento de PDF;
- OpenAI;
- Banco de Dados.

Os domínios Essencial, Estratégico e Governança podem consumir esse fluxo, mas não devem implementar sua infraestrutura.

---

# Estrutura Prevista

A estrutura arquitetural prevista inclui componentes como:

```text
src/app/api/upload-pdf/

src/app/api/pdf/

src/lib/pdf/

src/lib/storage/
```

Durante a Sprint A0.2 essa estrutura será validada por meio da análise do código-fonte.

---

# Fluxo de Processamento

O processamento deverá seguir a seguinte sequência:

1. Receber o arquivo.
2. Validar o formato.
3. Armazenar o documento.
4. Extrair o texto.
5. Registrar os metadados.
6. Disponibilizar o conteúdo para consulta.
7. Reutilizar o processamento sempre que possível.

---

# Reutilização

Sempre que um documento já tiver sido processado, o sistema deverá priorizar sua reutilização, evitando novo processamento.

Essa estratégia reduz:

- custo computacional;
- tempo de resposta;
- consumo da API da OpenAI.

---

# Blindagem

Os componentes responsáveis pelo processamento de PDFs são compartilhados entre múltiplos domínios.

Alterações nesses componentes deverão ser precedidas de análise de impacto.

---

# Fluxo de Dependência

```text
Essencial
        │
Estratégico
        │
Governança
        │
        ▼
 Fluxo PDF
        │
        ▼
      Core
```

O fluxo PDF depende do Core.

O Core não depende do fluxo PDF.

---

# Riscos

Os principais riscos identificados são:

- reprocessamento desnecessário de documentos;
- envio de contexto excessivo ao modelo;
- aumento do custo operacional;
- duplicação de processamento;
- alterações em componentes compartilhados sem análise de impacto.

---

# Recomendações

Para preservar a arquitetura recomenda-se:

1. reutilizar documentos já processados;
2. enviar apenas contexto relevante ao modelo;
3. manter a infraestrutura de PDF centralizada no Core;
4. evitar duplicação de lógica entre domínios;
5. documentar alterações arquiteturais.

---

# Custos

O processamento de PDFs deve considerar:

- armazenamento;
- processamento;
- consumo de tokens;
- custo da OpenAI;
- custo do Supabase.

Sempre que possível deverá ser utilizada a solução mais simples que atenda ao objetivo do usuário.

---

# ADR Relacionadas

Este documento está relacionado às seguintes decisões arquiteturais:

- ADR-001 — Evolução por Domínios.
- ADR-003 — Blindagem de Arquivos Compartilhados.
- ADR-004 — Priorizar Simplicidade.
- ADR-005 — Qualidade e Confiabilidade.
- ADR-006 — Implementar apenas soluções que agreguem valor.

---

# Próximos Passos

Após este documento serão produzidos:

- 15-MAPA-IMPACTO.md
- 16-RELATORIO-SPRINT-A02.md

Esses documentos concluirão a Sprint A0.2 e servirão de base para a evolução arquitetural do Publ.IA.