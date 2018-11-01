let browser;
let shown = false;

mp.events.add('guiReady', () => {
    mp.events.callRemote('reditor:requestInit');
});

mp.events.add('reditor:init', (url) => {
    if(!browser) browser = mp.browsers.new(url);
});

mp.keys.bind(0x77, false, () => {
    if(shown){
        browser.execute(`hide();`);
        mp.gui.cursor.visible = false;
        mp.events.call('reditor:hidden');
        shown = false;
    }else{
        browser.execute(`show();`);
        mp.gui.cursor.visible = true;
        mp.events.call('reditor:shown');
        shown = true;
    }
});

function resultToExecString(result){
    switch(typeof result){
        case 'undefined':
            result = 'undefined';
            break;
        case 'object':
            result = JSON.stringify(result);
            break;

    }
    return result;
}

mp.events.add('reditor:runLocal', (code) => {
    try {
        eval(code);
    }catch(e){}
    browser.execute(`onEvalLocalResult();`);
});

mp.events.add('reditor:runServer', (code) => {
    mp.events.callRemote('reditor:runServer', code);
});

mp.events.add('reditor:runServerRes', () => {
    browser.execute(`onEvalServerResult();`);
});

mp.events.add('reditor:runClients', (code) => {
    mp.events.callRemote('reditor:runClients', code);
});

mp.events.add('reditor:runClientsRes', () => {
    browser.execute(`onEvalClientsResult();`);
});

mp.events.add('reditor:runClientsEval', (code) => {
    try {
        eval(code);
    }catch(e){}
});