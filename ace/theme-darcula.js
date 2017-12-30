ace.define("ace/theme/darcula",["require","exports","module","ace/lib/dom"], function(require, exports, module) {

    exports.isDark = true;
    exports.cssClass = "ace-darcula";

    exports.cssText = `
        .ace-darcula .ace_gutter {
            background: #141414;
            color: #595959;
            border-right: 1px solid #282828;
        }
        .ace-darcula .ace_gutter-cell.ace_warning {
            background-image: none;
            background: #FC0;
            border-left: none;
            padding-left: 0;
            color: #000;
        }
        .ace-darcula .ace_gutter-cell.ace_error {
            background-position: -6px center;
            background-image: none;
            background: #F10;
            border-left: none;
            padding-left: 0;
            color: #000;
        }
        .ace-darcula .ace_print-margin {
            border-left: 1px solid #555;
            right: 0;
            background: #1D1D1D;
        }
        .ace-darcula {
            background-color: #161616;
            color: #E6E1DC;
        }
        .ace-darcula .ace_cursor {
            border-left: 2px solid #FFFFFF;
        }
        .ace-darcula .ace_cursor.ace_overwrite {
            border-left: 0px;
            border-bottom: 1px solid #FFFFFF;
        }
        .ace-darcula .ace_marker-layer .ace_selection {
            background: #494836;
        }
        .ace-darcula .ace_marker-layer .ace_step {
            background: rgb(198, 219, 174);
        }
        .ace-darcula .ace_marker-layer .ace_bracket {
            margin: -1px 0 0 -1px;
            border: 1px solid #FCE94F;
        }
        .ace-darcula .ace_marker-layer .ace_active-line {
            background: #333;
        }
        .ace-darcula .ace_gutter-active-line {
            background-color: #222;
        }
        .ace-darcula .ace_invisible {
            color: #404040;
        }
        .ace-darcula .ace_keyword {
            color:#CC7832;
        }
        .ace-darcula .ace_keyword.ace_operator {
            color:#FFFFFF;
        }
        .ace-darcula .ace_punctuation.ace_operator {
            color:#CC7832;
        }
        .ace-darcula .ace_constant {
            color:#CC7832;
        }
        .ace-darcula .ace_type.ace_storage {
            color:#CC7832;
            font-weight: bold;
        }
        .ace-darcula .ace_constant.ace_language {
            color:#CC7832;
        }
        .ace-darcula .ace_constant.ace_library {
            color:#8DFF0A;
        }
        .ace-darcula .ace_constant.ace_numeric {
            color:#6897BB;
        }
        .ace-darcula .ace_invalid {
            color:#FFFFFF;
            background-color:#990000;
        }
        .ace-darcula .ace_invalid.ace_deprecated {
            color:#FFFFFF;
            background-color:#990000;
        }
        .ace-darcula .ace_support {
            color: #999;
        }
        .ace-darcula .ace_support.ace_function {
            color:#FFC66D;
        }
        .ace-darcula .ace_function {
            color:#FFC66D;
        }
        .ace-darcula .ace_string {
            color:#6A8759;
        }
        .ace-darcula .ace_comment {
            color:#808080;
        }
        .ace-darcula .ace_comment.ace_doc {
            color: #629755;
        }
        .ace-darcula .ace_comment.ace_doc.ace_tag {
            font-weight: bold;
        }
        .ace-darcula .ace_meta.ace_tag {
            color:#BE53E6;
        }
        .ace-darcula .ace_entity.ace_other.ace_attribute-name {
            color:#FFFF89;
        }
        .ace-darcula .ace_markup.ace_underline {
            text-decoration: underline;
        }
        .ace-darcula .ace_fold-widget {
            text-align: center;
        }
        .ace-darcula .ace_fold-widget:hover {
            color: #777;
        }
        .ace-darcula .ace_fold-widget.ace_start,
        .ace-darcula .ace_fold-widget.ace_end,
        .ace-darcula .ace_fold-widget.ace_closed{
            background: none;
            border: none;
            box-shadow: none;
        }
        .ace-darcula .ace_fold-widget.ace_start:after {
            content: '▾'
        }
        .ace-darcula .ace_fold-widget.ace_end:after {
            content: '▴'
        }
        .ace-darcula .ace_fold-widget.ace_closed:after {
            content: '‣'
        }
        .ace-darcula .ace_indent-guide {
            border-right:1px dotted #333;
            margin-right:-1px;
        }
        .ace-darcula .ace_fold { 
            background: #222; 
            border-radius: 3px; 
            color: #7AF; 
            border: none; 
        }
        .ace-darcula .ace_fold:hover {
            background: #CCC; 
            color: #000;
        }
    `;

    var dom = require("../lib/dom");
    dom.importCssString(exports.cssText, exports.cssClass);

});