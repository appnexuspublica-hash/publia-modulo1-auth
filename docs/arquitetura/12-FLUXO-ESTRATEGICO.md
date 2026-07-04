# Fluxo Estratégico

## Status

**Sprint:** A0.2 – Engenharia Reversa

**Documento:** 12-FLUXO-ESTRATEGICO

**Situação:** Em elaboração

**Objetivo:**
Documentar o fluxo do domínio Estratégico, identificando suas responsabilidades, dependências e relação com os demais domínios da arquitetura do Publ.IA.

---

# Objetivo

O domínio Estratégico reúne funcionalidades que ampliam a capacidade de análise e apoio à tomada de decisão, utilizando a mesma infraestrutura compartilhada do domínio Essencial.

Seu foco é oferecer recursos de maior valor agregado, sem duplicar componentes já existentes.

---

# Responsabilidades

O domínio Estratégico é responsável por:

- consultas especializadas;
- análise de documentos;
- apoio à decisão;
- utilização de conhecimento institucional;
- funcionalidades avançadas para usuários autorizados.

Não é responsabilidade deste domínio:

- implementar infraestrutura;
- administrar usuários;
- controlar configurações globais;
- substituir o fluxo Essencial.

---

# Fluxo Geral

```text
Usuário
    │
    ▼
Interface Estratégica
    │
    ▼
API Estratégica
    │
    ▼
Core
    │
    ├── OpenAI
    ├── Supabase
    ├── PDF
    └── Storage
    │
    ▼
Resposta Estratégica
```

---

# Componentes Envolvidos

| Componente | Responsabilidade |
|------------|------------------|
| Interface Estratégica | Entrada das solicitações especializadas |
| API Estratégica | Processamento das requisições |
| Core | Infraestrutura compartilhada |
| Banco de Dados | Persistência de dados |
| OpenAI | Processamento das consultas |

---

# Dependências

O domínio Estratégico depende de:

- Core;
- autenticação;
- banco de dados;
- serviços compartilhados.

Sempre que possível deverá reutilizar componentes do domínio Essencial.

---

# Compartilhamento

Atualmente compartilha infraestrutura com o domínio Essencial.

Exemplos:

- Chat
- Upload de PDFs
- Histórico
- Componentes reutilizáveis

Esses componentes deverão ser tratados como arquivos compartilhados.

---

# Arquivos previstos

> **Observação**
>
> A relação abaixo representa a arquitetura planejada e será validada durante a Sprint A0.2.

Exemplos:

```text
src/app/chat/
src/app/api/chat/
src/app/api/upload-pdf/
src/lib/pdf/
```

---

# Blindagem

Arquivos compartilhados entre Essencial e Estratégico possuem alto impacto.

Antes de qualquer alteração deverá ser realizada análise de impacto.

---

# Princípios

O domínio Estratégico deverá:

- reutilizar infraestrutura existente;
- evitar duplicação de código;
- manter simplicidade;
- preservar baixo custo operacional;
- permanecer desacoplado da Governança.

---

# Riscos

Os principais riscos identificados são:

- duplicação de funcionalidades;
- acoplamento excessivo ao Essencial;
- crescimento desnecessário da complexidade;
- alterações em componentes compartilhados sem análise prévia.

---

# Recomendações

Para preservar a arquitetura:

1. reutilizar componentes do Core;
2. compartilhar apenas o necessário;
3. documentar novas dependências;
4. evitar regras de negócio no Core;
5. realizar análise de impacto antes de modificar componentes compartilhados.

---

# Próximos Passos

Após este documento serão produzidos:

- 13-FLUXO-GOVERNANCA.md
- 14-FLUXO-PDF.md
- 15-MAPA-IMPACTO.md
- 16-RELATORIO-SPRINT-A02.md