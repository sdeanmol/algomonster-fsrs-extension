# AGENTS.md - Migration Rules

## Project Context
- **Extension Type**: Chrome Extension Manifest V3 (Vanilla JS -> TypeScript).
- **Architecture**: Partial Webpack bundling + `CopyPlugin` raw asset copying.
- **Testing**: Jest unit/integration tests + Playwright E2E.

## Strict Rules
1. **Build Gate**: Run `npm run build` AND `npm test` after modifying any code.
2. **CopyPlugin Safety**: Never allow raw `.ts` files to be copied directly into the `build/` output folder by `CopyPlugin`.
3. **Incremental Execution**: Never convert entire feature directories at once. Work module by module starting with leaf utilities and Webpack entries.
4. **Chrome Runtime**: Keep Chrome extension API calls properly typed using `@types/chrome`.