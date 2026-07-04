# Fluxo Essencial

## Status

**Sprint:** A0.2 – Engenharia Reversa

**Documento:** 11-FLUXO-ESSENCIAL

**Situação:** Em elaboração

**Objetivo:**
Documentar o fluxo do domínio **Essencial**, responsável pela experiência principal do usuário e pelo funcionamento básico do chat do Publ.IA.

---

# Objetivo

O domínio Essencial representa o núcleo funcional da aplicação.

Seu propósito é permitir que o usuário interaja com a IA de forma simples, segura e eficiente, utilizando os serviços compartilhados disponibilizados pelo Core.

---

# Responsabilidades

O domínio Essencial é responsável por:

- autenticação do usuário;
- gerenciamento das conversas;
- envio de mensagens;
- recebimento das respostas da IA;
- exibição do histórico;
- interação com documentos quando aplicável.

Não é responsabilidade deste domínio:

- administrar configurações globais;
- executar tarefas de governança;
- implementar serviços compartilhados.

Essas responsabilidades pertencem ao Core ou ao domínio Governança.

---

# Fluxo Geral

```text
Usuário
    │
    ▼
Interface do Chat
    │
    ▼
API de Chat
    │
    ▼
Core
    │
    ├── OpenAI
    ├── Supabase
    └── PDF (quando necessário)
    │
    ▼
Resposta da IA
    │
    ▼
Histórico da Conversa
```

---

# Componentes Envolvidos

O fluxo Essencial normalmente envolve:

| Componente | Responsabilidade |
|------------|------------------|
| Interface do Chat | Entrada e exibição das mensagens |
| API do Chat | Comunicação entre frontend e backend |
| Core | Serviços compartilhados |
| Banco de Dados | Persistência das conversas |
| OpenAI | Geração das respostas |

---

# Fluxo da Conversa

O fluxo padrão deverá seguir a sequência:

1. Usuário inicia uma conversa.
2. A mensagem é enviada ao backend.
3. O backend prepara o contexto.
4. O Core realiza a chamada ao modelo da OpenAI.
5. A resposta é recebida.
6. A conversa é persistida.
7. A resposta é exibida ao usuário.

---

# Dependências

O domínio Essencial depende de:

- Core;
- autenticação;
- banco de dados;
- OpenAI;
- interface do usuário.

O domínio Essencial **não deve ser utilizado como infraestrutura para outros domínios**.

---

# Arquivos previstos

> **Observação**
>
> A relação abaixo representa a estrutura arquitetural prevista.
> Durante a Sprint A0.2 ela será validada com base no código-fonte.

Exemplos:

```text
src/app/chat/
src/app/api/chat/
src/components/chat/
src/components/sidebar/
```

---

# Compartilhamento

Alguns componentes do fluxo Essencial poderão ser compartilhados com o domínio Estratégico.

Exemplos:

- Chat
- Upload de PDF
- Histórico
- Componentes reutilizáveis

Esses arquivos deverão ser classificados como de **alto impacto**.

---

# Blindagem

Antes de alterar qualquer componente compartilhado deverá ser realizada análise de impacto.

Alterações nesses arquivos poderão afetar:

- Essencial
- Estratégico

---

# Princípios

O fluxo Essencial deverá manter:

- simplicidade;
- rapidez;
- baixo custo;
- alta disponibilidade;
- boa experiência do usuário.

---

# Riscos

Os principais riscos deste domínio são:

- aumento excessivo da complexidade;
- dependências desnecessárias;
- duplicação de funcionalidades;
- alterações em arquivos compartilhados sem análise de impacto.

---

# Recomendações

Para preservar a arquitetura do Publ.IA recomenda-se:

1. reutilizar serviços do Core;
2. manter regras de negócio neste domínio;
3. evitar lógica de infraestrutura;
4. documentar alterações relevantes;
5. preservar a separação entre os domínios.

---

# Próximos Passos

Após este documento serão produzidos:

- 12-FLUXO-ESTRATEGICO.md
- 13-FLUXO-GOVERNANCA.md
- 14-FLUXO-PDF.md

Esses documentos complementarão a visão arquitetural dos principais fluxos do Publ.IA.