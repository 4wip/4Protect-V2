import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import db from '../Events/loadDatabase.js';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(readFileSync(path.join(__dirname, '../config.json'), 'utf-8'));

const app = express();
const PORT = 5000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'votre-secret-de-session',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

const scopes = ['identify', 'guilds'];
const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
const redirectUri = process.env.REDIRECT_URI || (replitDomain ? `https://${replitDomain}/callback` : 'http://localhost:5000/callback');

passport.use(new DiscordStrategy({
    clientID: config.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID,
    clientSecret: config.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET,
    callbackURL: redirectUri,
    scope: scopes
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

app.get('/', (req, res) => {
    res.render('index', { user: req.user });
});

app.get('/login', passport.authenticate('discord'));

app.get('/callback', 
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

app.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.render('dashboard', { 
        user: req.user,
        guilds: req.user.guilds || []
    });
});

app.get('/dashboard/:guildId', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    const guild = req.user.guilds?.find(g => g.id === guildId);
    
    if (!guild) {
        return res.redirect('/dashboard');
    }

    const guildData = await new Promise((resolve) => {
        db.get('SELECT * FROM logs WHERE guild = ?', [guildId], (err, row) => {
            if (err || !row) {
                resolve({ channels: '{}' });
            } else {
                resolve(row);
            }
        });
    });

    let logsChannels = {};
    try {
        logsChannels = JSON.parse(guildData.channels || '{}');
    } catch (e) {
        logsChannels = {};
    }

    res.render('guild', {
        user: req.user,
        guild: guild,
        logsChannels: logsChannels
    });
});

app.post('/api/guild/:guildId/logs', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    const { logType, channelId } = req.body;

    const guild = req.user.guilds?.find(g => g.id === guildId);
    if (!guild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const guildData = await new Promise((resolve) => {
        db.get('SELECT * FROM logs WHERE guild = ?', [guildId], (err, row) => {
            resolve(row || { channels: '{}' });
        });
    });

    let logsChannels = {};
    try {
        logsChannels = JSON.parse(guildData.channels || '{}');
    } catch (e) {
        logsChannels = {};
    }

    if (channelId === null || channelId === '') {
        delete logsChannels[logType];
    } else {
        logsChannels[logType] = channelId;
    }

    db.run(
        'INSERT OR REPLACE INTO logs (guild, channels) VALUES (?, ?)',
        [guildId, JSON.stringify(logsChannels)],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        }
    );
});

