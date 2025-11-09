import { AuditLogEvent, EmbedBuilder } from 'discord.js';
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
	name: 'guildMemberUpdate',
	async execute(oldMember, newMember) {
		if (oldMember.roles.cache.size === newMember.roles.cache.size) return;
		let executor = null;

		db.get('SELECT antirole FROM antiraid WHERE guild = ?', [newMember.guild.id], async (err, row) => {
			if (err || !row?.antirole) return;

			try {
				const fetchedLogs = await newMember.guild.fetchAuditLogs({
					limit: 5,
					type: AuditLogEvent.MemberRoleUpdate,
				});

				const roleChange = fetchedLogs.entries.find(entry =>
					entry.target.id === newMember.id &&
					Date.now() - entry.createdTimestamp < 5000
				);

				if (!roleChange) return;

				const executor = roleChange.executor;
				const memberExecutor = await newMember.guild.members.fetch(executor.id).catch(() => null);

				if (!memberExecutor || await bypass(executor.id)) return;

				db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [newMember.guild.id, 'antirole'], async (err2, row2) => {
					const sanction = row2?.punition || 'derank';

					try {
						if (sanction === 'ban') {
							await memberExecutor.ban({ reason: 'AntiRole' });
						} else if (sanction === 'kick') {
							await memberExecutor.kick('AntiRole');
						} else if (sanction === 'derank') {
							await memberExecutor.roles.set([], 'AntiRole');
						} else {
							await memberExecutor.timeout?.(60000, 'AntiRole');
						}
					} catch (error) {
						console.error('Erreur lors de la punition antirole :', error);
					}
				});
			} catch (error) {
				console.error('Erreur AntiRole :', error);
			}
		});

		if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
			if (newMember.isCommunicationDisabled()) {
				const embed = new EmbedBuilder()
					.setColor(config.color)
					.setDescription(`<@${newMember.id}> a été timeout jusqu'au <t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`)
					.setTimestamp();
				sendLog(newMember.guild, embed, 'modlog');
			} else {
				const embed = new EmbedBuilder()
					.setColor(config.color)
					.setDescription(`<@${newMember.id}> n'est plus timeout`)
					.setTimestamp();
				sendLog(newMember.guild, embed, 'modlog');
			}
		}

		if (!oldMember.premiumSince && newMember.premiumSince) {
			const embed = new EmbedBuilder()
				.setColor(config.color)
				.setDescription(`<@${newMember.id}> a boosté le serveur`)
				.setTimestamp();
			sendLog(newMember.guild, embed, 'boostlog');
		} else if (oldMember.premiumSince && !newMember.premiumSince) {
			const embed = new EmbedBuilder()
				.setColor(config.color)
				.setDescription(`<@${newMember.id}> a retiré son boost du serveur.`)
				.setTimestamp();
			sendLog(newMember.guild, embed, 'boostlog');
		}

		if (!executor) {
			try {
				const fetchedLogs = await newMember.guild.fetchAuditLogs({
					limit: 5,
					type: AuditLogEvent.MemberRoleUpdate,
				});
				const roleChange = fetchedLogs.entries.find(entry =>
					entry.target.id === newMember.id &&
					Date.now() - entry.createdTimestamp < 5000
				);
				if (roleChange) executor = roleChange.executor;
			} catch (e) { }
		}

		const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
		const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

		if (addedRoles.size > 0) {
			const embed = new EmbedBuilder()
				.setColor(config.color)
				.setDescription(
					`<@${newMember.id}> a reçu le(s) rôle(s) : ${addedRoles.map(r => `<@&${r.id}>`).join(', ')}\n` +
					(executor ? `Ajouté par: <@${executor.id}>` : '')
				)
				.setTimestamp();
			sendLog(newMember.guild, embed, 'rolelog');
		}

		if (removedRoles.size > 0) {
			const embed = new EmbedBuilder()
				.setColor(config.color)
				.setDescription(
					`<@${newMember.id}> a perdu le(s) rôle(s) : ${removedRoles.map(r => `<@&${r.id}>`).join(', ')}\n` +
					(executor ? `Retiré par: <@${executor.id}>` : '')
				)
				.setTimestamp();
			sendLog(newMember.guild, embed, 'rolelog');
		}
	},
};