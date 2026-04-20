import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import type { D3TGameState, D3TMove } from "@/lib/d3t/engine";
import type { ChallengeStatus, GameMode, GameStatus, TimePresetId } from "@/lib/data/types";

export const profilesTable = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    quickplayRating: integer("quickplay_rating").notNull().default(1200),
    quickplayGamesPlayed: integer("quickplay_games_played").notNull().default(0),
    hasSeenForcedTargetHint: integer("has_seen_forced_target_hint").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("profiles_username_unique").on(table.username)],
);

export const gamesTable = pgTable(
  "games",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    inviteUrl: text("invite_url").notNull(),
    mode: text("mode").$type<GameMode>().notNull(),
    status: text("status").$type<GameStatus>().notNull(),
    rated: integer("rated").notNull().default(0),
    presetId: text("preset_id").$type<TimePresetId>().notNull(),
    creatorId: text("creator_id").notNull(),
    playerXId: text("player_x_id"),
    playerOId: text("player_o_id"),
    starterId: text("starter_id"),
    currentTurnId: text("current_turn_id"),
    winnerId: text("winner_id"),
    challengeId: text("challenge_id"),
    disconnectPlayerId: text("disconnect_player_id"),
    disconnectExpiresAt: timestamp("disconnect_expires_at", { withTimezone: true }),
    playerXLastSeenAt: timestamp("player_x_last_seen_at", { withTimezone: true }),
    playerOLastSeenAt: timestamp("player_o_last_seen_at", { withTimezone: true }),
    initialMs: integer("initial_ms").notNull(),
    incrementMs: integer("increment_ms").notNull(),
    playerXRemainingMs: integer("player_x_remaining_ms").notNull(),
    playerORemainingMs: integer("player_o_remaining_ms").notNull(),
    turnStartedAt: timestamp("turn_started_at", { withTimezone: true }),
    currentStateJson: jsonb("current_state_json").$type<D3TGameState>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("games_room_id_unique").on(table.roomId)],
);

export const movesTable = pgTable(
  "moves",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id").notNull(),
    moveNumber: integer("move_number").notNull(),
    playerId: text("player_id").notNull(),
    moveJson: jsonb("move_json").$type<D3TMove>().notNull(),
    resultingStateJson: jsonb("resulting_state_json").$type<D3TGameState>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("moves_game_move_unique").on(table.gameId, table.moveNumber)],
);

export const challengesTable = pgTable(
  "challenges",
  {
    id: text("id").primaryKey(),
    status: text("status").$type<ChallengeStatus>().notNull(),
    fromUserId: text("from_user_id").notNull(),
    toUserId: text("to_user_id").notNull(),
    presetId: text("preset_id").$type<TimePresetId>().notNull(),
    gameId: text("game_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type DbProfile = typeof profilesTable.$inferSelect;
export type DbGame = typeof gamesTable.$inferSelect;
export type DbMove = typeof movesTable.$inferSelect;
export type DbChallenge = typeof challengesTable.$inferSelect;
