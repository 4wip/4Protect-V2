import * as Discord from "discord.js";
import db from "../../Events/loadDatabase.js";
import { EmbedBuilder } from "discord.js";
import config from "../../config.json" with { type: 'json' }
import sendLog from "../../Events/sendlog.js";

export const command = {
        name: 'close',
        helpname: 'close',
        description: 'Permet de close le ticket',
        help: 'close',
        run: async (bot, message, args, config) => {
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
                db.get('SELECT channelId FROM ticketchannel WHERE channelId = ?', [message.channel.id], async (err, row) => {
                        if (err) return console.error(err);
                        if (!row) return;

                        const channel = message.channel;
                        const channelName = channel.name;

                        try {
                                let messages = [];
                                let lastMessageId;
                                let fetchedMessages;
                                
                                do {
                                        const options = { limit: 100 };
                                        if (lastMessageId) {
                                                options.before = lastMessageId;
                                        }
                                        
                                        fetchedMessages = await channel.messages.fetch(options);
                                        messages.push(...fetchedMessages.values());
                                        lastMessageId = fetchedMessages.last()?.id;
                                } while (fetchedMessages.size === 100);
                                
                                messages.reverse();
                                
                                const formattedMessages = messages.map(msg => ({
                                        id: msg.id,
                                        author: {
                                                id: msg.author.id,
                                                username: msg.author.username,
                                                tag: msg.author.tag,
                                                bot: msg.author.bot
                                        },
                                        content: msg.content,
                                        timestamp: msg.createdTimestamp,
                                        attachments: msg.attachments.map(att => ({
                                                url: att.url,
                                                name: att.name
                                        })),
                                        embeds: msg.embeds.length > 0
                                }));
                                
                                const transcriptId = `${Date.now()}-${channel.id}`;
                                const messagesJson = JSON.stringify(formattedMessages);
                                
                                db.run(
                                        'INSERT INTO transcripts (id, guild_id, ticket_name, ticket_channel_id, closed_by_id, closed_by_username, messages, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                                        [transcriptId, message.guild.id, channelName, channel.id, message.author.id, message.author.tag, messagesJson, new Date().toISOString()],
                                        (err) => {
                                                if (err) console.error('Erreur lors de la sauvegarde du transcript:', err);
                                        }
                                );

                                db.run('DELETE FROM ticketchannel WHERE channelId = ?', [message.channel.id], (err2) => {
                                        if (err2) console.error(err2);
                                });

                                const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || 'localhost:5000';
                                const transcriptUrl = `https://${domain}/transcript/${transcriptId}`;

                                const embed = new Discord.EmbedBuilder()
                                        .setColor(config.color)
                                        .setTitle('Ticket Fermé')
                                        .setDescription(`Le ticket **${channelName}** a été fermé par ${message.author}`)
                                        .addFields(
                                                { name: 'Fermé par', value: `${message.author.tag}`, inline: true },
                                                { name: 'Nombre de messages', value: `${formattedMessages.length}`, inline: true }
                                        )
                                        .addFields({ name: 'Transcript', value: `[Cliquez ici pour voir le transcript](${transcriptUrl})` })
                                        .setTimestamp();

                                sendLog(message.guild, embed, 'ticketlog');
                                
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                message.channel.delete().catch(() => { });
                        } catch (error) {
                                console.error('Erreur lors de la fermeture du ticket:', error);
                                message.channel.delete().catch(() => { });
                        }
                });
        },
}
