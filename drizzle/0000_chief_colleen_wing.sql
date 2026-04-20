CREATE TABLE "challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"preset_id" text NOT NULL,
	"game_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"invite_url" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"rated" integer DEFAULT 0 NOT NULL,
	"preset_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"player_x_id" text,
	"player_o_id" text,
	"starter_id" text,
	"current_turn_id" text,
	"winner_id" text,
	"challenge_id" text,
	"disconnect_player_id" text,
	"disconnect_expires_at" timestamp with time zone,
	"player_x_last_seen_at" timestamp with time zone,
	"player_o_last_seen_at" timestamp with time zone,
	"initial_ms" integer NOT NULL,
	"increment_ms" integer NOT NULL,
	"player_x_remaining_ms" integer NOT NULL,
	"player_o_remaining_ms" integer NOT NULL,
	"turn_started_at" timestamp with time zone,
	"current_state_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "moves" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"move_number" integer NOT NULL,
	"player_id" text NOT NULL,
	"move_json" jsonb NOT NULL,
	"resulting_state_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"quickplay_rating" integer DEFAULT 1200 NOT NULL,
	"quickplay_games_played" integer DEFAULT 0 NOT NULL,
	"has_seen_forced_target_hint" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "games_room_id_unique" ON "games" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moves_game_move_unique" ON "moves" USING btree ("game_id","move_number");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_unique" ON "profiles" USING btree ("username");