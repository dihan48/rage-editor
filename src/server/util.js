const https = require('https');

export function getIpAddress(){
    return new Promise((resolve, reject) => {
        const req = https.get('https://api.ipify.org', res => {
            if(res.statusCode < 200 || res.statusCode > 299) return reject(res.statusCode);
            const body = [];
            res.on('data', chunk => body.push(chunk));
            res.on('end', () => resolve(body.join('')));
        });
        req.on('error', reject);
    });
}