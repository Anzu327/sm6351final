# GitHub Pages deployment

## Implemented
- GitHub API-only source change; no local clone or source editing.
- `.github/workflows/deploy-pages.yml` builds with Node 22, npm ci, type checking, complete data verification and Vite.
- Official Pages artifact and OIDC deployment actions publish only `dist/`.
- Main source pushes automatically deploy; documentation-only pushes are ignored. Use Actions → Deploy GitHub Pages → Run workflow to redeploy manually.
- Vite uses relative asset paths, compatible with the project subdirectory.

## Pending / not verified
- Owner's GitHub email reauthentication is required to finish making the repository public.
- Enable Settings → Pages → Source: GitHub Actions.
- First successful Pages deployment and public URL have not yet been verified. Do not describe the expected address as a live site until deployment succeeds.
- Existing browser verification is recorded separately in HANDOFF.md; deployment checks do not replace visual verification.

## Recovery
Check the failed job in Actions. A configure-pages 404 usually means Pages has not been enabled or the repository plan/visibility does not support it. Enable Pages and rerun the workflow. Never change visibility or add credentials without owner authorization.

The owner authorized publishing this repository publicly on 2026-10-29. No paid hosting subscription is required for Pages on a public repository.
