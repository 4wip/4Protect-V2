import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import db from "../../Events/loadDatabase.js";
import Discord from "discord.js"

export const command = {
	name: 'setsuggest',
	helpname: 'setsuggest <salon/off>',
	description: 'Permet de configurer le salon de suggestions',
	help: 'setsuggest <salon/off>',
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
			db.run(`UPDATE Suggest SET channel = ? WHERE guildId = ?`, ['off', message.guild.id], function (err) {
				if (err) return message.reply("Erreur lors de la désactivation.");
				return message.reply("Le système de suggestions a été désactivé.");
			});
		}

		const channelId = arg[1].replace("<#", "").replace(">", "");
		const suggestChannel = message.guild.channels.cache.get(channelId);

		if (!suggestChannel || suggestChannel.type !== 0) {
			return message.reply("Le salon doit être un salon textuel.");
		}

		db.get('SELECT channel FROM Suggest WHERE guildId = ?', [message.guild.id], (err, row) => {
			if (err) return message.reply("Erreur SQL.");
			if (!row) {
				db.run('INSERT INTO Suggest (guildId, channel) VALUES (?, ?)', [message.guild.id, channelId]);
			} else {
				db.run('UPDATE Suggest SET channel = ? WHERE guildId = ?', [channelId, message.guild.id]);
			}

			const embed = new EmbedBuilder()
				.setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
				.setTitle('Suggestion')
				.setDescription('Clique sur le bouton ci-dessous pour faire une suggestion.')
				.setColor(config.color);

			const rowBtn = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('suggest_open')
					.setLabel('Faire une suggestion')
					.setStyle(ButtonStyle.Primary)
			);

			suggestChannel.send({ embeds: [embed], components: [rowBtn] });
			message.reply(`Le salon de suggestions est <#${channelId}>`);
		});
	},
}