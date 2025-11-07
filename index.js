const originalStderrWrite = process.stderr.write;
process.stderr.write = function(...args) {
        const msg = args[0]?.toString() || '';
        if (msg.includes('DeprecationWarning') || msg.includes('ready event') || msg.includes('clientReady')) {
                return true;
        }
        return originalStderrWrite.apply(process.stderr, args);
};

process.removeAllListeners('warning');
process.on('warning', () => {});
process.setMaxListeners(0);

import Discord from "discord.js"
import { EmbedBuilder } from "discord.js";
import config from "./config.json" with { type: 'json' }
import { GiveawaysManager } from "discord-giveaways";

const bot = new Discord.Client({
        intents: 3276799,
        partials: [
                Discord.Partials.Channel,
                Discord.Partials.Message,
                Discord.Partials.User,
                Discord.Partials.GuildMember,
                Discord.Partials.Reaction,
                Discord.Partials.ThreadMember,
                Discord.Partials.GuildScheduledEvent
        ]
});

bot.commands = new Discord.Collection();
bot.slashCommands = new Discord.Collection();
bot.setMaxListeners(70);

const token = process.env.DISCORD_BOT_TOKEN || config.token;

bot.login(token)
        .catch((e) => {
                console.log('\x1b[31m[!] — Please configure a valid bot token or allow all the intents\x1b[0m');
        });

bot.giveawaysManager = new GiveawaysManager(bot, {
        storage: './giveaways.json',
        updateCountdownEvery: 5000,
        default: {
                botsCanWin: false,
                embedColor: config.color,
                reaction: "🎉"
        }
});
bot.giveawaysManager.on('giveawayEnded', async (giveaway, winners) => {
        const channel = await bot.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(giveaway.messageId);

        setTimeout(async () => {
                const reaction = message.reactions.cache.get("🎉");
                let participantsCount = 0;
                if (reaction) {
                        const users = await reaction.users.fetch();
                        participantsCount = users.filter(u => !u.bot).size;
                }
                const embed = new EmbedBuilder()
                        .setTitle(giveaway.prize)
                        .setDescription(
                                `Fin: <t:${Math.floor(giveaway.endAt / 1000)}:R> <t:${Math.floor(giveaway.endAt / 1000)}:F>\n` +
                                `Organisé par: ${giveaway.hostedBy?.id || giveaway.hostedBy}\n` +
                                `Participants: ${participantsCount}\n` +
                                `Gagnant(s): ${winners.map(w => `<@${w.id}>`).join(', ') || "Aucun"}\n`
                        )
                        .setColor(config.color);
                await message.edit({ embeds: [embed], components: [] });
        }, 1000);
}
);
const commandHandler = (await import('./Handler/Commands.js')).default(bot);
const slashcommandHandler = (await import('./Handler/slashCommands.js')).default(bot);
const eventdHandler = (await import('./Handler/Events.js')).default(bot);
const anticrashHandler = (await import('./Handler/anticrash.js')).default;
anticrashHandler(bot);

const { startDashboard, logDashboardReady } = await import('./dashboard/server.js');
startDashboard(bot);

bot.once('clientReady', async () => {
        setTimeout(() => {
                console.log('');
                logDashboardReady();
                console.log(`[INFO] > ${bot.user.tag} est connecté`);
                console.log(`[Invite] https://discord.com/oauth2/authorize?client_id=${bot.user.id}&permissions=8&integration_type=0&scope=bot`);
                console.log(`[Support] https://dsc.gg/4wip`);
        }, 3000);
});
