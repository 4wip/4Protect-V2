import config from "../config.json" with { type: 'json' }
import { EmbedBuilder } from "discord.js";
import db from "./loadDatabase.js";
const spamMap = new Map();

export default {
	name: 'messageCreate',
	async execute(message, bot, config) {
		if (!message.guild || message.author.bot) return;
		await al(message);
		await antiEveryone(message);
		await antispam(message);
		await handleCommands(message, bot, config);
	},
};

const bypass = async (userId) => {
	return await new Promise(resolve => {
		db.get('SELECT id FROM owner WHERE id = ?', [userId], (err, row) => {
			if (row) return resolve(true);
			db.get('SELECT id FROM whitelist WHERE id = ?', [userId], (err2, row2) => {
				resolve(!!row2);
			});
		});
	});
};

const al = async (message) => {
	if (await bypass(message.author.id)) return;

	db.get('SELECT antilink, type FROM antiraid WHERE guild = ?', [message.guild.id], (err, row) => {
		if (err) {
			console.error('Error retrieving protections:', err);
			return;
		}

		if (row?.antilink) {
			const patern = /(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*/gi;
			const bl = /(discord\.gg\/[^\s]+|discord(app)?\.com\/invite\/[^\s]+)/i;
			const gifPattern = /\.(gif)$/i;
			const wldom = /(tenor\.com|giphy\.com)/i;

			if (patern.test(message.content)) {
				const links = message.content.match(patern) || [];
				const isInvite = bl.test(message.content);
				const isGif = links.some(link => gifPattern.test(link) || wldom.test(link));

				if (isGif) return;

				if ((isInvite && row.type === 'invite') || row.type === 'all') {
					message.delete().catch(console.error);

					const embed = new EmbedBuilder()
						.setColor(config.color)
						.setDescription(`Vous n'avez pas le droit d'envoyer des liens <@${message.author.id}>`)
					message.channel.send({ embeds: [embed] }).then(msg => {
						setTimeout(() => {
							msg.delete().catch(console.error);
						}, 3000);
					}).catch(console.error);

					db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [message.guild.id, 'antilink'], async (err, row) => {
						const sanction = row?.punition || 'timeout';

						if (sanction === 'ban') {
							await message.member.ban({ reason: 'Antilink' });
						} else if (sanction === 'kick') {
							await message.member.kick('Antilink');
						} else if (sanction === 'derank') {
							await message.member.roles.set([], 'Antilink');
						} else {
							await message.member.timeout?.(60000, 'Antilink');
						}

					});
				}
			}
		}
	});
};


const antiEveryone = async (message) => {
	if (await bypass(message.author.id)) return;

	db.get('SELECT antieveryone FROM antiraid WHERE guild = ?', [message.guild.id], async (err, row) => {
		if (err || !row?.antieveryone) return;

		if (message.mentions.everyone) {
			try {
				await message.delete();

				const sanctionRow = await new Promise((resolve) => {
					db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [message.guild.id, 'antieveryone'], (err2, row2) => {
						resolve(row2);
					});
				});
				const sanction = sanctionRow?.punition || 'timeout';

				const member = message.member;
				if (!member) return;

				if (sanction === 'ban') {
					await member.ban({ reason: 'AntiEveryone' });
				} else if (sanction === 'kick') {
					await member.kick('AntiEveryone');
				} else if (sanction === 'derank') {
					await member.roles.set([], 'AntiEveryone');
				} else {
					await member.timeout?.(60000, 'AntiEveryone');
				}
			} catch (error) {
				console.error('Erreur AntiEveryone:', error);
			}
		}
	});
};


const antispam = async (message) => {
	const checkbypass = await bypass(message.author.id);
	if (checkbypass) return;

	db.get(
		'SELECT antispam, nombremessage, sous, timeout FROM antiraid WHERE guild = ?',
		[message.guild.id],
		async (err, row) => {
			if (err) {
				console.error(err);
				return;
			}
			if (!row?.antispam) {
				return;
			}
			const count = row.nombremessage;
			const sous = row.sous;
			const timeoutMs = row.timeout;

			const now = Date.now();
			if (!spamMap.has(message.guild.id)) {
				spamMap.set(message.guild.id, new Map());
			}
			const guildSpam = spamMap.get(message.guild.id);

			let userTimestamps = guildSpam.get(message.author.id) || [];
			userTimestamps = userTimestamps.filter(ts => now - ts < sous);
			userTimestamps.push(now);
			guildSpam.set(message.author.id, userTimestamps);

			if (userTimestamps.length >= count) {
				try {
					db.get(
						'SELECT punition FROM punish WHERE guild = ? AND module = ?',
						[message.guild.id, 'antispam'],
						async (err, punishRow) => {
							if (err) {
								console.error(err);
								return;
							}
							const sanction = punishRow?.punition || 'timeout';
							try {
								if (sanction === 'ban') {
									await message.member.ban({ reason: 'Antispam' });
									message.channel.send(`<@${message.author.id}> a été banni pour spam.`);
								} else if (sanction === 'kick') {
									await message.member.kick('Antispam');
									message.channel.send(`<@${message.author.id}> a été kick pour spam.`);
								} else if (sanction === 'derank') {
									await message.member.roles.set([], 'Antispam');
									message.channel.send(`<@${message.author.id}> a été dérank pour spam.`);
								} else {
									await message.member.timeout(timeoutMs, 'Antispam');
									message.channel.send(`<@${message.author.id}> a été timeout pour spam.`);
								}
								guildSpam.set(message.author.id, []);
							}

							catch (e) {
								console.error(e);
							}
						}
					);
				} catch (e) {
					-console.error(e);
				}
			}
		}
	);
};

const handleCommands = async (message, bot, config) => {
	const prefixPing = () => message.reply({
		content: `Mon préfixe est \`${config.prefix}\`.`,
		allowedMentions: { repliedUser: false }
	});

	if (message.content.startsWith(`<@${bot.user.id}>`)) {
		const args = message.content.slice(`<@${bot.user.id}>`.length).trim().split(/ +/);
		const commandName = args.shift()?.toLowerCase();

		if (!commandName) return prefixPing();

		const commandFile = bot.commands.get(commandName);
		if (!commandFile) return prefixPing();

		await commandFile.run(bot, message, args, config);
	} else if (message.content.startsWith(config.prefix)) {
		const args = message.content.slice(config.prefix.length).trim().split(/ +/);
		const commandName = args.shift()?.toLowerCase();

		const commandFile = bot.commands.get(commandName);
		if (!commandFile) return;

		await commandFile.run(bot, message, args, config);
	}
};
