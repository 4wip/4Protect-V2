import { 
        ModalBuilder, 
        TextInputBuilder, 
        TextInputStyle, 
        ActionRowBuilder, 
        EmbedBuilder, 
        ButtonBuilder, 
        ButtonStyle, 
        MessageFlags,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize
} from 'discord.js';
import Discord from "discord.js"
import db from "./loadDatabase.js";
import sendLog from "./sendlog.js";

export default {
        name: 'interactionCreate',
        async execute(interaction, bot, config) {

                if (interaction.isCommand()) {
                        const cmd = bot.slashCommands.get(interaction.commandName);
                        const args = [];
                        for (let option of interaction.options.data) {
                                if (option.type === 1) {
                                        if (option.name) args.push(option.name);
                                        option.options?.forEach((x) => {
                                                if (x.value) args.push(x.value);
                                        });
                                } else if (option.value) args.push(option.value);
                        }
                        cmd.run(bot, interaction, args, config);
                        return;
                }

                if (interaction.isButton() && interaction.customId === 'confess_open') {
                        const modal = new ModalBuilder()
                                .setCustomId('confess_modal')
                                .setTitle('Faire une confession');

                        const input = new TextInputBuilder()
                                .setCustomId('confess_text')
                                .setLabel('Ta confession')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMaxLength(2000);

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        return interaction.showModal(modal);
                }

                if (interaction.isModalSubmit() && interaction.customId === 'confess_modal') {
                        const confession = interaction.fields.getTextInputValue('confess_text');
                        db.get('SELECT channel FROM Confess WHERE guildId = ?', [interaction.guild.id], async (err, row) => {
                                if (err || !row || row.channel === 'off') {
                                        return interaction.reply({ content: "Le salon de confession n'est pas configuré.", flags: Discord.MessageFlags.Ephemeral });
                                }
                                const confessChannel = interaction.guild.channels.cache.get(row.channel);
                                if (!confessChannel) {
                                        return interaction.reply({ content: "Le salon de confession est introuvable.", flags: Discord.MessageFlags.Ephemeral });
                                }

                                const confessionNumber = await new Promise((resolve) => {
                                        db.get('SELECT COUNT(*) as count FROM confesslogs WHERE guildId = ?', [interaction.guild.id], (err2, row2) => {
                                                if (!err2 && row2) return resolve(row2.count + 1);
                                                resolve(1);
                                        });
                                });

                                db.run('INSERT INTO confesslogs (guildId, userId, message) VALUES (?, ?, ?)', [interaction.guild.id, interaction.user.id, confession]);

                                const embed = new EmbedBuilder()
                                        .setTitle(`Confession #${confessionNumber}`)
                                        .setDescription(confession)
                                        .setColor(config.color);

                                const messages = await confessChannel.messages.fetch({ limit: 10 });
                                const lastBotMsg = messages.find(m => m.author.id === interaction.client.user.id && m.components.length > 0);
                                if (lastBotMsg) {
                                        await lastBotMsg.edit({ components: [] }).catch(() => { });
                                }

                                const rowBtn = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId('confess_open')
                                                .setLabel('Se confesser')
                                                .setStyle(ButtonStyle.Primary)
                                );

                                await confessChannel.send({ embeds: [embed], components: [rowBtn] });
                        });
                }

                if (interaction.isButton() && interaction.customId.startsWith('giveaway_')) {
                        const [, action, messageId] = interaction.customId.split('_');
                        if (action === 'reroll') {
                                await bot.giveawaysManager.reroll(messageId)
                                        .then(() => interaction.reply({ content: "Reroll", flags: Discord.MessageFlags.Ephemeral }))
                                        .catch(() => interaction.reply({ content: "Erreur lors du reroll.", flags: Discord.MessageFlags.Ephemeral }));
                        }
                        if (action === 'end') {
                                await bot.giveawaysManager.end(messageId)
                                        .then(() => interaction.reply({ content: "Giveaway terminé !", flags: Discord.MessageFlags.Ephemeral }))
                                        .catch(() => interaction.reply({ content: "Erreur lors de la fin du giveaway.", flags: Discord.MessageFlags.Ephemeral }));
                        }
                }

                if (interaction.isButton() && interaction.customId === 'cbutton') {
                        db.get('SELECT id FROM captcha WHERE guild = ?', [interaction.guild.id], async (err, row) => {
                                if (err) {
                                        console.error(err);
                                }
                                const role = interaction.guild.roles.cache.get(row.id);
                                try {
                                        await interaction.member.roles.add(role);
                                } catch (e) {
                                        console.error(e);
                                }

                        });
                }


                if (interaction.isButton() && interaction.customId === 'suggest_open') {
                        const modal = new ModalBuilder()
                                .setCustomId('suggest_modal')
                                .setTitle('Faire une suggestion');

                        const input = new TextInputBuilder()
                                .setCustomId('suggest_text')
                                .setLabel('Ta suggestion')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMaxLength(2000);

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        return interaction.showModal(modal);
                }

                if (interaction.isModalSubmit() && interaction.customId === 'suggest_modal') {
                        const suggestion = interaction.fields.getTextInputValue('suggest_text');
                        db.get('SELECT channel FROM Suggest WHERE guildId = ?', [interaction.guild.id], async (err, row) => {
                                if (err || !row || row.channel === 'off') {
                                        return interaction.reply({ content: "Le salon de suggestion n'est pas configuré.", flags: Discord.MessageFlags.Ephemeral });
                                }
                                const suggestChannel = interaction.guild.channels.cache.get(row.channel);
                                if (!suggestChannel) {
                                        return interaction.reply({ content: "Le salon de suggestion est introuvable.", flags: Discord.MessageFlags.Ephemeral });
                                }

                                const messages = await suggestChannel.messages.fetch({ limit: 10 });
                                const lastBotMsg = messages.find(m => m.author.id === interaction.client.user.id && m.components.length > 0);
                                if (lastBotMsg) {
                                        await lastBotMsg.edit({ components: [] }).catch(() => { });
                                }

                                const embed = new EmbedBuilder()
                                        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                                        .setTitle('Suggestion')
                                        .setDescription(suggestion)
                                        .setColor(config.color);

                                const rowBtn = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId('suggest_open')
                                                .setLabel('Faire une suggestion')
                                                .setStyle(ButtonStyle.Primary)
                                );

                                const sentMsg = await suggestChannel.send({ embeds: [embed], components: [rowBtn] });
                                await sentMsg.react('✅');
                                await sentMsg.react('❌');
                        });
                }

                if (interaction.isButton() && interaction.customId === 'ticket_close') {
                        await interaction.reply({ content: 'Fermeture du ticket et création du transcript...', flags: MessageFlags.Ephemeral });

                        try {
                                const channel = interaction.channel;
                                const ticketName = channel.name;
                                const ticketTopic = channel.topic || '';
                                
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
                                        [transcriptId, interaction.guild.id, ticketName, channel.id, interaction.user.id, interaction.user.tag, messagesJson, new Date().toISOString()],
                                        (err) => {
                                                if (err) console.error('Erreur lors de la sauvegarde du transcript:', err);
                                        }
                                );
                                
                                db.run('DELETE FROM ticketchannel WHERE channelId = ?', [channel.id], (err) => {
                                        if (err) console.error(err);
                                });
                                
                                const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || 'localhost:5000';
                                const transcriptUrl = `https://${domain}/transcript/${transcriptId}`;
                                
                                const logEmbed = new EmbedBuilder()
                                        .setColor(config.color)
                                        .setTitle('Ticket Fermé')
                                        .setDescription(`Le ticket **${ticketName}** a été fermé par ${interaction.user}`)
                                        .addFields(
                                                { name: 'Fermé par', value: `${interaction.user.tag}`, inline: true },
                                                { name: 'Nombre de messages', value: `${formattedMessages.length}`, inline: true }
                                        )
                                        .addFields({ name: 'Transcript', value: `[Cliquez ici pour voir le transcript](${transcriptUrl})` })
                                        .setTimestamp();
                                
                                sendLog(interaction.guild, logEmbed, 'ticketlog');
                                
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                
                                await channel.delete().catch(console.error);
                        } catch (error) {
                                console.error('Erreur lors de la fermeture du ticket:', error);
                        }
                }


                if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
                        const optiontxt = config[interaction.values[0]] || 'Ticket';
                        const existing = interaction.guild.channels.cache.find(c =>
                                c.topic === `${optiontxt} - ${interaction.user.username}`
                        );
                        if (existing) {
                                return interaction.reply({ content: 'Vous avez déjà un ticket ouvert.', ephemeral: true });
                        }
                        db.get('SELECT category FROM ticket WHERE guild = ?', [interaction.guild.id], async (err, row) => {
                                let parent = row?.category || null;
                                if (parent && typeof parent !== 'string') parent = String(parent);
                                const ticketChannel = await interaction.guild.channels.create({
                                        name: `ticket-${interaction.user.username}`,
                                        type: 0,
                                        topic: `${optiontxt} - ${interaction.user.username}`,
                                        parent: parent,
                                        permissionOverwrites: [
                                                { id: interaction.guild.id, deny: ['ViewChannel'] },
                                                { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles'] },
                                                { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] },
                                        ],
                                });
                                db.run(
                                        'INSERT INTO ticketchannel (channelId) VALUES (?)',
                                        [ticketChannel.id],
                                        (err) => {
                                                if (err) console.error(err);
                                        }
                                );

                                const close = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId('ticket_close')
                                                .setLabel('🔒 Fermer le ticket')
                                                .setStyle(ButtonStyle.Danger)
                                );
                                
                                const container = new ContainerBuilder()
                                        .setAccentColor(parseInt(config.color.replace('#', ''), 16))
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(`## 🎫 Ticket - ${optiontxt}`)
                                        )
                                        .addSeparatorComponents(
                                                new SeparatorBuilder()
                                                        .setSpacing(SeparatorSpacingSize.Small)
                                                        .setDivider(true)
                                        )
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(`👋 Bonjour <@${interaction.user.id}> !`),
                                                new TextDisplayBuilder().setContent(`Expliquez votre problème, un membre du staff va vous répondre rapidement.`)
                                        )
                                        .addSeparatorComponents(
                                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                                        )
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(`**Créé par:** ${interaction.user.tag}\n**Date:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                                        );
                                
                                await ticketChannel.send({
                                        components: [container, close],
                                        flags: MessageFlags.IsComponentsV2
                                });
                                return interaction.reply({ content: `Votre ticket: ${ticketChannel}`, flags: 64 });
                        });
                }
        }
};
