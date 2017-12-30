const editor = ace.edit("editor");
editor.setTheme("ace/theme/darcula");
editor.setFontSize(18);
editor.setShowPrintMargin(false);
editor.getSession().setUseWorker(false);
editor.getSession().setMode("ace/mode/javascript");
editor.$blockScrolling = Infinity;

ace.config.loadModule('ace/ext/tern', () => {
    editor.setOptions({
        enableTern: {
            defs: ['ecma5', 'ecma6', 'rageserver'],
            plugins: {
                doc_comment: {
                    fullDocs: true
                }
            },
            useWorker: false
        },
        enableSnippets: true,
        enableBasicAutocompletion: true
    });
});

const $tabs = $('#tabs');
$tabs.on('click', '.tab:not(.active)', function(){
    $(this).addClass('active').siblings('.active').removeClass('active');
});