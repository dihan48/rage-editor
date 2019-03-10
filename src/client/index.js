import * as rpc from 'rage-rpc';

const STORAGE_KEY = 'reditorFiles';

let browser;

// hack to get up-to-date chat activated status. damnit GEROGE :(
function getChatStatus(){
    return new Promise(res => {
        const handler = toggle => {
            res(toggle);
            mp.events.remove('reditor:chatActivation', handler);
        };
        mp.events.add('reditor:chatActivation', handler);
        mp.gui.execute(`mp.trigger('reditor:chatActivation', chat.active)`);
    });
}

function init(info){
    // set up browser
    if(!browser) browser = mp.browsers.new(info.url);
    browser.active = false;

    // set up key bind
    mp.keys.bind(info.key, false, onBindPress);
}

mp.events.add('guiReady', () => {
    rpc.callServer('reditor:getInfo').then(info => {
        if(info) init(info);
    });
});

let lastChatActivation;
function onBindPress(){
    if(browser){
        if(browser.active){
            mp.gui.cursor.visible = false;
            mp.events.call('reditor:hidden');
            lastChatActivation.then(t => mp.gui.chat.activate(t));
            browser.active = false;
        }else{
            getUserAccess().then(access => {
                if(access){
                    rpc.callBrowser(browser, 'reditor:setAccess', access);
                    mp.events.call('reditor:shown');
                    lastChatActivation = getChatStatus();
                    mp.gui.cursor.visible = true;
                    lastChatActivation.then(() => mp.gui.chat.activate(false));
                    browser.active = true;
                    focusEditor();
                }
            });
        }
    }
}

function getUserAccess(){
    return rpc.callServer('reditor:canPlayerUse').then(res => {
        if(typeof res === 'object'){
            return {
                l: !!res.l,
                s: !!res.s,
                c: !!res.c
            };
        }else return !!res;
    });
}

function focusEditor(){
    if(browser && browser.active){
        browser.execute(`if(reditor && reditor.editor) reditor.editor.focus()`);
    }
}

rpc.register('reditor:eval', code => {
    try {
        eval(code);
    }catch(e){}
});

rpc.register('reditor:getFiles', () => {
    const names = Object.keys(mp.storage.data[STORAGE_KEY] || {});
    return names.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
});
rpc.register('reditor:getFile', name => (mp.storage.data[STORAGE_KEY] || {})[name]);
rpc.register('reditor:exists', name => typeof (mp.storage.data[STORAGE_KEY] || {})[name] !== 'undefined');
rpc.register('reditor:saveFile', ([name, code]) => {
    if(!mp.storage.data[STORAGE_KEY]) mp.storage.data[STORAGE_KEY] = {};
    mp.storage.data[STORAGE_KEY][name] = code;
    mp.storage.flush();
});
rpc.register('reditor:deleteFile', name => {
    if(mp.storage.data[STORAGE_KEY]){
        delete mp.storage.data[STORAGE_KEY][name];
        mp.storage.flush();
    }
});