import { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuOptionBuilder, ButtonStyle } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from '../../config.json' with { type: 'json' };
import sendLog from '../../Events/sendlog.js';
import * as Discord from "discord.js";

export const command = {
	name: 'ticket',
	helpname: 'ticket <catégorie id>',
	description: 'Permet de configurer les tickets',
	help: 'ticket <catégorie id>',
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


		const category = message.guild.channels.cache.get(args[0]);
		if (!category || category.type !== 4) {
			return message.reply({ content: "ID Catégorie invalide." });
		}

		db.run(
			`CREATE TABLE IF NOT EXISTS ticket (guild TEXT PRIMARY KEY, category TEXT)`,
			[],
			() => {
				db.run(
					`INSERT OR REPLACE INTO ticket (guild, category) VALUES (?, ?)`,
					[message.guild.id, category.id]
				);
			}
		);

		const options = [
			{ key: 'option1', label: config.option1 },
			{ key: 'option2', label: config.option2 },
			{ key: 'option3', label: config.option3 },
			{ key: 'option4', label: config.option4 }
		].filter(opt => opt.label && opt.label.trim() !== '');

		if (options.length === 0) {
			return message.reply({ content: 'Aucune option pour le ticket n\'est configurée' });
		}

		const ticket = new StringSelectMenuBuilder()
			.setCustomId('ticket_select')
			.setPlaceholder('Choisissez une option')
			.addOptions(
				options.map(opt => ({
					label: opt.label,
					value: opt.key
				}))
			);
		const embed = new EmbedBuilder();
		if (config.titre && config.titre.trim() !== '') {
			embed.setTitle(config.titre);
		}
		embed.setDescription(config.description);
		if (config.color) {
			embed.setColor(config.color);
		}
		let icon = message.guild.iconURL({ dynamic: true });
		if (config.tfooter && config.tfooter.trim() !== '') {
			embed.setFooter({ text: config.tfooter, iconURL: icon });
		}

		await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(ticket)] });
	},
};