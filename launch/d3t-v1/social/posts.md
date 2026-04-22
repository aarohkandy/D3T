# D3T V1 Social Posts

Status: ready pending final screenshots/video and production URL smoke test.

## Primary launch post

D3T is live.

It is three-layer Grandfather Tic-Tac-Toe: one move sends your opponent into the next forced board, so every tiny square changes the whole match.

Play here: https://d3-t.vercel.app

## Portal-friendly post

D3T is a one-click browser strategy game built from Tic-Tac-Toe, nested three layers deep. Red Xs, blue Os, forced replies, and a board that gets mean fast.

## Show HN comment

I built D3T after playing a paper version with friends: Tic-Tac-Toe inside Tic-Tac-Toe inside Tic-Tac-Toe. The interesting rule is forced routing: if you play `t1=4, t2=5, t3=6`, the next player must play in `t1=5, t2=6`.

The main app is Next.js on Vercel with Supabase auth/Postgres/realtime for friend challenges. I also made a self-contained portal build for one-click guest play so HTML5 game sites do not depend on auth or backend state.

## Reddit title options

- I made D3T, three-layer Tic-Tac-Toe where every move sends your opponent to a forced board
- Playtest request: D3T, a nested Tic-Tac-Toe strategy game for the browser
- D3T is live: Grandfather Tic-Tac-Toe with forced replies and live challenges

## First reply with link

Playable link: https://d3-t.vercel.app

Would genuinely love feedback on whether the forced-board highlighting makes sense on the first game.
