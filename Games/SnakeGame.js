import {
	EmbedBuilder,
	ButtonBuilder,
	ActionRowBuilder,
	ButtonStyle,
	ComponentType
} from 'discord.js';
import config from "../config.json" with { type: 'json' }

const WIDTH = 10;
const HEIGHT = 8;

class SnakeGame {
	constructor(options) {
		if (!options.message) throw new TypeError('Argument manquant : message');
		this.config = config
		this.message = options.message;
		this.buttons = options.buttons || false;
		this.snakeEmoji = options.snake || "🟩";
		this.appleEmoji = options.apple || "🍎";
		this.leftButton = options.leftButton || '⬅️';
		this.rightButton = options.rightButton || '➡️';
		this.upButton = options.upButton || '⬆️';
		this.downButton = options.downButton || '⬇️';

		this.apple = { x: 1, y: 1 };
	}

	start() {
		let snake = [{ x: 5, y: 5 }];
		let snakeLength = 1;
		let score = 0;

		const gameBoardToString = () => {
			let str = "";
			for (let y = 0; y < HEIGHT; y++) {
				for (let x = 0; x < WIDTH; x++) {
					if (x === this.apple.x && y === this.apple.y) {
						str += this.appleEmoji;
						continue;
					}
					let flag = true;
					for (let s = 0; s < snake.length; s++) {
						if (x === snake[s].x && y === snake[s].y) {
							str += this.snakeEmoji;
							flag = false;
							break;
						}
					}
					if (flag) str += "⬛";
				}
				str += "\n";
			}
			return str;
		};

		const isLocInSnake = (pos) => {
			return snake.find(sPos => sPos.x === pos.x && sPos.y === pos.y);
		};

		const newAppleLoc = () => {
			let newApplePos;
			do {
				newApplePos = {
					x: Math.floor(Math.random() * WIDTH),
					y: Math.floor(Math.random() * HEIGHT)
				};
			} while (isLocInSnake(newApplePos));
			this.apple = newApplePos;
		};

		const createEmbed = (title, config) => {
			return new EmbedBuilder()
				.setColor(this.config.color)
				.setTitle(`${title} - ${this.message.author.username}`)
				.setDescription(gameBoardToString() + `\n**Score : ${score}**`)
				.setTimestamp();
		};

		const row1 = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(`\u200b`).setCustomId('extra1').setDisabled(true),
				new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId('up').setEmoji(this.upButton),
				new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(`\u200b`).setCustomId('extra2').setDisabled(true),
			);

		const row2 = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Primary).setEmoji(this.leftButton).setCustomId('left'),
				new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId('down').setEmoji(this.downButton),
				new ButtonBuilder().setStyle(ButtonStyle.Primary).setEmoji(this.rightButton).setCustomId('right')
			);

		this.message.channel.send({
			embeds: [createEmbed("Jeu du Serpent", config)],
			components: this.buttons ? [row1, row2] : []
		}).then(gameMessage => {

			const waitForInput = () => {
				if (this.buttons) {
					const filter = i => i.user.id === this.message.author.id;

					gameMessage.awaitMessageComponent({
						filter,
						componentType: ComponentType.Button,
						max: 1,
						time: 60000,
						errors: ['time']
					})
						.then(interaction => {
							interaction.deferUpdate();
							moveSnake(interaction.customId);
						})
						.catch(() => gameOver("Vous n'avez pas réagi à temps !"));

				} else {
					const filter = (reaction, user) =>
						["⬅️", "⬆️", "⬇️", "➡️"].includes(reaction.emoji.name) && user.id === this.message.author.id;

					gameMessage.awaitReactions({ filter, max: 1, time: 60000, errors: ['time'] })
						.then(collected => {
							const reaction = collected.first();
							reaction.users.remove(this.message.author.id).catch(() => { });
							moveSnake(reaction.emoji.name);
						})
						.catch(() => gameOver("Vous n'avez pas réagi à temps !"));
				}
			};

			const moveSnake = (direction) => {
				const snakeHead = snake[0];
				const nextPos = { x: snakeHead.x, y: snakeHead.y };

				switch (direction) {
					case 'left':
					case '⬅️':
						nextPos.x = (snakeHead.x - 1 + WIDTH) % WIDTH;
						break;
					case 'right':
					case '➡️':
						nextPos.x = (snakeHead.x + 1) % WIDTH;
						break;
					case 'up':
					case '⬆️':
						nextPos.y = (snakeHead.y - 1 + HEIGHT) % HEIGHT;
						break;
					case 'down':
					case '⬇️':
						nextPos.y = (snakeHead.y + 1) % HEIGHT;
						break;
				}

				if (isLocInSnake(nextPos)) return gameOver("*Vous vous êtes **mordu** !*");

				snake.unshift(nextPos);
				if (snake.length > snakeLength) snake.pop();

				if (this.apple.x === snake[0].x && this.apple.y === snake[0].y) {
					score++;
					snakeLength++;
					newAppleLoc();
				}

				gameMessage.edit({
					embeds: [createEmbed("Jeu du Serpent")],
					components: this.buttons ? [row1, row2] : []
				});
				waitForInput();
			};

			const gameOver = (reason, config) => {
				gameMessage.edit({
					embeds: [new EmbedBuilder()
						.setColor(this.config.color)
						.setTitle(`Fin du Jeu - ${this.message.author.username}`)
						.setDescription(`${reason}\n*Pommes récoltées : **${score}***`)
						.setTimestamp()
					],
					components: []
				});
			};

			waitForInput();
		});
	}
}

export default SnakeGame;
