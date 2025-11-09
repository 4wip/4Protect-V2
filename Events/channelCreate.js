import Discord from "discord.js"
import config from "../config.json" with { type: 'json' }
import sendLog from "./sendlog.js";
import db from "./loadDatabase.js";

const bypass = async (userId) => {
	if (config.owners && config.owners.includes(userId)) return true;
	return new Promise((resolve) => {
		db.get('SELECT id FROM owner WHERE id = ?', [userId], (err, row) => {
			if (row) return resolve(true);
			db.get('SELECT id FROM whitelist WHERE id = ?', [userId], (err2, row2) => {
				resolve(!!row2);
			});
		});
	});
};

export default {
	name: 'channelCreate',
	async execute(channel) {
		if (!channel.guild) return;

		db.get('SELECT antichannel FROM antiraid WHERE guild = ?', [channel.guild.id], async (err, row) => {
			if (err || !row?.antichannel) return;

			try {
				const fetchedLogs = await channel.guild.fetchAuditLogs({
					limit: 1,
					type: Discord.AuditLogEvent.ChannelCreate,
				});

				const creationLog = fetchedLogs.entries.first();
				if (!creationLog) return;

				const executor = creationLog.executor;
				if (await bypass(executor.id)) return;

				await channel.delete('AntiChannel');

				const embed = new Discord.EmbedBuilder()
					.setColor(config.color)
					.setDescription(`<@${executor.id}> a effacé le salon <#${channel.id}>`)
					.setTimestamp();

				sendLog(channel.guild, embed, 'raidlog');
			} catch (error) {
				console.error('Erreur AntiChannel :', error);
			}
		});
	},
};