var express = require('express');
var router = express.Router();
const rword = require('rword').rword;

/* GET home page. */
router.get('/', function(req, res, next) {
  const query = require('url').parse(req.url).query;
  res.redirect('/' + rword.generate(3, { capitalize: 'first' }).join('') + (query ? '?' + query : ''));
});

router.get('/:roomname', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
