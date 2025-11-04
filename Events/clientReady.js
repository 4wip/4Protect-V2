import { ActivityType } from "discord.js";

export default {
	name: 'clientReady',
	async execute(bot) {
		await bot.application.commands.set(bot.arrayOfSlashCommands);

		bot.user.setPresence({
			activities: [{ name: '4Protect V2', type: ActivityType.Streaming, url: 'https://twitch.tv/4wipyk' }], status: 'online'
		});
	}
};
