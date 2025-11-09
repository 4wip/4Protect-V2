import { ChannelType, PermissionsBitField, EmbedBuilder } from 'discord.js';
import sendLog from "./sendlog.js";
import config from "../config.json" with { type: 'json' }
import db from './loadDatabase.js';

export default {
	name: 'voiceStateUpdate',
	async execute(oldState, newState, bot) {
		const guildId = oldState.guild.id;

		db.get(`SELECT * FROM tempvoc WHERE guildId = ?`, [guildId], async (err, row) => {
			if (err || !row) return;

			const categoryId = row.category;
			const tempvoc = row.channel;

			if ((!oldState.channelId || oldState.channelId !== tempvoc) && newState.channelId === tempvoc) {
				const category = oldState.guild.channels.cache.get(categoryId);
				if (!category) return;

				oldState.guild.channels.create({
					name: `⏱・Salon temporaire de ${newState.member.user.username}`,
					type: ChannelType.GuildVoice,
					parent: category,
					reason: 'Salon temporaire',
					permissionOverwrites: [
						{
							id: newState.member.id,
							allow: [
								PermissionsBitField.Flags.MoveMembers,
								PermissionsBitField.Flags.MuteMembers,
								PermissionsBitField.Flags.DeafenMembers,
								PermissionsBitField.Flags.ViewChannel,
								PermissionsBitField.Flags.UseVAD,
								PermissionsBitField.Flags.Stream,
								PermissionsBitField.Flags.Connect,
								PermissionsBitField.Flags.Speak,
								PermissionsBitField.Flags.UseSoundboard,
								PermissionsBitField.Flags.SendVoiceMessages,
								PermissionsBitField.Flags.ManageChannels
							]
						},
						{
							id: newState.guild.id,
							allow: [
								PermissionsBitField.Flags.Connect,
								PermissionsBitField.Flags.Speak,
								PermissionsBitField.Flags.Stream,
								PermissionsBitField.Flags.UseVAD
							]
						}
					]
				}).then((createdChannel) => {
					db.run('INSERT INTO tempvoc_channels (channelId, guildId) VALUES (?, ?)', [createdChannel.id, guildId]);
					newState.member.voice.setChannel(createdChannel);
				});
			}

			if (!oldState.channel) return;

			db.get('SELECT * FROM tempvoc_channels WHERE channelId = ?', [oldState.channel.id], (err, tempChannelRow) => {
				if (err || !tempChannelRow) return;

				setTimeout(() => {
					const tempchannel = oldState.guild.channels.cache.get(oldState.channel.id);
					if (tempchannel && tempchannel.members.size === 0) {
						tempchannel.delete()
							.catch(err => {
								if (err.code === 10003) {
									return;
								} else {
									console.error(err);
								}
							});
						db.run('DELETE FROM tempvoc_channels WHERE channelId = ?', [oldState.channel.id]);
					}
				}, 1000);
			});


			db.get('SELECT channels FROM logs WHERE guild = ?', [guildId], async (err, row) => {
				if (err || !row) return;
				let channelsObj;
				try {
					channelsObj = JSON.parse(row.channels);
				} catch {
					return;
				}
				const channelId = channelsObj["📁・voice-logs"];
				if (!channelId) return;

				if (oldState.channelId !== newState.channelId) {
					if (oldState.channelId && !newState.channelId) {

						const embed = new EmbedBuilder()
							.setColor(config.color)
							.setDescription(`<@${oldState.member.id}> s'est déconnecté de <#${oldState.channelId}>`)
							.setTimestamp();
						sendLog(oldState.guild, embed, 'voicelog');
					} else if (!oldState.channelId && newState.channelId) {

						const embed = new EmbedBuilder()
							.setColor(config.color)
							.setDescription(`<@${newState.member.id}> s'est connecté à <#${newState.channelId}>`)
							.setTimestamp();
						sendLog(newState.guild, embed, 'voicelog');
					} else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {

						const embed = new EmbedBuilder()
							.setColor(config.color)
							.setDescription(`<@${newState.member.id}> a quitté <#${oldState.channelId}> pour aller vers <#${newState.channelId}>`)
							.setTimestamp();
						sendLog(newState.guild, embed, 'voicelog');
					}
				}

				if (oldState.mute !== newState.mute) {
					const action = newState.mute ? "s'est mute" : "s'est démute";
					const embed = new EmbedBuilder()
						.setColor(config.color)
						.setDescription(`<@${newState.member.id}> ${action} dans <#${newState.channelId || oldState.channelId}>`)
						.setTimestamp();
					sendLog(newState.guild, embed, 'voicelog');
				}

				if (oldState.deaf !== newState.deaf) {
					const action = newState.deaf ? "s'est mute casque" : "s'est démute casque";
					const embed = new EmbedBuilder()
						.setColor(config.color)
						.setDescription(`<@${newState.member.id}> ${action} dans <#${newState.channelId || oldState.channelId}>`)
						.setTimestamp();
					sendLog(newState.guild, embed, 'voicelog');
				}
			});
		})
	}
};