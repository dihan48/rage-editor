const fs        = require('fs');
const path      = require('path');
const http      = require('http');
const ngrok     = require('ngrok');
const rpc       = require('rage-rpc');
const config    = require('./config.json');

global.rrpc = rpc;

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

    fs.readFile(path.resolve(__dirname, 'static', filePath), (err, data) => {
        if(err){
            if(err.code === 'ENOENT'){
                res.writeHead(404);
                res.end('Not Found');
            }else{
                res.writeHead(500);
                res.end('Server Error');
            }
        }else{
            res.writeHead(200, {
                'Content-Type': mimeTypes[extName],
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'X-Requested-With'
            });
            res.end(data, 'utf-8');
        }
    });
}).listen(config.port);

console.log(`RAGE Editor is listening on port ${config.port}`);

let tunnel = ngrok.connect(config.port);

rpc.register('reditor:getUrl', () => tunnel);
rpc.register('reditor:eval', code => {
    try {
        eval(code);
    }catch(e){}
});
rpc.register('reditor:evalClients', code => {
    const queue = mp.players.toArray().map(player => rpc.callClient(player, 'reditor:eval', code));
    return Promise.all(queue);
});