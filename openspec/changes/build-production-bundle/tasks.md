## 1. Configuração do build

- [x] 1.1 Adicionar `tsup.config.ts` compilando `src` para `build/` em ESM, sem splitting, com sourcemap e `clean: true`
- [x] 1.2 Adicionar `tsup` como devDependency
- [x] 1.3 Adicionar scripts `build` (`tsup`) e `start` (`node build/http/server.js`) no `package.json`
- [x] 1.4 Corrigir imports de `dayjs/plugin/timezone` e `dayjs/plugin/utc` para incluir extensão `.js` (resolução correta no bundle ESM)
- [x] 1.5 Ignorar `/build` no `.gitignore`

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `pnpm build` gera `build/http/server.js` sem erros
- [x] 2.3 `node build/http/server.js` sobe o servidor e o job de encerramento automático normalmente
