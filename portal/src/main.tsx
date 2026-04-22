import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { D3T_INDICES, getPathLabel, type D3TIndex, type D3TMove } from "../../src/lib/d3t";

import {
  applyPortalMove,
  createPortalGame,
  generateLegalPortalMoves,
  isPortalMoveLegal,
  resetPortalState,
  tickPortalTimers,
  type PortalGame,
} from "./portal-game";
import { createPortalSdkAdapter } from "./sdk";
import "./styles.css";

const sdk = createPortalSdkAdapter({
  target: __D3T_PORTAL_TARGET__,
  win: window,
  doc: document,
});

function formatClock(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function usePortalClock(game: PortalGame, setGame: React.Dispatch<React.SetStateAction<PortalGame>>) {
  useEffect(() => {
    if (game.result || game.state.status !== "active") {
      return;
    }

    const interval = window.setInterval(() => {
      setGame((current) => tickPortalTimers(current, { now: performance.now() }));
    }, 250);

    return () => window.clearInterval(interval);
  }, [game.result, game.state.status, setGame]);
}

function App() {
  const [game, setGame] = useState(() => createPortalGame({ now: performance.now() }));
  const [started, setStarted] = useState(false);
  const stoppedRef = useRef(false);

  usePortalClock(game, setGame);

  useEffect(() => {
    const preventScrollKeys = (event: KeyboardEvent) => {
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
      }
    };

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    window.addEventListener("keydown", preventScrollKeys, { passive: false });

    sdk.loadingProgress(0.35);
    void sdk.load().finally(() => {
      sdk.loadingProgress(1);
      sdk.loadingFinished();
    });

    return () => {
      window.removeEventListener("keydown", preventScrollKeys);
    };
  }, []);

  useEffect(() => {
    if (game.result && !stoppedRef.current) {
      sdk.gameplayStop();
      stoppedRef.current = true;
    }
  }, [game.result]);

  const legalKeys = useMemo(() => {
    return new Set(generateLegalPortalMoves(game).map((move) => getPathLabel(move.t1, move.t2, move.t3)));
  }, [game]);

  const statusText = game.result
    ? game.result.type === "timeout"
      ? `${game.result.winner} wins on time`
      : game.result.winner
        ? `${game.result.winner} wins`
        : "Draw"
    : game.state.nextForced
      ? `${game.state.turn} to move in ${game.state.nextForced.t1},${game.state.nextForced.t2}`
      : `${game.state.turn} can play anywhere`;

  const playMove = (move: D3TMove) => {
    if (!isPortalMoveLegal(game, move)) {
      return;
    }

    if (!started) {
      sdk.gameplayStart();
      setStarted(true);
      stoppedRef.current = false;
    }

    setGame((current) => applyPortalMove(current, move, performance.now()));
  };

  const reset = () => {
    sdk.gameplayStop();
    stoppedRef.current = false;
    setStarted(false);
    setGame((current) => resetPortalState(current));
  };

  return (
    <main className="portal-shell">
      <section className="hud" aria-label="D3T match status">
        <div className={game.state.turn === "X" ? "clock active x" : "clock x"}>
          <span>X</span>
          <strong>{formatClock(game.timers.X)}</strong>
        </div>
        <div className="title-block">
          <p>D3T</p>
          <h1>{statusText}</h1>
        </div>
        <div className={game.state.turn === "O" ? "clock active o" : "clock o"}>
          <span>O</span>
          <strong>{formatClock(game.timers.O)}</strong>
        </div>
      </section>

      <section className="board-wrap" aria-label="D3T board">
        <div className="board" role="grid" aria-label="Three-layer tic-tac-toe board">
          {D3T_INDICES.flatMap((t1) =>
            D3T_INDICES.flatMap((t2) =>
              D3T_INDICES.map((t3) => {
                const leaf = game.state.board.boards[t1 - 1].boards[t2 - 1];
                const owner = leaf.cells[t3 - 1];
                const key = getPathLabel(t1, t2, t3);
                const isLegal = legalKeys.has(key);
                const move = { t1: t1 as D3TIndex, t2: t2 as D3TIndex, t3: t3 as D3TIndex };
                const isLast = game.state.lastMove
                  ? key === getPathLabel(game.state.lastMove.t1, game.state.lastMove.t2, game.state.lastMove.t3)
                  : false;

                return (
                  <button
                    key={key}
                    type="button"
                    className={["cell", owner?.toLowerCase() ?? "", isLegal ? "legal" : "locked", isLast ? "last" : ""].join(" ")}
                    disabled={!isLegal}
                    aria-label={`Cell ${key}${owner ? ` occupied by ${owner}` : ""}`}
                    onClick={() => playMove(move)}
                  >
                    {owner}
                  </button>
                );
              }),
            ),
          )}
        </div>
      </section>

      <section className="footer-panel">
        <p>
          First move goes anywhere. Then the medium and small coordinates send the next player to a forced board.
        </p>
        <button type="button" onClick={reset}>
          Rematch
        </button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
