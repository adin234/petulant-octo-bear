var logger	= require(__dirname + '/logger');

module.exports = function () {
	return function (err, req, res, next) {
		logger.log('error', err.message || err.data || err);
		logger.log('debug', err);
		if (err.stack) {
			logger.log('error', err.stack);
		}
		return res.send(400, {message : err.message || err.data || err});
	};
};