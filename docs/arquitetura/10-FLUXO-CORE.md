# Fluxo do Core

## Status

**Sprint:** A0.2 – Engenharia Reversa

**Documento:** 10-FLUXO-CORE

**Situação:** Em elaboração

**Objetivo:**
Documentar a arquitetura do domínio **Core**, identificando seus componentes, responsabilidades, dependências e pontos críticos. O Core fornece serviços compartilhados para os demais domínios e não deve conter regras de negócio.

---

# Objetivo do Core

O Core concentra os serviços de infraestrutura utilizados por toda a aplicação.

Sua responsabilidade é oferecer funcionalidades reutilizáveis, desacopladas das regras de negócio, permitindo que os demais módulos utilizem os mesmos serviços de forma consistente.

O Core deve permanecer o mais estável possível.

---

# Responsabilidades

O Core é responsável por:

- Configuração do Supabase
- Integração com a OpenAI
- Upload de arquivos
- Processamento de PDFs
- Storage
- Utilitários compartilhados
- Configurações comuns
- Tipos e funções reutilizáveis

O Core **não deve**:

- implementar regras de negócio;
- tomar decisões específicas de um domínio;
- depender dos módulos Essencial, Estratégico ou Governança.

---

# Domínios consumidores

Os serviços do Core podem ser utilizados por:

- Essencial
- Estratégico
- Governança

Essa dependência deve ocorrer apenas em um sentido:

```text
                Core
                 ▲
      ┌──────────┼──────────┐
      │          │          │
 Essencial  Estratégico  Governança
```

Os módulos consumidores dependem do Core.

O Core não depende deles.

---

# Componentes previstos

Os componentes abaixo representam a estrutura esperada do Core.

| Componente | Finalidade |
|------------|------------|
| Supabase | Autenticação, banco e storage |
| OpenAI | Comunicação com os modelos de IA |
| PDF | Processamento e leitura de documentos |
| Storage | Armazenamento de arquivos |
| Utilitários | Funções compartilhadas |
| Configurações | Variáveis e inicializações |

---

# Fluxo Geral

```text
Usuário
   │
   ▼
Domínio (Essencial / Estratégico / Governança)
   │
   ▼
Core
   │
   ├── Supabase
   ├── OpenAI
   ├── Storage
   └── PDF
```

O Core atua como camada de infraestrutura.

Toda comunicação com serviços externos deve ocorrer através dele.

---

# Dependências

O Core poderá depender de:

- bibliotecas externas;
- SDK da OpenAI;
- SDK do Supabase;
- bibliotecas para processamento de PDFs.

Não deverá depender de componentes da aplicação.

---

# Princípios

O Core deverá seguir os seguintes princípios:

- reutilização;
- simplicidade;
- baixo acoplamento;
- alta coesão;
- baixo custo operacional.

---

# Blindagem

Os arquivos pertencentes ao Core possuem alto impacto arquitetural.

Toda alteração deverá ser precedida de análise de impacto.

Mudanças nesses arquivos podem afetar simultaneamente:

- Essencial
- Estratégico
- Governança

---

# Arquivos do Core

> **Observação**
>
> A relação abaixo representa a estrutura arquitetural prevista.
> Durante a Sprint A0.2 ela será validada e ajustada com base na análise do código-fonte.

Exemplos:

```text
src/lib/supabase/
src/lib/openai/
src/lib/pdf/
src/lib/storage/
src/lib/utils/
```

---

# Fluxo de Dependência

```text
Core
│
├── Supabase
├── OpenAI
├── PDF
├── Storage
└── Utilitários
```

Nenhum desses componentes deverá depender dos domínios de negócio.

---

# Riscos

Os principais riscos associados ao Core são:

- aumento excessivo de responsabilidades;
- inclusão de regras de negócio;
- acoplamento entre domínios;
- alterações sem análise de impacto.

---

# Recomendações

Para preservar a arquitetura do Publ.IA, recomenda-se:

1. manter o Core enxuto;
2. reutilizar serviços existentes;
3. evitar duplicação de código;
4. não inserir regras de negócio no Core;
5. documentar alterações arquiteturais;
6. realizar análise de impacto antes de modificar componentes compartilhados.

---

# Próximos Passos

Após a conclusão deste documento serão produzidos:

- 11-FLUXO-ESSENCIAL.md
- 12-FLUXO-ESTRATEGICO.md
- 13-FLUXO-GOVERNANCA.md

Esses documentos detalharão como cada domínio consome os serviços disponibilizados pelo Core.