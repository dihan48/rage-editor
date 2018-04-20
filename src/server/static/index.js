import 'babel-polyfill';

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import MonacoEditor from 'react-monaco-editor';

const CONTEXT_SERVER = 0;
const CONTEXT_CLIENT = 1;

class App extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            cursorLineNumber: 1,
            cursorColumn: 1,
            status: 'Loading...',
            context: CONTEXT_SERVER,
            tabs: [],
            selectedTab: -1,
            show: false
        };
        this.editorWillMount = this.editorWillMount.bind(this);
        this.editorDidMount = this.editorDidMount.bind(this);
        this.onEditorChanged = this.onEditorChanged.bind(this);
        this.setContext = this.setContext.bind(this);
        this.onClickContext = this.onClickContext.bind(this);
        this.fileNew = this.fileNew.bind(this);
        this.selectTab = this.selectTab.bind(this);
        this.closeTab = this.closeTab.bind(this);
        this.setStatus = this.setStatus.bind(this);
        this.evalLocal = this.evalLocal.bind(this);
        this.evalServer = this.evalServer.bind(this);
        this.evalClients = this.evalClients.bind(this);
    }

    componentDidMount(){
        window.show = () => {
            this.setState({
                show: true
            });
        };
        window.hide = () => {
            this.setState({
                show: false
            });
            if(this.editor && this.editor.isFocused()) document.activeElement.blur();
        };
        window.onEvalLocalResult = () => {
            this.setStatus(null);
        };
        window.onEvalServerResult = () => {
            this.setStatus(null);
        };
        window.onEvalClientsResult = () => {
            this.setStatus(null);
        };
    }

    onEditorChanged(value){
        this.setState((prevState) => prevState.tabs.map((tab, idx) => {
            const obj = tab;
            if(prevState.selectedTab === idx) obj.code = value;
            return obj;
        }));
    }

    editorWillMount(monaco){
        this.monaco = monaco;
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
    }

    editorDidMount(editor){
        this.editor = editor;

        // line number, column
        const updateCursorPosition = () => {
            const pos = editor.getPosition();
            this.setState({
                cursorLineNumber: pos.lineNumber,
                cursorColumn: pos.column
            });
        };
        editor.onDidChangeCursorPosition(updateCursorPosition);
        updateCursorPosition();

        // set default context
        this.setContext(this.state.context);

        // create first tab
        if(!this.state.tabs.length) this.fileNew();
    }

    render(){
        if(!this.state.show) return null;
        return (
            <React.Fragment>
                <div id="container">
                    <div id="toolbar">
                        <span className="toolbar-btn flt-left" onClick={this.fileNew}>New</span>
                        <span className="toolbar-btn flt-left" data-action="fileOpen">Open</span>
                        <span className="toolbar-btn flt-left" data-action="fileSave">Save</span>
                        <span className="toolbar-btn flt-left" data-action="fileSaveAs">Save As</span>
                        <span className="toolbar-btn flt-right" onClick={this.onClickContext} title={this.state.context === CONTEXT_CLIENT ? "Use Server-side Context" : "Use Client-side Context"}>{this.state.context === CONTEXT_CLIENT ? "Client-side" : "Server-side"}</span>
                        <span className="toolbar-btn square flt-right" onClick={this.evalClients} title="Run on All Clients">C</span>
                        <span className="toolbar-btn square flt-right" onClick={this.evalServer} title="Run on Server">S</span>
                        <span className="toolbar-btn square flt-right" onClick={this.evalLocal} title="Run Locally">L</span>
                    </div>
                    <div id="tabs">
                        {this.state.tabs.map((tab, idx) => {
                            const classNames = ["tab"];
                            const selected = this.state.selectedTab === idx;
                            if(selected) classNames.push('active');
                            return (
                                <div key={idx} className={classNames.join(' ')} onClick={() => this.selectTab(idx)}>
                                    <span className="tab-title">{tab.new ? `New ${tab.count}` : 'something'}</span>
                                    {selected && this.state.tabs.length > 1 && <a href="#" onClick={(e) => {e.stopPropagation(); this.closeTab(idx)}} className="tab-close">&times;</a>}
                                </div>
                            )
                        })}
                    </div>
                    <div id="editor">
                        <MonacoEditor
                            language="javascript"
                            theme="vs-dark"
                            value={(this.state.tabs.length && this.state.selectedTab > -1) ? this.state.tabs[this.state.selectedTab].code : ""}
                            onChange={this.onEditorChanged}
                            editorWillMount={this.editorWillMount}
                            editorDidMount={this.editorDidMount}
                            options={{
                                fontSize: 16,
                                links: false
                            }}
                        />
                    </div>
                    <div id="statusbar">
                        <span>Line {this.state.cursorLineNumber}, Column {this.state.cursorColumn}</span>
                        <span style={{ float: 'right' }}>{this.state.status}</span>
                    </div>
                </div>
                <div id="popup-open" className="popup">
                    <ul id="openfile-list">
                        <li><a href="#">script1</a></li>
                        <li><a href="#">script2</a></li>
                        <li><a href="#">script3</a></li>
                    </ul>
                    <a href="#" className="popup-btn flt-right" id="openfile-open">Open</a>
                    <a href="#" className="popup-btn flt-left" id="openfile-close">Close</a>
                </div>
            </React.Fragment>
        );
    }

    fileNew(){
        let count = 1;
        this.state.tabs.forEach((tab) => {
            if(tab.new) count++;
        });
        const newTabs = [...this.state.tabs, {
            count,
            new: true,
            code: ""
        }];
        this.setState({
            tabs: newTabs
        });
        this.selectTab(newTabs.length - 1);
    }

    selectTab(idx){
        this.setState({
            selectedTab: idx
        });
    }

    closeTab(idx){
        this.setState((prevState) => {
            const oldSelected = prevState.selectedTab;
            const newSelected = oldSelected === 0 ? oldSelected : oldSelected - 1;
            const newTabs = [...prevState.tabs];
            newTabs.splice(idx, 1);
            return {
                selectedTab: newSelected,
                tabs: newTabs
            };
        });
    }

    setStatus(status){
        this.setState({ status });
    }

    async setContext(context){
        if(!this.monaco) return;
        this.setState({ context });
        if(context === CONTEXT_SERVER){
            if(this.csDefDisposable){
                this.csDefDisposable.dispose();
                this.csDefDisposable = undefined;
            }
            this.setStatus("Loading Server-side Definitions...");
            let data = this.ssDefContent;
            if(typeof data === "undefined"){
                try {
                    data = await $.get('http://populumsolus.com/content/defs/rage.php?c=s');
                }catch(e){
                    data = await $.get('defs/rage-server.d.ts');
                }
            }
            this.ssDefContent = data;
            this.ssDefDisposable = monaco.languages.typescript.javascriptDefaults.addExtraLib(data);
        }else if(context === CONTEXT_CLIENT){
            if(this.ssDefDisposable){
                this.ssDefDisposable.dispose();
                this.ssDefDisposable = undefined;
            }
            this.setStatus("Loading Client-side Definitions...");
            let data = this.csDefContent;
            if(typeof data === "undefined"){
                try {
                    data = await $.get('http://populumsolus.com/content/defs/rage.php?c=c');
                }catch(e){
                    data = await $.get('defs/rage-client.d.ts');
                }
            }
            this.csDefContent = data;
            this.csDefDisposable = monaco.languages.typescript.javascriptDefaults.addExtraLib(data);
        }
        this.setStatus(null);
    }

    onClickContext(){
        this.setContext(this.state.context === CONTEXT_CLIENT ? CONTEXT_SERVER : CONTEXT_CLIENT);
    }

    evalLocal(code){
        if(!code){
            code = this.state.tabs[this.state.selectedTab].code;
        }
        if(mp) mp.trigger('reditor:runLocal', code);
        this.setStatus('Running Locally...');
    }

    evalServer(code){
        if(!code){
            code = this.state.tabs[this.state.selectedTab].code;
        }
        if(mp) mp.trigger('reditor:runServer', code);
        this.setStatus('Running on Server...');
    }

    evalClients(code){
        if(!code){
            code = this.state.tabs[this.state.selectedTab].code;
        }
        if(mp) mp.trigger('reditor:runClients', code);
        this.setStatus('Running on All Clients...');
    }
}

global.app = ReactDOM.render(<App />, document.getElementById('root'));

/*

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
        eval('require')(['vs/editor/editor.main'], function(){
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

        // Toolbar buttons
        $('#toolbar').on('click', '.toolbar-btn', function(e){
            e.preventDefault();
            const $this = $(this);
            switch($this.data('action')){
                case 'fileNew':
                    selectTab(fileNew());
                    break;
                case 'fileOpen':
                    $('#popup-open').show();
                    $('#container').css('pointer-events', 'none');
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

        // Open File
        $('#openfile-close').on('click', function(e){
            e.preventDefault();
            $('#popup-open').hide();
            $('#container').css('pointer-events', 'auto');
            if(editor) editor.focus();
        });
        $('#openfile-list').on('click', 'li > a', function(e){
            e.preventDefault();
            const $this = $(this);
            $this.parent().addClass('active').siblings('.active').removeClass('active');
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
*/
$('#container').show();