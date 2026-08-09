## 1. Mensagens da consulta ao advogado(a)

- [x] 1.1 `404` de consulta indisponível/advogado(a) não encontrado: acrescentar "Tente novamente mais tarde."
- [x] 1.2 `400` de situação não liberada: trocar "inativo" por "não ativo" e redirecionar de "a OAB" para "sua Seccional"
- [x] 1.3 `400` de inadimplência: remover a menção à pendência financeira do texto e apontar para o Setor Financeiro da Seccional
- [x] 1.4 `400` de dados divergentes: apontar para "sua Seccional" e instruir a conferir os dados antes de repetir

## 2. Mensagens do computador

- [x] 2.1 `404` de computador inexistente: acrescentar "Tente novamente mais tarde."
- [x] 2.2 `400` de computador em manutenção: acrescentar "Entre em contato com a administração."
- [x] 2.3 Manter "Entre em contato com a administração" como destinatário dos erros de máquina/sala, distinto de "sua Seccional" (registro) — a distinção é o que dá utilidade à orientação

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check src/http/core/lawyers/release-computer.ts` sem issues
- [x] 3.3 Conferir no diff que só literais de string mudaram — nenhuma condição, status code ou ordem de validação alterada
- [x] 3.4 Confirmar que `docs/DOC.md` e `docs/ROADMAP.md` não citam o texto das mensagens (nada a atualizar)
- [x] 3.5 Corrigir a citação da mensagem antiga em `openspec/changes/suspend-defaulting-lawyer-block/design.md`
- [ ] 3.6 `grep` no app desktop e no front por comparação de `message` com string fixa (`inadimplente`, `inativo`, `não conferem`) — o tratamento deve ser por status code
- [ ] 3.7 Ler as seis mensagens na tela real do app desktop, em produção, conferindo quebra de linha e truncamento (as novas são mais longas que as antigas)
