import { EmbedBuilder } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from '../../config.json' with { type: 'json' };
import * as Discord from "discord.js";

function parseTime(str) {
	const match = /^(\d+)(s|m|h|d)$/i.exec(str);
	if (!match) return null;
	const num = parseInt(match[1]);
	const unit = match[2].toLowerCase();
	const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
	return { value: num, unit, ms: num * (ms[unit] || 1000) };
}

export const command = {
	name: 'antispam',
	description: "Active ou désactive l'antispam",
	help: 'antispam on/off <message> <sous> <durée du timeout>\nExemple: antispam on 3 10s 1m \n(3 messages en 10 secondes, timeout de 1 minute)\nTemps: 1s, 1m, 1h, 1h (exemples)',
	run: async (bot, message, args) => {
		const checkPerm = async (message, commandName) => {
			if (config.owners.includes(message.author.id)) {
				return true;
			}

			const publicStatut = await new Promise((resolve, reject) => {
				db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
					if (err) reject(err);
					resolve(!!row);
				});
			});

			if (publicStatut) {

				const checkPublicCmd = await new Promise((resolve, reject) => {
					db.get(
						'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
						['public', commandName, message.guild.id],
						(err, row) => {
							if (err) reject(err);
							resolve(!!row);
						}
					);
				});

				if (checkPublicCmd) {
					return true;
				}
			}

			try {
				const checkUserWl = await new Promise((resolve, reject) => {
					db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
						if (err) reject(err);
						resolve(!!row);
					});
				});

				if (checkUserWl) {
					return true;
				}

				const checkDbOwner = await new Promise((resolve, reject) => {
					db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
						if (err) reject(err);
						resolve(!!row);
					});
				});

				if (checkDbOwner) {
					return true;
				}

				const roles = message.member.roles.cache.map(role => role.id);

				const permissions = await new Promise((resolve, reject) => {
					db.all('SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?', [...roles, message.guild.id], (err, rows) => {
						if (err) reject(err);
						resolve(rows.map(row => row.perm));
					});
				});

				if (permissions.length === 0) {
					return false;
				}

				const checkCmdPermLevel = await new Promise((resolve, reject) => {
					db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
						if (err) reject(err);
						resolve(rows.map(row => row.command));
					});
				});

				return checkCmdPermLevel.includes(commandName);
			} catch (error) {
				console.error('Erreur lors de la vérification des permissions:', error);
				return false;
			}
		};

		if (!(await checkPerm(message, command.name))) {
			const noacces = new EmbedBuilder()
				.setDescription("Vous n'avez pas la permission d'utiliser cette commande")
				.setColor(config.color);
			return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } }).then(m => setTimeout(() => m.delete().catch(() => { }), 2000));
		}

		const guildId = message.guild.id;
		const status = args[0].toLowerCase() === 'on' ? 1 : 0;

		if (status === 0) {
			db.run(
				`INSERT INTO antiraid (guild, antispam) VALUES (?, ?) ON CONFLICT(guild) DO UPDATE SET antispam = ?`,
				[guildId, 0, 0],
				(err) => {
					if (err) {
						console.error(err);
						return
					}
					message.reply("L'antispam a bien été désactivé.");
				}
			);
			return;
		}

		let count = parseInt(args[1]) || 3;
		let sousparse = parseTime(args[2] || '10s');
		let toparse = parseTime(args[3] || '1m');

		if (!sousparse || !toparse) {
			return
		}

		let sous = sousparse.ms;
		let timeoutMs = toparse.ms;

		db.run(
			`INSERT INTO antiraid (guild, antispam, nombremessage, sous, timeout)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(guild) DO UPDATE SET antispam = ?, nombremessage = ?, sous = ?, timeout = ?`,
			[guildId, status, count, sous, timeoutMs, status, count, sous, timeoutMs],
			(err) => {
				if (err) {
					console.error(err);
					return
				}
				message.reply(`L'antispam a bien été activé`);
			}
		);

	},
}