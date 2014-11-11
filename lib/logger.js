var winston = require('winston'),
	logger;

/*
silly
	all object data
debug
	http requests
verbose
	per function logs
info
	start and end of api calls
warn
	medyo error
error
	error talaga. promise
*/

winston.cli();

switch (process.env['NODE_ENV']) {
	case 'testing' :
		logger = new (winston.Logger)();
		break;

	case 'development' :
		logger = new (winston.Logger)({
			transports: [
				new (winston.transports.Console)({
					level : 'debug',
					colorize : true
				})
			]
		});
		break;

	case 'staging' :
		logger = new (winston.Logger)({
			transports: [
				new (winston.transports.Console)({
					level : 'verbose',
					colorize : true
				})
			]
		});
		break;

	case 'production' :
		logger = new (winston.Logger)({
			transports: [
				new (winston.transports.Console)({
					level : 'info',
					colorize : true
				})
			]
		});
		break;

	default :
		logger = new (winston.Logger)({
			transports: [
				new (winston.transports.Console)({
					level : 'warn',
					colorize : true
				})
			]
		});
}

logger.cli();

module.exports = logger;