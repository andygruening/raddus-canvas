# Contributing

## Local Development

Use Node.js 22 and npm. Install dependencies from the lockfile:

```shell
npm ci
```

Run the local development server:

```shell
npm run dev
```

Build and preview the production bundle:

```shell
npm run verify
npm run preview
```

## Validation

Before opening or updating a pull request, run:

```shell
npm run typecheck
npm run verify
```

`npm run test` currently aliases `npm run typecheck` because the repository does not have a dedicated unit test framework yet.

## Pull Requests

- Create a scoped branch for each change.
- Link the relevant issue when one exists.
- Keep unrelated refactors, dependency updates, and formatting churn out of feature PRs.
- Include the commands you ran and their outcomes.
- Call out any changes to local storage, auth, Anthropic API proxying, or packaging behavior.

## Release And Publishing

The `publish:*` scripts version and publish `@raddus/canvas` to npm. Do not run them from a contribution branch unless the maintainer explicitly requests a release.

## Secrets

Do not commit `.env*` files, Anthropic API keys, local app data, keychain exports, logs containing credentials, or browser session cookies. Use `.env.example` for public local configuration examples.
