## Why

Após reverter a tentativa de deploy via `Dockerfile` (commit `bc5a42d`, revertido em `6eb57f9`), a aplicação continuava sem uma forma de rodar em produção fora do modo dev (`tsx watch`). Rodar `tsx` diretamente em produção (como o Dockerfile revertido fazia) mantém as fontes TypeScript e o compilador just-in-time no runtime, o que é mais lento para iniciar e desnecessário quando o objetivo é apenas subir um processo Node estável no Coolify.

## What Changes

- **`tsup.config.ts`**: novo arquivo de configuração do `tsup`, compilando `src` inteiro para `build/` em ESM, sem code splitting, com sourcemaps e limpando o diretório de saída a cada build (`clean: true`).
- **`package.json`**: novo script `build` (`tsup`) e `start` (`node build/http/server.js`); `tsup` adicionado como devDependency.
- **`src/lib/dayjs.ts`**: imports de `dayjs/plugin/timezone` e `dayjs/plugin/utc` passam a incluir a extensão `.js` explícita — necessária para resolução correta desses subpaths no bundle ESM gerado pelo esbuild/tsup.
- **`.gitignore`**: `/build` adicionado para não versionar o artefato de compilação.

## Capabilities

### Added Capabilities
- `build`: a aplicação passa a poder ser compilada para JavaScript puro (`pnpm build`) e executada em produção via `pnpm start`, sem depender de `tsx` nem das fontes TypeScript em runtime.

## Impact

- Código novo: `tsup.config.ts`.
- Alterado: `package.json` (scripts `build`/`start`, devDependency `tsup`), `src/lib/dayjs.ts` (extensões `.js` nos imports de plugins), `.gitignore` (`/build`).
- Deploy: o Coolify (ou outro orquestrador) passa a poder rodar `pnpm build` seguido de `pnpm start`, em vez de `tsx watch` ou de um Dockerfile customizado.
- Documentação: `docs/ROADMAP.md` marca o item de build de produção como concluído.
