const anticrashHandler = (bot) => {
	bot.on('error', (err) => { console.log('Une erreur non-capturée est survenue:', err); });

	process.on('uncaughtExceptionMonitor', (err, origin) => { console.log(err, origin); });

	process.on('rejectionHandled', (err) => { console.log(err); });

	process.on('warning', (warning) => { console.log(warning); });

	process.on('uncaughtException', (error) => { console.log('Une erreur non-capturée est survenue:', error); });

	process.on('unhandledRejection', (reason) => { console.log(reason); });

	process.on('processTicksAndRejections', (request, reason) => { console.log('Une erreur réseau non-capturée est survenue:', reason); });

	process.on('exit', (code) => { console.log(`Processus terminé avec le code ${code}`); });
};

export default anticrashHandler;