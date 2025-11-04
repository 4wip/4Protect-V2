import { EmbedBuilder } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from '../../config.json' with { type: 'json' };
import * as Discord from "discord.js";

export const command = {
	name: 'punish',
	description: "Permet de gérer les sanctions pour l'antiraid",
	help: 'punish <module> <ban/kick/derank/timeout>',
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

		const [module, sanction] = args;

		const modules = [
			'antispam', 'antichannel', 'antirole', 'antiupdate', 'antivanity',
			'antiwebhook', 'antiban', 'antieveryone', 'antibot', 'antitoken', 'antilink'
		];
		const sanc = ['ban', 'kick', 'derank', 'timeout'];

		if (!module && !sanction) {
			db.all('SELECT module, punition FROM punish WHERE guild = ?', [message.guild.id], (err2, rows) => {
				if (err2) {
					console.error('Erreur lors de la récupération des sanctions:', err2);
					return message.reply('Erreur lors de la récupération des sanctions.');
				}

				let description = '';
				if (rows && rows.length > 0) {
					description = rows
						.map(r => `**${r.module} :** \`${r.punition || ''}\``)
						.join('\n');
				} else {
					description = 'Aucune sanction définie.';
				}

				const embed = new EmbedBuilder()
					.setDescription(description)
					.setColor(config.color)
					.setFooter({ text: '4Protect V2' });

				return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
			});
			return;
		}

		if (!module || !sanction || !modules.includes(module.toLowerCase()) || !sanc.includes(sanction.toLowerCase())) {
			return message.reply({
				content: `\`${command.use}\`\nModules: ${modules.join(', ')}\nSanctions: ${sanc.join(', ')}`,
				allowedMentions: { repliedUser: false }
			});
		}

		db.run(
			`INSERT INTO punish (guild, module, punition)
     VALUES (?, ?, ?)
     ON CONFLICT(guild, module) DO UPDATE SET punition = ?`,
			[message.guild.id, module.toLowerCase(), sanction.toLowerCase(), sanction.toLowerCase()],
			(err) => {
				if (err) return message.reply('Erreur lors de la mise à jour de la sanction.');

				db.all('SELECT module, punition FROM punish WHERE guild = ?', [message.guild.id], (err2, rows) => {
					if (err2) {
						console.error('Erreur lors de la récupération des sanctions:', err2);
						return message.reply('Erreur lors de la récupération des sanctions.');
					}

					let description = '';
					if (rows && rows.length > 0) {
						description = rows
							.map(r => `**${r.module} :** \`${r.punition || ''}\``)
							.join('\n');
					} else {
						description = 'Aucune sanction définie.';
					}

					const embed = new EmbedBuilder()
						.setDescription(description)
						.setColor(config.color)
						.setFooter({ text: '4Protect V2' });

					message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
				});
			}
		);
	},
}