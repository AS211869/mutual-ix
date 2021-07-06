const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

var app = express();

app.set('trust proxy', 'loopback');
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

function fetchPeeringDBData(asn1, asn2, cb) {
	axios.get(`https://www.peeringdb.com/api/net?asn__in=${asn1}&depth=2`).then(function(resp1) {
		var asn1Data = resp1.data.data;

		if (asn1Data.length === 0) {
			return cb('tw-err:pdb-no-asn', null);
		}

		if (asn1Data[0].netixlan_set.length === 0) {
			return cb('tw-err:pdb-no-asn', null);
		}

		var asn1IX = {};

		for (var i = 0; i < asn1Data[0].netixlan_set.length; i++) {
			asn1IX[asn1Data[0].netixlan_set[i].ix_id] = asn1Data[0].netixlan_set[i].name;
		}

		axios.get(`https://www.peeringdb.com/api/net?asn__in=${asn2}&depth=2`).then(function(resp2) {
			var asn2Data = resp2.data.data;

			if (asn2Data.length === 0) {
				return cb('tw-err:pdb-no-asn', null);
			}

			if (asn2Data[0].netixlan_set.length === 0) {
				return cb('tw-err:pdb-no-ix', null);
			}

			var asn2IX = {};

			for (var i = 0; i < asn2Data[0].netixlan_set.length; i++) {
				asn2IX[asn2Data[0].netixlan_set[i].ix_id] = asn2Data[0].netixlan_set[i].name;
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

	if (req.body.asn1 === req.body.asn2) {
		return res.redirect('/?error=same');
	}

	fetchPeeringDBData(req.body.asn1, req.body.asn2, function(err, data) {
		if (err) {
			if (err.includes('tw-err:')) {
				return res.redirect(`/?error=${err}`);
			} else {
				return res.redirect('/?error');
			}
		}

		res.render('mutual', { asn1: req.body.asn1, asn2: req.body.asn2, mutualIX: data });
	});
});

app.listen('8606', function() {
	console.log('Listening on port 8606');
});