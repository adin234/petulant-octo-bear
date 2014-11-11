/**
	Curl.js

	@author	Raven Lagrimas
*/

var util	= require(__dirname + '/../helpers/util'),
	logger	= require(__dirname + '/logger'),
    http	= require('http'),
    https	= require('https'),

	Request = function (method) {
		this.method		= method;
		this.secure 	= false;
		this.started 	= false;
		this._raw 		= false;
		this._json 		= false;
		this.headers 	= {};
		this.max_retry	= 3;
		this.retries	= 0;

		this.to = function (host, port, path) {
			this.host = host;
			this.port = port;
			this.path = path;
			return this;
		};

		this.set_max_retry = function (max) {
			this.max_retry = max;
			return this;
		};

		this.secured = function () {
			this.secure = true;
			return this;
		};

		this.add_header = function (key, value) {
			this.headers[key] = value;
			return this;
		};

		this.raw = function () {
			this._raw = true;
			return this;
		};

		this.json = function() {
			this._json = true;
			return this;
		};

		this.then = function (cb) {
			if (!this.cb) {
				this.cb = cb;
			}
			else {
				this.fcb = cb;
			}

			!this.started && this.send();
			return this;
		};

		this.retry = function () {
			this.retries++;
			if (this.retries > this.max_retry) {
				logger.log('error', 'Reached max retries');
				this.cb({
						message : 'Reached max retries',
						url : this.host + ':' + this.port + this.path
					},
					null,
					this,
					this.additional_arguments
				);
				return this;
			}
			logger.log('warn', 'Retrying request');
			return this.send(this.data);
		};

		this.finally = function (cb) {
			this.fcb = cb;
			return this;
		};

		this.send = function (data) {
			var self = this,
				protocol,
				payload,
				req;

			this.started = true;

			if (this.method === 'GET') {
				this.path += (~this.path.indexOf('?') ? '&':'?') + util.stringify(data);
			}
			else if(this._json) {
				payload = JSON.stringify(data);
				this.headers['Content-Type'] = 'application/json';
			}
			else {
				payload = util.stringify(data);
				this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
				this.headers['Content-Length'] = payload.length;
			}

			if (!this._raw) {
				this.headers['Accept'] = 'application/json';
			}

			logger.log('verbose', this.method, this.host, ':', this.port, this.path);

			if (payload) {
				logger.log('verbose', 'data\n' + payload);
			}

			protocol = this.secure ? https : http;

			try {
				req = protocol.request({
					host: this.host,
					port: this.port,
					path: this.path,
					method: this.method,
					headers: this.headers
				}, function (response) {
					var s = '';

					response.setEncoding('utf8');

					response.on('data', function (chunk) {
						s += chunk;
					});

					response.on('end', function () {

						self.response_headers = response.headers;

						if (self._raw) {
							if (response.statusCode === 200) {
								logger.log('debug', 'Response', response.statusCode);
								logger.log('silly', s);
								self.cb(null, s, self, self.additional_arguments);
							}
							else {
								s = {
									response : s,
									statusCode : response.statusCode
								};
								self.cb(s, null, self, self.additional_arguments);
							}
						}
						else {
							logger.log('verbose', 'Response', response.statusCode);
							logger.log('silly', s);

							if (this.before_json) {
								s = this.before_json(s);
							}

							if(this._json) {
								try {
									JSON.parse(s);
								}
								catch (e) {
									logger.log('error', 'JSON is invalid');
									logger.log('error', s);
									e.statusCode = response.statusCode;
									return self.cb(e, s, self, self.additional_arguments);
								}
							}

							if (response.statusCode === 200) {
								self.cb(null, (this._json ? JSON.parse(s) : s), self, self.additional_arguments);
							}
							else {
								if(this._json) {
									s = JSON.parse(s);
									s.statusCode = response.statusCode;
								}

								self.cb(s, null, self, self.additional_arguments);
							}
						}
					});
				});

				req.on('error', function (err) {
					var retryable_errors = [
							'ECONNREFUSED',
							'ENOTFOUND',
							'ECONNRESET',
							'EADDRINFO',
							'EMFILE'
						];

					logger.log('error', 'Request error', err, self.host + ':' + self.port + self.path);

    				if (self.retries < self.max_retry) {
						return self.retry();
					}
                    
                    err.message = 'OMG. Server on ' + self.host + ':' + self.port + ' seems dead';

					self.cb(err, null, self, self.additional_arguments);
				});

				if (this.method !== 'GET') {
					req.write(payload);
				}

				req.end();
			} catch (e) {
				console.dir(e);
				self.retry();
			}
			return this;
		};
	};

module.exports = {
	get : {
		to : function (host, port, path) {
			return new Request('GET').to(host, port, path);
		}
	},
	post : {
		to : function (host, port, path) {
			return new Request('POST').to(host, port, path);
		}
	},
	put : {
		to : function (host, port, path) {
			return new Request('PUT').to(host, port, path);
		}
	},
	delete : {
		to : function (host, port, path) {
			return new Request('DELETE').to(host, port, path);
		}
	},
	request : function (method) {
		this.to = function (host, port, path) {
			return new Request(method).to(host, port, path);
		};
		return this;
	}
};