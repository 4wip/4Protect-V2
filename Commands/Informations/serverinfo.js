const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../Events/loadDatabase'); 
const config = require('../../config.json');

exports.help = {
    name: 'serverinfo',
    description: "Affiche les informations du serveur",
    use: 'serverinfo',
};

exports.run = async (bot, message, args) => {

  const checkperm = async (message, commandName) => {
    if (config.owners.includes(message.author.id)) {
      return true;
    }

const public = await new Promise((resolve, reject) => {
  db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
    if (err) reject(err);
    resolve(!!row);
  });
});

if (public) {

  const publiccheck = await new Promise((resolve, reject) => {
    db.get(
      'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
      ['public', commandName, message.guild.id],
      (err, row) => {
        if (err) reject(err);
        resolve(!!row);
      }
    );
  });

  if (publiccheck) {
    return true;
  }
}
    
    try {
      const userwl = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        });
      });

      if (userwl) {
        return true;
      }

            const userowner = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        });
      });

      if (userowner) {
        return true;
      }

      const userRoles = message.member.roles.cache.map(role => role.id);

      const permissions = await new Promise((resolve, reject) => {
        db.all('SELECT perm FROM permissions WHERE id IN (' + userRoles.map(() => '?').join(',') + ') AND guild = ?', [...userRoles, message.guild.id], (err, rows) => {
          if (err) reject(err);
          resolve(rows.map(row => row.perm));
        });
      });

      if (permissions.length === 0) {
        return false;
      }

      const cmdwl = await new Promise((resolve, reject) => {
        db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
          if (err) reject(err);
          resolve(rows.map(row => row.command));
        });
      });

      return cmdwl.includes(commandName);
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      return false;
    }
  };

  if (!(await checkperm(message, exports.help.name))) {
    const noacces = new EmbedBuilder()
    .setDescription("Vous n'avez pas la permission d'utiliser cette commande.")
    .setColor(config.color);
  return message.reply({embeds: [noacces], allowedMentions: { repliedUser: true }});
  }

    const owner = await message.guild.fetchOwner();
    const embed = new EmbedBuilder()
        .setTitle(`Information - ${message.guild.name}`)
        .setThumbnail(message.guild.iconURL({ dynamic: true, size: 1024 }))
        .setColor(config.color)
        .addFields(
            { name: 'Nom', value: message.guild.name, inline: true },
            { name: 'ID', value: message.guild.id, inline: true },
            { name: 'Propriétaire', value: `${owner.user.tag}`, inline: true },
            { name: 'Membres', value: `${message.guild.memberCount}`, inline: true },
            { name: 'Boosts', value: `${message.guild.premiumSubscriptionCount}`, inline: true },
            { name: 'Rôles', value: `${message.guild.roles.cache.size}`, inline: true },
            { name: 'Date de création', value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:F>`, inline: false },
        )
        .setImage(message.guild.bannerURL({ dynamic: true, size: 1024 }));

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
};
