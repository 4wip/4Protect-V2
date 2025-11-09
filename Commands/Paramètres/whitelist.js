import * as Discord from "discord.js";
import db from "../../Events/loadDatabase.js";
import { EmbedBuilder } from "discord.js";

const ITEMS_PER_PAGE = 10;

export const command = {
	name: 'whitelist',
	helpname: 'whitelist [mention/id]',
	aliases: ['wl'],
	description: 'Permet de gérer la whitelist',
	help: 'whitelist [mention/id]\nwhitelist',
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

		if (args.length === 0) {
			db.all('SELECT id FROM whitelist', [], async (err, rows) => {
				if (err) {
					console.error('Erreur lors de la récupération de la whitelist:', err);
					return
				}

				if (rows.length === 0) {
					return message.reply("La whitelist est vide.");
				}

				const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
				let currentPage = 1;

				const generateEmbed = async (page) => {
					const embed = new Discord.EmbedBuilder()
						.setTitle('Whitelist')
						.setColor(config.color)
						.setFooter({ text: `${rows.length} personnes - ${page}/${totalPages}` });

					const start = (page - 1) * ITEMS_PER_PAGE;
					const end = Math.min(start + ITEMS_PER_PAGE, rows.length);

					for (let i = start; i < end; i++) {
						const user = await bot.users.fetch(rows[i].id).catch(() => null);
						if (user) {
							embed.addFields({
								name: user.tag,
								value: user.id,
								inline: false
							});
						} else {
							embed.addFields({
								name: 'Utilisateur non trouvé',
								value: rows[i].id,
								inline: false
							});
						}
					}

					return embed;
				};

				const embed = await generateEmbed(currentPage);

				const row = new Discord.ActionRowBuilder()
					.addComponents(
						new Discord.ButtonBuilder()
							.setCustomId('prev')
							.setLabel('Précédent')
							.setStyle('Secondary')
							.setDisabled(currentPage === 1),
						new Discord.ButtonBuilder()
							.setCustomId('next')
							.setLabel('Suivant')
							.setStyle('Secondary')
							.setDisabled(currentPage === totalPages)
					);

				const reply = await message.reply({ embeds: [embed], components: [row], allowedMentions: { repliedUser: false } });

				const filter = i => i.user.id === message.author.id;
				const collector = reply.createMessageComponentCollector({ filter, time: 60000 });

				collector.on('collect', async interaction => {
					if (interaction.customId === 'prev') {
						currentPage--;
					} else if (interaction.customId === 'next') {
						currentPage++;
					}

					const newEmbed = await generateEmbed(currentPage);

					const newRow = new Discord.ActionRowBuilder()
						.addComponents(
							new Discord.ButtonBuilder()
								.setCustomId('prev')
								.setLabel('Précédent')
								.setStyle('Primary')
								.setDisabled(currentPage === 1),
							new Discord.ButtonBuilder()
								.setCustomId('next')
								.setLabel('Suivant')
								.setStyle('Primary')
								.setDisabled(currentPage === totalPages)
						);

					await interaction.update({ embeds: [newEmbed], components: [newRow] });
				});

				collector.on('end', collected => {
					if (collected.size === 0) {
						reply.edit({ components: [] });
					}
				});
			});
		} else {
			const user = message.mentions.users.first() || await bot.users.fetch(args[0]).catch(() => null);
			if (!user) return

			db.run(`INSERT OR IGNORE INTO whitelist (id) VALUES (?)`, [user.id], function (err) {
				if (err) {
					console.error('Erreur lors de l\'ajout à la whitelist:', err);
					return
				}

				if (this.changes === 0) {
					return message.reply(`<@${user.id}> est déjà dans la whitelist.`);
				}

				message.reply(`<@${user.id}> a été ajouté à la whitelist.`);
			});
		}
	},
}