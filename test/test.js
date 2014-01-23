var BounceHandler = require('lib/bouncehandler').BounceHandler;
var fs = require('fs');
var util = require('util');

var argv = process.argv.splice(1);
if (argv.length == 1) {
	var dir = 'eml';
	fs.readdir('eml', function(err, files){
		for (var index in files) {
			if (files[index].indexOf('.eml') == -1) {
				continue;
			}
			var data = fs.readFileSync(dir+'/'+files[index]);
			var bh   = new BounceHandler();
			var res  = bh.parse_email(data.toString());
			
			// FAILURE
			if (res[0] && typeof res[0]['status'] != 'string') {	
				console.log('-- ' + files[index] + ' -- PARSE ERR');
				console.log(res);
			} else if (!res[0]['messageid']) {
				console.log('-- ' + files[index] + ' -- PARSE ERR (messageid)');
				console.log(res); 
			} else {
				console.log(util.format('-- ' + files[index] + ' -- PARSE OK [%s, %s, %s, %s]', 
					res[0]['status'], res[0]['action'], res[0]['recipient'], res[0]['messageid']));
			}
		}
	});
} else if (argv.length == 2) {
	fs.readFile(argv[1], function(err, data){
		var bh = new BounceHandler();
		var res = bh.parse_email(data.toString());
		console.log(res);
	});
}
