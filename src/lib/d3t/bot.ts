import {
  applyMoveToState,
  generateLegalMoves,
  getForcedBoard,
  oppositeMark,
  type D3TGameState,
  type D3TMark,
  type D3TMove,
} from "./engine";
import { createSeededRng, hashText } from "../utils/hash";

type BotSkillProfile = {
  depth: number;
  rootWidth: number;
  branchWidth: number;
  pickCount: number;
  softness: number;
};

type ScoredMove = {
  move: D3TMove;
  score: number;
};

const TOP_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

const POSITION_WEIGHTS = [3, 2, 3, 2, 4, 2, 3, 2, 3] as const;
const TOP_LINE_SCORES = [0, 28, 180, 0] as const;
const MIDDLE_LINE_SCORES = [0, 12, 75, 0] as const;
const LEAF_LINE_SCORES = [0, 6, 42, 0] as const;

function getSkillProfile(rating: number, state: D3TGameState): BotSkillProfile {
  const forced = Boolean(getForcedBoard(state));
  const moveCount = state.moveCount;

  if (rating >= 1800) {
    return {
      depth: forced || moveCount >= 12 ? 4 : 3,
      rootWidth: forced ? 9 : moveCount < 2 ? 20 : 16,
      branchWidth: forced ? 9 : 8,
      pickCount: 1,
      softness: 0,
    };
  }

  if (rating >= 1550) {
    return {
      depth: forced || moveCount >= 10 ? 3 : 2,
      rootWidth: forced ? 9 : 18,
      branchWidth: forced ? 9 : 8,
      pickCount: 2,
      softness: 10,
    };
  }

  if (rating >= 1250) {
    return {
      depth: forced ? 3 : 2,
      rootWidth: forced ? 9 : 16,
      branchWidth: forced ? 9 : 7,
      pickCount: 3,
      softness: 18,
    };
  }

  if (rating >= 1000) {
    return {
      depth: 2,
      rootWidth: forced ? 9 : 14,
      branchWidth: forced ? 9 : 6,
      pickCount: 4,
      softness: 28,
    };
  }

  return {
    depth: 1,
    rootWidth: forced ? 9 : 12,
    branchWidth: forced ? 9 : 5,
    pickCount: 5,
    softness: 42,
  };
}

function countLine(line: readonly (D3TMark | null)[], mark: D3TMark) {
  let own = 0;
  let opp = 0;
  const enemy = mark === "X" ? "O" : "X";

  for (const cell of line) {
    if (cell === mark) {
      own += 1;
    } else if (cell === enemy) {
      opp += 1;
    }
  }

  return { own, opp };
}

function scoreLines(cells: readonly (D3TMark | null)[], mark: D3TMark, weights: readonly number[]) {
  let score = 0;

  for (const [a, b, c] of TOP_LINES) {
    const sample = [cells[a], cells[b], cells[c]] as const;
    const { own, opp } = countLine(sample, mark);

    if (own > 0 && opp > 0) {
      continue;
    }

    if (own > 0) {
      score += weights[own];
    } else if (opp > 0) {
      score -= weights[opp];
    }
  }

  return score;
}

function evaluateLeafBoards(state: D3TGameState, mark: D3TMark) {
  let score = 0;

  for (let t1 = 0; t1 < state.board.boards.length; t1 += 1) {
    const middle = state.board.boards[t1];
    const middleWeight = POSITION_WEIGHTS[t1];

    for (let t2 = 0; t2 < middle.boards.length; t2 += 1) {
      const leaf = middle.boards[t2];
      const boardWeight = middleWeight * POSITION_WEIGHTS[t2];

      if (leaf.status === "won" && leaf.winner) {
        score += (leaf.winner === mark ? 30 : -30) * boardWeight;
        continue;
      }

      if (leaf.status !== "open") {
        continue;
      }

      score += scoreLines(leaf.cells, mark, LEAF_LINE_SCORES) * boardWeight;

      for (let t3 = 0; t3 < leaf.cells.length; t3 += 1) {
        if (leaf.cells[t3] === mark) {
          score += POSITION_WEIGHTS[t3] * boardWeight;
        } else if (leaf.cells[t3] !== null) {
          score -= POSITION_WEIGHTS[t3] * boardWeight;
        }
      }
    }
  }

  return score;
}

