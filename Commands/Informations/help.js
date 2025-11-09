import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import config from '../../config.json' with { type: 'json' };
import db from '../../Events/loadDatabase.js';
import path from "node:path";
import fs from "fs";

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categories = [
	'Utilitaires',
	'Modérations',
	'Gestions',
	'Antiraid',
	'Logs',
	'Contact',
	'Paramètres',
	'Informations'
];

export const command = {
	name: 'help',
	helpname: 'help',
	description: "Permet d'afficher la liste des commandes",
	help: 'help',
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

		if (args[0]) {
			let cmdchec = false;
			for (const category of categories) {
				const cpath = path.join(__dirname, `../../Commands/${category}`);
				if (!fs.existsSync(cpath)) continue;
				const commandFiles = fs.readdirSync(cpath).filter(file => file.endsWith('.js'));
				for (const file of commandFiles) {
					const command = (await import(`../../Commands/${category}/${file}`)).command;
					if (command.name === args[0] || (command.aliases && command.aliases.includes(args[0]))) {
						const embed = new EmbedBuilder()
							.setTitle(`${command.name}`)
							.setDescription(command.description || "Aucune description")
							.addFields(
								{ name: 'Utilisation', value: `\`${config.prefix}${command.help}\`` },
								{ name: 'Alias', value: command.aliases ? command.aliases.join(', ') : '  ' }
							)
							.setColor(config.color)
							.setFooter({ text: "4Protect V2" });
						await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
						cmdchec = true;
						break;
					}
				}
				if (cmdchec) break;
			}
			if (!cmdchec) {
				const notFoundEmbed = new EmbedBuilder()
					.setDescription(`La commande \`${args[0]}\` n'existe pas.`)
					.setColor(config.color)
					.setFooter({ text: "4Protect V2" });
				await message.reply({ embeds: [notFoundEmbed], allowedMentions: { repliedUser: false } });
			}
			return;
		}

		const catagor = [];

		for (let i = 0; i < categories.length; i++) {
			const category = categories[i];
			const cpath = path.join(__dirname, `../../Commands/${category}`);
			let commands = [];

			if (fs.existsSync(cpath)) {
				const commandFiles = fs.readdirSync(cpath).filter(file => file.endsWith('.js'));

				for (const file of commandFiles) {
					const cmd = (await import(`../../Commands/${category}/${file}`)).command;

					const checkhelpPerm = await checkPerm(message, cmd.name);
					if (checkhelpPerm) {
						commands.push(`**\`${config.prefix}${cmd.helpname || cmd.name}\`**\n${cmd.description || ' '}`);

					}
				}
			}

			if (commands.length > 0) {
				catagor.push({
					name: category,
					embed: new EmbedBuilder()
						.setTitle(`${category}`)
						.setDescription(`Pour avoir de l’aide sur une commande, utilisez \`${config.prefix}help <commande>\`\nLes paramètres entre \`<...>\` sont obligatoires tandis que ceux entre \`[...]\` sont facultatifs\n\n${commands.join('\n\n')}`)
						.setColor(config.color)
						.setFooter({ text: "4Protect V2" })
				});
			}
		}

		if (catagor.length === 0) {
			return
		}

		const selectMenu = new ActionRowBuilder()
			.addComponents(
				new StringSelectMenuBuilder()
					.setCustomId('categorySelect')
					.setPlaceholder('Choisis une catégorie')
					.addOptions(catagor.map((cat, index) => ({
						label: cat.name,
						value: `category_${index}`,
					})))
			);

		const msg = await message.reply({
			embeds: [catagor[0].embed],
			components: [selectMenu],
			allowedMentions: { repliedUser: false }
		});
		const filter = i => i.user.id === message.author.id;
		const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

		collector.on('collect', async i => {
			if (i.customId === 'categorySelect') {
				const selectedIndex = parseInt(i.values[0].split('_')[1], 10);
				await i.update({ embeds: [catagor[selectedIndex].embed], components: [selectMenu] });
			}
		});

		collector.on('end', () => {
			msg.edit({ components: [] }).catch(() => { });
		});
	},
};