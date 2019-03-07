const rpc   = require('rage-rpc');

let browser;

global.rrpc = rpc;

mp.events.add('guiReady', () => {
    rpc.callServer('reditor:getUrl').then(url => {
        if(!browser) browser = mp.browsers.new(url);
        browser.active = false;
    });
});

mp.keys.bind(0x77, false, () => {
    if(browser){
        if(browser.active){
            mp.gui.cursor.visible = false;
            mp.events.call('reditor:hidden');
            browser.active = false;
        }else{
            mp.gui.cursor.visible = true;
            mp.events.call('reditor:shown');
            browser.active = true;
        }
    }
});

rpc.register('reditor:eval', (code) => {
    try {
        eval(code);
    }catch(e){}
});