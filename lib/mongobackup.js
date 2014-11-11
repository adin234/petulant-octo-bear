var mongo = require('mongoskin'),
	config = require(__dirname + '/../config/config').mongobackup,
	db = mongo.db([
		'mongodb://',
		config.host,
		':',
		config.port,
		'/',
		config.name
	].join(''), {
		native_parser : true
	});

db.toId = mongo.helper.toObjectID;

module.exports = db;