app.get('/api/guild/:guildId/channels', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    
    const userGuild = req.user.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const bot = app.locals.bot;
        if (!bot) {
            return res.json([]);
        }

        const guild = bot.guilds.cache.get(guildId);
        
        if (!guild) {
            return res.json([]);
        }

        const channels = guild.channels.cache
            .filter(channel => channel.type === 0)
            .map(channel => ({
                id: channel.id,
                name: channel.name
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json(channels);
    } catch (error) {
        console.error('Erreur lors de la récupération des salons:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/guild/:guildId/antiraid', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    
    const userGuild = req.user.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM antiraid WHERE guild = ?', [guildId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const config = {
            antilink: row?.antilink === 1 || false,
            antispam: row?.antispam === 1 || false,
            antibot: row?.antibot === 1 || false,
            antiwebhook: row?.antiwebhook === 1 || false,
            antichannel: row?.antichannel === 1 || false,
            antiban: row?.antiban === 1 || false,
            antirole: row?.antirole === 1 || false,
            antiupdate: row?.antiupdate === 1 || false,
            antieveryone: row?.antieveryone === 1 || false,
            antivanity: row?.antivanity === 1 || false
        };

        res.json(config);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'anti-raid:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/guild/:guildId/antiraid', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    const antiraidConfig = req.body;
    
    const userGuild = req.user.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const columns = [
            'antilink', 'antispam', 'antibot', 'antiwebhook', 
            'antichannel', 'antiban', 'antirole', 'antiupdate',
            'antieveryone', 'antivanity'
        ];

        const values = columns.map(col => antiraidConfig[col] ? 1 : 0);
        const placeholders = columns.map(() => '?').join(', ');
        const columnList = columns.join(', ');
        const updateList = columns.map(col => `${col} = ?`).join(', ');

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO antiraid (guild, ${columnList}) VALUES (?, ${placeholders})
                 ON CONFLICT(guild) DO UPDATE SET ${updateList}`,
                [guildId, ...values, ...values],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'anti-raid:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/guild/:guildId/voice-channels', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    
    const userGuild = req.user.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const bot = app.locals.bot;
        
        if (!bot) {
            return res.json([]);
        }

        const guild = bot.guilds.cache.get(guildId);
        
        if (!guild) {
            return res.json([]);
        }

        const channels = guild.channels.cache
            .filter(channel => channel.type === 2)
            .map(channel => ({
                id: channel.id,
                name: channel.name
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json(channels);
    } catch (error) {
        console.error('Erreur lors de la récupération des salons vocaux:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/guild/:guildId/tempvoc', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    
    const userGuild = req.user.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const channelId = await new Promise((resolve) => {
            db.get('SELECT channel FROM tempvoc WHERE guildId = ?', [guildId], (err, row) => {
                if (err || !row) {
                    resolve(null);
                } else {
                    resolve(row.channel);
                }
            });
        });

        res.json({ channelId: channelId || null });
    } catch (error) {
        console.error('Erreur lors de la récupération de tempvoc:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/guild/:guildId/tempvoc', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    const { channelId } = req.body;
    
    const userGuild = req.user.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        if (!channelId) {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM tempvoc WHERE guildId = ?', [guildId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT OR REPLACE INTO tempvoc (guildId, channel) VALUES (?, ?)',
                    [guildId, channelId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de tempvoc:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/guild/:guildId/transcripts', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    
    const userGuild = req.user.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const transcripts = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM transcripts WHERE guild_id = ? ORDER BY created_at DESC',
                [guildId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json(transcripts);
    } catch (error) {
        console.error('Erreur lors de la récupération des transcripts:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/guild/:guildId/send-ticket', ensureAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    const { title, description, color, channelId, options } = req.body;

    const userGuild = req.user.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ error: 'Au moins une option est requise' });
    }

    if (options.length > 25) {
        return res.status(400).json({ error: 'Maximum 25 options autorisées' });
    }

    try {
        const bot = app.locals.bot;
        if (!bot) {
            return res.status(503).json({ error: 'Bot non disponible' });
        }

        const guild = bot.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Serveur non trouvé' });
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Salon non trouvé' });
        }

        const { 
            ContainerBuilder, 
            TextDisplayBuilder, 
            SeparatorBuilder,
            SeparatorSpacingSize,
            ActionRowBuilder, 
            StringSelectMenuBuilder,
            MessageFlags 
        } = await import('discord.js');
        
        const container = new ContainerBuilder();
        
        if (color) {
            container.setAccentColor(parseInt(color.replace('#', ''), 16));
        }
        
        if (title) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${title}`)
            );
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
                    .setDivider(true)
            );
        }
        
        if (description) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(description)
            );
            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );
        }

        const selectOptions = options.map((label, index) => ({
            label: label.substring(0, 100),
            value: `option${index + 1}`
        }));

        const ticketSelect = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Choisissez une option')
            .addOptions(selectOptions);

        const row = new ActionRowBuilder().addComponents(ticketSelect);

        await channel.send({ 
            components: [container, row],
            flags: MessageFlags.IsComponentsV2
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du ticket:', error);
        res.status(500).json({ error: 'Erreur lors de l\'envoi du ticket' });
    }
});

app.get('/transcript/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const transcript = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM transcripts WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!transcript) {
            return res.status(404).send('Transcript non trouvé');
        }

        const userGuild = req.user.guilds?.find(g => g.id === transcript.guild_id);
        if (!userGuild) {
            return res.status(403).send('Vous n\'avez pas accès à ce transcript');
        }

        res.render('transcript', { transcript });
    } catch (error) {
        console.error('Erreur lors de la récupération du transcript:', error);
        res.status(500).send('Erreur serveur');
    }
});

export function startDashboard(bot) {
    app.locals.bot = bot;
    
    app.listen(PORT, '0.0.0.0', () => {
    });
}

export function logDashboardReady() {
    console.log(`[DASHBOARD] Dashboard démarré sur http://0.0.0.0:${PORT}`);
}

export default app;
