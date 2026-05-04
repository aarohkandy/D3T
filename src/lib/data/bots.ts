import type { UserProfile } from "./types";
import { appConfig } from "../config";
import { hashText } from "../utils/hash";

type BuiltInBot = UserProfile & {
  skillBand: string;
};

const BUILT_IN_BOTS: BuiltInBot[] = [
  {
    id: "bot_northline",
    username: "northline",
    email: "northline@d3t.local",
    avatarUrl: null,
    wins: 0,
    losses: 0,
    draws: 0,
    quickplayRating: 850,
    quickplayGamesPlayed: 0,
    skillBand: "entry",
  },
  {
    id: "bot_marlowe",
    username: "marlowe",
    email: "marlowe@d3t.local",
    avatarUrl: null,
    wins: 0,
    losses: 0,
    draws: 0,
    quickplayRating: 1050,
    quickplayGamesPlayed: 0,
    skillBand: "steady",
  },
  {
    id: "bot_keene",
    username: "keene",
    email: "keene@d3t.local",
    avatarUrl: null,
    wins: 0,
    losses: 0,
    draws: 0,
    quickplayRating: 1250,
    quickplayGamesPlayed: 0,
    skillBand: "club",
  },
  {
    id: "bot_sable",
    username: "sable",
    email: "sable@d3t.local",
    avatarUrl: null,
    wins: 0,
    losses: 0,
    draws: 0,
    quickplayRating: 1450,
    quickplayGamesPlayed: 0,
    skillBand: "sharp",
  },
  {
    id: "bot_camber",
    username: "camber",
    email: "camber@d3t.local",
    avatarUrl: null,
    wins: 0,
    losses: 0,
    draws: 0,
    quickplayRating: 1650,
    quickplayGamesPlayed: 0,
    skillBand: "strong",
  },
  {
    id: "bot_rialto",
    username: "rialto",
    email: "rialto@d3t.local",
    avatarUrl: null,
    wins: 0,
    losses: 0,
    draws: 0,
    quickplayRating: 1850,
    quickplayGamesPlayed: 0,
    skillBand: "expert",
  },
];

export function isAutomatedPlayerId(userId?: string | null) {
  return Boolean(userId?.startsWith("bot_"));
}

export function getBuiltInBot(userId?: string | null) {
  if (!userId) {
    return null;
  }

  return BUILT_IN_BOTS.find((bot) => bot.id === userId) ?? null;
}

export function getBuiltInBotProfiles() {
  return BUILT_IN_BOTS.map((bot) => ({ ...bot }));
}

export function pickBotForRating(rating: number) {
  const normalizedRating = Number.isFinite(rating) ? rating : 1200;

  return BUILT_IN_BOTS.reduce((best, candidate) => {
    const bestGap = Math.abs(best.quickplayRating - normalizedRating);
    const candidateGap = Math.abs(candidate.quickplayRating - normalizedRating);

    return candidateGap < bestGap ? candidate : best;
  }, BUILT_IN_BOTS[0]);
}

export function getStaticRatingForUser(userId?: string | null) {
  return getBuiltInBot(userId)?.quickplayRating ?? null;
}

export function getQuickplayBotDelayMs(queueId: string) {
  const span = Math.max(1, appConfig.quickplayBotMaxWaitMs - appConfig.quickplayBotMinWaitMs);
  return appConfig.quickplayBotMinWaitMs + (hashText(queueId) % span);
}
