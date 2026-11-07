import app from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { startDiscordBot } from "./lib/discord-bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  const discordClient = await startDiscordBot();
  const server = app.listen(port, () => {
    logger.info({ port }, "API server listening");
  });

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Shutting down Discord bot and API server");
    discordClient.destroy();
    server.close((error) => {
      void pool
        .end()
        .then(() => {
          if (error) {
            logger.error(
              { error: error.message },
              "API server shutdown failed",
            );
            process.exitCode = 1;
            return;
          }
          process.exitCode = 0;
        })
        .catch((poolError: unknown) => {
          logger.error(
            {
              error:
                poolError instanceof Error
                  ? poolError.message
                  : "Unknown database shutdown error",
            },
            "Database shutdown failed",
          );
          process.exitCode = 1;
        });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch((error: unknown) => {
  logger.fatal(
    { error: error instanceof Error ? error.message : "Unknown error" },
    "Could not start the Discord bot service",
  );
  process.exit(1);
});
