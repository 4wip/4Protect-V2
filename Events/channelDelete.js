import { ChannelType, PermissionFlagsBits, AuditLogEvent, EmbedBuilder } from 'discord.js';
import sendLog from "./sendlog.js";
import config from "../config.json" with { type: 'json' }
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
	name: 'channelDelete',
	async execute(channel) {
		if (!channel || !channel.guild) return;

		db.get('SELECT antichannel FROM antiraid WHERE guild = ?', [channel.guild.id], async (err, row) => {
			if (err || !row?.antichannel) return;

			try {
				const fetchedLogs = await channel.guild.fetchAuditLogs({
					limit: 1,
					type: AuditLogEvent.ChannelDelete,
				});

				const deleteLog = fetchedLogs.entries.first();
				if (!deleteLog) return;

				const executor = deleteLog.executor;
				if (await bypass(executor.id)) return;

				db.get('SELECT channels FROM logs WHERE guild = ?', [channel.guild.id], async (err, row) => {
					if (err || !row?.channels) return;

					let channels = {};
					try {
						channels = JSON.parse(row.channels);
					} catch (e) {
						console.error('Erreur JSON channels logs:', e);
						return;
					}

					const entry = Object.entries(channels).find(([name, id]) => id === channel.id);
					if (!entry) return;

					const logsCategory = channel.guild.channels.cache.find(
						c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'logs'
					);
					if (!logsCategory) return;

					const newChannel = await channel.guild.channels.create({
						name: entry[0],
						type: ChannelType.GuildText,
						parent: logsCategory.id,
						permissionOverwrites: [
							{
								id: channel.guild.roles.everyone.id,
								deny: [PermissionFlagsBits.ViewChannel]
							},
							{
								id: channel.guild.ownerId,
								allow: [PermissionFlagsBits.ViewChannel]
							}
						],
					});

					try {
						await newChannel.setPosition(channel.rawPosition);
					} catch (e) { }

					channels[entry[0]] = newChannel.id;
					db.run(
						`UPDATE logs SET channels = ? WHERE guild = ?`,
						[JSON.stringify(channels), channel.guild.id],
						(err2) => {
							if (err2) console.error('Erreur mise à jour logs channels:', err2);
						}
					);

					const embed = new EmbedBuilder()
						.setColor(config.color)
						.setDescription(`<@${executor.id}> a supprimé le salon \`${channel.name}\` (${channel.id}), il a été recréé <#${newChannel.id}>.`)
						.setTimestamp();

					sendLog(channel.guild, embed, 'raidlog');
				});
			} catch (error) {
				console.error('Erreur dans channelDelete :', error);
			}
		}
		)
	}
} 