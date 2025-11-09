import * as Discord from "discord.js";
import db from "../../Events/loadDatabase.js";
import { EmbedBuilder } from "discord.js";
import config from "../../config.json" with { type: 'json' }
import sendLog from "../../Events/sendlog.js";

export const command = {
	name: 'delsanction',
	helpname: 'delsanction <mention/id> <nombre>',
	description: 'Permet de retirer la sanction d\'un membre',
	help: 'delsanction <mention/id> <nombre>',
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


		const user = message.mentions.users.first() || await bot.users.fetch(args[0]).catch(() => null);
		if (!user) return;

		const sanctionNumber = parseInt(args[1], 10);
		if (isNaN(sanctionNumber)) {
			return message.reply("Le numéro de sanction est invalide.");
		}

		db.all('SELECT id FROM sanctions WHERE userId = ? AND guild = ? ORDER BY date DESC', [user.id, message.guild.id], (err, rows) => {
			if (err) {
				console.error('Erreur lors de la récupération des sanctions:', err);
				return;
			}

			if (sanctionNumber < 1 || sanctionNumber > rows.length) {
				return message.reply("Le numéro de sanction est invalide.");
			}

			const sanctionToRemove = rows[sanctionNumber - 1].id;
			db.run('DELETE FROM sanctions WHERE id = ?', [sanctionToRemove], (err) => {
				if (err) {
					console.error('Erreur lors de la suppression de la sanction:', err);
					return;
				}
				db.all('SELECT id FROM sanctions WHERE userId = ? AND guild = ? ORDER BY date DESC', [user.id, message.guild.id], (err, updatedRows) => {
					if (err) {
						console.error('Erreur lors de la réorganisation des sanctions:', err);
						return;
					}

					updatedRows.forEach((row, index) => {
						db.run('UPDATE sanctions SET rowid = ? WHERE id = ?', [index + 1, row.id], (err) => {
							if (err) {
								console.error('Erreur lors de la mise à jour des sanctions:', err);
							}
						});
					});

					message.reply(`La sanction #${sanctionNumber} de <@${user.tag}> a été supprimée.`);
					const embed = new Discord.EmbedBuilder()
						.setColor(config.color)
						.setDescription(`<@${message.author.id}> a supprimé la sanction #${sanctionNumber} de <@${user.tag}> (${user.id})`)
						.setTimestamp();

					sendLog(message.guild, embed, 'modlog');
				});
			});
		});
	},
}