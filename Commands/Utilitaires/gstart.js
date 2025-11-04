import { EmbedBuilder, Invite } from 'discord.js';
import db from "../../Events/loadDatabase.js";
import config from "../../config.json" with { type: 'json' }
import ms from "ms";

export const command = {
	name: 'gstart',
	helpname: 'gstart <durée> <gagnant> <prix>',
	description: 'Permet de créer un giveaway',
	help: 'gstart <durée> <gagnant> <prix>',
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

		if (!args[0] || !args[1] || !args[2]) return

		let duration = args[0];
		if (!duration || isNaN(ms(duration))) return

		let winnerCount = parseInt(args[1]);
		if (isNaN(winnerCount) || winnerCount <= 0) return

		let prize = args.slice(2).join(" ");
		if (!prize) return

		await message.delete();

		bot.giveawaysManager.start(message.channel, {
			duration: ms(duration),
			winnerCount: winnerCount,
			prize: prize,
			hostedBy: message.author,
			messages: {
				giveaway: '',
				giveawayEnded: '',
				drawing: 'Fin dans: {timestamp}',
				inviteToParticipate: '',
				timeRemaining: `Temps restant: **{duration}**`,
				winMessage: `🎉 Félicitations, {winners} a gagné **${prize}**!`,
				noWinner: "Giveaway annulé, aucun participant valide.",
				hostedBy: `Organisé par: ${message.author}`,
				noWinner: 'Pas assez de participant',
				winners: "Gagnant(s)",
				endedAt: "Terminé",
				embedFooter: 'Termine',
			}
		});
	},
};