function evaluateMiddleBoards(state: D3TGameState, mark: D3TMark) {
  let score = 0;

  for (let index = 0; index < state.middleBoardSummaries.length; index += 1) {
    const summary = state.middleBoardSummaries[index];
    const boardWeight = POSITION_WEIGHTS[index];

    if (summary.status === "won" && summary.winner) {
      score += (summary.winner === mark ? 65 : -65) * boardWeight;
      continue;
    }

    score += scoreLines(summary.cellOwners, mark, MIDDLE_LINE_SCORES) * boardWeight;
  }

  return score;
}

function evaluateForcedBoard(state: D3TGameState, mark: D3TMark) {
  const forced = getForcedBoard(state);

  if (!forced) {
    return state.turn === mark ? 4 : -4;
  }

  const middleWeight = POSITION_WEIGHTS[forced.t1 - 1];
  const leafWeight = POSITION_WEIGHTS[forced.t2 - 1];
  return (state.turn === mark ? 1 : -1) * middleWeight * leafWeight * 3;
}

function evaluateState(state: D3TGameState, mark: D3TMark) {
  const enemy = mark === "X" ? "O" : "X";

  if (state.status === "finished") {
    if (state.winner === mark) {
      return 1_000_000 - state.moveCount;
    }

    if (state.winner === enemy) {
      return -1_000_000 + state.moveCount;
    }

    return 0;
  }

  const scoreDiff = (state.score[mark] - state.score[enemy]) * 260;
  const topLines = scoreLines(state.topBoardOwners, mark, TOP_LINE_SCORES) * 26;

  return (
    scoreDiff +
    topLines +
    evaluateMiddleBoards(state, mark) +
    evaluateLeafBoards(state, mark) +
    evaluateForcedBoard(state, mark)
  );
}

function scoreMoveHeuristic(state: D3TGameState, move: D3TMove, rootMark: D3TMark) {
  const priorLeaf = state.board.boards[move.t1 - 1].boards[move.t2 - 1];
  const priorMiddle = state.board.boards[move.t1 - 1];
  const nextState = applyMoveToState(state, move, state.turn);
  const nextLeaf = nextState.board.boards[move.t1 - 1].boards[move.t2 - 1];
  const nextMiddle = nextState.board.boards[move.t1 - 1];
  let score = evaluateState(nextState, rootMark);
  const rootIsMover = state.turn === rootMark;
  const direction = rootIsMover ? 1 : -1;
  const leafWeight = POSITION_WEIGHTS[move.t1 - 1] * POSITION_WEIGHTS[move.t2 - 1];
  const middleWeight = POSITION_WEIGHTS[move.t1 - 1];

  if (nextState.status === "finished") {
    if (nextState.winner === rootMark) {
      score += 250_000;
    } else if (nextState.winner === null) {
      score += 1_000;
    } else {
      score -= 250_000;
    }
  }

  if (priorLeaf.status !== "won" && nextLeaf.status === "won" && nextLeaf.winner === state.turn) {
    score += 1_800 * leafWeight * direction;
  }

  if (
    priorMiddle.status !== "won" &&
    nextMiddle.status === "won" &&
    nextMiddle.winner === state.turn
  ) {
    score += 9_000 * middleWeight * direction;
  }

  if (nextState.nextForced === null) {
    score -= 12;
  }

  return score;
}

function lineWinner(values: readonly (D3TMark | null)[]) {
  for (const [a, b, c] of TOP_LINES) {
    const first = values[a];
    if (first && first === values[b] && first === values[c]) {
      return first;
    }
  }

  return null;
}

function scoreImmediateTactic(state: D3TGameState, move: D3TMove, mark: D3TMark) {
  const middle = state.board.boards[move.t1 - 1];
  const leaf = middle.boards[move.t2 - 1];

  if (leaf.status !== "open" || leaf.cells[move.t3 - 1] !== null) {
    return 0;
  }

  const leafCells = [...leaf.cells];
  leafCells[move.t3 - 1] = mark;
  const leafWinner = lineWinner(leafCells);

  if (leafWinner !== mark) {
    return 0;
  }

  let score = 100_000;
  const middleOwners = middle.boards.map((child) => (child.status === "won" ? child.winner : null));
  middleOwners[move.t2 - 1] = mark;

  if (lineWinner(middleOwners) !== mark) {
    return score;
  }

  score = 500_000;
  const topOwners = [...state.topBoardOwners];
  topOwners[move.t1 - 1] = mark;

  if (lineWinner(topOwners) === mark) {
    score = 1_000_000;
  }

  return score;
}

