import {
  ApplicationIntegrationType,
  Client,
  Events,
  GatewayIntentBits,
  InteractionContextType,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  type Channel,
  type ChatInputCommandInteraction,
  type Client as DiscordClient,
} from "discord.js";
import {
  hasManagementRole,
  managementRoleName,
  partnershipGuildId,
  serverMembersIntentEnabled,
} from "./discord-config";
import { logger } from "./logger";
import {
  handlePartnershipLog,
  handlePartnershipRepresentativeLeave,
  partnershipCommand,
} from "./partnerships";
import { freeAssetsCommand, handleFreeAssets } from "./free-assets";

const sayCommand = new SlashCommandBuilder()
  .setName("say")
  .setDescription("Post a message as the bot")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("The message to post")
      .setRequired(true)
      .setMaxLength(2000),
  );

function requiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Replit Secret: ${name}`);
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function reportInteractionFailure(
  interaction: ChatInputCommandInteraction,
  commandLabel: string,
  error: unknown,
) {
  logger.error(
    {
      error: errorMessage(error),
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    },
    "Discord interaction failed",
  );

  const reply = `Something went wrong while handling ${commandLabel}.`;
  if (interaction.deferred || interaction.replied) {
    void interaction.editReply(reply).catch(() => undefined);
  } else {
    void interaction
      .reply({ content: reply, flags: MessageFlags.Ephemeral })
      .catch(() => undefined);
  }
}

async function handleSay(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.member) {
    await interaction.editReply(
      "I couldn't verify your server roles. Please try again.",
    );
    return;
  }

  if (!hasManagementRole(interaction)) {
    await interaction.editReply(
      `Only members with the **${managementRoleName}** role can use \`/say\`.`,
    );
    return;
  }

  let channel: Channel | null = interaction.channel;
  if (!channel) {
    try {
      channel = await interaction.client.channels.fetch(interaction.channelId);
    } catch (error) {
      logger.warn(
        {
          guildId,
          channelId: interaction.channelId,
          error: errorMessage(error),
        },
        "The bot cannot access this Discord channel",
      );
      await interaction.editReply(
        "I can't access this channel as a bot. Make sure the bot is installed in this server and has View Channel and Send Messages permissions.",
      );
      return;
    }
  }

  if (!channel?.isSendable()) {
    await interaction.editReply("I can't send messages in this channel.");
    return;
  }

  try {
    const message = interaction.options.getString("message", true);
    await channel.send({
      content: message,
      allowedMentions: { parse: [] },
    });
    await interaction.editReply("Message sent.");
  } catch (error) {
    logger.error(
      {
        error: errorMessage(error),
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      },
      "Discord /say failed",
    );
    await interaction.editReply(
      "I couldn't send that message. Check that I can send messages in this channel.",
    );
  }
}

export async function startDiscordBot(): Promise<DiscordClient> {
  const token = requiredSecret("DISCORD_BOT_TOKEN");
  const applicationId = requiredSecret("DISCORD_APPLICATION_ID");
  const intents: GatewayIntentBits[] = [GatewayIntentBits.Guilds];
  if (serverMembersIntentEnabled) {
    intents.push(GatewayIntentBits.GuildMembers);
  }
  const client = new Client({ intents });
  const rest = new REST({ version: "10" }).setToken(token);

  client.on(Events.ClientReady, (readyClient) => {
    logger.info({ bot: readyClient.user.tag }, "Discord bot is ready");
  });
  client.on(Events.Error, (error) => {
    logger.error({ error: error.message }, "Discord client error");
  });

  if (serverMembersIntentEnabled) {
    client.on(Events.GuildMemberRemove, (member) => {
      void handlePartnershipRepresentativeLeave(member).catch(
        (error: unknown) => {
          logger.error(
            {
              error: errorMessage(error),
              guildId: member.guild.id,
              representativeId: member.id,
            },
            "Could not process partnership representative departure",
          );
        },
      );
    });
  } else {
    logger.warn(
      "Partnership departure alerts are disabled. Enable Server Members Intent in Discord and set DISCORD_SERVER_MEMBERS_INTENT_ENABLED=true to turn them on.",
    );
  }

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    logger.info(
      {
        command: interaction.commandName,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      },
      "Discord command received",
    );

    if (interaction.commandName === "say") {
      void handleSay(interaction).catch((error: unknown) =>
        reportInteractionFailure(interaction, "`/say`", error),
      );
      return;
    }

    if (interaction.commandName === "partnership") {
      void handlePartnershipLog(interaction).catch((error: unknown) =>
        reportInteractionFailure(interaction, "`/partnership`", error),
      );
      return;
    }

    if (interaction.commandName === "free-assets") {
      void handleFreeAssets(interaction).catch((error: unknown) =>
        reportInteractionFailure(interaction, "`/free-assets`", error),
      );
    }
  });

  const commandRoute = Routes.applicationGuildCommands(
    applicationId,
    partnershipGuildId,
  );
  const existingCommands = (await rest.get(commandRoute)) as Array<{
    id: string;
    name: string;
  }>;

  for (const command of [sayCommand, partnershipCommand, freeAssetsCommand]) {
    const commandData = command.toJSON();
    const existingCommand = existingCommands.find(
      (registered) => registered.name === commandData.name,
    );

    if (existingCommand) {
      await rest.patch(
        Routes.applicationGuildCommand(
          applicationId,
          partnershipGuildId,
          existingCommand.id,
        ),
        { body: commandData },
      );
      logger.info(
        { command: commandData.name, guildId: partnershipGuildId },
        "Updated server Discord command",
      );
    } else {
      await rest.post(commandRoute, { body: commandData });
      logger.info(
        { command: commandData.name, guildId: partnershipGuildId },
        "Registered server Discord command",
      );
    }
  }

  await client.login(token);
  return client;
}
