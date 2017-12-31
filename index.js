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
    }
    function closeTab($tab){
        if($tab.siblings('.tab').length === 0) return;
        fileBuffers.splice($tab.index(), 1);
        const $nextTab = $tab.index() === 0 ? $tab.next('.tab') : $tab.prev('.tab');
        $tab.remove();
        selectTab($nextTab);
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

            editor.onDidChangeModelContent(function(){
                const $tab = $('.tab.active').eq(0);
                const idx = $tab.index();
                const val = editor.getValue();
                fileBuffers[idx] = val;
                const disk = fileDiskBuffers[val];
                if(disk !== val){
                    if(disk === null){
                        if(val.length) $tab.addClass('unsaved');
                        else $tab.removeClass('unsaved');
                    }else $tab.addClass('unsaved');
                }else $tab.removeClass('unsaved');
            });

            selectTab(fileNew());

            // autocomplete context
            setContext(CONTEXT_SERVER);

            // Line status
            editor.onDidChangeCursorPosition(updateLineCount);
            updateLineCount();

            // Display
            show();
        });

        $('.toolbar-btn').tooltip();

        // Toolbar buttons
        $('#toolbar').on('click', '.toolbar-btn', function(e){
            e.preventDefault();
            const $this = $(this);
            setStatus($this.data('action'));
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
                    break;
                case 'runServer':
                    break;
                case 'runAllClients':
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
            $('.toolbar-btn[data-action="toggleContext"]').attr('title', 'Use Client-side Context');
            return loadServersideDefs();
        }else if(mode === CONTEXT_CLIENT){
            if(ssDefDisp) ssDefDisp.dispose();
            ssDefDisp = null;
            $('.toolbar-btn[data-action="toggleContext"]').attr('title', 'Use Server-side Context');
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