function pickTacticalMove(state: D3TGameState, legalMoves: D3TMove[]) {
  const ownWins = legalMoves
    .map((move) => ({
      move,
      score: scoreImmediateTactic(state, move, state.turn),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        scoreMoveHeuristic(state, right.move, state.turn) -
          scoreMoveHeuristic(state, left.move, state.turn),
    );

  if (ownWins.length > 0) {
    return ownWins[0].move;
  }

  const enemy = oppositeMark(state.turn);
  const blocks = legalMoves
    .map((move) => ({
      move,
      score: scoreImmediateTactic(state, move, enemy),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        scoreMoveHeuristic(state, right.move, state.turn) -
          scoreMoveHeuristic(state, left.move, state.turn),
    );

  return blocks[0]?.move ?? null;
}

function orderMoves(state: D3TGameState, moves: D3TMove[], rootMark: D3TMark, limit: number) {
  return moves
    .map((move) => ({
      move,
      score: scoreMoveHeuristic(state, move, rootMark),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function search(
  state: D3TGameState,
  depth: number,
  alpha: number,
  beta: number,
  rootMark: D3TMark,
  branchWidth: number,
): number {
  if (depth === 0 || state.status === "finished") {
    return evaluateState(state, rootMark);
  }

  const legalMoves = generateLegalMoves(state);
  if (!legalMoves.length) {
    return evaluateState(state, rootMark);
  }

  const maximizing = state.turn === rootMark;
  const orderedMoves = orderMoves(
    state,
    legalMoves,
    rootMark,
    Math.min(legalMoves.length, branchWidth),
  );

  if (maximizing) {
    let best = Number.NEGATIVE_INFINITY;

    for (const candidate of orderedMoves) {
      const score = search(
        applyMoveToState(state, candidate.move, state.turn),
        depth - 1,
        alpha,
        beta,
        rootMark,
        branchWidth,
      );
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);

      if (beta <= alpha) {
        break;
      }
    }

    return best;
  }

  let best = Number.POSITIVE_INFINITY;

  for (const candidate of orderedMoves) {
    const score = search(
      applyMoveToState(state, candidate.move, state.turn),
      depth - 1,
      alpha,
      beta,
      rootMark,
      branchWidth,
    );
    best = Math.min(best, score);
    beta = Math.min(beta, score);

    if (beta <= alpha) {
      break;
    }
  }

  return best;
}

function pickMove(scoredMoves: ScoredMove[], pickCount: number, softness: number, seed: string) {
  const contenders = scoredMoves.slice(0, Math.max(1, Math.min(pickCount, scoredMoves.length)));
  if (contenders.length === 1 || softness <= 0) {
    return contenders[0].move;
  }

  const bestScore = contenders[0].score;
  const rng = createSeededRng(seed);
  const weights = contenders.map(({ score }, index) => {
    const gap = Math.max(0, bestScore - score);
    const damped = Math.exp(-gap / softness);
    return damped * (1 / (index + 1));
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let target = rng() * totalWeight;

  for (let index = 0; index < contenders.length; index += 1) {
    target -= weights[index];

    if (target <= 0) {
      return contenders[index].move;
    }
  }

  return contenders[0].move;
}

export function chooseBotMove({
  state,
  rating,
  seed,
}: {
  state: D3TGameState;
  rating: number;
  seed: string;
}) {
  const legalMoves = generateLegalMoves(state);
  if (!legalMoves.length) {
    throw new Error("No legal moves available for the bot.");
  }

  const tacticalMove = pickTacticalMove(state, legalMoves);
  if (tacticalMove) {
    return tacticalMove;
  }

  const skill = getSkillProfile(rating, state);
  let scoredMoves = orderMoves(
    state,
    legalMoves,
    state.turn,
    Math.min(legalMoves.length, skill.rootWidth),
  );

  for (let depth = 1; depth < skill.depth; depth += 1) {
    scoredMoves = scoredMoves
      .map(({ move }) => ({
        move,
        score: search(
          applyMoveToState(state, move, state.turn),
          depth,
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          state.turn,
          skill.branchWidth,
        ),
      }))
      .sort((left, right) => right.score - left.score);
  }

  return pickMove(
    scoredMoves,
    skill.pickCount,
    skill.softness,
    `${seed}:${hashText(JSON.stringify(scoredMoves[0]?.move ?? {}))}`,
  );
}

export function getBotThinkTimeMs({
  gameId,
  moveCount,
  rating,
}: {
  gameId: string;
  moveCount: number;
  rating: number;
}) {
  const baseline = rating >= 1600 ? 2400 : rating >= 1200 ? 1900 : 1400;
  const phaseAdjustment = Math.min(900, moveCount * 90);
  const jitter = hashText(`${gameId}:${moveCount}:${rating}`) % 900;

  return baseline + phaseAdjustment + jitter;
}
