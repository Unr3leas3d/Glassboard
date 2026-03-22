/**
 * Headless bot simulator for Glasboard multi-user testing.
 *
 * Usage:
 *   npx tsx scripts/test-bot.ts --code <JOIN_CODE> [options]
 *
 * Options:
 *   --code, -c     Session join code (required)
 *   --bots, -n     Number of bots (default: 1)
 *   --email        Test account email (or TEST_BOT_EMAIL env var)
 *   --password     Test account password (or TEST_BOT_PASSWORD env var)
 *   --pattern      Cursor movement: "random" | "circle" | "figure8" (default: "circle")
 *   --interval     Cursor broadcast interval in ms (default: 100)
 *   --duration     Run duration in seconds, 0=infinite (default: 0)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// --- CLI argument parsing ---
function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      opts[key] = args[++i] ?? "";
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      opts[key] = args[++i] ?? "";
    }
  }

  return {
    code: opts.code ?? opts.c ?? "",
    bots: parseInt(opts.bots ?? opts.n ?? "1", 10),
    email: opts.email ?? process.env.TEST_BOT_EMAIL ?? "",
    password: opts.password ?? process.env.TEST_BOT_PASSWORD ?? "",
    pattern: (opts.pattern ?? "circle") as "random" | "circle" | "figure8",
    interval: parseInt(opts.interval ?? "100", 10),
    duration: parseInt(opts.duration ?? "0", 10),
  };
}

// --- Cursor movement patterns ---
const SCREEN_W = 1920;
const SCREEN_H = 1080;
const CENTER_X = SCREEN_W / 2;
const CENTER_Y = SCREEN_H / 2;
const RADIUS = 300;

function cursorPosition(
  pattern: "random" | "circle" | "figure8",
  t: number,
  phaseOffset: number,
): { x: number; y: number } {
  const angle = t + phaseOffset;
  switch (pattern) {
    case "circle":
      return {
        x: CENTER_X + Math.cos(angle) * RADIUS,
        y: CENTER_Y + Math.sin(angle) * RADIUS,
      };
    case "figure8":
      return {
        x: CENTER_X + Math.sin(angle) * RADIUS,
        y: CENTER_Y + Math.sin(angle * 2) * (RADIUS / 2),
      };
    case "random":
      return {
        x: Math.random() * SCREEN_W,
        y: Math.random() * SCREEN_H,
      };
  }
}

// --- Bot colors ---
const BOT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

// --- Main ---
async function main() {
  const config = parseArgs();

  if (!config.code) {
    console.error("Error: --code <JOIN_CODE> is required");
    process.exit(1);
  }
  if (!config.email || !config.password) {
    console.error(
      "Error: Provide --email/--password or set TEST_BOT_EMAIL/TEST_BOT_PASSWORD env vars",
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Authenticate
  console.log(`Authenticating as ${config.email}...`);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });

  if (authError) {
    console.error("Auth failed:", authError.message);
    process.exit(1);
  }
  console.log("Authenticated.");

  // Look up session by join code
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("join_code", config.code.toUpperCase())
    .eq("status", "active")
    .single();

  if (sessionError || !session) {
    console.error("Session not found or ended:", sessionError?.message ?? "no data");
    process.exit(1);
  }

  console.log(`Found session: ${session.id} (code: ${session.join_code})`);
  console.log(`Spawning ${config.bots} bot(s) with "${config.pattern}" pattern...`);

  // Spawn bots
  const channels: RealtimeChannel[] = [];
  const intervals: ReturnType<typeof setInterval>[] = [];
  let totalSent = 0;

  for (let i = 0; i < config.bots; i++) {
    const botId = randomUUID();
    const botName = `Bot-${i + 1}`;
    const botColor = BOT_COLORS[i % BOT_COLORS.length];
    const phaseOffset = (i / config.bots) * Math.PI * 2;

    // Each bot needs its own Supabase client so they get independent channel
    // subscriptions with unique presenceRefs for the same channel name.
    const botClient = createClient(supabaseUrl, supabaseKey);
    // Sign in with the same credentials — lightweight, reuses the same session token
    await botClient.auth.signInWithPassword({
      email: config.email,
      password: config.password,
    });

    const channel = botClient.channel(`session:${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`  ${botName} connected`);

        // Track presence
        channel.track({
          userId: botId,
          name: botName,
          color: botColor,
          isHost: false,
        });

        // Start cursor movement
        let t = 0;
        const step = (config.interval / 1000) * 0.5; // speed factor

        const iv = setInterval(() => {
          t += step;
          const pos = cursorPosition(config.pattern, t, phaseOffset);

          channel.send({
            type: "broadcast",
            event: "cursor_move",
            payload: { userId: botId, name: botName, x: pos.x, y: pos.y },
          });

          totalSent++;
          if (totalSent % 100 === 0) {
            process.stdout.write(`\r  Messages sent: ${totalSent}`);
          }
        }, config.interval);

        intervals.push(iv);
      } else {
        console.log(`  ${botName} status: ${status}`);
      }
    });

    channels.push(channel);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n\nShutting down...");
    for (const iv of intervals) clearInterval(iv);
    for (const ch of channels) {
      await ch.untrack();
      await ch.unsubscribe();
    }
    console.log(`Total messages sent: ${totalSent}`);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Duration-based auto-stop
  if (config.duration > 0) {
    setTimeout(() => {
      console.log(`\nDuration (${config.duration}s) reached.`);
      shutdown();
    }, config.duration * 1000);
  }

  console.log("Bots running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
