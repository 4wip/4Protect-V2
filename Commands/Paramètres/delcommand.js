import * as Discord from "discord.js";
import db from "../../Events/loadDatabase.js";
import { EmbedBuilder } from "discord.js";

export const command = {
	name: 'delcommand',
	helpname: 'delcommand [perms] [commande]',
	aliases: ['delcmd', 'delcommande'],
	description: "Permet de retirer une commande d'une ou plusieurs permissions",
	help: 'delcommand [perms] [commande]',
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


		if (!args[0] || args.length < 2) {
			return
		}


		const permLevels = args[0]
			.split(',')
			.map(level => {
				const trimmed = level.trim().toLowerCase();
				if (trimmed === "public") return "public";
				const num = parseInt(trimmed, 10);
				if (!isNaN(num) && num >= 1 && num <= 12) return num;
				return null;
			})
			.filter(level => level !== null);

		const commands = args.slice(1).join(' ').split(',').map(cmd => cmd.trim().toLowerCase());

		if (permLevels.length === 0) {
			return;
		}

		if (commands.length === 0) {
			return;
		}

		for (const permLevel of permLevels) {
			for (const command of commands) {
				db.run(
					`DELETE FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?`,
					[permLevel, command, message.guild.id],
					(err) => {
						if (err) {
							return;
						}
					}
				);
			}
		}

		message.reply(`La commande \`${commands.join(', ')}\` a été retirée de la permission \`${permLevels.join(', ')}\`.`);
	},
}