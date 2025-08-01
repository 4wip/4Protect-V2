const { EmbedBuilder } = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');

exports.help = {
  name: 'setjoin',
  sname: 'setjoin <salon/off> <message>',
  description: 'Configure le salon et le message de bienvenue pour les nouveaux membres',
  use: 'setjoin <salon/off> <message>',
};

exports.run = async (bot, message, args, config) => {
  const configcheck = async (message, commandName) => {
    if (config.owners.includes(message.author.id)) {
      return true;
    }

const publicOn = await new Promise((resolve, reject) => {
  db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
    if (err) reject(err);
    resolve(!!row);
  });
});

if (publicOn) {

  const publicCheck = await new Promise((resolve, reject) => {
    db.get(
      'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
      ['public', commandName, message.guild.id],
      (err, row) => {
        if (err) reject(err);
        resolve(!!row);
      }
    );
  });

  if (publicCheck) {
    return true;
  }
}
    
    try {
      const wldb = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        });
      });

      if (wldb) {
        return true;
      }

            const ownerdb = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        });
      });

      if (ownerdb) {
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

  if (!(await configcheck(message, exports.help.name))) {
    const noacces = new EmbedBuilder()
    .setDescription("Vous n'avez pas la permission d'utiliser cette commande.")
    .setColor(config.color);
  return message.reply({embeds: [noacces], allowedMentions: { repliedUser: true }});
  }

  const arg = message.content.trim().split(/ +/g);
  if (!arg[1]) {
    return message.reply({ content: `Use: \`${config.prefix}setjoin <salon/off> <message>\`` });
  }

  if (arg[1].toLowerCase() === "off") {
    db.run(`UPDATE joinsettings SET channel = ?, message = ? WHERE guildId = ?`, ['off', '', message.guild.id], function (err) {
      if (err) return message.reply("Erreur lors de la désactivation ou est-ce déjà désactivé ?");
      return message.reply("Le système de bienvenue a été désactivé.");
    });
    return;
  }

  const channelId = arg[1].replace("<#", "").replace(">", "");
  const joinChannel = message.guild.channels.cache.get(channelId);
  if (!joinChannel || joinChannel.type !== 0) {
    return message.reply("Salon invalide.");
  }

  const joinMsg = arg.slice(2).join(" ");
  if (!joinMsg) {
    return message.reply("Préciser un message de bienvenue.");
  }

  db.get('SELECT channel FROM joinsettings WHERE guildId = ?', [message.guild.id], (err, row) => {
    if (err) return message.reply("Erreur SQL.");
    if (!row) {
      db.run('INSERT INTO joinsettings (guildId, channel, message) VALUES (?, ?, ?)', [message.guild.id, channelId, joinMsg]);
    } else {
      db.run('UPDATE joinsettings SET channel = ?, message = ? WHERE guildId = ?', [channelId, joinMsg, message.guild.id]);
    }
    message.reply(`Le salon de bienvenue a bien été configuré.`);
  });
};
