import { ChannelType, PermissionFlagsBits, Message } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from '../../config.json' with { type: 'json' };
import Discord from 'discord.js';

export const command = {
	name: 'ticketlog',
	help: 'ticketlog [off]',
	helpname: 'ticketlog [off]',
	description: 'Active/désactive les logs ticket',
	run: async (client, message, args, config) => {

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

		const action = args[0]?.toLowerCase();

		if (action === 'off') {
			let channelsObj = {};
			try {
				channelsObj = JSON.parse(
					await new Promise(res =>
						db.get(
							'SELECT channels FROM logs WHERE guild = ?',
							[message.guild.id],
							(err, row) => res(row?.channels || '{}')
						)
					)
				);
			} catch { channelsObj = {}; }

			const channelId = channelsObj["📁・ticket-logs"];
			if (channelId) {
				const channel = message.guild.channels.cache.get(channelId);
				if (channel) await channel.delete().catch(() => { });
				delete channelsObj["📁・ticket-logs"];
				db.run(
					`INSERT OR REPLACE INTO logs (guild, channels) VALUES (?, ?)`,
					[message.guild.id, JSON.stringify(channelsObj)]
				);
				return message.reply("Les logs boosts sont désactivé.");
			} else {
				return message.reply("Pas de logs des boosts configuré.");
			}
		}

		let logsCategory = message.guild.channels.cache.find(
			c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'logs'
		);

		if (!logsCategory) {
			logsCategory = await message.guild.channels.create({
				name: 'Logs',
				type: ChannelType.GuildCategory,
				permissionOverwrites: [
					{
						id: message.guild.roles.everyone,
						deny: [PermissionFlagsBits.ViewChannel],
					},
					{
						id: message.guild.ownerId,
						allow: [PermissionFlagsBits.ViewChannel],
					},
				],
			});
		}

		const newChannel = message.mentions.channels.first() ||
			message.guild.channels.cache.get(args[0]) ||
			message.channel;

		if (!newChannel) {
			return message.reply("Salon invalide");
		}

		let finalChannel = newChannel;
		if (newChannel.parentId !== logsCategory.id) {
			finalChannel = await message.guild.channels.create({
				name: "📁・ticket-logs",
				type: ChannelType.GuildText,
				parent: logsCategory.id,
				permissionOverwrites: [
					{
						id: message.guild.roles.everyone,
						deny: [PermissionFlagsBits.ViewChannel],
					},
					{
						id: message.guild.ownerId,
						allow: [PermissionFlagsBits.ViewChannel],
					},
				],
			});
		}

		let channelsObj = {};
		try {
			channelsObj = JSON.parse(
				await new Promise(res =>
					db.get(
						'SELECT channels FROM logs WHERE guild = ?',
						[message.guild.id],
						(err, row) => res(row?.channels || '{}')
					)
				)
			);
		} catch {
			channelsObj = {};
		}

		channelsObj["📁・ticket-logs"] = finalChannel.id;

		db.run(
			`INSERT OR REPLACE INTO logs (guild, channels) VALUES (?, ?)`,
			[message.guild.id, JSON.stringify(channelsObj)]
		);

		await message.reply(`<#${finalChannel.id}>`);
	},
}