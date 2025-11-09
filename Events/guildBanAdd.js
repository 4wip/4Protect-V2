import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import sendLog from "./sendlog.js";
import config from "../config.json" with { type: 'json' }

export default {
	name: 'guildBanAdd',
	async execute(ban) {
		const { guild, user } = ban;
		let executor = null;

		try {
			const fetchedLogs = await guild.fetchAuditLogs({
				limit: 1,
				type: AuditLogEvent.MemberBanAdd,
			});
			const banLog = fetchedLogs.entries.find(entry =>
				entry.target.id === user.id &&
				Date.now() - entry.createdTimestamp < 5000
			);
			if (banLog) executor = banLog.executor;
		} catch (e) { }

		const embed = new EmbedBuilder()
			.setColor(config.color)
			.setDescription(
				`<@${user.id}> a été banni du serveur` +
				(executor ? ` par <@${executor.id}>` : '')
			)
			.setTimestamp();
		sendLog(guild, embed, 'modlog');
	}
};