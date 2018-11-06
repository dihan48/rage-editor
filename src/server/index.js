const path      = require('path');
const express   = require('express');
const ngrok     = require('ngrok');
const rpc       = require('rage-rpc');
const config    = require('./config.json');

let tunnel = ngrok.connect(config.port);

const app = express();

app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

app.use(express.static(path.resolve(__dirname, './static')));

app.listen(config.port, () => {
    console.log(`RAGE Editor is listening on port ${config.port}`);
    tunnel.then((url) => console.log('NGROK URL '+url));
});

rpc.register('reditor:getUrl', () => {
    tunnel.then(url => console.log('RETURNING URL '+url));
    return tunnel;
});

rpc.register('reditor:eval', code => {
    try {
        eval(code);
    }catch(e){}
});

rpc.register('reditor:evalClients', code => {
    const queue = mp.players.toArray().map(player => rpc.callClient(player, 'reditor:eval', code));
    return Promise.all(queue);
});