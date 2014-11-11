var cluster = require("cluster");

if (cluster.isMaster) {
	if (!process.argv[2]) {
		console.log('Script to cluster is missing');
	}

	console.log(new Date);
    var numCPUs = require("os").cpus().length;
    while (numCPUs--) {
        cluster.fork();
    }
}
else {
	require(__dirname + '/' + process.argv[2]);
}

cluster.on('exit', function (worker) {
	console.log(new Date);
	console.log('Someone died T_T');
});

