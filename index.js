const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

var app = express();

app.set('trust proxy', 'loopback');
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

function getASDataFromPeeringDBData(data, asn) {
	var _data = {};

	//console.log(data);

	for (var i = 0; i < data.length; i++) {
		if (data[i].asn === parseInt(asn)) {
			_data = data[i];
		}
	}

	return _data;
}

function fetchPeeringDBData(asn1, asn2, cb) {
	axios.get(`https://www.peeringdb.com/api/net?asn__in=${asn1},${asn2}&depth=2`).then(function(resp) {
		var asnData = resp.data.data;

		if (asnData.length !== 2) {
			return cb('tw-err:pdb-no-asn', null);
		}

		if (!(asnData[0].netixlan_set.length !== 0 && asnData[1].netixlan_set.length !== 0)) {
			return cb('tw-err:pdb-no-ix', null);
		}

		var asn1Data = getASDataFromPeeringDBData(asnData, asn1);
		var asn2Data = getASDataFromPeeringDBData(asnData, asn2);

		var asn1IX = {};

		for (var i = 0; i < asn1Data.netixlan_set.length; i++) {
			asn1IX[asn1Data.netixlan_set[i].ix_id] = asn1Data.netixlan_set[i];
		}

		var asn2IX = {};

		for (var j = 0; j < asn2Data.netixlan_set.length; j++) {
			asn2IX[asn2Data.netixlan_set[j].ix_id] = asn2Data.netixlan_set[j];
		}

		var mutualIX = {};

		for (var id in asn1IX) {
			if (Object.prototype.hasOwnProperty.call(asn2IX, id)) {
				mutualIX[id] = asn2IX[id];
			}
		}

		cb(null, mutualIX);
	}).catch(function(err) {
		return cb(err, null);
	});
}

app.get('/', function(req, res) {
	res.render('index');
});

app.post('/', function(req, res) {
	if (!(req.body.asn1 && req.body.asn2)) {
		return res.redirect('/?error=required');
	}

	if (!(req.body.asn1.match(/^[0-9]+$/) && req.body.asn2.match(/^[0-9]+$/))) {
		return res.redirect('/?error=numeric');
	}

	if (parseInt(req.body.asn1) >= 64496 && parseInt(req.body.asn1) <= 131071) {
		return res.redirect('/?error=private');
	}

	if (parseInt(req.body.asn1) >= 4200000000) {
		return res.redirect('/?error=private');
	}

	if (parseInt(req.body.asn2) >= 64496 && parseInt(req.body.asn2) <= 131071) {
		return res.redirect('/?error=private');
	}

	if (parseInt(req.body.asn2) >= 4200000000) {
		return res.redirect('/?error=private');
	}

	if (req.body.asn1 === req.body.asn2) {
		return res.redirect('/?error=same');
	}

	fetchPeeringDBData(req.body.asn1, req.body.asn2, function(err, data) {
		if (err) {
			if (typeof err === 'string' && err.includes('tw-err:')) {
				return res.redirect(`/?error=${err}`);
			} else {
				console.error(err);
				return res.redirect('/?error');
			}
		}

		res.render('mutual', { asn1: req.body.asn1, asn2: req.body.asn2, mutualIX: data });
	});
});

app.listen('8606', function() {
	console.log('Listening on port 8606');
});