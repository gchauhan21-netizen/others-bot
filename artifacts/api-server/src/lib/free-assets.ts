import {
  ApplicationIntegrationType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type Attachment,
  type ChatInputCommandInteraction,
} from "discord.js";
import {
  freeReleaseChannelId,
  freeReleaseRoleId,
  hasPartnershipAccessRole,
  managementRoleName,
  partnershipGuildId,
  staffTeamRoleName,
} from "./discord-config";

export const freeAssetsCommand = new SlashCommandBuilder()
  .setName("free-assets")
  .setDescription("Publish a free asset release")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) =>
    option
      .setName("category")
      .setDescription("The game, department, or category")
      .setRequired(false)
      .setMaxLength(100),
  )
  .addStringOption((option) =>
    option
      .setName("contents")
      .setDescription("What is included in the release")
      .setRequired(false)
      .setMaxLength(1000),
  )
  .addStringOption((option) =>
    option
      .setName("assets")
      .setDescription("Asset names and IDs to include")
      .setRequired(false)
      .setMaxLength(1000),
  )
  .addStringOption((option) =>
    option
      .setName("erlcx-link")
      .setDescription("Optional link to view the ERLCX page")
      .setRequired(false)
      .setMaxLength(1000),
  )
  .addUserOption((option) =>
    option
      .setName("designer")
      .setDescription("The designer to credit")
      .setRequired(false),
  )
  .addAttachmentOption((option) =>
    option
      .setName("banner")
      .setDescription("Release banner image")
      .setRequired(false),
  )
  .addAttachmentOption((option) =>
    option
      .setName("preview-one")
      .setDescription("First preview image")
      .setRequired(false),
  )
  .addAttachmentOption((option) =>
    option
      .setName("preview-two")
      .setDescription("Second preview image")
      .setRequired(false),
  )
  .addAttachmentOption((option) =>
    option
      .setName("preview-three")
      .setDescription("Third preview image")
      .setRequired(false),
  );

function getOptionalTextOption(
  interaction: ChatInputCommandInteraction,
  name: string,
): string | null {
  const value = interaction.options.getString(name)?.trim();
  return value || null;
}

function attachmentEmbed(title: string, attachment: Attachment) {
  return new EmbedBuilder().setTitle(title).setImage(attachment.url);
}

export async function handleFreeAssets(
  interaction: ChatInputCommandInteraction,
) {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (interaction.guildId !== partnershipGuildId) {
    await interaction.editReply(
      "Free asset releases are only configured for the SHR server.",
    );
    return;
  }

  if (!hasPartnershipAccessRole(interaction)) {
    await interaction.editReply(
      `Only members with the **${managementRoleName}** or **${staffTeamRoleName}** role can use this command.`,
    );
    return;
  }

  const guild = interaction.guild;
  const releaseRole = await guild.roles.fetch(freeReleaseRoleId);
  if (!releaseRole) {
    await interaction.editReply(
      `I couldn't find the release ping role <@&${freeReleaseRoleId}> in this server.`,
    );
    return;
  }

  const targetChannel = await guild.channels.fetch(freeReleaseChannelId);
  if (!targetChannel?.isSendable()) {
    await interaction.editReply(
      `I couldn't access <#${freeReleaseChannelId}> as a sendable channel.`,
    );
    return;
  }

  const category = getOptionalTextOption(interaction, "category");
  const contents = getOptionalTextOption(interaction, "contents");
  const assets = getOptionalTextOption(interaction, "assets");
  const erlcxLink = getOptionalTextOption(interaction, "erlcx-link");
  const designer = interaction.options.getUser("designer");
  const banner = interaction.options.getAttachment("banner");
  const previews = [
    interaction.options.getAttachment("preview-one"),
    interaction.options.getAttachment("preview-two"),
    interaction.options.getAttachment("preview-three"),
  ].filter((attachment): attachment is Attachment => attachment !== null);

  let normalizedErlcxLink: string | null = null;
  if (erlcxLink) {
    try {
      const parsedLink = new URL(erlcxLink);
      if (parsedLink.protocol !== "http:" && parsedLink.protocol !== "https:") {
        throw new Error("Unsupported ERLCX link protocol");
      }
      normalizedErlcxLink = parsedLink.toString();
    } catch {
      await interaction.editReply(
        "The ERLCX link must be a valid http or https URL.",
      );
      return;
    }
  }

  if (
    !category &&
    !contents &&
    !assets &&
    !normalizedErlcxLink &&
    !banner &&
    previews.length === 0
  ) {
    await interaction.editReply(
      "Add at least one release detail or image before publishing.",
    );
    return;
  }

  const releaseEmbed = new EmbedBuilder().setColor(0xffffff).setTitle("Free Release");
  if (category) {
    releaseEmbed.setDescription(`**${category}**`);
  }
  if (contents) {
    releaseEmbed.addFields({ name: "Contents", value: contents });
  }
  if (assets) {
    releaseEmbed.addFields({
      name: "Assets",
      value: `\`\`\`text\n${assets}\n\`\`\``,
    });
  }
  if (normalizedErlcxLink) {
    releaseEmbed.addFields({ name: "ERLCX", value: normalizedErlcxLink });
  }
  if (designer) {
    releaseEmbed.addFields({
      name: "Designed by",
      value: `<@${designer.id}>`,
    });
  }
  if (banner) {
    releaseEmbed.setImage(banner.url);
  }

  await targetChannel.send({
    content: `<@&${releaseRole.id}>`,
    embeds: [
      releaseEmbed,
      ...previews.map((preview, index) =>
        attachmentEmbed(
          index === 0 ? "Preview Images" : `Preview Image ${index + 1}`,
          preview,
        ),
      ),
    ],
    allowedMentions: { parse: [], roles: [releaseRole.id] },
  });

  await interaction.editReply(
    `Free release published in <#${targetChannel.id}>.`,
  );
}
