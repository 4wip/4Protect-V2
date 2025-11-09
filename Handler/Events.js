import config from "../config.json" with { type: 'json' }
import fs from "fs"

export default async (bot) => {
	const eventFiles = fs.readdirSync('./Events/').filter((file) => file.endsWith('.js'));

	for (const file of eventFiles) {
		const event = (await import(`../Events/${file}`)).default;

		if (event.once) {
			bot.once(event.name, (...args) => event.execute(...args, bot, config));
		} else {
			bot.on(event.name, (...args) => event.execute(...args, bot, config));
		}
		console.log(`[EVENT] > ${file}`);
	}

	const eventSubFolders = fs.readdirSync('./Events/').filter((folder) => !folder.endsWith('.js'));

	for (const folder of eventSubFolders) {
		const subEventFiles = fs.readdirSync(`./Events/${folder}/`).filter((file) => file.endsWith('.js'));

		for (const file of subEventFiles) {
			const event = (await import(`../Events/${folder}/${file}`)).default;

			if (event.once) {
				bot.once(event.name, (...args) => event.execute(...args, bot, config));
			} else {
				bot.on(event.name, (...args) => event.execute(...args, bot, config));
			}
			console.log(`[EVENT] > ${file} - ${folder}`);
		}
	}
};