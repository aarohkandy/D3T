# D3T V1 QA Checklist

Last verified locally: 2026-04-26.

## Repo checks

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run portal:build:all`

## Portal ZIP checks

- [x] Portal ZIPs exist in `launch/d3t-v1/builds/` for generic, CrazyGames, Poki, and GameDistribution.
- [x] First click can be a legal board move; no account, auth, Supabase, or external link required by portal code.
- [x] Board CSS uses fixed aspect ratio and viewport constraints for 16:9 and mobile widths.
- [x] Spacebar and arrow-key page scroll is prevented in portal code.
- [x] `user-select: none` is active on body.
- [x] Timer, timeout result, and rematch are implemented in portal state.
- [x] CrazyGames build uses only the CrazyGames adapter target.
- [x] Poki build uses only the Poki adapter target and duplicate event guard.
- [x] GameDistribution build uses only the GameDistribution adapter target.

## Main-site launch checks

- [x] Production URL resolves: `https://d3-t.vercel.app`.
- [x] `/privacy`, `/terms`, `/presskit`, `/robots.txt`, `/sitemap.xml`, and `/manifest.webmanifest` resolve.
- [ ] Sign up, sign in, challenge by username, accept/decline, resign, reconnect, and disconnect forfeit pass.
- [ ] No visible pre-release wording.
- [ ] Username and display name are the same everywhere.

## Submission checks

- [x] Every platform file has status and blocker notes.
- [x] Launch metadata has final URLs; owner sender email is the only human input still required for outreach.
- [x] Required static raster assets exist or are marked deferred/prepared-only for native stores.
- [ ] Reddit/HN/Product Hunt/social posts use the same canonical hook.
