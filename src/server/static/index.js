import 'babel-polyfill';

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import MonacoEditor from 'react-monaco-editor';
import { Rnd } from 'react-rnd';

const CONTEXT_SERVER = 0;
const CONTEXT_CLIENT = 1;

class App extends React.Component {
    state = {
        cursorLineNumber: 1,
        cursorColumn: 1,
        status: 'Loading...',
        context: CONTEXT_SERVER,
        tabs: [],
        selectedTab: -1,
        show: true,
        showOpenFile: false
    };

    componentDidMount(){
        window.show = () => {
            this.setState({
                show: true
            });
            if(this.editor) this.editor.focus();
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

        document.body.addEventListener('mousedown', this.onClickAnywhere);
        window.addEventListener('resize', this.onResize);
    }

    componentWillUnmount(){
        document.body.removeEventListener('mousedown', this.onClickAnywhere);
        window.removeEventListener('resize', this.onResize);
    }

    onResize = () => {
        if(this.editor) this.editor.layout();
    };

    onClickAnywhere = (e) => {
        if(this.editor && this.state.show){
            e.preventDefault();
        }
    };

    onEditorChanged = (value) => {
        this.setState((prevState) => prevState.tabs.map((tab, idx) => {
            const obj = tab;
            if(prevState.selectedTab === idx) obj.code = value;
            return obj;
        }));
    };

    editorWillMount = (monaco) => {
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
    };

    editorDidMount = (editor) => {
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

        editor.addAction({
            id: 'runSelectionLocally',
            label: 'Run Selection Locally',
            precondition: 'editorHasSelection',
            keybindingContext: null,
            contextMenuGroupId: 'runSelection',
            contextMenuOrder: 0,
            run: (e) => this.evalLocal(e.getModel().getValueInRange(e.getSelection()))
        });

        editor.addAction({
            id: 'runSelectionServer',
            label: 'Run Selection on Server',
            precondition: 'editorHasSelection',
            keybindingContext: null,
            contextMenuGroupId: 'runSelection',
            contextMenuOrder: 0,
            run: (e) => this.evalServer(e.getModel().getValueInRange(e.getSelection()))
        });

        editor.addAction({
            id: 'runSelectionAllClients',
            label: 'Run Selection on All Clients',
            precondition: 'editorHasSelection',
            keybindingContext: null,
            contextMenuGroupId: 'runSelection',
            contextMenuOrder: 0,
            run: (e) => this.evalClients(e.getModel().getValueInRange(e.getSelection()))
        });

        // create first tab
        this.fileNew();
    };

    showFileOpen = () => {
        this.setState({
            showOpenFile: true
        });
        if(this.editor && this.editor.isFocused()) document.activeElement.blur();
    };

    hideFileOpen = () => {
        this.setState({
            showOpenFile: false
        });
        if(this.editor) this.editor.focus();
    };

    fileNew = () => {
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
    };

    selectTab = (idx) => {
        this.setState({
            selectedTab: idx
        });
    };

    closeTab = (idx) => {
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
    };

    setStatus = (status) => {
        this.setState({ status });
    };

    setContext = async (context) => {
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
    };

    onClickContext = () => {
        this.setContext(this.state.context === CONTEXT_CLIENT ? CONTEXT_SERVER : CONTEXT_CLIENT);
    };

    evalLocal = (code) => {
        if(typeof code !== "string"){
            code = this.state.tabs[this.state.selectedTab].code;
        }
        if(mp) mp.trigger('reditor:runLocal', code);
        this.setStatus('Running Locally...');
    };

    evalServer = (code) => {
        if(typeof code !== "string"){
            code = this.state.tabs[this.state.selectedTab].code;
        }
        if(mp) mp.trigger('reditor:runServer', code);
        this.setStatus('Running on Server...');
    };

    evalClients = (code) => {
        if(typeof code !== "string"){
            code = this.state.tabs[this.state.selectedTab].code;
        }
        if(mp) mp.trigger('reditor:runClients', code);
        this.setStatus('Running on All Clients...');
    };

    render(){
        return (
            <React.Fragment>
                <Rnd onResize={this.onResize}
                     default={{
                         x: (window.innerWidth * 0.3)/2,
                         y: 50,
                         width: '70%',
                         height: 750
                     }}
                     minWidth={500}
                     minHeight={200}
                     dragHandleClassName="handle"
                     cancel=".toolbar-btn"
                     resizeHandleClasses={{
                         bottomRight: "resize"
                     }}
                     enableResizing={{
                         bottom: false,
                         bottomLeft: false,
                         bottomRight: true,
                         left: false,
                         right: false,
                         top: false,
                         topLeft: false,
                         topRight: false
                     }}
                     bounds="#body">
                    <div id="container">
                        <div id="toolbar" className="handle">
                            <div>
                                <span className="toolbar-btn" onClick={this.fileNew}>New</span>
                                <span className="toolbar-btn" onClick={this.showFileOpen}>Open</span>
                                <span className="toolbar-btn" data-action="fileSave">Save</span>
                                <span className="toolbar-btn" data-action="fileSaveAs">Save As</span>
                            </div>
                            <div>
                                <span className="toolbar-btn square" onClick={this.evalLocal} title="Run Locally">L</span>
                                <span className="toolbar-btn square" onClick={this.evalServer} title="Run on Server">S</span>
                                <span className="toolbar-btn square" onClick={this.evalClients} title="Run on All Clients">C</span>
                                <span className="toolbar-btn" onClick={this.onClickContext} title={this.state.context === CONTEXT_CLIENT ? "Use Server-side Context" : "Use Client-side Context"}>{this.state.context === CONTEXT_CLIENT ? "Client-side" : "Server-side"}</span>
                            </div>
                        </div>
                        <div id="tabs">
                            {this.state.tabs.map((tab, idx) => {
                                const classNames = ['tab'];
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
                                    links: false,
                                    scrollBeyondLastLine: false
                                }} />
                        </div>
                        <div id="statusbar">
                            <span>Line {this.state.cursorLineNumber}, Column {this.state.cursorColumn}</span>
                            <span style={{ float: 'right' }}>{this.state.status}</span>
                        </div>
                    </div>
                </Rnd>
                {this.state.show && this.state.showOpenFile && (
                    <div id="popup-open" className="popup">
                        <ul id="openfile-list">
                            <li><a href="#">script1</a></li>
                            <li><a href="#">script2</a></li>
                            <li><a href="#">script3</a></li>
                        </ul>
                        <a href="#" className="popup-btn flt-right">Open</a>
                        <a href="#" className="popup-btn flt-left" onClick={this.hideFileOpen}>Close</a>
                    </div>
                )}
            </React.Fragment>
        );
    }
}

ReactDOM.render(<App />, document.getElementById('root'));