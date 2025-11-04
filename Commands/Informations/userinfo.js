import { EmbedBuilder, PermissionsBitField } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from "../../config.json" with { type: 'json' }

export const command = {
	name: 'userinfo',
	helpname: 'userinfo [mention/id]',
	description: "Permet d'afficher des informations sur un membre du serveur",
	help: 'userinfo [mention/id]',
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

		const user = message.mentions.users.first() || (args[0] ? await bot.users.fetch(args[0]).catch(() => null) : message.author);

		if (!user) {
			return message.reply({ content: "L'utilisateur n'existe pas ou n'est pas sur le serveur.", allowedMentions: { repliedUser: false } });
		}

		const member = await message.guild.members.fetch(user.id);

		const embed = new EmbedBuilder()
			.setTitle(`Information - ${user.username}`)
			.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
			.setColor(config.color)
			.addFields(
				{ name: 'Nom', value: user.tag, inline: true },
				{ name: 'Surnom', value: member.nickname || 'Aucun', inline: true },
				{ name: 'ID', value: user.id, inline: true },
				{ name: 'Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
				{ name: 'Sur le serveur depuis', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
				{ name: 'Rôles', value: member.roles.cache.map(role => role.name).join(', ') || 'Aucun', inline: false },
			)
			.setFooter({ text: '4Protect V2' });

		return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
	},
}