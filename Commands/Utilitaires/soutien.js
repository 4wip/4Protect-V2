import * as Discord from "discord.js";
import db from "../../Events/loadDatabase.js";
import { EmbedBuilder } from "discord.js";

export const command = {
	name: 'soutien',
	helpname: 'soutien <clear/role> <texte>',
	description: "Permet de configurer le soutien",
	help: 'soutien <clear/role> <texte>',
	run: async (bot, message, args, config) => {
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

		if (args[0] && args[0].toLowerCase() === 'clear') {
			db.run('DELETE FROM soutien WHERE guild = ?', [message.guild.id], (err) => {
				if (err) return message.reply("Une erreur est survenue lors du clear.");
				return message.reply("Le soutien est désactivé.");
			});
			return;
		}

		const text = args.slice(1).join(" ");
		let role = null;

		if (message.mentions.roles.size > 0) {
			role = message.mentions.roles.first();
		} else if (args[0] && message.guild.roles.cache.get(args[0])) {
			role = message.guild.roles.cache.get(args[0]);
		}

		db.run(
			`CREATE TABLE IF NOT EXISTS soutien (guild TEXT PRIMARY KEY, id TEXT, texte TEXT)`,
			[],
			(err) => {
				if (err) return message.reply("Une erreur est survenue.");
				db.run(
					`INSERT OR REPLACE INTO soutien (guild, id, texte) VALUES (?, ?, ?)`,
					[message.guild.id, role.id, text],
					(err) => {
						if (err) return message.reply("Une erreur est survenue.");
						message.reply(`Rôle soutien ${role} - Texte: ${text}`);
					}
				);
			}
		);
	},
}