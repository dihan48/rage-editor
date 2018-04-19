const path      = require('path');
const express   = require('express');
const ngrok     = require('ngrok');
const config    = require('./config.json');

let tunnel = ngrok.connect(config.port);

const app = express();

app.use(express.static(path.resolve(__dirname, './static')));

app.listen(config.port, () => {
    console.log(`RAGE:MP Debugger is listening on port ${config.port}`);
    tunnel.then((url) => console.log('NGROK URL '+url));
});

mp.events.add('reditor:requestInit', (player) => {
    tunnel.then((url) => player.call('reditor:init', [url]));
});

mp.events.add('reditor:runServer', (player, code) => {
    try {
        eval(code);
    }catch(e){}
    player.call('reditor:runServerRes');
});

mp.events.add('reditor:runClients', (player, code) => {
    mp.players.forEach((player) => {
        player.call('reditor:runClientsEval', [code]);
    });
    player.call('reditor:runClientsRes');
});