const fs        = require('fs');
const path      = require('path');
const http      = require('http');
const ngrok     = require('ngrok');
const rpc       = require('rage-rpc');
const config    = require('./config.json');
const util      = require('./util.js');

const url = config.useNgrok ? ngrok.connect(config.port) : util.getIpAddress().then(ip => `http://${ip}:${config.port}`);

http.createServer((req, res) => {
    let filePath = req.url.substr(1);
    if(!filePath) filePath = 'index.html';

    const extName = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.png': 'image/png',
        '.ts': 'text/plain'
    };

    res.writeHead(200, {
        'Content-Type': mimeTypes[extName],
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With'
    });

    fs.createReadStream(path.resolve(__dirname, 'static', filePath)).pipe(res);
}).listen(config.port);

console.log(`RAGE Editor is listening on port ${config.port}`);

if(!__rpcListeners['reditor:canPlayerUse']){
    rpc.register('reditor:canPlayerUse', (_, { player }) => {
        return (!Array.isArray(config.whitelistIPs) || !config.whitelistIPs.length || config.whitelistIPs.includes(player.ip));
    });
}
rpc.register('reditor:getInfo', (_, { player }) => url.then(url => {
    return {
        url: player.ip === '127.0.0.1' ? `http://localhost:${config.port}` : url,
        key: config.key
    };
}));
rpc.register('reditor:eval', code => {
    try {
        eval(code);
    }catch(e){}
});
rpc.register('reditor:evalClients', code => {
    const queue = mp.players.toArray().map(player => rpc.callClient(player, 'reditor:eval', code));
    return Promise.all(queue);
});