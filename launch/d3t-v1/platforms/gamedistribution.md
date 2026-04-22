# GameDistribution

- status: blocked
- url: https://gamedistribution.com/
- accepts: HTML5 ZIP from `npm run portal:build:gamedistribution`
- assets: 512x384 thumbnail, screenshots, ad-size derivatives if requested
- sdk: GD SDK through the portal SDK adapter only
- metadata: title, description, controls, category, tags
- revenue: ad revenue share across partner network
- blockers: GD SDK QA, final thumbnail/screenshots, account approval
- gotchas: this is a network distribution route; confirm ad calls do not conflict with other portal builds
