import * as Discord from "discord.js";
import db from "../../Events/loadDatabase.js";
import { EmbedBuilder } from "discord.js";
import config from "../../config.json" with { type: 'json' }
import sendLog from "../../Events/sendlog.js";

export const command = {
	name: 'kick',
	helpname: 'kick <mention/id> <raison>',
	description: "Permet de kick un membre.",
	help: 'kick <mention/id> <raison>',
	run: async (bot, message, args, config) => {
		const checkperm = async (message, commandName) => {
			if (config.owners.includes(message.author.id)) {
				return true;
			}

			const publicData = await new Promise((resolve, reject) => {
				db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
					if (err) reject(err);
					resolve(!!row);
				});
			});

			if (publicData) {

				const publiccheck = await new Promise((resolve, reject) => {
					db.get(
						'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
						['public', commandName, message.guild.id],
						(err, row) => {
							if (err) reject(err);
							resolve(!!row);
						}
					);
				});

				if (publiccheck) {
					return true;
				}
			}

			try {
				const userwl = await new Promise((resolve, reject) => {
					db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
						if (err) reject(err);
						resolve(!!row);
					});
				});

				if (userwl) {
					return true;
				}

				const userowner = await new Promise((resolve, reject) => {
					db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
						if (err) reject(err);
						resolve(!!row);
					});
				});

				if (userowner) {
					return true;
				}

				const userrole = message.member.roles.cache.map(role => role.id);

				const permissions = await new Promise((resolve, reject) => {
					db.all('SELECT perm FROM permissions WHERE id IN (' + userrole.map(() => '?').join(',') + ') AND guild = ?', [...userrole, message.guild.id], (err, rows) => {
						if (err) reject(err);
						resolve(rows.map(row => row.perm));
					});
				});

				if (permissions.length === 0) {
					return false;
				}

				const cmdwl = await new Promise((resolve, reject) => {
					db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
						if (err) reject(err);
						resolve(rows.map(row => row.command));
					});
				});

				return cmdwl.includes(commandName);
			} catch (error) {
				console.error('Erreur lors de la vérification des permissions:', error);
				return false;
			}
		};

		if (!(await checkperm(message, command.name))) {
			const noacces = new EmbedBuilder()
				.setDescription("Vous n'avez pas la permission d'utiliser cette commande.")
				.setColor(config.color);
			return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } });
		}

		const user = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
		if (!user) {
			return message.reply("L'utilisateur n'existe pas.");
		}

		if (message.member.roles.highest.position <= user.roles.highest.position) {
			return message.reply("Vous ne pouvez pas kick un membre supérieur à vous.");
		}

		const reason = args.slice(1).join(' ');
		if (!reason) {
			return message.reply("Veuillez fournir une raison.");
		}

		try {
			await user.kick(reason);
			message.reply(`<@${user.id}> a été kick pour ${reason}`);
			const embed = new Discord.EmbedBuilder()
				.setColor(config.color)
				.setDescription(`<@${message.author.id}> a kick <@${user.id}> (${user.id}) pour ${reason}`)
				.setTimestamp();

			sendLog(message.guild, embed, 'modlog');
		} catch (error) {
			console.error('Erreur lors de l\'expulsion :', error);
			return message.reply("Une erreur est survenue.");
		}

		db.run(`INSERT INTO sanctions (userId, raison, date, guild) VALUES (?, ?, ?, ?)`, [user.id, reason + ' - Kick', new Date().toISOString(), message.guild.id], function (err) {
			if (err) {
				console.error('Erreur lors de l\'ajout de la sanction :', err);
				return message.reply("Une erreur est survenue.");
			}
		});
	},
}