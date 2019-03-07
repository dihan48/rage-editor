import React from 'react';
import ReactDOM from 'react-dom';
import MonacoEditor from 'react-monaco-editor';
import { Rnd } from 'react-rnd';
import styled, { css, createGlobalStyle } from 'styled-components';

import { SpacedContainer, Button } from './components/shared.js';
import OpenFileDialog from './components/OpenFileDialog.js';

const rpc = require('rage-rpc');

window.rrpc = rpc;

const CONTEXT_SERVER = 0;
const CONTEXT_CLIENT = 1;

const GlobalStyle = createGlobalStyle`
    html, body {
        padding: 0;
        margin: 0;
        width: 100%;
        height: 100%;
        font-family: Arial, serif;
        overflow: hidden;
        user-select: none;
    }
    
    * {
        box-sizing: border-box;
    }
    
    .resize {
        z-index: 2;
        margin: 10px;
        background: url(/handle.png) no-repeat;
    }
`;
const Container = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 0;
    width: 100%;
    height: 100%;
    background: #252525;
    border-radius: 4px;
    overflow: hidden;
`;
const Toolbar = styled(SpacedContainer)`
    flex: 0 0 35px;
    z-index: 1;
    border-bottom: 1px solid #393939;
    padding: 3px;
    
    ${Button} {
        height: 25px;
        margin: 2px;
    }
`;
const Tabs = styled.div`
    position: relative;
    z-index: 1;
    box-shadow: 0 1px 8px 0 rgba(0,0,0,0.7);
    font-size: 0;
    height: 30px;
`;
const Tab = styled.div`
    display: inline-block;
    margin: 0;
    padding: 8px 10px 5px;
    border-bottom: 1px solid #393939;
    font-size: 15px;
    background: #2d2d2d;
    
    > span {
        color: #888888;
        pointer-events: none;
        
        ${props => props.unsaved && css`
            &:after {
                content: ' *';
            }
        `}
    }
    
    > a {
        text-decoration: none;
        color: #e8e8e8;
        margin-left: 3px;
    }

    ${props => props.active && css`
        border-bottom: none;
        background: #1e1e1e;

        &:not(:first-of-type) {
            border-left: 1px solid #393939;
        }

        &:not(:last-of-type) {
            border-right: 1px solid #393939;
        }

        > span {
            color: #e8e8e8;
        }
    `}
`;
const EditorContainer = styled.div`
    flex: 1;
    margin: 0;
    z-index: 0;
    overflow: hidden;
`;
const StatusBar = styled(SpacedContainer)`
    flex: 0 0 25px;
    box-shadow: 0 -1px 8px 0 rgba(0, 0, 0, 0.7);
    z-index: 1;
    padding: 0 30px 0 10px;
    align-items: center;
    color: #e8e8e8;
    font-size: 12px;
`;

class App extends React.Component {
    state = {
        cursorLineNumber: 1,
        cursorColumn: 1,
        status: 'Loading...',
        context: CONTEXT_SERVER,
        tabs: [],
        selectedTab: -1,
        showOpenFile: false
    };

    componentDidMount(){
        document.body.addEventListener('mousedown', this.onClickAnywhere);
    }

    componentWillUnmount(){
        document.body.removeEventListener('mousedown', this.onClickAnywhere);
    }

    onResize = () => {
        if(this.editor) this.editor.layout();
    };

    onClickAnywhere = (e) => {
        if(this.editor){
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
        fetchFile('/defs/lib.es5.d.ts').then(text => monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'defs/lib.es5.d.ts'));
        fetchFile('/defs/base.d.ts').then(text => monaco.languages.typescript.javascriptDefaults.addExtraLib(text, 'defs/base.d.ts'));
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

        editor.focus();
    };

    showOpenFile = () => {
        document.activeElement.blur();
        this.setState({
            showOpenFile: true
        });
    };

    hideOpenFile = () => {
        this.setState({
            showOpenFile: false
        });
        if(this.editor) this.editor.focus();
    };

    openFile = (file) => {

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
                    data = await fetchFile('https://raw.githubusercontent.com/CocaColaBear/types-ragemp-s/master/index.d.ts');
                }catch(e){
                    data = await fetchFile('defs/rage-server.d.ts');
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
                    data = await fetchFile('https://raw.githubusercontent.com/CocaColaBear/types-ragemp-c/master/index.d.ts');
                }catch(e){
                    data = await fetchFile('/defs/rage-client.d.ts');
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

        this.setStatus('Running Locally...');
        rpc.callClient('reditor:eval', code).then(() => {
            this.setStatus(null);
        });
    };

    evalServer = (code) => {
        if(typeof code !== "string"){
            code = this.state.tabs[this.state.selectedTab].code;
        }

        this.setStatus('Running on Server...');
        rpc.callServer('reditor:eval', code).then(() => {
            this.setStatus(null);
        });
    };

    evalClients = (code) => {
        if(typeof code !== "string"){
            code = this.state.tabs[this.state.selectedTab].code;
        }

        this.setStatus('Running on All Clients...');
        rpc.callServer('reditor:evalClients', code).then(() => {
            this.setStatus(null);
        });
    };

    render(){
        return (
            <React.Fragment>
                <Rnd onResize={this.onResize}
                     default={{
                         x: (window.innerWidth * 0.3)/2,
                         y: 50,
                         width: '70%',
                         height: 700
                     }}
                     minWidth={500}
                     minHeight={200}
                     dragHandleClassName="handle"
                     cancel="button"
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
                    <Container>
                        <Toolbar className="handle">
                            <div>
                                <Button onClick={this.fileNew}>New</Button>
                                <Button onClick={this.showOpenFile}>Open</Button>
                                <Button>Save</Button>
                                <Button>Save As</Button>
                            </div>
                            <div>
                                <Button square title="Run Locally" onClick={this.evalLocal}>L</Button>
                                <Button square title="Run on Server" onClick={this.evalServer}>S</Button>
                                <Button square title="Run on All Clients" onClick={this.evalClients}>C</Button>
                                <Button title={`Use ${this.state.context === CONTEXT_CLIENT ? 'Server-side' : 'Client-side'} Context`} onClick={this.onClickContext}>{this.state.context === CONTEXT_CLIENT ? "Client-side" : "Server-side"}</Button>
                            </div>
                        </Toolbar>
                        <Tabs>
                            {this.state.tabs.map((tab, idx) => {
                                const selected = this.state.selectedTab === idx;
                                return (
                                    <Tab key={idx} active={selected} onClick={() => this.selectTab(idx)}>
                                        <span>{tab.new ? `New ${tab.count}` : 'something'}</span>
                                        {selected && this.state.tabs.length > 1 && <a href="#" onClick={(e) => {e.preventDefault(); this.closeTab(idx)}}>&times;</a>}
                                    </Tab>
                                )
                            })}
                        </Tabs>
                        <EditorContainer>
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
                        </EditorContainer>
                        <StatusBar>
                            <span>Line {this.state.cursorLineNumber}, Column {this.state.cursorColumn}</span>
                            <span>{this.state.status}</span>
                        </StatusBar>
                        {this.state.showOpenFile && (
                            <OpenFileDialog
                                hide={this.hideOpenFile}
                                onFileSelected={this.openFile}/>
                        )}
                    </Container>
                </Rnd>
                <GlobalStyle/>
            </React.Fragment>
        );
    }
}

function fetchFile(url){
    return fetch(url).then(res => res.text());
}

ReactDOM.render(<App />, document.getElementById('root'));