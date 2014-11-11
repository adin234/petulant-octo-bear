/**
	Utilities
*/

exports.hash = function (string, hash) {
    return crypto.createHash(hash || 'sha1').update('' + string).digest('hex');
};

exports.get_data = function (reqd, optional, body) {
    var i = reqd.length,
        ret = {},
        temp;

    while (i--) {
        if (!body[temp = reqd[i]] || body[temp] instanceof Array) {
            return temp + ' is missing';
        }
        ret[temp] = body[temp];
    }

	i = optional.length;

    while (i--) {
        if (body[temp = optional[i]]) {
            ret[temp] = body[temp];
        }
    }

    return ret;
};

exports.random_string = function (i) {
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
		str = '',
		l = i || 32;

    while (l--) {
        str += possible.charAt(~~(Math.random() * 62));
    }

    return str;
};

exports.unique_short_string = function (n) {
    return (+new Date * Math.random()).toString(36).replace('.', '').substring(0, n);
};

exports.pad = function (num, size) {
    return ('000000000' + num).substr(-(size || 2));
};

exports.extract_files = function (files, name, next) {
    if (files[name]) {
        return (files[name] instanceof Array) ? files[name] : [files[name]];
    }

    if (next) {
        next(name + ' is missing');
		return false;
	}

    return [];
};

exports.to_title_case = function (str) {
	if (str) {
        return str.replace(/\w\S*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

	return false;
};

exports.current_date = function () {
	var d = new Date();
	return [d.getFullYear(), this.pad(d.getMonth() + 1), this.pad(d.getDate())].join('-');
};

exports.cleanString = function (s) {
	return s.match(/\S{1,30}/g).join(' ');
};

exports.stringify = function (obj) {
    var ret = [],
        key;
    for (key in obj) {
        if (obj[key] === null) {
            ret.push(encodeURIComponent(key));
        }
        else {
            ret.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
        }
    }
    return ret.join('&');

};

exports.get_user_from_url = function (url) {
    var tokens = url.split('/');
    tokens = tokens.filter(function(e) { return e!=undefined });
    return tokens[tokens.length-1];
};

exports.diffArray = function (a, b) {
  var seen = [], diff = [];
  for ( var i = 0; i < b.length; i++)
      seen[b[i]] = true;
  for ( var i = 0; i < a.length; i++)
      if (!seen[a[i]])
          diff.push(a[i]);
  return diff;
};
