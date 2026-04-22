# D3T V1 QA Checklist

## Repo checks

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run portal:build:all`

## Portal ZIP checks

- [ ] Generic portal build opens offline from `dist/portal/generic/index.html`.
- [ ] First click can be a legal board move; no account, auth, Supabase, or external link required.
- [ ] Board is readable at 16:9, DPR 1, and mobile widths.
- [ ] Spacebar and arrow keys do not scroll the page.
- [ ] `user-select: none` is active on body.
- [ ] Timer ticks, timeout result resolves, and rematch resets the board.
- [ ] CrazyGames build loads only CrazyGames SDK and fires gameplay start/stop once per state change.
- [ ] Poki build loads only Poki SDK and does not double-fire consecutive gameplay events.
- [ ] GameDistribution build loads only GD ad calls.

## Main-site launch checks

- [ ] Production URL resolves.
- [ ] `/privacy`, `/terms`, `/presskit`, `/robots.txt`, `/sitemap.xml`, and `/manifest.webmanifest` resolve.
- [ ] Sign up, sign in, challenge by username, accept/decline, resign, reconnect, and disconnect forfeit pass.
- [ ] No visible pre-release wording.
- [ ] Username and display name are the same everywhere.

## Submission checks

- [ ] Every platform file has status and blocker notes.
- [ ] Metadata fields in `metadata.yml` are filled with final URLs and contact email.
- [ ] Required raster assets exist or are marked deferred/prepared-only for native stores.
- [ ] Reddit/HN/Product Hunt/social posts use the same canonical hook.
