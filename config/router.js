var loc			= __dirname + '/../controllers/',
	index 		= require(loc + 'index'),
	user 		= require(loc + 'user'),
	games 		= require(loc + 'games'),
	login 		= require(loc + 'login'),
	news 		= require(loc + 'news'),
	shows 		= require(loc + 'shows'),
	youtubers 	= require(loc + 'youtubers'),
	streamers	= require(loc + 'streamers');

module.exports	= function (router, logger) {

	router.del 	= router.delete;

	router.all('*', function (req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		logger.log('debug', '--REQUEST BODY--', req.body);
		logger.log('debug', '--REQUEST QUERY--', req.query);
		process.cache = process.cache || {};
		if(req.query.bust === 1) {
			process.cache = {};
		}
		console.log(process.cache);
		next();
	});

	router.get('/authenticate', login.authenticate);
	router.post('/login', login.login);
	router.get('/lan_party', youtubers.get_lan_party);
	router.get('/get_views/:twitch', streamers.get_views);
	router.get('/index', index.get_index);
	router.get('/flush', index.flush_cache);
	router.get('/scrape/:twitch', index.get_scrape);
	router.get('/user/:id', user.get_user);
	router.get('/streamers', streamers.get_streamers);
	router.get('/streamers/youtube', streamers.get_youtube_streamers);
	router.get('/streamersdata', streamers.get_streamers_data);
	router.get('/streaming/:twitch/:youtube', streamers.get_is_streaming);
	router.get('/youtubers', youtubers.get_data);
	router.get('/youtubers/video', youtubers.get_youtubers);
	router.get('/youtubers/videos/:id/comment', youtubers.get_comments);
	router.post('/youtubers/videos/:id/comment', youtubers.post_comment);
	router.get('/youtubers/search', youtubers.search);
	router.get('/game/:gameid', games.get_game_data);
	router.get('/gamesdata', games.get_games_data);
	router.get('/games', games.get_games);
	router.get('/games/:gameid/videos', games.get_game_videos);
	router.get('/games/:gameid/playlists', games.get_game_playlists);
	router.get('/news', news.get_news);
	router.get('/shows', shows.get_shows);
	router.get('/cache', youtubers.cache_videos);
	router.get('/user/personal/:id', user.get_youtuber_profile);
	router.get('/loaderio-37804bf004f92d92a8319891ded25d31.html', function(req, res, next){  
		res.send('loaderio-37804bf004f92d92a8319891ded25d31'); 
	});
	router.get('/loaderio-37804bf004f92d92a8319891ded25d31.txt', function(req,res,next){ 
		res.send('loaderio-37804bf004f92d92a8319891ded25d31'); 
	});
	router.get('/vid_suggestions', youtubers.get_suggestions);
	router.post('/batch/update', youtubers.update_videos);
	router.all('*', function (req, res) {
		res.status(404)
			.send({message : 'Nothing to do here.'});
	});

	return router;
};

