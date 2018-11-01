import React, { useEffect, useState } from 'react';
import styled, { css } from 'styled-components';

import { Button, SpacedContainer } from './shared.js';

const Backdrop = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 3;
`;
const Dialog = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 4px;
    background: #2d2d2d;
    padding: 10px;
    color: #ffffff;
    box-shadow: 0 0 6px 3px rgba(0, 0, 0, 0.3);
    width: 250px;
`;
const List = styled.ul`
    background: #111111;
    border-radius: 4px;
    width: 100%;
    min-height: 120px;
    max-height: 360px;
    overflow-x: hidden;
    overflow-y: auto;
    margin: 0;
    list-style-type: none;
    padding: 0;
`;
const StyledListItem = styled.li`
    > a {
        padding: 2px 5px;
        display: block;
        text-decoration: none;
        color: #e9e9e9;
    }
    
    ${props => props.active && css`
        background: rgba(217, 217, 217, 0.29);
    `}
`;
const StyledButton = styled(Button)`
    margin-top: 8px;
    border: 1px solid #4e4e4e;
    padding: 5px 10px;
`;

export default function OpenFileDialog({ hide, onFileSelected }){
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);

    function onBackdropClick(e){
        if(e.target === e.currentTarget){
            hide();
        }
    }

    useEffect(() => {
        const files = [
            "script1",
            "script2",
            "script3",
            "script4"
        ];
        setFiles(files);
        setSelectedFile(files[0]);
    }, []);

    return (
        <Backdrop onClick={onBackdropClick}>
            <Dialog>
                <List>
                    {files.map(file => (
                        <ListItem
                            key={file}
                            active={selectedFile === file}
                            onClick={() => setSelectedFile(file)}
                        >{file}</ListItem>
                    ))}
                </List>
                <SpacedContainer>
                    <StyledButton onClick={hide}>Close</StyledButton>
                    <StyledButton onClick={() => onFileSelected(selectedFile)}>Open</StyledButton>
                </SpacedContainer>
            </Dialog>
        </Backdrop>
    );
}

function ListItem({ children, active, onClick }){
    return (
        <StyledListItem active={active}>
            <a href="#" onClick={onClick}>{children}</a>
        </StyledListItem>
    );
}