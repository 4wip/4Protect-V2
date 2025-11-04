import { EmbedBuilder } from "discord.js";
import db from "../../Events/loadDatabase.js";
import Discord from "discord.js"

export const command = {
	name: 'setjoin',
	helpname: 'setjoin <salon/off> <message>',
	description: 'Permet de configurer un message de bienvenue',
	help: 'setjoin <salon/off> <message>\nVoir la commande variable',
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

		const arg = message.content.trim().split(/ +/g);

		if (arg[1].toLowerCase() === "off") {
			db.run(`UPDATE joinsettings SET channel = ?, message = ? WHERE guildId = ?`, ['off', '', message.guild.id], function (err) {
				if (err) return message.reply("Erreur lors de la désactivation ou est-ce déjà désactivé ?");
				return message.reply("Le message de bienvenue a bien été désactivé.");
			});
		}

		const channelId = arg[1].replace("<#", "").replace(">", "");
		const joinChannel = message.guild.channels.cache.get(channelId);
		if (!joinChannel || joinChannel.type !== 0) {
			return message.reply("Le salon doit etre un salon textuel.");
		}

		const joinMsg = arg.slice(2).join(" ");

		db.get('SELECT channel FROM joinsettings WHERE guildId = ?', [message.guild.id], (err, row) => {
			if (err) return message.reply("Erreur SQL.");
			if (!row) {
				db.run('INSERT INTO joinsettings (guildId, channel, message) VALUES (?, ?, ?)', [message.guild.id, channelId, joinMsg]);
			} else {
				db.run('UPDATE joinsettings SET channel = ?, message = ? WHERE guildId = ?', [channelId, joinMsg, message.guild.id]);
			}
			message.reply(`Le salon de bienvenue a bien été configuré.`);
		});
	},
}