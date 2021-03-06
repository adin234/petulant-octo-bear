var config = require(__dirname + '/config/config'),
    logger = require(__dirname + '/lib/logger'),
    util = require(__dirname + '/helpers/util'),
    mysql = require(__dirname + '/lib/mysql'),
    mongo = require(__dirname + '/lib/mongoskin'),
    mongob = require(__dirname + '/lib/mongobackup'),
    us = require(__dirname + '/lib/unserialize'),
    curl = require('cuddle');

var exports = {};
var totalTransIntran = 0;

exports.nextD = function (err, result) {
    console.log(err);
};

exports.get_access = function (user, next) {
    curl.post
        .to(
            'accounts.google.com',
            443,
            '/o/oauth2/token'
        )
        .secured()
        .send({
            client_id: config.api.client_id,
            client_secret: config.api.client_secret,
            refresh_token: user.refresh_token,
            grant_type: 'refresh_token'
        })
        .then(next);
};

exports.update_video = function (params, auth, next) {
    curl.put
        .to(
            'www.googleapis.com',
            443,
            '/youtube/v3/videos?part=snippet,status'
        )
        .add_header('Authorization', auth)
        .secured()
        .send(params)
        .then(next);
};

exports.get_user_credentials = function (channel, next) {
    var source = typeof mysqlG != 'undefined' ? mysqlG : mysql.open(config.mysql);
    source
        .query(
            'SELECT token.user_id, token.field_value as refresh_token, \
            channel.field_value as channel, user.username \
            FROM xf_user_field_value token \
            INNER JOIN xf_user_field_value channel \
            ON token.user_id = channel.user_id \
            INNER JOIN xf_user user \
            ON user.user_id = token.user_id \
            WHERE token.field_id = "refresh_token" \
            AND channel.field_id = "youtube_id" \
            AND user.secondary_group_ids LIKE "%6%" \
            AND channel.field_value = ?', [
                channel
            ],
            next);
};

exports.get_playlist_videos = function (user, next) {
    var params = {
        order: 'data',
        playlistId: user.playlist_id,
        part: 'snippet',
        key: config.youtube_key,
        maxResults: 50
    };

    if (user.videos && user.videos.nextPageToken) {
        params.pageToken = user.videos.nextPageToken;
    }

    curl.get
        .to(
            'www.googleapis.com',
            443,
            '/youtube/v3/playlistItems'
        )
        .secured()
        .send(params)
        .then(next);
};

exports.get_user_videos = function (user, next) {
    mongob.collection('videos')
        .remove({
            'snippet.channelId': user.channel_id
        }, function (err, result) {
            console.log(user);
            var playlist = user.playlist || 'UU' + user.channel_id.substring(2);
            user['playlist_id'] = playlist;


            (function (user) {
                exports.get_playlist_videos(user, function (err, result, request) {
                    if (err) {
                        if (request.retries >= request.max_retry) {
                            console.log('this request had error', request.path);
                            return next(err);
                        }

                        return request.retry();
                    }


                    if (!user.videos) {
                        user.videos = result;
                    }
                    else {
                        user.videos.nextPageToken = result.nextPageToken;
                        user.videos.items = user.videos.items.concat(result.items);
                    }

                    if (user.videos.nextPageToken) {
                        exports.get_user_videos(user, next);
                    }
                    else {
                        if (!user) {
                            console.log('no user')
                        }

                        next(err, user);
                    }
                });
            })(user);
        });
};

exports.get_video_details = function (user, video, next) {
    var params = {
        part: 'snippet,statistics',
        id: video.snippet.resourceId.videoId,
        fields: 'items(snippet(channelId,tags), statistics)',
        key: config.youtube_key
    };

    if (user.access_token.trim()
        .length) {
        params['access_token'] = user.access_token;
    }

    curl.get
        .to(
            'www.googleapis.com',
            443,
            '/youtube/v3/videos'
        )
        .secured()
        .send(params)
        .then(next);
};

