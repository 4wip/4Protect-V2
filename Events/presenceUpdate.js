import db from "./loadDatabase.js";

export default {
	name: 'presenceUpdate',
	async execute(oldPresence, newPresence) {
		if (!newPresence || !newPresence.guild || !newPresence.member) return;

		db.get('SELECT id, texte FROM soutien WHERE guild = ?', [newPresence.guild.id], async (err, row) => {
			if (err || !row) return;
			const { id: role_id, texte } = row;
			const member = newPresence.member;
			const hasStatus = newPresence.activities?.some(a =>
				a.type === 4 && a.state && a.state.toLowerCase().includes(texte.toLowerCase())
			);

			const role = newPresence.guild.roles.cache.get(role_id);
			if (!role) return;

			if (hasStatus) {
				if (!member.roles.cache.has(role_id)) {
					await member.roles.add(role_id).catch(() => { });
				}
			} else {
				if (member.roles.cache.has(role_id)) {
					await member.roles.remove(role_id).catch(() => { });
				}
			}
		});
	}
};