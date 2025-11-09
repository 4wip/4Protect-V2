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
	name: 'guildUpdate',
	async execute(oldGuild, newGuild) {

		if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
			const oldVanity = oldGuild.vanityURLCode;
			const newVanity = newGuild.vanityURLCode;

			db.get('SELECT antivanity FROM antiraid WHERE guild = ?', [newGuild.id], async (err, row) => {
				if (!err && row?.antivanity) {
					try {
						const logs = await newGuild.fetchAuditLogs({ type: AuditLogEvent.GuildUpdate, limit: 5 });
						const entry = logs.entries.find(e =>
							e.changes.some(c => c.key === 'vanity_url_code' && c.new === newVanity)
						);
						if (entry) {
							const executor = entry.executor;
							const member = await newGuild.members.fetch(executor.id).catch(() => null);

							const embed = new EmbedBuilder()
								.setColor(config.color)
								.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() })
								.setDescription(`<@${executor.id}> a modifié le vanity`)
								.setTimestamp();
							sendLog(newGuild, embed, 'raidlog');

							if (!(await bypass(executor.id))) {
								if (oldVanity) {
									try {
										await newGuild.editVanityURL(oldVanity);
									} catch (err) {
										console.error('Erreur lors de la restauration du vanity URL:', err);
									}
								}

								db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [newGuild.id, 'antivanity'], async (err2, row2) => {
									const sanction = row2?.punition || 'derank';
									try {
										if (!member) return;
										if (sanction === 'ban') {
											await member.ban({ reason: 'AntiVanity' });
										} else if (sanction === 'kick') {
											await member.kick('AntiVanity');
										} else if (sanction === 'derank') {
											await member.roles.set([], 'AntiVanity');
										} else {
											await member.timeout?.(60000, 'AntiVanity');
										}
									} catch (error) {
										console.error('Erreur lors de la punition AntiVanity :', error);
									}
								});
							}
						}
					} catch (error) {
						console.error('Erreur dans AntiVanity :', error);
					}
				}
			});
		}

		const changedKeys = [];
		for (const change of newGuild?._updates?.changes || []) {
			changedKeys.push(change.key);
		}
		const hasOtherChanges = JSON.stringify(oldGuild) !== JSON.stringify(newGuild) && oldGuild.vanityURLCode === newGuild.vanityURLCode;

		if (hasOtherChanges) {
			db.get('SELECT antiupdate FROM antiraid WHERE guild = ?', [newGuild.id], async (err, row) => {
				if (err || !row?.antiupdate) return;

				try {
					const fetchedLogs = await newGuild.fetchAuditLogs({
						limit: 1,
						type: AuditLogEvent.GuildUpdate,
					});

					const updateLog = fetchedLogs.entries.first();
					if (!updateLog) return;

					const executor = updateLog.executor;
					const member = await newGuild.members.fetch(executor.id).catch(() => null);
					if (!member) return;

					const embed = new EmbedBuilder()
						.setColor(config.color)
						.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() })
						.setDescription(`<@${executor.id}> a modifié des paramètres du serveur.`)
						.setTimestamp();
					sendLog(newGuild, embed, 'raidlog');

					try {
						if (await bypass(executor.id)) return;
						db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [newGuild.id, 'antiupdate'], async (err2, row2) => {
							const sanction = row2?.punition || 'derank';
							try {
								if (!member) return;
								if (sanction === 'ban') {
									await member.ban({ reason: 'AntiUpdate' });
								} else if (sanction === 'kick') {
									await member.kick('AntiUpdate');
								} else if (sanction === 'derank') {
									await member.roles.set([], 'AntiUpdate');
								} else {
									await member.timeout?.(60000, 'AntiUpdate');
								}
							} catch (error) {
								console.error('Erreur lors de la punition AntiUpdate :', error);
							}
						});
					} catch (error) {
						console.error('Erreur lors du derank AntiUpdate:', error);
					}
				} catch (error) {
					console.error('Erreur event AntiUpdate:', error);
				}
			});
		}
	},
};

