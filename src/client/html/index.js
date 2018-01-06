const CONTEXT_SERVER = 0;
const CONTEXT_CLIENT = 1;

(function(){
    let editor, currentContext;
    let ssDefDisp, csDefDisp, ssDefContent, csDefContent;

    const fileBuffers = [];
    const fileDiskBuffers = [];

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
    function fileNew(){
        const $tabs = $('#tabs');
        const nextCount = $tabs.children('.tab.new').length+1;
        const $tab = $(`
            <div class="tab new">
                <span class="tab-title">New ${nextCount}</span>
                <a href="#" class="tab-close">&times;</a>
            </div>
        `);
        $tabs.append($tab);
        fileBuffers.push('');
        fileDiskBuffers.push(null);
        return $tab;
    }
    function selectTab($tab){
        const $currentTab = $tab.siblings('.active');
        if($currentTab){
            if(editor) fileBuffers[$currentTab.first().index()] = editor.getValue();
            $currentTab.find('.tab-close').hide();
            $currentTab.removeClass('active');
        }
        $tab.addClass('active');
        if($tab.siblings().length) $tab.find('.tab-close').show();
        editor.setValue(fileBuffers[$tab.index()]);
        editor.focus();
    }
    function closeTab($tab){
        if($tab.siblings('.tab').length === 0) return;
        fileBuffers.splice($tab.index(), 1);
        const $nextTab = $tab.index() === 0 ? $tab.next('.tab') : $tab.prev('.tab');
        $tab.remove();
        selectTab($nextTab);
    }

    function evalLocal(code){
        if(mp) mp.trigger('reditor:runLocal', code);
        setStatus('Running Locally...');
    }
    function evalServer(code){
        if(mp) mp.trigger('reditor:runServer', code);
        setStatus('Running on Server...');
    }
    function evalClients(code){
        if(mp) mp.trigger('reditor:runClients', code);
        setStatus('Running on All Clients...');
    }

    window.onEvalLocalResult = function(result){
        setStatus(null);
    };
    window.onEvalServerResult = function(result){
        setStatus(null);
    };
    window.onEvalClientsResult = function(result){
        setStatus(null);
    };

    $(function(){
        require(['vs/editor/editor.main'], function(){
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: false
            });
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2015,
                noLib: true,
                allowNonTsExtensions: true
            });
            $.get('defs/lib.es5.d.ts').then((res) => monaco.languages.typescript.javascriptDefaults.addExtraLib(res, 'defs/lib.es5.d.ts'));
            $.get('defs/base.d.ts').then((res) => monaco.languages.typescript.javascriptDefaults.addExtraLib(res, 'defs/base.d.ts'));
            editor = monaco.editor.create(document.getElementById('editor'), {
                language: 'javascript',
                theme: 'vs-dark',
                fontSize: 16,
                links: false
            });

            editor.onDidChangeModelContent(function(){
                const $tab = $('.tab.active').eq(0);
                const idx = $tab.index();
                const val = editor.getValue();
                fileBuffers[idx] = val;
                const disk = fileDiskBuffers[idx];
                if(disk !== val){
                    if(disk === null){
                        if(val.length) $tab.addClass('unsaved');
                        else $tab.removeClass('unsaved');
                    }else $tab.addClass('unsaved');
                }else $tab.removeClass('unsaved');
            });

            editor.addAction({
                id: 'runSelectionLocally',
                label: 'Run Selection Locally',
                precondition: 'editorHasSelection',
                keybindingContext: null,
                contextMenuGroupId: 'runSelection',
                contextMenuOrder: 0,
                run: (e) => evalLocal(e.getModel().getValueInRange(e.getSelection()))
            });
            editor.addAction({
                id: 'runSelectionServer',
                label: 'Run Selection on Server',
                precondition: 'editorHasSelection',
                keybindingContext: null,
                contextMenuGroupId: 'runSelection',
                contextMenuOrder: 0,
                run: (e) => evalServer(e.getModel().getValueInRange(e.getSelection()))
            });
            editor.addAction({
                id: 'runSelectionAllClients',
                label: 'Run Selection on All Clients',
                precondition: 'editorHasSelection',
                keybindingContext: null,
                contextMenuGroupId: 'runSelection',
                contextMenuOrder: 0,
                run: (e) => evalClients(e.getModel().getValueInRange(e.getSelection()))
            });

            selectTab(fileNew());

            // autocomplete context
            setContext(CONTEXT_SERVER);

            // Line status
            editor.onDidChangeCursorPosition(updateLineCount);
            updateLineCount();
        });

        $('.toolbar-btn').tooltip();

        // Toolbar buttons
        $('#toolbar').on('click', '.toolbar-btn', function(e){
            e.preventDefault();
            const $this = $(this);
            switch($this.data('action')){
                case 'fileNew':
                    selectTab(fileNew());
                    break;
                case 'fileOpen':
                    break;
                case 'fileSave':
                    break;
                case 'fileSaveAs':
                    break;
                case 'runLocally':
                    if(editor) evalLocal(editor.getValue());
                    break;
                case 'runServer':
                    if(editor) evalServer(editor.getValue());
                    break;
                case 'runAllClients':
                    if(editor) evalClients(editor.getValue());
                    break;
                case 'toggleContext':
                    if(currentContext === CONTEXT_SERVER) setContext(CONTEXT_CLIENT);
                    else setContext(CONTEXT_SERVER);
                    $this.tooltip('close');
                    $this.tooltip('open');
                    break;
            }
        }).on('mousedown', '.toolbar-btn', function(e){
            e.preventDefault();
        });

        // Tabs
        $('#tabs').on('click', '.tab', function(e){
            e.preventDefault();
            selectTab($(this));
        }).on('click', '.tab-close', function(e){
            e.preventDefault();
            const $tab = $(this).closest('.tab');
            closeTab($tab);
        });
    });

    window.setContext = (mode) => {
        currentContext = mode;
        if(mode === CONTEXT_SERVER){
            if(csDefDisp) csDefDisp.dispose();
            csDefDisp = null;
            $('.toolbar-btn[data-action="toggleContext"]').attr('title', 'Use Client-side Context').text('Server-side');
            return loadServersideDefs();
        }else if(mode === CONTEXT_CLIENT){
            if(ssDefDisp) ssDefDisp.dispose();
            ssDefDisp = null;
            $('.toolbar-btn[data-action="toggleContext"]').attr('title', 'Use Server-side Context').text('Client-side');
            return loadClientsideDefs();
        }
    };
    window.getContext = () => {
        return currentContext;
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