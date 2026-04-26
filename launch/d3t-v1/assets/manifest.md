# D3T V1 Asset Manifest

Status: self-contained for static portal submissions. Video/GIF capture is still optional launch polish and is called out separately.

## Reusable source assets

| Asset | Target path | Status | Notes |
| --- | --- | --- | --- |
| Logo mark | `launch/d3t-v1/assets/source/d3t-mark.svg` | ready | Square D3T mark for press and placeholders. |
| Wordmark | `launch/d3t-v1/assets/source/d3t-wordmark.svg` | ready | Horizontal wordmark for press. |
| Social card | `launch/d3t-v1/assets/source/d3t-og.svg` | ready | OG/Twitter card source. |

## Export checklist

| Asset | Dimensions / format | Required for | Status |
| --- | --- | --- | --- |
| `logo.png` | 1024x1024 transparent PNG | general portals | ready in `launch/d3t-v1/assets/exports/` |
| `logo_small.png` | 240x240 PNG | Product Hunt | ready in `launch/d3t-v1/assets/exports/` |
| `cover_315x250.png` | 315x250 PNG | itch.io | ready in `launch/d3t-v1/assets/exports/` |
| `cover_630x500.png` | 630x500 PNG | itch.io preferred | ready in `launch/d3t-v1/assets/exports/` |
| `thumbnail_300x170.png` | 300x170 PNG | GameJolt | ready in `launch/d3t-v1/assets/exports/` |
| `thumbnail_512x384.png` | 512x384 PNG | Poki, GameDistribution | ready in `launch/d3t-v1/assets/exports/` |
| `thumbnail_512x384.gif` | 512x384 GIF | Poki animated | needs gameplay capture |
| `header_1280x720.png` | 1280x720 PNG | GameJolt, YouTube | ready in `launch/d3t-v1/assets/exports/` |
| `screenshots_1920x1080_*.png` | 5+ 1920x1080 PNG | Steam, portals, press | ready in `launch/d3t-v1/assets/exports/` |
| `gif_hero.gif` | ~800x600 GIF, under 5MB | Reddit/social/press | needs gameplay capture |
| `trailer_30s.mp4` | 1920x1080 H.264 | portals/social | needs edit |
| `trailer_60s.mp4` | 1920x1080 H.264 | YouTube/Steam deferred | needs edit |
| `trailer_vertical_9x16.mp4` | 1080x1920 MP4 | TikTok/Reels | needs edit |
| Steam capsule set | Valve exact dimensions | Steam deferred | ready as art exports, submission deferred |
| iOS screenshot set | Apple exact dimensions | App Store deferred | deferred until native iOS build |
| Android screenshot set | Google exact dimensions | Google Play deferred | deferred until native Android build |

## Rules

- Portal screenshots must show the one-click guest pass-and-play board, not account setup.
- Main-site screenshots can show friend challenges and account flow.
- Crosses are red and circles are blue.
- Keep all text readable at devicePixelRatio 1 and 16:9 iframe sizes.
