import { EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import db from '../Events/loadDatabase.js';

export const command = {
	name: 'vouch',
	description: 'Permet de vouch',
	dm_permission: false,
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: 'service',
			description: 'Le service',
			required: true,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'avis',
			description: 'Votre avis',
			required: true,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'note',
			description: 'Note',
			required: true,
			choices: [
				{ name: '⭐', value: '⭐' },
				{ name: '⭐⭐', value: '⭐⭐' },
				{ name: '⭐⭐⭐', value: '⭐⭐⭐' },
				{ name: '⭐⭐⭐⭐', value: '⭐⭐⭐⭐' },
				{ name: '⭐⭐⭐⭐⭐', value: '⭐⭐⭐⭐⭐' },
			],
		},
	],
	run: async (bot, interaction, args, config) => {

		const service = interaction.options.getString('service');
		const avis = interaction.options.getString('avis');
		const note = interaction.options.getString('note');
		const guildId = interaction.guild.id;
		const total = await new Promise((resolve, reject) => {
			db.get('SELECT total FROM vouch WHERE guild = ?', [guildId], (err, row) => {
				if (err) return reject(err);
				resolve(row ? row.total + 1 : 1);
			});
		});

		await new Promise((resolve, reject) => {
			db.run(`
        INSERT INTO vouch (guild, total)
        VALUES (?, 1)
        ON CONFLICT(guild) DO UPDATE SET total = total + 1
      `, [guildId], function (err) {
				if (err) return reject(err);
				resolve();
			});
		});

		const embed = new EmbedBuilder()
			.setTitle(`#${total} Vouch`)
			.setDescription(`<@${interaction.user.id}> a vouch`)
			.addFields(
				{ name: 'Service', value: service, inline: false },
				{ name: 'Avis', value: avis, inline: false },
				{ name: 'Note', value: note, inline: false },
			)
			.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
			.setTimestamp()
			.setColor(config.color);

		await interaction.reply({ embeds: [embed] });
	}
};
