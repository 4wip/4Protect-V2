import { EmbedBuilder } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from '../../config.json' with { type: 'json' };
import Discord from 'discord.js';

export const command = {
	name: 'protect',
	helpname: 'protect',
	aliases: ['secur'],
	description: "Permet d'affiche l'antiraid",
	help: 'protect',
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


		db.get('SELECT * FROM antiraid WHERE guild = ?', [message.guild.id], (err, row) => {
			if (err) {
				console.error('Erreur lors de la récupération des protections:', err);
				return message.reply('Erreur lors de la récupération des paramètres de protection.');
			}

			const protections = {
				Antispam: row?.antispam ? `✅ (${row.nombremessage}/${row.spam_duration}${row.spam_unit}・${row.timeout ? Math.round(row.timeout / 1000) + 's' : '60s'})` : '❌',
				Antilien: row?.antilink ? `✅ (${row.type === 'invite' ? 'invite' : 'all'})` : '❌',
				Antichannel: row?.antichannel ? '✅' : '❌',
				Antirole: row?.antirole ? '✅' : '❌',
				Antiupdate: row?.antiupdate ? '✅' : '❌',
				Antivanity: row?.antivanity ? '✅' : '❌',
				Antiwebhook: row?.antiwebhook ? '✅' : '❌',
				Antiban: row?.antiban ? '✅' : '❌',
				Antieveryone: row?.antieveryone ? '✅' : '❌',
				Antirole: row?.antirole ? '✅' : '❌',
				Antibot: row?.antibot ? '✅' : '❌',
				Antitoken: row?.antitoken ? '✅' : '❌'
			};

			const description = Object.entries(protections)
				.map(([name, status]) => `**${name} :** \`${status}\``)
				.join('\n');

			const embed = new EmbedBuilder()
				.setDescription(description)
				.setColor(config.color)
				.setFooter({ text: '4Protect V2' });

			message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
		});
	},
}