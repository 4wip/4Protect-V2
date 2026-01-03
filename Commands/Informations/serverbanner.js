import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from "../../config.json" with { type: 'json' };

export const command = {
    name: 'serverbanner',
    helpname: 'serverbanner',
    description: "Affiche la bannière du serveur",
    help: 'serveurbanner',
    run: async (bot, message, args) => {

        // --- Système de vérification des permissions ---
        const checkPerm = async (message, commandName) => {
            if (config.owners.includes(message.author.id)) return true;

            const publicStatut = await new Promise((resolve) => {
                db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
                    resolve(!!row);
                });
            });

            if (publicStatut) {
                const checkPublicCmd = await new Promise((resolve) => {
                    db.get('SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?', ['public', commandName, message.guild.id], (err, row) => {
                        resolve(!!row);
                    });
                });
                if (checkPublicCmd) return true;
            }

            try {
                const checkUserWl = await new Promise((resolve) => {
                    db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => resolve(!!row));
                });
                if (checkUserWl) return true;

                const checkDbOwner = await new Promise((resolve) => {
                    db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => resolve(!!row));
                });
                if (checkDbOwner) return true;

                const roles = message.member.roles.cache.map(role => role.id);
                const permissions = await new Promise((resolve) => {
                    db.all('SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?', [...roles, message.guild.id], (err, rows) => {
                        resolve(rows ? rows.map(row => row.perm) : []);
                    });
                });

                if (permissions.length === 0) return false;

                const checkCmdPermLevel = await new Promise((resolve) => {
                    db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
                        resolve(rows ? rows.map(row => row.command) : []);
                    });
                });

                return checkCmdPermLevel.includes(commandName);
            } catch (error) {
                return false;
            }
        };

        if (!(await checkPerm(message, command.name))) {
            const noacces = new EmbedBuilder()
                .setDescription("Vous n'avez pas la permission d'utiliser cette commande")
                .setColor(config.color);
            return message.reply({ embeds: [noacces] }).then(m => setTimeout(() => m.delete().catch(() => {}), 2000));
        }

        const banner = message.guild.bannerURL({ size: 1024, dynamic: true });

        if (banner) {
            const embed = new EmbedBuilder()
                .setTitle(`Bannière - ${message.guild.name}`)
                .setImage(banner)
                .setColor(config.color);

            const downloadButton = new ButtonBuilder()
                .setLabel("Télécharger")
                .setStyle(ButtonStyle.Link)
                .setURL(banner);

            const actionRow = new ActionRowBuilder().addComponents(downloadButton);

            return message.reply({ embeds: [embed], components: [actionRow] });
        } else {
            // SI AUCUNE BANNIÈRE : On affiche le message d'erreur au lieu de crash
            const errorEmbed = new EmbedBuilder()
                .setDescription("❌ **Bannière non trouvée** pour ce serveur.")
                .setColor(config.color);

            return message.reply({ embeds: [errorEmbed], allowedMentions: { repliedUser: false } });
        }
    },
};
