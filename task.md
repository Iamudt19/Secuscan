# SecuScan Phase 5 — Task List

## Backend
- [x] Add secure `api_token` column to `projects` database table with auto-generation
- [x] Implement API token regeneration route `POST /api/projects/:id/regenerate-token`
- [x] Create CI scan handler `POST /api/scan/ci-scan` validating project auth token
- [x] Create GitHub Webhook endpoint `POST /api/scan/webhooks/github` supporting HMAC signature checks
- [x] Implement JWT token signing and installation token exchange for GitHub App
- [x] Build comment markdown formatter with collapsible severity groups and side-by-side deployment check listings
- [x] Support simulation/mock fallback logging for PR comments when App keys are not configured

## Frontend & UI
- [x] Add "Set up CI scanning" action drawer to the project details view
- [x] Display copyable `SECUSCAN_PROJECT_TOKEN` settings panel with clipboard helper
- [x] Show download/copyable parameterized GitHub Action workflow `.github/workflows/secuscan.yml`
- [x] Add action button to trigger project token regeneration dynamically

## Verification
- [x] Verify project listing returns generated API tokens
- [x] Verify CI scanning endpoint triggers repository clones and completes audits successfully
- [x] Verify GitHub Webhook trigger accepts pull request sync notifications, clones branch shas, and logs formatted PR markdown comments correctly in simulator mode
