PUBL.IA GOVERNANÇA — ENCERRAMENTO DA FASE DE ESTABILIZAÇÃO v15.20

Base analisada: publia-modulo1-auth-atual(30).zip
Pipeline congelado: governance-v15.20-final-audit-closure

RESULTADO

A fase de reconstrução e estabilização estrutural do chat Governança está encerrada.
O baseline determinístico foi ampliado de 144 para 150 verificações.

GARANTIAS CONGELADAS

1. Um único plano de consulta por requisição.
2. Um único governance-core no fluxo principal.
3. Referências canônicas em metadata.governance_result.
4. Mesmo envelope em streaming, JSON, persistência e resposta transitória.
5. Reidratação do cliente pelo parser compartilhado.
6. Idempotência de usuário e assistente, com recuperação de lease.
7. Base legal, evidências e canais preservados em categorias distintas.
8. Rota principal sem imports dos módulos legados substituídos.
9. Backups preservados, mas fora do runtime.

RESÍDUOS CONHECIDOS E DECISÃO

- Arquivos legados continuam no repositório porque parte deles serve às rotas administrativas do Diário Oficial, sincronização, segurança e manutenção. A exclusão em massa não é segura sem uma fase separada.
- Validadores, manifestos e backups anteriores formam a trilha de auditoria. Não são importados pelo runtime.
- A limpeza física desses arquivos é opcional e não deve ser misturada com correções funcionais.

CRITÉRIO PARA NOVAS ALTERAÇÕES

A partir deste baseline, nenhuma mudança deve ser feita apenas por preferência subjetiva. Uma nova alteração deve apresentar:

- regressão reproduzível;
- caso de teste antes da correção;
- alteração mínima;
- execução de npm run validate:baseline;
- typecheck no ambiente local;
- teste funcional específico.

LIMITAÇÕES

- A suíte estrutural não substitui integração real com Supabase, OpenAI e fontes web.
- O typecheck completo deve ser executado no projeto local com node_modules.
- Migrações pendentes devem ser aplicadas antes da homologação.
