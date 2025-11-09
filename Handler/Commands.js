import fs from "fs"

export default async (bot) => {
	const commandFiles = fs.readdirSync('./Commands/').filter((file) => file.endsWith('.js'));

	for (const file of commandFiles) {
		const props = (await import(`../Commands/${file}`))?.command;
		bot.commands.set(props.command.name, props);

		if (props.aliases && Array.isArray(props.aliases)) {
			props.aliases.forEach((alias) => {
				bot.commands.set(alias, props);
			});
		}
		console.log(`[COMMAND] > ${file}`);
	}

	const commandSubFolders = fs.readdirSync('./Commands/').filter((folder) => !folder.endsWith('.js'));

	for (const folder of commandSubFolders) {
		const subCommandFiles = fs.readdirSync(`./Commands/${folder}/`).filter((file) => file.endsWith('.js'));

		for (const file of subCommandFiles) {
			const props = (await import(`../Commands/${folder}/${file}`))?.command;
			bot.commands.set(props.name, props);

			if (props.aliases && Array.isArray(props.aliases)) {
				props.aliases.forEach((alias) => {
					bot.commands.set(alias, props);
				});
			}
			console.log(`[COMMAND] > ${file} - ${folder}`);
		}
	}
};