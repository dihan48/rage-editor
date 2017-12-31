const CONTEXT_SERVER = 0;
const CONTEXT_CLIENT = 1;

let editor;
let ssDefDisp, csDefDisp, ssDefContent, csDefContent;

async function loadServersideDefs(){
    function load(data){
        ssDefContent = data;
        ssDefDisp = monaco.languages.typescript.javascriptDefaults.addExtraLib(data);
    }
    if(ssDefContent) load(ssDefContent);
    else{
        let data;
        try {
            data = await $.get('poofart');
        }catch(e){
            data = await $.get('defs/rage-server.d.ts');
        }
        load(data);
    }
}
async function loadClientsideDefs(){
    function load(data){
        csDefContent = data;
        csDefDisp = monaco.languages.typescript.javascriptDefaults.addExtraLib(data);
    }
    if(csDefContent) load(csDefContent);
    else{
        let data;
        try {
            data = await $.get('poofart');
        }catch(e){
            data = await $.get('defs/rage-client.d.ts');
        }
        load(data);
    }
}

$(function(){
    require(['vs/editor/editor.main'], function(){
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false
        });
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2015,
            allowNonTsExtensions: true
        });
        editor = monaco.editor.create(document.getElementById('editor'), {
            language: 'javascript',
            theme: 'vs-dark',
            fontSize: 16
        });
        setContext(CONTEXT_SERVER);
    });
});

function setContext(mode){
    if(mode === CONTEXT_SERVER){
        if(csDefDisp) csDefDisp.dispose();
        csDefDisp = null;
        return loadServersideDefs();
    }else if(mode === CONTEXT_CLIENT){
        if(ssDefDisp) ssDefDisp.dispose();
        ssDefDisp = null;
        return loadClientsideDefs();
    }
}