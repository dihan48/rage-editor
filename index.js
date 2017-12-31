const CONTEXT_SERVER = 0;
const CONTEXT_CLIENT = 1;

(function(){
    let editor;
    let ssDefDisp, csDefDisp, ssDefContent, csDefContent;

    async function loadServersideDefs(){
        setStatus('Loading Server-side Definitions...');
        function load(data){
            ssDefContent = data;
            ssDefDisp = monaco.languages.typescript.javascriptDefaults.addExtraLib(data);
        }
        if(ssDefContent) load(ssDefContent);
        else{
            let data;
            try {
                data = await $.get('http://populumsolus.com/content/defs/rage.php?c=s');
            }catch(e){
                data = await $.get('defs/rage-server.d.ts');
            }
            load(data);
        }
        setStatus(null);
    }
    async function loadClientsideDefs(){
        setStatus('Loading Client-side Definitions...');
        function load(data){
            csDefContent = data;
            csDefDisp = monaco.languages.typescript.javascriptDefaults.addExtraLib(data);
        }
        if(csDefContent) load(csDefContent);
        else{
            let data;
            try {
                data = await $.get('http://populumsolus.com/content/defs/rage.php?c=c');
            }catch(e){
                data = await $.get('defs/rage-client.d.ts');
            }
            load(data);
        }
        setStatus(null);
    }

    function updateLineCount(){
        if(editor) $('#linenum').text(`Line ${editor.getPosition().lineNumber}, Column ${editor.getPosition().column}`);
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
            editor.onDidChangeCursorPosition(updateLineCount);
            updateLineCount();
            show();
        });

        // Toolbar buttons
        $('#toolbar').on('click', '.toolbar-btn', function(e){
            e.preventDefault();
            const $this = $(this);
            setStatus($this.data('action'));
            switch($this.data('action')){
                case 'fileNew':
                    break;
                case 'fileOpen':
                    break;
                case 'fileSave':
                    break;
                case 'fileSaveAs':
                    break;
            }
        }).on('mousedown', '.toolbar-btn', function(e){
            e.preventDefault();
        }).tooltip();
    });

    window.setContext = (mode) => {
        if(mode === CONTEXT_SERVER){
            if(csDefDisp) csDefDisp.dispose();
            csDefDisp = null;
            return loadServersideDefs();
        }else if(mode === CONTEXT_CLIENT){
            if(ssDefDisp) ssDefDisp.dispose();
            ssDefDisp = null;
            return loadClientsideDefs();
        }
    };
    window.setStatus = (status) => {
        $('#status').text(status);
    };
    window.show = () => {
        $('#container').show();
        if(editor) {
            editor.layout();
            editor.focus();
        }
    };
    window.hide = () => {
        $('#container').hide();
        if(editor && editor.isFocused()) document.activeElement.blur();
    };
})();