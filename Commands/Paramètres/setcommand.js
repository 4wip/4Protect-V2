const db = require('../../Events/loadDatabase');
const fs = require('fs');
const path = require('path');
const config = require('../../config.json');

exports.help = {
  name: 'setcommand',
  sname: 'setcommand [perms] [commande]',
  aliases: ['setcmd', 'setcommande'],
  description: "Permet d'ajouter plusieurs commandes à une ou plusieurs permissions",
  use: 'setcommand [perms] [commande]',
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


const permLevels = args[0]
  .split(',')
  .map(level => {
    const trimmed = level.trim().toLowerCase();
    if (trimmed === "public") return "public";
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) return num;
    return null;
  })
  .filter(level => level !== null);

const commands = args.slice(1).join(' ').split(',').map(cmd => cmd.trim().toLowerCase());

    if (permLevels.length === 0) {
      return
    }

    if (commands.length === 0) {
      return 
    }

    const commandExists = (commandName) => {
      const commandFolders = fs.readdirSync('./Commands').filter((file) => fs.statSync(path.join('./Commands', file)).isDirectory());
      for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(`./Commands/${folder}`).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
          const cmd = require(`../../Commands/${folder}/${file}`);
          if (cmd.help && cmd.help.name.toLowerCase() === commandName) {
            return true;
          }
        }
      }
      return false;
    };

    for (const command of commands) {
      if (!commandExists(command)) {
        return 
      }
    }

for (const permLevel of permLevels) {
  for (const command of commands) {
    db.get(
      'SELECT * FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
      [permLevel, command, message.guild.id],
      (err, row) => {
        if (err) {
          console.error("Erreur lors de la vérification des permissions dans la base de données :", err);
          return;
        }

        if (row) {
          return;
        } else {
          db.run(
            `INSERT INTO cmdperm (perm, command, guild) VALUES (?, ?, ?)`,
            [permLevel, command, message.guild.id],
            (err) => {
              if (err) {
                return;
              }
              message.reply(
                `La commande \`${command}\` a été ajoutée à la permission \`${permLevel}\``
              );
            }
          );
        }
      }
    );
  }
}
}

