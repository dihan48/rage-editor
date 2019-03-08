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

mp.events.add('guiReady', () => {
    rpc.callServer('reditor:getUrl').then(url => {
        if(!browser) browser = mp.browsers.new(url);
        browser.active = false;
    });
});

let lastChatActivation;
mp.keys.bind(0x77, false, () => {
    if(browser){
        if(browser.active){
            mp.gui.cursor.visible = false;
            mp.events.call('reditor:hidden');
            lastChatActivation.then(t => mp.gui.chat.activate(t));
            browser.active = false;
        }else{
            mp.events.call('reditor:shown');
            lastChatActivation = getChatStatus();
            mp.gui.cursor.visible = true;
            lastChatActivation.then(() => mp.gui.chat.activate(false));
            browser.active = true;
            focusEditor();
        }
    }
});

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