exports.translate = function (string, next) {

    if (!exports.requested) {
        exports.requested = [];
    }

    exports.requested.push(string);

    if (!exports.responded) {
        exports.responded = [];
    }

    var params = {};

    curl.get
        .to(
            'translate.google.com',
            443,
            '/translate_a/single?' + 'client=t&sl=zh&tl=en&hl=en&dt=bd&dt=ex&dt=ld&dt=md&dt=qc&dt=rw&' +
            'dt=rm&dt=ss&dt=t&dt=at&dt=sw&ie=UTF-8&oe=UTF-8&prev=btn&srcrom=1&' + 'ssel=3&tsel=0&q=' +
            encodeURIComponent(string)
        )
        .raw()
        .secured()
        .send(params)
        .then(function (err, result) {
            if (!exports.responded) {
                exports.responded = [];
            }

            exports.responded.push(string);

            var x = JSON.parse(result.replace(/,,+/gi, ',')
                .replace(/\[,/gi, '\['));
            next(err, x[0][0][0]);
        });
};

exports.cache_videos = function (req, res, next, next_move) {
    var data = {
            totalTransIntran: 0,
            totalTrans: 0
        },
        start = function () {
            data.counter = 0;
            data.total = 0;

            if (!data.users) {
                return mysql
                    .open(config.mysql)
                    .query(
                        'SELECT token.user_id, token.field_value as refresh_token, \
                        channel.field_value as channel, user.username \
                        FROM xf_user_field_value token \
                        INNER JOIN xf_user_field_value channel \
                        ON token.user_id = channel.user_id \
                        INNER JOIN xf_user user \
                        ON user.user_id = token.user_id \
                        WHERE token.field_id = "refresh_token" \
                        AND channel.field_id = "youtube_id" \
                        AND user.secondary_group_ids LIKE "%6%" \
                        AND channel.field_value <> ""', [],
                        start_cache
                    )
                    .end();
            }

            start_cache(null, data.users);
        },
        start_cache = function (err, result) {
            if (err) {
                return next(err);
            }

            delete data.users;
            data.credentials = result;
            data.itemCount = {};
            data.inserted = {};

            result.forEach(function (item, i) {
                if (!data.users) {
                    data.users = {};
                }

                data.users[item.channel] = item;

                if (!item.refresh_token.trim()
                    .length) {
                    item.refresh_token = 'empty';
                }

                (function (item) {
                    exports.get_access(item, function (err, _result) {
                        if (err) {
                            _result = {};
                        }

                        _result.playlist = item.playlist;
                        _result.channel_id = item.channel;

                        exports.get_user_videos(_result, function (err, __result) {
                            if (err) {
                                return next(err);
                            }

                            __result.user_id = item.user_id;
                            __result.username = item.username;

                            data.counter++;
                            try {
                                __result.total_videos = __result && __result.videos ?
                                    __result.videos.items.length : 0;
                            }
                            catch (e) {
                                console.log('err', e, __result);
                            }

                            data.users[item.channel] = __result;

                            if (data.counter === data.credentials.length) {
                                get_snippet(null, data);
                            }
                        });
                    });
                })(item);
            });
        },
        get_snippet = function (err, result) {
            if (err) {
                return next(err);
            }

            data.interval = setInterval(function (i) {
                if (Object.keys(data.itemCount)
                    .length === Object.keys(result.users)
                    .length) {
                    for (var i in data.itemCount) {
                        if (!result.users[i].videos || data.itemCount[i] === result.users[i].videos.items.length) {
                            //console.log('got all for '+i+' here because no videos: '+!result.users.videos);
                            if (!data.inserted[i]) {
                                data.inserted[i] = true;
                                (function (index) {
                                    mongob.collection((data.collection || 'videos'))
                                        .insert(result.users[index].videos.items, function (err, result) {
                                            if (err) {
                                                return next(err);
                                            }

                                            console.log('will increment', data.total++);

                                            console.log('inserted for ' + index + ' the total = ' +
                                                data.total);

                                            if (data.total === Object.keys(data.itemCount)
                                                .length) {
                                                console.log('taken all');
                                                clearInterval(data.interval);
                                                return send_response(null, data.collection);
                                            }
                                        });
                                })(i);
                            }
                        }
                        else {
                            if (data.itemCount[i] > result.users[i].videos.items.length) {
                                console.log('too much data on ' + i + ' ' + data.itemCount[i] + '/' +
                                    result.users[i].videos.items.length)
                            }

                            if (data.itemCount[i] / result.users[i].videos.items.length >= .80) {
                                console.log('user ' + i + ' is at ' + data.itemCount[i] + '/' + result.users[
                                    i].videos.items.length);
                            }
                        }
                    }
                }
            }, 5000);

            for (var userIndex in result.users) {
                var user = result.users[userIndex];
                if (!(user && user.videos && user.videos.items && user.videos.items.length))
                    continue;

                data.itemCount[user.channel_id] = 0;
                user.videos.items.forEach(function (item, i) {
                    var total = user.videos.items.length;
                    var params = {
                        channel_id: user.channel_id || '',
                        refresh_token: user.refresh_token || '',
                        access_token: user.access_token || '',
                    };
                    (function (item, i) {
                        exports.get_video_details(
                            params,
                            item,
                            function (err, result, request) {
                                if (err) {
                                    console.log('got an error here');

                                    if (request.retries >= request.max_retries) {
                                        console.log('retries');
                                        return next(err);
                                    }

                                    console.log('wants to retry ' + item.snippet.resourceId.videoId +
                                        ' by ' + item.snippet.channelId + ' because ', err);
                                    return request.retry();
                                }

                                if (request.retries >= 1) {
                                    console.log('got from retry ' + item.snippet.resourceId.videoId +
                                        ' by ' + item.snippet.channelId, result);
                                }

                                ++data.totalTrans;

                                if (data.totalTrans >= 1500) {
                                    // process.stdout.cursorTo(3);
                                    // process.stdout.clearLine();
                                    // process.stdout.write("total transactions now "+(data.totalTrans)+'\033[3;0H');
                                }


                                if (request.retries >= 1) {
                                    console.log('will now request for translation from retry');

                                }

                                if (!item.snippet.meta) {
                                    item.snippet.meta = {};
                                }

                                item.user_id = data.users[item.snippet.channelId].user_id;
                                item.username = data.users[item.snippet.channelId].username;

                                if (result && result.items[0]) {
                                    item.snippet.meta = {
                                        tags: result.items[0].snippet.tags || [],
                                        statistics: result.items[0].statistics || [],
                                    };

                                    for (i in item.snippet.meta.statistics) {
                                        item.snippet.meta.statistics[i] = +item.snippet.meta.statistics[
                                            i] || 0;
                                    }
                                }
                                else {
                                    console.log('no items taken', result);
                                    item.snippet.meta = {
                                        tags: [],
                                        statistics: [],
                                    };
                                }

                                // exports.translate(item.snippet.title, function(err, result) {
                                //     if(err) {
                                //         return console.log('error here '+err);
                                //     }

                                data.itemCount[item.snippet.channelId] ++;
                                //});
                            }
                        );
                    })(item, i);
                })
            }
        },
        send_response = function (err, result) {
            if (err) {
                return next(err);
            }

            if (req.cb) {
                return cb(data);
            }

            exports.translate_job(null, result, next_move);
        };

    process.start_time = new Date();

    mongo.admin()
        .command({
            copydb: 1,
            fromdb: 'asiafreedom_youtubers',
            todb: 'asiafreedom_youtubers_backup'
        }, function (err, result) {
            if (err) {
                return console.log('err');
            }

            data.collection = req.collection || 'videos';
            mongob.dropCollection(data.collection, function (err, result) {
                data.users = req.users || null;
                start();
            });
        });
};

exports.translate_job = function (videosARG, collection, next) {
    var data = {},
        videos = videosARG,
        where = collection || 'videos';
    start = function () {
        console.log('starting the translate job ' + where);
        console.log('length', videos.length);
        videos.forEach(function (item) {
            console.log('translating');
            data.translate_request++;
            (function (item) {
                exports.translate(item.snippet.title, function (err, result) {
                    if (err) {
                        return console.log('error here ' + err);
                    }

                    data.translate_response++;

                    console.log(result + ' translate requests ' + data.translate_response +
                        '/' + data.translate_request);

                    item.engtitle = result;

                    (function (item) {
                        mongob.collection(where)
                            .update({
                                    _id: mongo.toId(item._id)
                                },
                                item,
                                function (err, result) {
                                    if (err) {
                                        return console.log('error in updating ' + item._id);
                                    }
                                }
                            );
                    })(item);

                    if (data.translate_response == videos.length) {
                        console.log('translated all ' + process.start_time + ' - ' + (new Date()));
                        exports.merge_tags(null, where, next);
                    }
                });
            })(item);
        });
    };

    data.translate_request = 0;
    data.translate_response = 0;

    if (!videos) {
        return mongob.collection(where)
            .find()
            .toArray(function (err, result) {
                if (err) {
                    return console.log('error ' + err);
                }

                console.log(where, 'to translate', result.length);
                videos = result;
                start();
            })
    }

    console.log('the start after if is called');

    return start();
}

exports.merge_tags = function (videos, where, next) {
    var data = {},
        counter1 = 0,
        counter2 = 0,
        counter3 = 0,
        mb,
        videos = videos,
        start = function () {
            console.log('videos ' + videos.length);
            videos.forEach(function (item) {
                console.log('loop at ' + (++counter3));

                var anytv_tags = item.snippet.meta.tags.filter(function (e) {
                    return ~e.indexOf('anytv');
                });

                if (anytv_tags.length) {
                    mongob.collection('videos')
                        .update({
                            'snippet.resourceId.videoId': item.snippet.resourceId.videoId
                        }, {
                            '$push': {
                                'snippet.meta.tags': {
                                    '$each': anytv_tags
                                }
                            }
                        }, function (err, result) {
                            counter1++;
                            if (err) {
                                return console.log(err);
                            }

                            console.log(item.snippet.resourceId.videoId + ' ' + counter3 +
                                'merge with tags ' + (counter2 + counter1) + '/' + videos.length +
                                ' ' + counter1 + '|' + counter2);

                            if ((counter1 + counter2) === videos.length) {
                                console.log('finished merging tags');
                                console.log('translated all ' + process.start_time + ' - ' + (new Date()));

                                exports.manage_db(where, next);
                            }
                        });
                }
                else {
                    counter2++;
                    console.log(item.snippet.resourceId.videoId + ' ' + counter3 + ' merge no tags ' + (
                            counter2 + counter1) + '/' + videos.length + ' ' + counter1 + '|' +
                        counter2);


                    if ((counter1 + counter2) === videos.length) {
                        console.log('finished merging tags');
                        console.log('translated all ' + process.start_time + ' - ' + (new Date()));

                        exports.manage_db(where, next);
                    }
                }
            });

            if (!videos.length) {
                exports.manage_db(where, next);
            }
        };

    if (!videos) {
        console.log('get_videos');
        return mongo.collection(where)
            .find()
            .toArray(function (err, result) {
                if (err) {
                    return console.log('error ' + err);
                }

                videos = result;
                start();
            })
    }

    return start();
};

exports.get_news = function (next) {
    var data = {},
        start = function () {
            mysql
                .open(config.mysql)
                .query('SELECT option_id, option_value from xf_option WHERE option_id ' +
                    'in ("NewsChannel", "RefreshToken", "ShowsChannel", ' +
                    '"ShowsRefreshToken", "NewsPlaylist", "ShowsPlaylist")', [],
                    format_data
                )
                .end();
        },
        format_data = function (err, result) {
            if (err) {
                return console.log(err);
                process.exit();
            }

            inputs = {};

            result.forEach(function (data) {
                inputs[new Buffer(data.option_id, 'binary')
                        .toString()] =
                    new Buffer(data.option_value, 'binary')
                    .toString();
            });

            var users = [];

            users.push({
                user_id: 1,
                refresh_token: inputs.RefreshToken,
                channel: inputs.NewsChannel,
                playlist: inputs.NewsPlaylist,
                username: 'News'
            });

            //cache news
            exports.cache_videos({
                    users: users,
                    collection: 'news'
                }, {},
                exports.nextD,
                function (err, result) {
                    var users = [{
                        user_id: 1,
                        refresh_token: inputs.ShowsRefreshToken,
                        channel: inputs.ShowsChannel,
                        playlist: inputs.ShowsPlaylist,
                        username: 'Shows'
                    }];

                    //cache shows
                    exports.cache_videos({
                            users: users,
                            collection: 'shows'
                        }, {},
                        exports.nextD,
                        function (err, result) {
                            //cache lanparty
                            exports.cache_videos({
                                    users: users,
                                    collection: 'lan_party_videos'
                                }, {},
                                exports.nextD,
                                function (err, result) {
                                    console.log('finished all')
                                    process.exit();
                                }
                            );
                        }
                    );
                }
            );
        };
    start();
};

exports.manage_db = function (where, next) {
    var data = {},
        start = function () {
            console.log('dropping', where);
            mongo.dropCollection(where, function (err, result) {
                if (err) {
                    console.log('error dropping collection videos in manage_db', err);
                }

                mongob.collection(where)
                    .find()
                    .toArray(function (err, result) {
                        if (err) {
                            console.log('cant find the videos in manage_db', err);
                        }

                        console.log('managed ', where)
                        mongo.collection(where)
                            .insert(result, function (err, result) {
                                mongo.collection(where)
                                    .ensureIndex({
                                            engtitle: "text"
                                        },
                                        function (err, result) {
                                            next();
                                        }
                                    );
                            });
                    })
            });
        };

    start();
};

exports.cache_videos({}, {},
    exports.nextD,
    function (err, result) {
        exports.get_news();
    }
);

