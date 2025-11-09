import Discord from "discord.js"
import sendLog from "./sendlog.js";
import config from "../config.json" with { type: 'json' }

export default {
	name: 'messageDelete',
	async execute(message, bot) {
		if (message.partial) return;

		const deletedMessages = bot.deletedMessages || new Map();
		deletedMessages.set(message.channel.id, {
			msg: message,
			content: message.content,
			deletedAt: new Date()
		});
		bot.deletedMessages = deletedMessages;

		const embed = new Discord.EmbedBuilder()
			.setColor(config.color)
			.setTitle('Message supprimé')
			.setAuthor({
				name: message.author?.tag || ' ',
				iconURL: message.author?.displayAvatarURL() || ''
			})
			.setDescription(
				`**Auteur :** <@${message.author?.id || ' '}> (${message.author?.id || ' '})\n` +
				`**Salon :** <#${message.channel.id}>\n` +
				`**Contenu :**\n${message.content ? `\`\`\`\n${message.content}\n\`\`\`` : ' '}`
			)
			.setTimestamp();

		sendLog(message.guild, embed, 'messagelog');
	},
};