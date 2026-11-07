import { db, partnershipLogsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import {
  ApplicationIntegrationType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import {
  hasPartnershipAccessRole,
  managementRoleId,
  managementRoleName,
  partnershipGuildId,
  partnershipLogChannelId,
  partnershipPingRoleId,
  staffTeamRoleName,
} from "./discord-config";
import { logger } from "./logger";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export const partnershipCommand = new SlashCommandBuilder()
  .setName("partnership")
  .setDescription("Log a partnership advertisement")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((option) =>
    option
      .setName("representative")
      .setDescription("The partnership representative")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("advertisement")
      .setDescription("The advertisement to post")
      .setRequired(true)
      .setMaxLength(1800),
  );

export async function handlePartnershipLog(
  interaction: ChatInputCommandInteraction,
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (interaction.guildId !== partnershipGuildId) {
    await interaction.editReply(
      "Partnership logging is only configured for the SHR server.",
    );
    return;
  }

  if (!hasPartnershipAccessRole(interaction)) {
    await interaction.editReply(
      `Only members with the **${managementRoleName}** or **${staffTeamRoleName}** role can use this command.`,
    );
    return;
  }

  const representative = interaction.options.getUser("representative", true);
  const advertisement = interaction.options
    .getString("advertisement", true)
    .trim();

  if (!advertisement) {
    await interaction.editReply("Please enter the advertisement text.");
    return;
  }

  let channel;
  try {
    channel = await interaction.client.channels.fetch(partnershipLogChannelId);
  } catch (error) {
    logger.warn(
      {
        guildId: interaction.guildId,
        channelId: partnershipLogChannelId,
        error: errorMessage(error),
      },
      "Could not access the partnership log channel",
    );
    await interaction.editReply(
      `I couldn't access <#${partnershipLogChannelId}>. Make sure the bot can view and send messages there.`,
    );
    return;
  }

  if (
    !channel?.isSendable() ||
    !("guildId" in channel) ||
    channel.guildId !== partnershipGuildId
  ) {
    await interaction.editReply(
      `<#${partnershipLogChannelId}> isn't available as a sendable channel in the configured server.`,
    );
    return;
  }

  const [savedLog] = await db
    .insert(partnershipLogsTable)
    .values({
      guildId: partnershipGuildId,
      representativeId: representative.id,
      advertisement,
      logChannelId: partnershipLogChannelId,
      loggedById: interaction.user.id,
    })
    .returning({ id: partnershipLogsTable.id });

  if (!savedLog) {
    throw new Error("The partnership log could not be saved.");
  }

  const embed = new EmbedBuilder()
    .setTitle("Partnership Advertisement")
    .setDescription(advertisement)
    .addFields({
      name: "Representative",
      value: `<@${representative.id}>`,
      inline: true,
    })
    .setTimestamp();

  try {
    await channel.send({
      content: `<@&${partnershipPingRoleId}> <@${representative.id}>`,
      embeds: [embed],
      allowedMentions: {
        parse: [],
        roles: [partnershipPingRoleId],
        users: [representative.id],
      },
    });
  } catch (error) {
    await db
      .delete(partnershipLogsTable)
      .where(eq(partnershipLogsTable.id, savedLog.id));
    throw error;
  }

  await interaction.editReply(
    `Partnership logged and sent to <#${partnershipLogChannelId}>.`,
  );
}

export async function handlePartnershipRepresentativeLeave(
  member: Pick<GuildMember, "id" | "guild" | "client">,
) {
  if (member.guild.id !== partnershipGuildId) {
    return;
  }

  const activeLogs = await db
    .select({ logChannelId: partnershipLogsTable.logChannelId })
    .from(partnershipLogsTable)
    .where(
      and(
        eq(partnershipLogsTable.guildId, member.guild.id),
        eq(partnershipLogsTable.representativeId, member.id),
        isNull(partnershipLogsTable.leftAt),
      ),
    );

  if (activeLogs.length === 0) {
    return;
  }

  const logChannelId = activeLogs[0]?.logChannelId;
  if (!logChannelId) {
    return;
  }

  const channel = await member.client.channels.fetch(logChannelId);
  if (!channel?.isSendable()) {
    throw new Error("The partnership log channel is not sendable.");
  }

  await channel.send({
    content: `<@&${managementRoleId}> Partnership representative <@${member.id}> has left the server. ${activeLogs.length} partnership log(s) were active.`,
    allowedMentions: { parse: [], roles: [managementRoleId] },
  });

  await db
    .update(partnershipLogsTable)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(partnershipLogsTable.guildId, member.guild.id),
        eq(partnershipLogsTable.representativeId, member.id),
        isNull(partnershipLogsTable.leftAt),
      ),
    );

  logger.info(
    {
      guildId: member.guild.id,
      representativeId: member.id,
      activePartnershipLogs: activeLogs.length,
    },
    "Partnership representative departure logged",
  );
}
