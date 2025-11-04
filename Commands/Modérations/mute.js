import * as Discord from "discord.js";
import db from "../../Events/loadDatabase.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import config from "../../config.json" with { type: 'json' }
import sendLog from "../../Events/sendlog.js";
import ms from "ms";

export const command = {
	name: 'mute',
	helpname: 'mute <mention/id> [1s/1m/1h/1d]',
	description: "Mute un membre.",
	help: 'mute <mention/id> [1s/1m/1h/1d]',
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

		const member = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
		if (!member) {
			return message.reply("Utilisateur introuvable.");
		}

		if (message.member.roles.highest.position <= member.roles.highest.position) {
			return message.reply("Vous ne pouvez pas mute un membre supérieur à vous.");
		}

		let duration = args[1];
		let ms;
		if (!duration) {
			ms = 28 * 24 * 60 * 60 * 1000;
		} else {
			const match = duration.match(/^(\d+)(s|m|h|d)$/);
			if (!match) {
				return message.reply("Format du temps invalide. Exemples : 10m, 2h, 1d, 30s");
			}
			const value = parseInt(match[1]);
			const unit = match[2];
			switch (unit) {
				case 's': ms = value * 1000; break;
				case 'm': ms = value * 60 * 1000; break;
				case 'h': ms = value * 60 * 60 * 1000; break;
				case 'd': ms = value * 24 * 60 * 60 * 1000; break;
				default: ms = 28 * 24 * 60 * 60 * 1000;
			}
			if (ms > 28 * 24 * 60 * 60 * 1000) ms = 28 * 24 * 60 * 60 * 1000;
		}

		try {
			await member.timeout(ms);
			message.reply(`<@${member.id}> a été mute pour ${duration ? duration : "28j"}.`);
			const embed = new Discord.EmbedBuilder()
				.setColor(config.color)
				.setDescription(`<@${message.author.id}> a mute <@${member.id}> (${member.id}) pendant ${duration ? duration : "28j"}.`)
				.setTimestamp();

			sendLog(message.guild, embed, 'modlog');
		} catch (error) {
			console.error('Erreur lors du mute :', error);
			return message.reply("Impossible de mute.");
		}
	},
}