import fs from "fs"

export default async bot => {
	const arrayOfSlashCommands = [];
	const commandFiles = fs.readdirSync('./SlashCommands/').filter((file) => file.endsWith('.js'));

	for (const file of commandFiles) {
		const props = (await import(`../SlashCommands/${file}`)).command;
		bot.slashCommands.set(props.name, props);
		arrayOfSlashCommands.push(props);
		bot.arrayOfSlashCommands = arrayOfSlashCommands
		console.log(`[SLASH-COMMAND] > ${file}`);
	}
	const commandSubFolders = fs.readdirSync('./SlashCommands/').filter((folder) => !folder.endsWith('.js'));

	for (const folder of commandSubFolders) {
		const subCommandFiles = fs.readdirSync(`./SlashCommands/${folder}/`).filter((file) => file.endsWith('.js'));

		for (const file of subCommandFiles) {
			const props = (await import(`../SlashCommands/${folder}/${file}`)).command;
			bot.slashCommands.set(props.name, props);
			arrayOfSlashCommands.push(props);
			bot.arrayOfSlashCommands = arrayOfSlashCommands
			console.log(`[SLASH-COMMAND] > ${file} - ${folder}`);
		}
	}
};