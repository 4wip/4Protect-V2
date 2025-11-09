import Discord, { AuditLogEvent } from "discord.js"
import sendLog from "./sendlog.js";
import db from "./loadDatabase.js";
import config from "../config.json" with { type: 'json' }

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
	name: 'webhooksUpdate',
	async execute(channel) {
		if (!channel.guild) return;

		try {
			const logsCreate = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate });
			const entryCreate = logsCreate.entries.first();
			if (entryCreate) {
				const executor = entryCreate.executor;
				const embed = new Discord.EmbedBuilder()
					.setColor(config.color)
					.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() })
					.setDescription(`<@${executor.id}> a créé un webhook dans <#${channel.id}>`)
					.setTimestamp();
				sendLog(channel.guild, embed, 'raidlog');
			}

			const logsDelete = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookDelete });
			const entryDelete = logsDelete.entries.first();
			if (entryDelete) {
				const executor = entryDelete.executor;
				const embedd = new Discord.EmbedBuilder()
					.setColor(config.color)
					.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() })
					.setDescription(`<@${executor.id}> a supprimé un webhook dans <#${channel.id}>`)
					.setTimestamp();
				sendLog(channel.guild, embedd, 'raidlog');
			}

			let executor = null;
			if (entryCreate) executor = entryCreate.executor;
			else if (entryDelete) executor = entryDelete.executor;
			if (!executor) return;

			db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [channel.guild.id, 'antiwebhook'], async (err, row) => {
				if (await bypass(executor.id)) return;
				const sanction = row?.punition || 'derank';
				const member = await channel.guild.members.fetch(executor.id).catch(() => null);
				if (!member) return;
				const botMember = await channel.guild.members.fetchMe();
				if (member.roles.highest.position >= botMember.roles.highest.position || member.id === channel.guild.ownerId) {
					console.warn(`[AntiWebhook] Impossible de sanctionner ${member.user.tag} (${member.id}) : rôle trop haut ou propriétaire.`);
					return;
				}
				try {
					if (sanction === 'ban') {
						await member.ban({ reason: 'Antiwebhook' });
					} else if (sanction === 'kick') {
						await member.kick('Antiwebhook');
					} else if (sanction === 'derank') {
						await member.roles.set([], 'Antiwebhook');
					} else {
						await member.timeout?.(60000, 'Antiwebhook');
					}
				} catch (error) {
					console.error('Erreur lors de la punition :', error);
				}
			});
		} catch (error) {
			console.error('Erreur antiwebhook :', error);
		}
	},
};
