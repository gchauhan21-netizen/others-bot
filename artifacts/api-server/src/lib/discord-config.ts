import type { ChatInputCommandInteraction } from "discord.js";

export const managementRoleId = "1563817850349555800";
export const managementRoleName = "[SHR] Management Team";
export const staffTeamRoleId = "1563817850312073252";
export const staffTeamRoleName = "Staff Team";
export const partnershipGuildId = "1563817849993039973";
export const partnershipLogChannelId = "1563817859904180244";
export const partnershipPingRoleId = "1563817849993039981";
export const freeReleaseRoleId = "1566168303544827913";
export const freeReleaseChannelId = "1563817858708938854";

export const serverMembersIntentEnabled =
  process.env["DISCORD_SERVER_MEMBERS_INTENT_ENABLED"] === "true";

export function hasManagementRole(
  interaction: ChatInputCommandInteraction,
): boolean {
  return hasAnyRole(interaction, [managementRoleId]);
}

export function hasPartnershipAccessRole(
  interaction: ChatInputCommandInteraction,
): boolean {
  return hasAnyRole(interaction, [managementRoleId, staffTeamRoleId]);
}

function hasAnyRole(
  interaction: ChatInputCommandInteraction,
  allowedRoleIds: string[],
): boolean {
  const member = interaction.member;
  if (!member) {
    return false;
  }

  const memberRoleIds = Array.isArray(member.roles)
    ? member.roles
    : member.roles.cache.keys();

  const roleIdSet = new Set(memberRoleIds);
  return allowedRoleIds.some((roleId) => roleIdSet.has(roleId));
}
