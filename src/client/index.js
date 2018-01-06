let browser;
let shown = false;

mp.events.add('guiReady', () => {
    if(!browser) browser = mp.browsers.new('package://rage-editor/html/index.html');
});

mp.keys.bind(0x77, false, () => {
    if(shown){

        browser.execute(`hide();`);
        mp.gui.cursor.visible = false;
        mp.gui.chat.activate(false);
        mp.events.call('reditor:hidden');
        shown = false;

    }else{
        browser.execute(`show();`);
        mp.gui.cursor.visible = true;
        mp.gui.chat.activate(true);
        mp.events.call('reditor:shown');
        shown = true;
    }
});