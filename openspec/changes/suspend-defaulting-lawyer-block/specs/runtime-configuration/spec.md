## ADDED Requirements

### Requirement: Suspensão administrativa do bloqueio por inadimplência

O sistema SHALL obter da variável de ambiente `ALLOW_DEFAULTING_LAWYERS` a decisão de exigir ou não adimplência para liberar computador. A regra é administrativa — a diretoria da OAB pode determinar liberação geral por período — e MUST NOT exigir alteração de código para ser ligada ou desligada.

Quando `ALLOW_DEFAULTING_LAWYERS` não for informada, o sistema MUST assumir `false`, mantendo o bloqueio ativo. Ambientes já existentes MUST continuar funcionando sem qualquer alteração de configuração.

O sistema MUST interpretar como `true` apenas o valor literal `true`, ignorando espaços em volta e diferença de caixa. Qualquer outro valor — inclusive `1`, `sim`, `yes`, `on` — MUST ser interpretado como `false`. A assimetria é deliberada: ler um valor ambíguo como `false` produz o comportamento normal do sistema e o erro aparece de imediato; lê-lo como `true` liberaria inadimplentes sem que ninguém tenha determinado, e isso passaria despercebido.

Quando a flag estiver ligada, o sistema MUST emitir aviso destacado no boot, informando que advogados(as) inadimplentes estão liberados. A exceção é temporária por natureza e a configuração é permanente; sem o aviso, a exceção sobreviveria à determinação que a justificou.

#### Scenario: Variável ausente

- **WHEN** a API sobe sem `ALLOW_DEFAULTING_LAWYERS` definida
- **THEN** a exigência de adimplência permanece ativa e nenhum aviso é emitido

#### Scenario: Liberação geral determinada

- **WHEN** a API sobe com `ALLOW_DEFAULTING_LAWYERS=true`
- **THEN** a exigência de adimplência fica suspensa
- **AND** o boot emite aviso destacado informando que inadimplentes estão liberados

#### Scenario: Valor ambíguo no deploy

- **WHEN** a API sobe com `ALLOW_DEFAULTING_LAWYERS=1` (ou qualquer valor diferente de `true`)
- **THEN** a exigência de adimplência permanece ativa, como se a variável não existisse
