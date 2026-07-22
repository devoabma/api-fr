## ADDED Requirements

### Requirement: Build de produção via tsup

O sistema SHALL prover um script `build` (`tsup`) que compila todo o código-fonte em `src` para JavaScript puro (ESM) no diretório `build/`, com sourcemaps e limpeza do diretório de saída a cada execução.

O sistema SHALL prover um script `start` (`node build/http/server.js`) que executa a aplicação a partir do artefato compilado, sem depender de `tsx` nem das fontes TypeScript em runtime.

O diretório `build/` MUST NOT ser versionado no controle de código-fonte.

#### Scenario: Compilar e iniciar a aplicação em produção

- **WHEN** o processo de deploy executa `pnpm build` seguido de `pnpm start`
- **THEN** o artefato `build/http/server.js` é gerado a partir de `src` e o servidor Fastify inicia normalmente, incluindo o job de encerramento automático de sessões

#### Scenario: Resolução de subpaths em bundle ESM

- **WHEN** o código importa subpaths de pacotes CommonJS (ex.: `dayjs/plugin/timezone`, `dayjs/plugin/utc`) dentro do bundle ESM gerado
- **THEN** os imports usam extensão `.js` explícita para que a resolução funcione tanto em dev (`tsx`) quanto no artefato compilado
