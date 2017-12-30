/** Tern web worker, which is used by default
 * This file also contains all files that are needed for the web worker to run (the server can load files on demand, but its messy to have all these files for once peice of ace functionality) *
 *
 *
 * Last updated 4/8/2015
 * Versions:
 *      Acorn: 1.0.1
 *      Tern:  0.10.0
 *
 * NOTE: in order to get latest acorn version you now must get from NPM or manually build Acorn source. Easiest way is to create a new folder and use: npm install acorn
 * 
 * NOTE: There is a bug with chrome.fileSystem that makes saving this file (specifically acorn.js) break (messes up UTF-8 encoding). https://code.google.com/p/chromium/issues/detail?id=474183. This file must be saved with a non-chrome app. If saved with a chrome app, then overwrting save wont fix, instead must delete file and save as new file from non-chrome app. 
 * 
 * NOTE: acorn_csp.js works without eval, but tern still has code that requires eval so there is no reason to use acorn_csp.
 */

// declare global: tern, server
/*jshint maxerr:10000 */


/**
 * this file used in web worker or normal javascript execution
 */
var isWorker = typeof window === 'undefined';

/**
 * this plugin is used in Caret-T chrome app.
 * tern can't run in a chrome app due to content security policy that disallows eval (which tern uses).
 * this code allows tern to work in chrome app using sandboxed iframe, so this worker file is not acutally
 * a worker in the chrome app.
 * 
 * This code is irrelevant for normal usage, set isChromeApp to false when not using in Caret-T chromeApp.
 *
 */
var isChromeApp = false;

if (isChromeApp) {
    var parentSource = null,
        parentOrigin = null;

    window.addEventListener('message', function(event) {
        if (parentSource === null) {
            parentSource = event.source;
            parentOrigin = event.origin;
        }
        onmessage(event);
    });

    window.postMessage = function(message) {
        parentSource.postMessage(message, parentOrigin);
    };
}

if (isWorker || isChromeApp) {
    if (isChromeApp) self = window;
    
    var server, nextId = 0,
        pending = {};

    self.onmessage = function(e) {
        //console.log('onmessage');
        var data = e.data;
        switch (data.type) {
        case "init":
            if (data.defs && data.defs.length > 0) {
                var tmp = [];
                for (var i = 0; i < data.defs.length; i++) {
                    tmp.push(getDefFromName(data.defs[i]));
                }
                data.defs = tmp;
            }
            return startServer(data.defs, data.plugins, data.scripts);
        case "add":
            return server.addFile(data.name, data.text);
        case "del":
            return server.delFile(data.name);
        case "req":
            //console.log('request received on server, data=',data.body);
            return server.request(data.body, function(err, reqData) {
                postMessage({
                    id: data.id,
                    body: reqData,
                    err: err && String(err)
                });
            });
        case "getFile":
            var c = pending[data.id];
            delete pending[data.id];
            return c(data.err, data.text);
        case "setDefs":
            return setDefs(data.defs);
        case "debug":
            debug(data.body);
            break;
        default:
            throw new Error("Unknown message type: " + data.type);
        }

        //Added for ace- sets defs as setting them on load is not ideal due to structure and the defs are stored in the worker file
        function setDefs(defs) {
            console.log('set defs in worker-tern.js does not work yet... it gets the file but setting the servers defs property is not enough to load the defs- this needs to be updated in tern to allow setting defs after load');
            try {
                server.defs = [];
                if (!defs || defs.length == 0) {
                    return;
                }
                for (var i = 0; i < defs.length; i++) {
                    server.defs.push(getDefFromName(defs[i]));
                    console.log(server.defs);
                }

            }
            catch (ex) {
                console.log('error setting tern defs (should be passed array) error: ' + ex);
            }
        }

        //(hack)- gets def from name at the bottom of this file (jquery,ecma5,browser,underscore)
        function getDefFromName(name) {
            try {
                if (typeof name !== 'string') return name;
                return eval('def_' + name);
            }
            catch (ex) {
                if (isWorker) console.log('error getting tern def (definition file) from name: ' + name);
                else console.log('error getting tern def (definition file) from name: ', name, ex);
                throw (ex);
            }
        }

        //(hack)- do something with debug messages
        function debug(message) {
            var r = '';
            if (message == "files" || message == 'filecontents') {
                for (var i = 0; i < server.files.length; i++) {
                    if (i > 0) r += '\n';
                    if (message == 'filecontents') {
                        r += 'file: ' + server.files[i].name + '\n\nbody:\n';
                        r += server.files[i].text + '\n\n\n';
                    }
                    else {
                        r += server.files[i].name;
                    }
                }
            }
            else {
                console.log("unknown debug message in tern worker:" + message);
            }
            if (r) {
                console.log('worker server debug - ' + message + '\n\n' + r);
            }
        }
    };

    self.getFile = function(file, c) {
        postMessage({
            type: "getFile",
            name: file,
            id: ++nextId
        });
        pending[nextId] = c;
    };

    self.startServer = function(defs, plugins, scripts) {
        console.log('tern: starting server');
        if (scripts) importScripts.apply(null, scripts);
        server = new tern.Server({
            getFile: getFile,
            async: true,
            defs: defs,
            plugins: plugins
        });
    };

    if (!self.console) self.console = {
        log: function(v) {
            postMessage({
                type: "debug",
                message: v
            });
        }
    };
}


//#region acorn/dist/acorn.js

(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    }
    else if (typeof define === "function" && define.amd) {
        define([], f)
    }
    else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        }
        else if (typeof global !== "undefined") {
            g = global
        }
        else if (typeof self !== "undefined") {
            g = self
        }
        else {
            g = this
        }
        g.acorn = f()
    }
})(function() {
    var define, module, exports;
    return (function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {
                    exports: {}
                };
                t[o][0].call(l.exports, function(e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }
        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    })({
        1: [function(_dereq_, module, exports) {


            // The main exported interface (under `self.acorn` when in the
            // browser) is a `parse` function that takes a code string and
            // returns an abstract syntax tree as specified by [Mozilla parser
            // API][api].
            //
            // [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

            "use strict";

            exports.parse = parse;

            // This function tries to parse a single expression at a given
            // offset in a string. Useful for parsing mixed-language formats
            // that embed JavaScript expressions.

            exports.parseExpressionAt = parseExpressionAt;

            // Acorn is organized as a tokenizer and a recursive-descent parser.
            // The `tokenize` export provides an interface to the tokenizer.

            exports.tokenizer = tokenizer;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // Acorn is a tiny, fast JavaScript parser written in JavaScript.
            //
            // Acorn was written by Marijn Haverbeke, Ingvar Stepanyan, and
            // various contributors and released under an MIT license.
            //
            // Git repositories for Acorn are available at
            //
            //     http://marijnhaverbeke.nl/git/acorn
            //     https://github.com/marijnh/acorn.git
            //
            // Please use the [github bug tracker][ghbt] to report issues.
            //
            // [ghbt]: https://github.com/marijnh/acorn/issues
            //
            // This file defines the main parser interface. The library also comes
            // with a [error-tolerant parser][dammit] and an
            // [abstract syntax tree walker][walk], defined in other files.
            //
            // [dammit]: acorn_loose.js
            // [walk]: util/walk.js

            var _state = _dereq_("./state");

            var Parser = _state.Parser;

            var _options = _dereq_("./options");

            var getOptions = _options.getOptions;

            _dereq_("./parseutil");

            _dereq_("./statement");

            _dereq_("./lval");

            _dereq_("./expression");

            exports.Parser = _state.Parser;
            exports.plugins = _state.plugins;
            exports.defaultOptions = _options.defaultOptions;

            var _location = _dereq_("./location");

            exports.SourceLocation = _location.SourceLocation;
            exports.getLineInfo = _location.getLineInfo;
            exports.Node = _dereq_("./node").Node;

            var _tokentype = _dereq_("./tokentype");

            exports.TokenType = _tokentype.TokenType;
            exports.tokTypes = _tokentype.types;

            var _tokencontext = _dereq_("./tokencontext");

            exports.TokContext = _tokencontext.TokContext;
            exports.tokContexts = _tokencontext.types;

            var _identifier = _dereq_("./identifier");

            exports.isIdentifierChar = _identifier.isIdentifierChar;
            exports.isIdentifierStart = _identifier.isIdentifierStart;
            exports.Token = _dereq_("./tokenize").Token;

            var _whitespace = _dereq_("./whitespace");

            exports.isNewLine = _whitespace.isNewLine;
            exports.lineBreak = _whitespace.lineBreak;
            exports.lineBreakG = _whitespace.lineBreakG;
            var version = "1.0.2";
            exports.version = version;

            function parse(input, options) {
                var p = parser(options, input);
                var startPos = p.options.locations ? [p.pos, p.curPosition()] : p.pos;
                p.nextToken();
                return p.parseTopLevel(p.options.program || p.startNodeAt(startPos));
            }

            function parseExpressionAt(input, pos, options) {
                var p = parser(options, input, pos);
                p.nextToken();
                return p.parseExpression();
            }

            function tokenizer(input, options) {
                return parser(options, input);
            }

            function parser(options, input) {
                return new Parser(getOptions(options), String(input));
            }

        }, {
            "./expression": 2,
            "./identifier": 3,
            "./location": 4,
            "./lval": 5,
            "./node": 6,
            "./options": 7,
            "./parseutil": 8,
            "./state": 9,
            "./statement": 10,
            "./tokencontext": 11,
            "./tokenize": 12,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        2: [function(_dereq_, module, exports) {
            // A recursive descent parser operates by defining functions for all
            // syntactic elements, and recursively calling those, each function
            // advancing the input stream and returning an AST node. Precedence
            // of constructs (for example, the fact that `!x[1]` means `!(x[1])`
            // instead of `(!x)[1]` is handled by the fact that the parser
            // function that parses unary prefix operators is called first, and
            // in turn calls the function that parses `[]` subscripts — that
            // way, it'll receive the node for `x[1]` already parsed, and wraps
            // *that* in the unary operator node.
            //
            // Acorn uses an [operator precedence parser][opp] to handle binary
            // operator precedence, because it is much more compact than using
            // the technique outlined above, which uses different, nesting
            // functions to specify precedence, for all of the ten binary
            // precedence levels that JavaScript defines.
            //
            // [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

            "use strict";

            var tt = _dereq_("./tokentype").types;

            var Parser = _dereq_("./state").Parser;

            var reservedWords = _dereq_("./identifier").reservedWords;

            var has = _dereq_("./util").has;

            var pp = Parser.prototype;

            // Check if property name clashes with already added.
            // Object/class getters and setters are not allowed to clash —
            // either with each other or with an init property — and in
            // strict mode, init properties are also not allowed to be repeated.

            pp.checkPropClash = function(prop, propHash) {
                if (this.options.ecmaVersion >= 6) return;
                var key = prop.key,
                    name = undefined;
                switch (key.type) {
                case "Identifier":
                    name = key.name;
                    break;
                case "Literal":
                    name = String(key.value);
                    break;
                default:
                    return;
                }
                var kind = prop.kind || "init",
                    other = undefined;
                if (has(propHash, name)) {
                    other = propHash[name];
                    var isGetSet = kind !== "init";
                    if ((this.strict || isGetSet) && other[kind] || !(isGetSet ^ other.init)) this.raise(key.start, "Redefinition of property");
                }
                else {
                    other = propHash[name] = {
                        init: false,
                        get: false,
                        set: false
                    };
                }
                other[kind] = true;
            };

            // ### Expression parsing

            // These nest, from the most general expression type at the top to
            // 'atomic', nondivisible expression types at the bottom. Most of
            // the functions will simply let the function(s) below them parse,
            // and, *if* the syntactic construct they handle is present, wrap
            // the AST node that the inner parser gave them in another node.

            // Parse a full expression. The optional arguments are used to
            // forbid the `in` operator (in for loops initalization expressions)
            // and provide reference for storing '=' operator inside shorthand
            // property assignment in contexts where both object expression
            // and object pattern might appear (so it's possible to raise
            // delayed syntax error at correct position).

            pp.parseExpression = function(noIn, refShorthandDefaultPos) {
                var start = this.markPosition();
                var expr = this.parseMaybeAssign(noIn, refShorthandDefaultPos);
                if (this.type === tt.comma) {
                    var node = this.startNodeAt(start);
                    node.expressions = [expr];
                    while (this.eat(tt.comma)) node.expressions.push(this.parseMaybeAssign(noIn, refShorthandDefaultPos));
                    return this.finishNode(node, "SequenceExpression");
                }
                return expr;
            };

            // Parse an assignment expression. This includes applications of
            // operators like `+=`.

            pp.parseMaybeAssign = function(noIn, refShorthandDefaultPos) {
                if (this.type == tt._yield && this.inGenerator) return this.parseYield();

                var failOnShorthandAssign = undefined;
                if (!refShorthandDefaultPos) {
                    refShorthandDefaultPos = {
                        start: 0
                    };
                    failOnShorthandAssign = true;
                }
                else {
                    failOnShorthandAssign = false;
                }
                var start = this.markPosition();
                var left = this.parseMaybeConditional(noIn, refShorthandDefaultPos);
                if (this.type.isAssign) {
                    var node = this.startNodeAt(start);
                    node.operator = this.value;
                    node.left = this.type === tt.eq ? this.toAssignable(left) : left;
                    refShorthandDefaultPos.start = 0; // reset because shorthand default was used correctly
                    this.checkLVal(left);
                    this.next();
                    node.right = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, "AssignmentExpression");
                }
                else if (failOnShorthandAssign && refShorthandDefaultPos.start) {
                    this.unexpected(refShorthandDefaultPos.start);
                }
                return left;
            };

            // Parse a ternary conditional (`?:`) operator.

            pp.parseMaybeConditional = function(noIn, refShorthandDefaultPos) {
                var start = this.markPosition();
                var expr = this.parseExprOps(noIn, refShorthandDefaultPos);
                if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
                if (this.eat(tt.question)) {
                    var node = this.startNodeAt(start);
                    node.test = expr;
                    node.consequent = this.parseMaybeAssign();
                    this.expect(tt.colon);
                    node.alternate = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, "ConditionalExpression");
                }
                return expr;
            };

            // Start the precedence parser.

            pp.parseExprOps = function(noIn, refShorthandDefaultPos) {
                var start = this.markPosition();
                var expr = this.parseMaybeUnary(refShorthandDefaultPos);
                if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
                return this.parseExprOp(expr, start, - 1, noIn);
            };

            // Parse binary operators with the operator precedence parsing
            // algorithm. `left` is the left-hand side of the operator.
            // `minPrec` provides context that allows the function to stop and
            // defer further parser to one of its callers when it encounters an
            // operator that has a lower precedence than the set it is parsing.

            pp.parseExprOp = function(left, leftStart, minPrec, noIn) {
                var prec = this.type.binop;
                if (prec != null && (!noIn || this.type !== tt._in)) {
                    if (prec > minPrec) {
                        var node = this.startNodeAt(leftStart);
                        node.left = left;
                        node.operator = this.value;
                        var op = this.type;
                        this.next();
                        var start = this.markPosition();
                        node.right = this.parseExprOp(this.parseMaybeUnary(), start, prec, noIn);
                        this.finishNode(node, op === tt.logicalOR || op === tt.logicalAND ? "LogicalExpression" : "BinaryExpression");
                        return this.parseExprOp(node, leftStart, minPrec, noIn);
                    }
                }
                return left;
            };

            // Parse unary operators, both prefix and postfix.

            pp.parseMaybeUnary = function(refShorthandDefaultPos) {
                if (this.type.prefix) {
                    var node = this.startNode(),
                        update = this.type === tt.incDec;
                    node.operator = this.value;
                    node.prefix = true;
                    this.next();
                    node.argument = this.parseMaybeUnary();
                    if (refShorthandDefaultPos && refShorthandDefaultPos.start) this.unexpected(refShorthandDefaultPos.start);
                    if (update) this.checkLVal(node.argument);
                    else if (this.strict && node.operator === "delete" && node.argument.type === "Identifier") this.raise(node.start, "Deleting local variable in strict mode");
                    return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
                }
                var start = this.markPosition();
                var expr = this.parseExprSubscripts(refShorthandDefaultPos);
                if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
                while (this.type.postfix && !this.canInsertSemicolon()) {
                    var node = this.startNodeAt(start);
                    node.operator = this.value;
                    node.prefix = false;
                    node.argument = expr;
                    this.checkLVal(expr);
                    this.next();
                    expr = this.finishNode(node, "UpdateExpression");
                }
                return expr;
            };

            // Parse call, dot, and `[]`-subscript expressions.

            pp.parseExprSubscripts = function(refShorthandDefaultPos) {
                var start = this.markPosition();
                var expr = this.parseExprAtom(refShorthandDefaultPos);
                if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
                return this.parseSubscripts(expr, start);
            };

            pp.parseSubscripts = function(base, start, noCalls) {
                if (this.eat(tt.dot)) {
                    var node = this.startNodeAt(start);
                    node.object = base;
                    node.property = this.parseIdent(true);
                    node.computed = false;
                    return this.parseSubscripts(this.finishNode(node, "MemberExpression"), start, noCalls);
                }
                else if (this.eat(tt.bracketL)) {
                    var node = this.startNodeAt(start);
                    node.object = base;
                    node.property = this.parseExpression();
                    node.computed = true;
                    this.expect(tt.bracketR);
                    return this.parseSubscripts(this.finishNode(node, "MemberExpression"), start, noCalls);
                }
                else if (!noCalls && this.eat(tt.parenL)) {
                    var node = this.startNodeAt(start);
                    node.callee = base;
                    node.arguments = this.parseExprList(tt.parenR, false);
                    return this.parseSubscripts(this.finishNode(node, "CallExpression"), start, noCalls);
                }
                else if (this.type === tt.backQuote) {
                    var node = this.startNodeAt(start);
                    node.tag = base;
                    node.quasi = this.parseTemplate();
                    return this.parseSubscripts(this.finishNode(node, "TaggedTemplateExpression"), start, noCalls);
                }
                return base;
            };

            // Parse an atomic expression — either a single token that is an
            // expression, an expression started by a keyword like `function` or
            // `new`, or an expression wrapped in punctuation like `()`, `[]`,
            // or `{}`.

            pp.parseExprAtom = function(refShorthandDefaultPos) {
                var node = undefined;
                switch (this.type) {
                case tt._this:
                case tt._super:
                    var type = this.type === tt._this ? "ThisExpression" : "Super";
                    node = this.startNode();
                    this.next();
                    return this.finishNode(node, type);

                case tt._yield:
                    if (this.inGenerator) this.unexpected();

                case tt.name:
                    var start = this.markPosition();
                    var id = this.parseIdent(this.type !== tt.name);
                    if (!this.canInsertSemicolon() && this.eat(tt.arrow)) {
                        return this.parseArrowExpression(this.startNodeAt(start), [id]);
                    }
                    return id;

                case tt.regexp:
                    var value = this.value;
                    node = this.parseLiteral(value.value);
                    node.regex = {
                        pattern: value.pattern,
                        flags: value.flags
                    };
                    return node;

                case tt.num:
                case tt.string:
                    return this.parseLiteral(this.value);

                case tt._null:
                case tt._true:
                case tt._false:
                    node = this.startNode();
                    node.value = this.type === tt._null ? null : this.type === tt._true;
                    node.raw = this.type.keyword;
                    this.next();
                    return this.finishNode(node, "Literal");

                case tt.parenL:
                    return this.parseParenAndDistinguishExpression();

                case tt.bracketL:
                    node = this.startNode();
                    this.next();
                    // check whether this is array comprehension or regular array
                    if (this.options.ecmaVersion >= 7 && this.type === tt._for) {
                        return this.parseComprehension(node, false);
                    }
                    node.elements = this.parseExprList(tt.bracketR, true, true, refShorthandDefaultPos);
                    return this.finishNode(node, "ArrayExpression");

                case tt.braceL:
                    return this.parseObj(false, refShorthandDefaultPos);

                case tt._function:
                    node = this.startNode();
                    this.next();
                    return this.parseFunction(node, false);

                case tt._class:
                    return this.parseClass(this.startNode(), false);

                case tt._new:
                    return this.parseNew();

                case tt.backQuote:
                    return this.parseTemplate();

                default:
                    this.unexpected();
                }
            };

            pp.parseLiteral = function(value) {
                var node = this.startNode();
                node.value = value;
                node.raw = this.input.slice(this.start, this.end);
                this.next();
                return this.finishNode(node, "Literal");
            };

            pp.parseParenExpression = function() {
                this.expect(tt.parenL);
                var val = this.parseExpression();
                this.expect(tt.parenR);
                return val;
            };

            pp.parseParenAndDistinguishExpression = function() {
                var start = this.markPosition(),
                    val = undefined;
                if (this.options.ecmaVersion >= 6) {
                    this.next();

                    if (this.options.ecmaVersion >= 7 && this.type === tt._for) {
                        return this.parseComprehension(this.startNodeAt(start), true);
                    }

                    var innerStart = this.markPosition(),
                        exprList = [],
                        first = true;
                    var refShorthandDefaultPos = {
                        start: 0
                    },
                    spreadStart = undefined,
                        innerParenStart = undefined;
                    while (this.type !== tt.parenR) {
                        first ? first = false : this.expect(tt.comma);
                        if (this.type === tt.ellipsis) {
                            spreadStart = this.start;
                            exprList.push(this.parseRest());
                            break;
                        }
                        else {
                            if (this.type === tt.parenL && !innerParenStart) {
                                innerParenStart = this.start;
                            }
                            exprList.push(this.parseMaybeAssign(false, refShorthandDefaultPos));
                        }
                    }
                    var innerEnd = this.markPosition();
                    this.expect(tt.parenR);

                    if (!this.canInsertSemicolon() && this.eat(tt.arrow)) {
                        if (innerParenStart) this.unexpected(innerParenStart);
                        return this.parseArrowExpression(this.startNodeAt(start), exprList);
                    }

                    if (!exprList.length) this.unexpected(this.lastTokStart);
                    if (spreadStart) this.unexpected(spreadStart);
                    if (refShorthandDefaultPos.start) this.unexpected(refShorthandDefaultPos.start);

                    if (exprList.length > 1) {
                        val = this.startNodeAt(innerStart);
                        val.expressions = exprList;
                        this.finishNodeAt(val, "SequenceExpression", innerEnd);
                    }
                    else {
                        val = exprList[0];
                    }
                }
                else {
                    val = this.parseParenExpression();
                }

                if (this.options.preserveParens) {
                    var par = this.startNodeAt(start);
                    par.expression = val;
                    return this.finishNode(par, "ParenthesizedExpression");
                }
                else {
                    return val;
                }
            };

            // New's precedence is slightly tricky. It must allow its argument
            // to be a `[]` or dot subscript expression, but not a call — at
            // least, not without wrapping it in parentheses. Thus, it uses the

            var empty = [];

            pp.parseNew = function() {
                var node = this.startNode();
                var meta = this.parseIdent(true);
                if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
                    node.meta = meta;
                    node.property = this.parseIdent(true);
                    if (node.property.name !== "target") this.raise(node.property.start, "The only valid meta property for new is new.target");
                    return this.finishNode(node, "MetaProperty");
                }
                var start = this.markPosition();
                node.callee = this.parseSubscripts(this.parseExprAtom(), start, true);
                if (this.eat(tt.parenL)) node.arguments = this.parseExprList(tt.parenR, false);
                else node.arguments = empty;
                return this.finishNode(node, "NewExpression");
            };

            // Parse template expression.

            pp.parseTemplateElement = function() {
                var elem = this.startNode();
                elem.value = {
                    raw: this.input.slice(this.start, this.end),
                    cooked: this.value
                };
                this.next();
                elem.tail = this.type === tt.backQuote;
                return this.finishNode(elem, "TemplateElement");
            };

            pp.parseTemplate = function() {
                var node = this.startNode();
                this.next();
                node.expressions = [];
                var curElt = this.parseTemplateElement();
                node.quasis = [curElt];
                while (!curElt.tail) {
                    this.expect(tt.dollarBraceL);
                    node.expressions.push(this.parseExpression());
                    this.expect(tt.braceR);
                    node.quasis.push(curElt = this.parseTemplateElement());
                }
                this.next();
                return this.finishNode(node, "TemplateLiteral");
            };

            // Parse an object literal or binding pattern.

            pp.parseObj = function(isPattern, refShorthandDefaultPos) {
                var node = this.startNode(),
                    first = true,
                    propHash = {};
                node.properties = [];
                this.next();
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR)) break;
                    }
                    else first = false;

                    var prop = this.startNode(),
                        isGenerator = undefined,
                        start = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        prop.method = false;
                        prop.shorthand = false;
                        if (isPattern || refShorthandDefaultPos) start = this.markPosition();
                        if (!isPattern) isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(prop);
                    if (this.eat(tt.colon)) {
                        prop.value = isPattern ? this.parseMaybeDefault() : this.parseMaybeAssign(false, refShorthandDefaultPos);
                        prop.kind = "init";
                    }
                    else if (this.options.ecmaVersion >= 6 && this.type === tt.parenL) {
                        if (isPattern) this.unexpected();
                        prop.kind = "init";
                        prop.method = true;
                        prop.value = this.parseMethod(isGenerator);
                    }
                    else if (this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type != tt.comma && this.type != tt.braceR)) {
                        if (isGenerator || isPattern) this.unexpected();
                        prop.kind = prop.key.name;
                        this.parsePropertyName(prop);
                        prop.value = this.parseMethod(false);
                    }
                    else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
                        prop.kind = "init";
                        if (isPattern) {
                            if (this.isKeyword(prop.key.name) || this.strict && (reservedWords.strictBind(prop.key.name) || reservedWords.strict(prop.key.name)) || !this.options.allowReserved && this.isReservedWord(prop.key.name)) this.raise(prop.key.start, "Binding " + prop.key.name);
                            prop.value = this.parseMaybeDefault(start, prop.key);
                        }
                        else if (this.type === tt.eq && refShorthandDefaultPos) {
                            if (!refShorthandDefaultPos.start) refShorthandDefaultPos.start = this.start;
                            prop.value = this.parseMaybeDefault(start, prop.key);
                        }
                        else {
                            prop.value = prop.key;
                        }
                        prop.shorthand = true;
                    }
                    else this.unexpected();

                    this.checkPropClash(prop, propHash);
                    node.properties.push(this.finishNode(prop, "Property"));
                }
                return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
            };

            pp.parsePropertyName = function(prop) {
                if (this.options.ecmaVersion >= 6) {
                    if (this.eat(tt.bracketL)) {
                        prop.computed = true;
                        prop.key = this.parseMaybeAssign();
                        this.expect(tt.bracketR);
                        return;
                    }
                    else {
                        prop.computed = false;
                    }
                }
                prop.key = this.type === tt.num || this.type === tt.string ? this.parseExprAtom() : this.parseIdent(true);
            };

            // Initialize empty function node.

            pp.initFunction = function(node) {
                node.id = null;
                if (this.options.ecmaVersion >= 6) {
                    node.generator = false;
                    node.expression = false;
                }
            };

            // Parse object or class method.

            pp.parseMethod = function(isGenerator) {
                var node = this.startNode();
                this.initFunction(node);
                this.expect(tt.parenL);
                node.params = this.parseBindingList(tt.parenR, false, false);
                var allowExpressionBody = undefined;
                if (this.options.ecmaVersion >= 6) {
                    node.generator = isGenerator;
                    allowExpressionBody = true;
                }
                else {
                    allowExpressionBody = false;
                }
                this.parseFunctionBody(node, allowExpressionBody);
                return this.finishNode(node, "FunctionExpression");
            };

            // Parse arrow function expression with given parameters.

            pp.parseArrowExpression = function(node, params) {
                this.initFunction(node);
                node.params = this.toAssignableList(params, true);
                this.parseFunctionBody(node, true);
                return this.finishNode(node, "ArrowFunctionExpression");
            };

            // Parse function body and check parameters.

            pp.parseFunctionBody = function(node, allowExpression) {
                var isExpression = allowExpression && this.type !== tt.braceL;

                if (isExpression) {
                    node.body = this.parseMaybeAssign();
                    node.expression = true;
                }
                else {
                    // Start a new scope with regard to labels and the `inFunction`
                    // flag (restore them to their old value afterwards).
                    var oldInFunc = this.inFunction,
                        oldInGen = this.inGenerator,
                        oldLabels = this.labels;
                    this.inFunction = true;
                    this.inGenerator = node.generator;
                    this.labels = [];
                    node.body = this.parseBlock(true);
                    node.expression = false;
                    this.inFunction = oldInFunc;
                    this.inGenerator = oldInGen;
                    this.labels = oldLabels;
                }

                // If this is a strict mode function, verify that argument names
                // are not repeated, and it does not try to bind the words `eval`
                // or `arguments`.
                if (this.strict || !isExpression && node.body.body.length && this.isUseStrict(node.body.body[0])) {
                    var nameHash = {},
                    oldStrict = this.strict;
                    this.strict = true;
                    if (node.id) this.checkLVal(node.id, true);
                    for (var i = 0; i < node.params.length; i++) {
                        this.checkLVal(node.params[i], true, nameHash);
                    }
                    this.strict = oldStrict;
                }
            };

            // Parses a comma-separated list of expressions, and returns them as
            // an array. `close` is the token type that ends the list, and
            // `allowEmpty` can be turned on to allow subsequent commas with
            // nothing in between them to be parsed as `null` (which is needed
            // for array literals).

            pp.parseExprList = function(close, allowTrailingComma, allowEmpty, refShorthandDefaultPos) {
                var elts = [],
                    first = true;
                while (!this.eat(close)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (allowTrailingComma && this.afterTrailingComma(close)) break;
                    }
                    else first = false;

                    if (allowEmpty && this.type === tt.comma) {
                        elts.push(null);
                    }
                    else {
                        if (this.type === tt.ellipsis) elts.push(this.parseSpread(refShorthandDefaultPos));
                        else elts.push(this.parseMaybeAssign(false, refShorthandDefaultPos));
                    }
                }
                return elts;
            };

            // Parse the next token as an identifier. If `liberal` is true (used
            // when parsing properties), it will also convert keywords into
            // identifiers.

            pp.parseIdent = function(liberal) {
                var node = this.startNode();
                if (liberal && this.options.allowReserved == "never") liberal = false;
                if (this.type === tt.name) {
                    if (!liberal && (!this.options.allowReserved && this.isReservedWord(this.value) || this.strict && reservedWords.strict(this.value) && (this.options.ecmaVersion >= 6 || this.input.slice(this.start, this.end).indexOf("\\") == -1))) this.raise(this.start, "The keyword '" + this.value + "' is reserved");
                    node.name = this.value;
                }
                else if (liberal && this.type.keyword) {
                    node.name = this.type.keyword;
                }
                else {
                    this.unexpected();
                }
                this.next();
                return this.finishNode(node, "Identifier");
            };

            // Parses yield expression inside generator.

            pp.parseYield = function() {
                var node = this.startNode();
                this.next();
                if (this.type == tt.semi || this.canInsertSemicolon() || this.type != tt.star && !this.type.startsExpr) {
                    node.delegate = false;
                    node.argument = null;
                }
                else {
                    node.delegate = this.eat(tt.star);
                    node.argument = this.parseMaybeAssign();
                }
                return this.finishNode(node, "YieldExpression");
            };

            // Parses array and generator comprehensions.

            pp.parseComprehension = function(node, isGenerator) {
                node.blocks = [];
                while (this.type === tt._for) {
                    var block = this.startNode();
                    this.next();
                    this.expect(tt.parenL);
                    block.left = this.parseBindingAtom();
                    this.checkLVal(block.left, true);
                    this.expectContextual("of");
                    block.right = this.parseExpression();
                    this.expect(tt.parenR);
                    node.blocks.push(this.finishNode(block, "ComprehensionBlock"));
                }
                node.filter = this.eat(tt._if) ? this.parseParenExpression() : null;
                node.body = this.parseExpression();
                this.expect(isGenerator ? tt.parenR : tt.bracketR);
                node.generator = isGenerator;
                return this.finishNode(node, "ComprehensionExpression");
            };

        }, {
            "./identifier": 3,
            "./state": 9,
            "./tokentype": 13,
            "./util": 14
        }],
        3: [function(_dereq_, module, exports) {


            // Test whether a given character code starts an identifier.

            "use strict";

            exports.isIdentifierStart = isIdentifierStart;

            // Test whether a given character is part of an identifier.

            exports.isIdentifierChar = isIdentifierChar;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // This is a trick taken from Esprima. It turns out that, on
            // non-Chrome browsers, to check whether a string is in a set, a
            // predicate containing a big ugly `switch` statement is faster than
            // a regular expression, and on Chrome the two are about on par.
            // This function uses `eval` (non-lexical) to produce such a
            // predicate from a space-separated string of words.
            //
            // It starts by sorting the words by length.

            // Removed to create an eval-free library

            // Reserved word lists for various dialects of the language

            var reservedWords = {
                3: function anonymous(str) {
                    switch (str.length) {
                    case 6:
                        switch (str) {
                        case "double":
                        case "export":
                        case "import":
                        case "native":
                        case "public":
                        case "static":
                        case "throws":
                            return true
                        }
                        return false;
                    case 4:
                        switch (str) {
                        case "byte":
                        case "char":
                        case "enum":
                        case "goto":
                        case "long":
                            return true
                        }
                        return false;
                    case 5:
                        switch (str) {
                        case "class":
                        case "final":
                        case "float":
                        case "short":
                        case "super":
                            return true
                        }
                        return false;
                    case 7:
                        switch (str) {
                        case "boolean":
                        case "extends":
                        case "package":
                        case "private":
                            return true
                        }
                        return false;
                    case 9:
                        switch (str) {
                        case "interface":
                        case "protected":
                        case "transient":
                            return true
                        }
                        return false;
                    case 8:
                        switch (str) {
                        case "abstract":
                        case "volatile":
                            return true
                        }
                        return false;
                    case 10:
                        return str === "implements";
                    case 3:
                        return str === "int";
                    case 12:
                        return str === "synchronized";
                    }
                },
                5: function anonymous(str) {
                    switch (str.length) {
                    case 5:
                        switch (str) {
                        case "class":
                        case "super":
                        case "const":
                            return true
                        }
                        return false;
                    case 6:
                        switch (str) {
                        case "export":
                        case "import":
                            return true
                        }
                        return false;
                    case 4:
                        return str === "enum";
                    case 7:
                        return str === "extends";
                    }
                },
                6: function anonymous(str) {
                    switch (str) {
                    case "enum":
                    case "await":
                        return true
                    }
                    return false;
                },
                strict: function anonymous(str) {
                    switch (str.length) {
                    case 9:
                        switch (str) {
                        case "interface":
                        case "protected":
                            return true
                        }
                        return false;
                    case 7:
                        switch (str) {
                        case "package":
                        case "private":
                            return true
                        }
                        return false;
                    case 6:
                        switch (str) {
                        case "public":
                        case "static":
                            return true
                        }
                        return false;
                    case 10:
                        return str === "implements";
                    case 3:
                        return str === "let";
                    case 5:
                        return str === "yield";
                    }
                },
                strictBind: function anonymous(str) {
                    switch (str) {
                    case "eval":
                    case "arguments":
                        return true
                    }
                    return false;
                }
            };

            exports.reservedWords = reservedWords;
            // And the keywords

            var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";

            var keywords = {
                5: function anonymous(str) {
                    switch (str.length) {
                    case 4:
                        switch (str) {
                        case "case":
                        case "else":
                        case "with":
                        case "null":
                        case "true":
                        case "void":
                        case "this":
                            return true
                        }
                        return false;
                    case 5:
                        switch (str) {
                        case "break":
                        case "catch":
                        case "throw":
                        case "while":
                        case "false":
                            return true
                        }
                        return false;
                    case 3:
                        switch (str) {
                        case "for":
                        case "try":
                        case "var":
                        case "new":
                            return true
                        }
                        return false;
                    case 6:
                        switch (str) {
                        case "return":
                        case "switch":
                        case "typeof":
                        case "delete":
                            return true
                        }
                        return false;
                    case 8:
                        switch (str) {
                        case "continue":
                        case "debugger":
                        case "function":
                            return true
                        }
                        return false;
                    case 2:
                        switch (str) {
                        case "do":
                        case "if":
                        case "in":
                            return true
                        }
                        return false;
                    case 7:
                        switch (str) {
                        case "default":
                        case "finally":
                            return true
                        }
                        return false;
                    case 10:
                        return str === "instanceof";
                    }
                },
                6: function anonymous(str) {
                    switch (str.length) {
                    case 5:
                        switch (str) {
                        case "break":
                        case "catch":
                        case "throw":
                        case "while":
                        case "false":
                        case "const":
                        case "class":
                        case "yield":
                        case "super":
                            return true
                        }
                        return false;
                    case 4:
                        switch (str) {
                        case "case":
                        case "else":
                        case "with":
                        case "null":
                        case "true":
                        case "void":
                        case "this":
                            return true
                        }
                        return false;
                    case 6:
                        switch (str) {
                        case "return":
                        case "switch":
                        case "typeof":
                        case "delete":
                        case "export":
                        case "import":
                            return true
                        }
                        return false;
                    case 3:
                        switch (str) {
                        case "for":
                        case "try":
                        case "var":
                        case "new":
                        case "let":
                            return true
                        }
                        return false;
                    case 8:
                        switch (str) {
                        case "continue":
                        case "debugger":
                        case "function":
                            return true
                        }
                        return false;
                    case 7:
                        switch (str) {
                        case "default":
                        case "finally":
                        case "extends":
                            return true
                        }
                        return false;
                    case 2:
                        switch (str) {
                        case "do":
                        case "if":
                        case "in":
                            return true
                        }
                        return false;
                    case 10:
                        return str === "instanceof";
                    }
                }
            };

            exports.keywords = keywords;
            // ## Character categories

            // Big ugly regular expressions that match characters in the
            // whitespace, identifier, and identifier-start categories. These
            // are only applied when a character is found to actually have a
            // code point above 128.
            // Generated by `tools/generate-identifier-regex.js`.

            var nonASCIIidentifierStartChars = "ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠ-ࢲऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ℘-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ゛-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞭꞰꞱꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭟꭤꭥꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ";
            var nonASCIIidentifierChars = "‌‍·̀-ͯ·҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࣤ-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ଁ-ଃ଼ା-ୄେୈୋ-୍ୖୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఃా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ഁ-ഃാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ංඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ູົຼ່-ໍ໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟፩-፱ᜒ-᜔ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠐-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏ᦰ-ᧀᧈᧉ᧐-᧚ᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭ᳲ-᳴᳸᳹᷀-᷵᷼-᷿‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯꘠-꘩꙯ꙴ-꙽ꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧꢀꢁꢴ-꣄꣐-꣙꣠-꣱꤀-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-︭︳︴﹍-﹏０-９＿";

            var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
            var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

            nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;

            // These are a run-length and offset encoded representation of the
            // >0xffff code points that are a valid part of identifiers. The
            // offset starts at 0x10000, and each pair of numbers represents an
            // offset to the next range, and then a size of the range. They were
            // generated by tools/generate-identifier-regex.js
            var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 17, 26, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 99, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 98, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 26, 45, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 955, 52, 76, 44, 33, 24, 27, 35, 42, 34, 4, 0, 13, 47, 15, 3, 22, 0, 38, 17, 2, 24, 133, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 32, 4, 287, 47, 21, 1, 2, 0, 185, 46, 82, 47, 21, 0, 60, 42, 502, 63, 32, 0, 449, 56, 1288, 920, 104, 110, 2962, 1070, 13266, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 881, 68, 12, 0, 67, 12, 16481, 1, 3071, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 4149, 196, 1340, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42710, 42, 4148, 12, 221, 16355, 541];
            var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 1306, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 52, 0, 13, 2, 49, 13, 16, 9, 83, 11, 168, 11, 6, 9, 8, 2, 57, 0, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 316, 19, 13, 9, 214, 6, 3, 8, 112, 16, 16, 9, 82, 12, 9, 9, 535, 9, 20855, 9, 135, 4, 60, 6, 26, 9, 1016, 45, 17, 3, 19723, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 4305, 6, 792618, 239];

            // This has a complexity linear to the value of the code. The
            // assumption is that looking up astral identifier characters is
            // rare.
            function isInAstralSet(code, set) {
                var pos = 65536;
                for (var i = 0; i < set.length; i += 2) {
                    pos += set[i];
                    if (pos > code) {
                        return false;
                    }
                    pos += set[i + 1];
                    if (pos >= code) {
                        return true;
                    }
                }
            }

            function isIdentifierStart(code, astral) {
                if (code < 65) {
                    return code === 36;
                }
                if (code < 91) {
                    return true;
                }
                if (code < 97) {
                    return code === 95;
                }
                if (code < 123) {
                    return true;
                }
                if (code <= 65535) {
                    return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
                }
                if (astral === false) {
                    return false;
                }
                return isInAstralSet(code, astralIdentifierStartCodes);
            }

            function isIdentifierChar(code, astral) {
                if (code < 48) {
                    return code === 36;
                }
                if (code < 58) {
                    return true;
                }
                if (code < 65) {
                    return false;
                }
                if (code < 91) {
                    return true;
                }
                if (code < 97) {
                    return code === 95;
                }
                if (code < 123) {
                    return true;
                }
                if (code <= 65535) {
                    return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
                }
                if (astral === false) {
                    return false;
                }
                return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
            }

        }, {}],
        4: [function(_dereq_, module, exports) {
            "use strict";

            var _createClass = (function() {
                function defineProperties(target, props) {
                    for (var key in props) {
                        var prop = props[key];
                        prop.configurable = true;
                        if (prop.value) prop.writable = true;
                    }
                    Object.defineProperties(target, props);
                }
                return function(Constructor, protoProps, staticProps) {
                    if (protoProps) defineProperties(Constructor.prototype, protoProps);
                    if (staticProps) defineProperties(Constructor, staticProps);
                    return Constructor;
                };
            })();

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            // The `getLineInfo` function is mostly useful when the
            // `locations` option is off (for performance reasons) and you
            // want to find the line/column position for a given character
            // offset. `input` should be the code string that the offset refers
            // into.

            exports.getLineInfo = getLineInfo;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var Parser = _dereq_("./state").Parser;

            var lineBreakG = _dereq_("./whitespace").lineBreakG;

            // These are used when `options.locations` is on, for the
            // `startLoc` and `endLoc` properties.

            var Position = exports.Position = (function() {
                function Position(line, col) {
                    _classCallCheck(this, Position);

                    this.line = line;
                    this.column = col;
                }

                _createClass(Position, {
                    offset: {
                        value: function offset(n) {
                            return new Position(this.line, this.column + n);
                        }
                    }
                });

                return Position;
            })();

            var SourceLocation = exports.SourceLocation = function SourceLocation(p, start, end) {
                _classCallCheck(this, SourceLocation);

                this.start = start;
                this.end = end;
                if (p.sourceFile !== null) this.source = p.sourceFile;
            };

            function getLineInfo(input, offset) {
                for (var line = 1, cur = 0;;) {
                    lineBreakG.lastIndex = cur;
                    var match = lineBreakG.exec(input);
                    if (match && match.index < offset) {
                        ++line;
                        cur = match.index + match[0].length;
                    }
                    else {
                        return new Position(line, offset - cur);
                    }
                }
            }

            var pp = Parser.prototype;

            // This function is used to raise exceptions on parse errors. It
            // takes an offset integer (into the current `input`) to indicate
            // the location of the error, attaches the position to the end
            // of the error message, and then raises a `SyntaxError` with that
            // message.

            pp.raise = function(pos, message) {
                var loc = getLineInfo(this.input, pos);
                message += " (" + loc.line + ":" + loc.column + ")";
                var err = new SyntaxError(message);
                err.pos = pos;
                err.loc = loc;
                err.raisedAt = this.pos;
                throw err;
            };

            pp.curPosition = function() {
                return new Position(this.curLine, this.pos - this.lineStart);
            };

            pp.markPosition = function() {
                return this.options.locations ? [this.start, this.startLoc] : this.start;
            };

        }, {
            "./state": 9,
            "./whitespace": 15
        }],
        5: [function(_dereq_, module, exports) {
            "use strict";

            var tt = _dereq_("./tokentype").types;

            var Parser = _dereq_("./state").Parser;

            var reservedWords = _dereq_("./identifier").reservedWords;

            var has = _dereq_("./util").has;

            var pp = Parser.prototype;

            // Convert existing expression atom to assignable pattern
            // if possible.

            pp.toAssignable = function(node, isBinding) {
                if (this.options.ecmaVersion >= 6 && node) {
                    switch (node.type) {
                    case "Identifier":
                    case "ObjectPattern":
                    case "ArrayPattern":
                    case "AssignmentPattern":
                        break;

                    case "ObjectExpression":
                        node.type = "ObjectPattern";
                        for (var i = 0; i < node.properties.length; i++) {
                            var prop = node.properties[i];
                            if (prop.kind !== "init") this.raise(prop.key.start, "Object pattern can't contain getter or setter");
                            this.toAssignable(prop.value, isBinding);
                        }
                        break;

                    case "ArrayExpression":
                        node.type = "ArrayPattern";
                        this.toAssignableList(node.elements, isBinding);
                        break;

                    case "AssignmentExpression":
                        if (node.operator === "=") {
                            node.type = "AssignmentPattern";
                        }
                        else {
                            this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
                        }
                        break;

                    case "MemberExpression":
                        if (!isBinding) break;

                    default:
                        this.raise(node.start, "Assigning to rvalue");
                    }
                }
                return node;
            };

            // Convert list of expression atoms to binding list.

            pp.toAssignableList = function(exprList, isBinding) {
                var end = exprList.length;
                if (end) {
                    var last = exprList[end - 1];
                    if (last && last.type == "RestElement") {
                        --end;
                    }
                    else if (last && last.type == "SpreadElement") {
                        last.type = "RestElement";
                        var arg = last.argument;
                        this.toAssignable(arg, isBinding);
                        if (arg.type !== "Identifier" && arg.type !== "MemberExpression" && arg.type !== "ArrayPattern") this.unexpected(arg.start);
                        --end;
                    }
                }
                for (var i = 0; i < end; i++) {
                    var elt = exprList[i];
                    if (elt) this.toAssignable(elt, isBinding);
                }
                return exprList;
            };

            // Parses spread element.

            pp.parseSpread = function(refShorthandDefaultPos) {
                var node = this.startNode();
                this.next();
                node.argument = this.parseMaybeAssign(refShorthandDefaultPos);
                return this.finishNode(node, "SpreadElement");
            };

            pp.parseRest = function() {
                var node = this.startNode();
                this.next();
                node.argument = this.type === tt.name || this.type === tt.bracketL ? this.parseBindingAtom() : this.unexpected();
                return this.finishNode(node, "RestElement");
            };

            // Parses lvalue (assignable) atom.

            pp.parseBindingAtom = function() {
                if (this.options.ecmaVersion < 6) return this.parseIdent();
                switch (this.type) {
                case tt.name:
                    return this.parseIdent();

                case tt.bracketL:
                    var node = this.startNode();
                    this.next();
                    node.elements = this.parseBindingList(tt.bracketR, true, true);
                    return this.finishNode(node, "ArrayPattern");

                case tt.braceL:
                    return this.parseObj(true);

                default:
                    this.unexpected();
                }
            };

            pp.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
                var elts = [],
                    first = true;
                while (!this.eat(close)) {
                    if (first) first = false;
                    else this.expect(tt.comma);
                    if (allowEmpty && this.type === tt.comma) {
                        elts.push(null);
                    }
                    else if (allowTrailingComma && this.afterTrailingComma(close)) {
                        break;
                    }
                    else if (this.type === tt.ellipsis) {
                        elts.push(this.parseRest());
                        this.expect(close);
                        break;
                    }
                    else {
                        elts.push(this.parseMaybeDefault());
                    }
                }
                return elts;
            };

            // Parses assignment pattern around given atom if possible.

            pp.parseMaybeDefault = function(startPos, left) {
                startPos = startPos || this.markPosition();
                left = left || this.parseBindingAtom();
                if (!this.eat(tt.eq)) return left;
                var node = this.startNodeAt(startPos);
                node.operator = "=";
                node.left = left;
                node.right = this.parseMaybeAssign();
                return this.finishNode(node, "AssignmentPattern");
            };

            // Verify that a node is an lval — something that can be assigned
            // to.

            pp.checkLVal = function(expr, isBinding, checkClashes) {
                switch (expr.type) {
                case "Identifier":
                    if (this.strict && (reservedWords.strictBind(expr.name) || reservedWords.strict(expr.name))) this.raise(expr.start, (isBinding ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
                    if (checkClashes) {
                        if (has(checkClashes, expr.name)) this.raise(expr.start, "Argument name clash in strict mode");
                        checkClashes[expr.name] = true;
                    }
                    break;

                case "MemberExpression":
                    if (isBinding) this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " member expression");
                    break;

                case "ObjectPattern":
                    for (var i = 0; i < expr.properties.length; i++) {
                        this.checkLVal(expr.properties[i].value, isBinding, checkClashes);
                    }
                    break;

                case "ArrayPattern":
                    for (var i = 0; i < expr.elements.length; i++) {
                        var elem = expr.elements[i];
                        if (elem) this.checkLVal(elem, isBinding, checkClashes);
                    }
                    break;

                case "AssignmentPattern":
                    this.checkLVal(expr.left, isBinding, checkClashes);
                    break;

                case "RestElement":
                    this.checkLVal(expr.argument, isBinding, checkClashes);
                    break;

                default:
                    this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " rvalue");
                }
            };

        }, {
            "./identifier": 3,
            "./state": 9,
            "./tokentype": 13,
            "./util": 14
        }],
        6: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var Parser = _dereq_("./state").Parser;

            var SourceLocation = _dereq_("./location").SourceLocation;

            // Start an AST node, attaching a start offset.

            var pp = Parser.prototype;

            var Node = exports.Node = function Node() {
                _classCallCheck(this, Node);
            };

            pp.startNode = function() {
                var node = new Node();
                node.start = this.start;
                if (this.options.locations) node.loc = new SourceLocation(this, this.startLoc);
                if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
                if (this.options.ranges) node.range = [this.start, 0];
                return node;
            };

            pp.startNodeAt = function(pos) {
                var node = new Node(),
                    start = pos;
                if (this.options.locations) {
                    node.loc = new SourceLocation(this, start[1]);
                    start = pos[0];
                }
                node.start = start;
                if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
                if (this.options.ranges) node.range = [start, 0];
                return node;
            };

            // Finish an AST node, adding `type` and `end` properties.

            pp.finishNode = function(node, type) {
                node.type = type;
                node.end = this.lastTokEnd;
                if (this.options.locations) node.loc.end = this.lastTokEndLoc;
                if (this.options.ranges) node.range[1] = this.lastTokEnd;
                return node;
            };

            // Finish node at given position

            pp.finishNodeAt = function(node, type, pos) {
                if (this.options.locations) {
                    node.loc.end = pos[1];
                    pos = pos[0];
                }
                node.type = type;
                node.end = pos;
                if (this.options.ranges) node.range[1] = pos;
                return node;
            };

        }, {
            "./location": 4,
            "./state": 9
        }],
        7: [function(_dereq_, module, exports) {


            // Interpret and default an options object

            "use strict";

            exports.getOptions = getOptions;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var _util = _dereq_("./util");

            var has = _util.has;
            var isArray = _util.isArray;

            var SourceLocation = _dereq_("./location").SourceLocation;

            // A second optional argument can be given to further configure
            // the parser process. These options are recognized:

            var defaultOptions = {
                // `ecmaVersion` indicates the ECMAScript version to parse. Must
                // be either 3, or 5, or 6. This influences support for strict
                // mode, the set of reserved words, support for getters and
                // setters and other features.
                ecmaVersion: 5,
                // Source type ("script" or "module") for different semantics
                sourceType: "script",
                // `onInsertedSemicolon` can be a callback that will be called
                // when a semicolon is automatically inserted. It will be passed
                // th position of the comma as an offset, and if `locations` is
                // enabled, it is given the location as a `{line, column}` object
                // as second argument.
                onInsertedSemicolon: null,
                // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
                // trailing commas.
                onTrailingComma: null,
                // By default, reserved words are not enforced. Disable
                // `allowReserved` to enforce them. When this option has the
                // value "never", reserved words and keywords can also not be
                // used as property names.
                allowReserved: true,
                // When enabled, a return at the top level is not considered an
                // error.
                allowReturnOutsideFunction: false,
                // When enabled, import/export statements are not constrained to
                // appearing at the top of the program.
                allowImportExportEverywhere: false,
                // When enabled, hashbang directive in the beginning of file
                // is allowed and treated as a line comment.
                allowHashBang: false,
                // When `locations` is on, `loc` properties holding objects with
                // `start` and `end` properties in `{line, column}` form (with
                // line being 1-based and column 0-based) will be attached to the
                // nodes.
                locations: false,
                // A function can be passed as `onToken` option, which will
                // cause Acorn to call that function with object in the same
                // format as tokenize() returns. Note that you are not
                // allowed to call the parser from the callback—that will
                // corrupt its internal state.
                onToken: null,
                // A function can be passed as `onComment` option, which will
                // cause Acorn to call that function with `(block, text, start,
                // end)` parameters whenever a comment is skipped. `block` is a
                // boolean indicating whether this is a block (`/* */`) comment,
                // `text` is the content of the comment, and `start` and `end` are
                // character offsets that denote the start and end of the comment.
                // When the `locations` option is on, two more parameters are
                // passed, the full `{line, column}` locations of the start and
                // end of the comments. Note that you are not allowed to call the
                // parser from the callback—that will corrupt its internal state.
                onComment: null,
                // Nodes have their start and end characters offsets recorded in
                // `start` and `end` properties (directly on the node, rather than
                // the `loc` object, which holds line/column data. To also add a
                // [semi-standardized][range] `range` property holding a `[start,
                // end]` array with the same numbers, set the `ranges` option to
                // `true`.
                //
                // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
                ranges: false,
                // It is possible to parse multiple files into a single AST by
                // passing the tree produced by parsing the first file as
                // `program` option in subsequent parses. This will add the
                // toplevel forms of the parsed file to the `Program` (top) node
                // of an existing parse tree.
                program: null,
                // When `locations` is on, you can pass this to record the source
                // file in every node's `loc` object.
                sourceFile: null,
                // This value, if given, is stored in every node, whether
                // `locations` is on or off.
                directSourceFile: null,
                // When enabled, parenthesized expressions are represented by
                // (non-standard) ParenthesizedExpression nodes
                preserveParens: false,
                plugins: {}
            };
            exports.defaultOptions = defaultOptions;

            function getOptions(opts) {
                var options = {};
                for (var opt in defaultOptions) {
                    options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt];
                }
                if (isArray(options.onToken)) {
                    (function() {
                        var tokens = options.onToken;
                        options.onToken = function(token) {
                            return tokens.push(token);
                        };
                    })();
                }
                if (isArray(options.onComment)) options.onComment = pushComment(options, options.onComment);

                return options;
            }

            function pushComment(options, array) {
                return function(block, text, start, end, startLoc, endLoc) {
                    var comment = {
                        type: block ? "Block" : "Line",
                        value: text,
                        start: start,
                        end: end
                    };
                    if (options.locations) comment.loc = new SourceLocation(this, startLoc, endLoc);
                    if (options.ranges) comment.range = [start, end];
                    array.push(comment);
                };
            }

        }, {
            "./location": 4,
            "./util": 14
        }],
        8: [function(_dereq_, module, exports) {
            "use strict";

            var tt = _dereq_("./tokentype").types;

            var Parser = _dereq_("./state").Parser;

            var lineBreak = _dereq_("./whitespace").lineBreak;

            var pp = Parser.prototype;

            // ## Parser utilities

            // Test whether a statement node is the string literal `"use strict"`.

            pp.isUseStrict = function(stmt) {
                return this.options.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && stmt.expression.value === "use strict";
            };

            // Predicate that tests whether the next token is of the given
            // type, and if yes, consumes it as a side effect.

            pp.eat = function(type) {
                if (this.type === type) {
                    this.next();
                    return true;
                }
                else {
                    return false;
                }
            };

            // Tests whether parsed token is a contextual keyword.

            pp.isContextual = function(name) {
                return this.type === tt.name && this.value === name;
            };

            // Consumes contextual keyword if possible.

            pp.eatContextual = function(name) {
                return this.value === name && this.eat(tt.name);
            };

            // Asserts that following token is given contextual keyword.

            pp.expectContextual = function(name) {
                if (!this.eatContextual(name)) this.unexpected();
            };

            // Test whether a semicolon can be inserted at the current position.

            pp.canInsertSemicolon = function() {
                return this.type === tt.eof || this.type === tt.braceR || lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
            };

            pp.insertSemicolon = function() {
                if (this.canInsertSemicolon()) {
                    if (this.options.onInsertedSemicolon) this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
                    return true;
                }
            };

            // Consume a semicolon, or, failing that, see if we are allowed to
            // pretend that there is a semicolon at this position.

            pp.semicolon = function() {
                if (!this.eat(tt.semi) && !this.insertSemicolon()) this.unexpected();
            };

            pp.afterTrailingComma = function(tokType) {
                if (this.type == tokType) {
                    if (this.options.onTrailingComma) this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
                    this.next();
                    return true;
                }
            };

            // Expect a token of a given type. If found, consume it, otherwise,
            // raise an unexpected token error.

            pp.expect = function(type) {
                this.eat(type) || this.unexpected();
            };

            // Raise an unexpected token error.

            pp.unexpected = function(pos) {
                this.raise(pos != null ? pos : this.start, "Unexpected token");
            };

        }, {
            "./state": 9,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        9: [function(_dereq_, module, exports) {
            "use strict";

            exports.Parser = Parser;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var _identifier = _dereq_("./identifier");

            var reservedWords = _identifier.reservedWords;
            var keywords = _identifier.keywords;

            var _tokentype = _dereq_("./tokentype");

            var tt = _tokentype.types;
            var lineBreak = _tokentype.lineBreak;

            function Parser(options, input, startPos) {
                this.options = options;
                this.loadPlugins(this.options.plugins);
                this.sourceFile = this.options.sourceFile || null;
                this.isKeyword = keywords[this.options.ecmaVersion >= 6 ? 6 : 5];
                this.isReservedWord = reservedWords[this.options.ecmaVersion];
                this.input = input;

                // Set up token state

                // The current position of the tokenizer in the input.
                if (startPos) {
                    this.pos = startPos;
                    this.lineStart = Math.max(0, this.input.lastIndexOf("\n", startPos));
                    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
                }
                else {
                    this.pos = this.lineStart = 0;
                    this.curLine = 1;
                }

                // Properties of the current token:
                // Its type
                this.type = tt.eof;
                // For tokens that include more information than their type, the value
                this.value = null;
                // Its start and end offset
                this.start = this.end = this.pos;
                // And, if locations are used, the {line, column} object
                // corresponding to those offsets
                this.startLoc = this.endLoc = null;

                // Position information for the previous token
                this.lastTokEndLoc = this.lastTokStartLoc = null;
                this.lastTokStart = this.lastTokEnd = this.pos;

                // The context stack is used to superficially track syntactic
                // context to predict whether a regular expression is allowed in a
                // given position.
                this.context = this.initialContext();
                this.exprAllowed = true;

                // Figure out if it's a module code.
                this.strict = this.inModule = this.options.sourceType === "module";

                // Flags to track whether we are in a function, a generator.
                this.inFunction = this.inGenerator = false;
                // Labels in scope.
                this.labels = [];

                // If enabled, skip leading hashbang line.
                if (this.pos === 0 && this.options.allowHashBang && this.input.slice(0, 2) === "#!") this.skipLineComment(2);
            }

            Parser.prototype.extend = function(name, f) {
                this[name] = f(this[name]);
            };

            // Registered plugins

            var plugins = {};

            exports.plugins = plugins;
            Parser.prototype.loadPlugins = function(plugins) {
                for (var _name in plugins) {
                    var plugin = exports.plugins[_name];
                    if (!plugin) throw new Error("Plugin '" + _name + "' not found");
                    plugin(this, plugins[_name]);
                }
            };

        }, {
            "./identifier": 3,
            "./tokentype": 13
        }],
        10: [function(_dereq_, module, exports) {
            "use strict";

            var tt = _dereq_("./tokentype").types;

            var Parser = _dereq_("./state").Parser;

            var lineBreak = _dereq_("./whitespace").lineBreak;

            var pp = Parser.prototype;

            // ### Statement parsing

            // Parse a program. Initializes the parser, reads any number of
            // statements, and wraps them in a Program node.  Optionally takes a
            // `program` argument.  If present, the statements will be appended
            // to its body instead of creating a new node.

            pp.parseTopLevel = function(node) {
                var first = true;
                if (!node.body) node.body = [];
                while (this.type !== tt.eof) {
                    var stmt = this.parseStatement(true, true);
                    node.body.push(stmt);
                    if (first && this.isUseStrict(stmt)) this.setStrict(true);
                    first = false;
                }
                this.next();
                if (this.options.ecmaVersion >= 6) {
                    node.sourceType = this.options.sourceType;
                }
                return this.finishNode(node, "Program");
            };

            var loopLabel = {
                kind: "loop"
            },
            switchLabel = {
                kind: "switch"
            };

            // Parse a single statement.
            //
            // If expecting a statement and finding a slash operator, parse a
            // regular expression literal. This is to handle cases like
            // `if (foo) /blah/.exec(foo)`, where looking at the previous token
            // does not help.

            pp.parseStatement = function(declaration, topLevel) {
                var starttype = this.type,
                    node = this.startNode();

                // Most types of statements are recognized by the keyword they
                // start with. Many are trivial to parse, some require a bit of
                // complexity.

                switch (starttype) {
                case tt._break:
                case tt._continue:
                    return this.parseBreakContinueStatement(node, starttype.keyword);
                case tt._debugger:
                    return this.parseDebuggerStatement(node);
                case tt._do:
                    return this.parseDoStatement(node);
                case tt._for:
                    return this.parseForStatement(node);
                case tt._function:
                    if (!declaration && this.options.ecmaVersion >= 6) this.unexpected();
                    return this.parseFunctionStatement(node);
                case tt._class:
                    if (!declaration) this.unexpected();
                    return this.parseClass(node, true);
                case tt._if:
                    return this.parseIfStatement(node);
                case tt._return:
                    return this.parseReturnStatement(node);
                case tt._switch:
                    return this.parseSwitchStatement(node);
                case tt._throw:
                    return this.parseThrowStatement(node);
                case tt._try:
                    return this.parseTryStatement(node);
                case tt._let:
                case tt._const:
                    if (!declaration) this.unexpected(); // NOTE: falls through to _var
                case tt._var:
                    return this.parseVarStatement(node, starttype);
                case tt._while:
                    return this.parseWhileStatement(node);
                case tt._with:
                    return this.parseWithStatement(node);
                case tt.braceL:
                    return this.parseBlock();
                case tt.semi:
                    return this.parseEmptyStatement(node);
                case tt._export:
                case tt._import:
                    if (!this.options.allowImportExportEverywhere) {
                        if (!topLevel) this.raise(this.start, "'import' and 'export' may only appear at the top level");
                        if (!this.inModule) this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
                    }
                    return starttype === tt._import ? this.parseImport(node) : this.parseExport(node);

                    // If the statement does not start with a statement keyword or a
                    // brace, it's an ExpressionStatement or LabeledStatement. We
                    // simply start parsing an expression, and afterwards, if the
                    // next token is a colon and the expression was a simple
                    // Identifier node, we switch to interpreting it as a label.
                default:
                    var maybeName = this.value,
                        expr = this.parseExpression();
                    if (starttype === tt.name && expr.type === "Identifier" && this.eat(tt.colon)) return this.parseLabeledStatement(node, maybeName, expr);
                    else return this.parseExpressionStatement(node, expr);
                }
            };

            pp.parseBreakContinueStatement = function(node, keyword) {
                var isBreak = keyword == "break";
                this.next();
                if (this.eat(tt.semi) || this.insertSemicolon()) node.label = null;
                else if (this.type !== tt.name) this.unexpected();
                else {
                    node.label = this.parseIdent();
                    this.semicolon();
                }

                // Verify that there is an actual destination to break or
                // continue to.
                for (var i = 0; i < this.labels.length; ++i) {
                    var lab = this.labels[i];
                    if (node.label == null || lab.name === node.label.name) {
                        if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
                        if (node.label && isBreak) break;
                    }
                }
                if (i === this.labels.length) this.raise(node.start, "Unsyntactic " + keyword);
                return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
            };

            pp.parseDebuggerStatement = function(node) {
                this.next();
                this.semicolon();
                return this.finishNode(node, "DebuggerStatement");
            };

            pp.parseDoStatement = function(node) {
                this.next();
                this.labels.push(loopLabel);
                node.body = this.parseStatement(false);
                this.labels.pop();
                this.expect(tt._while);
                node.test = this.parseParenExpression();
                if (this.options.ecmaVersion >= 6) this.eat(tt.semi);
                else this.semicolon();
                return this.finishNode(node, "DoWhileStatement");
            };

            // Disambiguating between a `for` and a `for`/`in` or `for`/`of`
            // loop is non-trivial. Basically, we have to parse the init `var`
            // statement or expression, disallowing the `in` operator (see
            // the second parameter to `parseExpression`), and then check
            // whether the next token is `in` or `of`. When there is no init
            // part (semicolon immediately after the opening parenthesis), it
            // is a regular `for` loop.

            pp.parseForStatement = function(node) {
                this.next();
                this.labels.push(loopLabel);
                this.expect(tt.parenL);
                if (this.type === tt.semi) return this.parseFor(node, null);
                if (this.type === tt._var || this.type === tt._let || this.type === tt._const) {
                    var _init = this.startNode(),
                        varKind = this.type;
                    this.next();
                    this.parseVar(_init, true, varKind);
                    this.finishNode(_init, "VariableDeclaration");
                    if ((this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && _init.declarations.length === 1 && !(varKind !== tt._var && _init.declarations[0].init)) return this.parseForIn(node, _init);
                    return this.parseFor(node, _init);
                }
                var refShorthandDefaultPos = {
                    start: 0
                };
                var init = this.parseExpression(true, refShorthandDefaultPos);
                if (this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) {
                    this.toAssignable(init);
                    this.checkLVal(init);
                    return this.parseForIn(node, init);
                }
                else if (refShorthandDefaultPos.start) {
                    this.unexpected(refShorthandDefaultPos.start);
                }
                return this.parseFor(node, init);
            };

            pp.parseFunctionStatement = function(node) {
                this.next();
                return this.parseFunction(node, true);
            };

            pp.parseIfStatement = function(node) {
                this.next();
                node.test = this.parseParenExpression();
                node.consequent = this.parseStatement(false);
                node.alternate = this.eat(tt._else) ? this.parseStatement(false) : null;
                return this.finishNode(node, "IfStatement");
            };

            pp.parseReturnStatement = function(node) {
                if (!this.inFunction && !this.options.allowReturnOutsideFunction) this.raise(this.start, "'return' outside of function");
                this.next();

                // In `return` (and `break`/`continue`), the keywords with
                // optional arguments, we eagerly look for a semicolon or the
                // possibility to insert one.

                if (this.eat(tt.semi) || this.insertSemicolon()) node.argument = null;
                else {
                    node.argument = this.parseExpression();
                    this.semicolon();
                }
                return this.finishNode(node, "ReturnStatement");
            };

            pp.parseSwitchStatement = function(node) {
                this.next();
                node.discriminant = this.parseParenExpression();
                node.cases = [];
                this.expect(tt.braceL);
                this.labels.push(switchLabel);

                // Statements under must be grouped (by label) in SwitchCase
                // nodes. `cur` is used to keep the node that we are currently
                // adding statements to.

                for (var cur, sawDefault; this.type != tt.braceR;) {
                    if (this.type === tt._case || this.type === tt._default) {
                        var isCase = this.type === tt._case;
                        if (cur) this.finishNode(cur, "SwitchCase");
                        node.cases.push(cur = this.startNode());
                        cur.consequent = [];
                        this.next();
                        if (isCase) {
                            cur.test = this.parseExpression();
                        }
                        else {
                            if (sawDefault) this.raise(this.lastTokStart, "Multiple default clauses");
                            sawDefault = true;
                            cur.test = null;
                        }
                        this.expect(tt.colon);
                    }
                    else {
                        if (!cur) this.unexpected();
                        cur.consequent.push(this.parseStatement(true));
                    }
                }
                if (cur) this.finishNode(cur, "SwitchCase");
                this.next(); // Closing brace
                this.labels.pop();
                return this.finishNode(node, "SwitchStatement");
            };

            pp.parseThrowStatement = function(node) {
                this.next();
                if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) this.raise(this.lastTokEnd, "Illegal newline after throw");
                node.argument = this.parseExpression();
                this.semicolon();
                return this.finishNode(node, "ThrowStatement");
            };

            // Reused empty array added for node fields that are always empty.

            var empty = [];

            pp.parseTryStatement = function(node) {
                this.next();
                node.block = this.parseBlock();
                node.handler = null;
                if (this.type === tt._catch) {
                    var clause = this.startNode();
                    this.next();
                    this.expect(tt.parenL);
                    clause.param = this.parseBindingAtom();
                    this.checkLVal(clause.param, true);
                    this.expect(tt.parenR);
                    clause.guard = null;
                    clause.body = this.parseBlock();
                    node.handler = this.finishNode(clause, "CatchClause");
                }
                node.guardedHandlers = empty;
                node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;
                if (!node.handler && !node.finalizer) this.raise(node.start, "Missing catch or finally clause");
                return this.finishNode(node, "TryStatement");
            };

            pp.parseVarStatement = function(node, kind) {
                this.next();
                this.parseVar(node, false, kind);
                this.semicolon();
                return this.finishNode(node, "VariableDeclaration");
            };

            pp.parseWhileStatement = function(node) {
                this.next();
                node.test = this.parseParenExpression();
                this.labels.push(loopLabel);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, "WhileStatement");
            };

            pp.parseWithStatement = function(node) {
                if (this.strict) this.raise(this.start, "'with' in strict mode");
                this.next();
                node.object = this.parseParenExpression();
                node.body = this.parseStatement(false);
                return this.finishNode(node, "WithStatement");
            };

            pp.parseEmptyStatement = function(node) {
                this.next();
                return this.finishNode(node, "EmptyStatement");
            };

            pp.parseLabeledStatement = function(node, maybeName, expr) {
                for (var i = 0; i < this.labels.length; ++i) {
                    if (this.labels[i].name === maybeName) this.raise(expr.start, "Label '" + maybeName + "' is already declared");
                }
                var kind = this.type.isLoop ? "loop" : this.type === tt._switch ? "switch" : null;
                this.labels.push({
                    name: maybeName,
                    kind: kind
                });
                node.body = this.parseStatement(true);
                this.labels.pop();
                node.label = expr;
                return this.finishNode(node, "LabeledStatement");
            };

            pp.parseExpressionStatement = function(node, expr) {
                node.expression = expr;
                this.semicolon();
                return this.finishNode(node, "ExpressionStatement");
            };

            // Parse a semicolon-enclosed block of statements, handling `"use
            // strict"` declarations when `allowStrict` is true (used for
            // function bodies).

            pp.parseBlock = function(allowStrict) {
                var node = this.startNode(),
                    first = true,
                    oldStrict = undefined;
                node.body = [];
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    var stmt = this.parseStatement(true);
                    node.body.push(stmt);
                    if (first && allowStrict && this.isUseStrict(stmt)) {
                        oldStrict = this.strict;
                        this.setStrict(this.strict = true);
                    }
                    first = false;
                }
                if (oldStrict === false) this.setStrict(false);
                return this.finishNode(node, "BlockStatement");
            };

            // Parse a regular `for` loop. The disambiguation code in
            // `parseStatement` will already have parsed the init statement or
            // expression.

            pp.parseFor = function(node, init) {
                node.init = init;
                this.expect(tt.semi);
                node.test = this.type === tt.semi ? null : this.parseExpression();
                this.expect(tt.semi);
                node.update = this.type === tt.parenR ? null : this.parseExpression();
                this.expect(tt.parenR);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, "ForStatement");
            };

            // Parse a `for`/`in` and `for`/`of` loop, which are almost
            // same from parser's perspective.

            pp.parseForIn = function(node, init) {
                var type = this.type === tt._in ? "ForInStatement" : "ForOfStatement";
                this.next();
                node.left = init;
                node.right = this.parseExpression();
                this.expect(tt.parenR);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, type);
            };

            // Parse a list of variable declarations.

            pp.parseVar = function(node, isFor, kind) {
                node.declarations = [];
                node.kind = kind.keyword;
                for (;;) {
                    var decl = this.startNode();
                    decl.id = this.parseBindingAtom();
                    this.checkLVal(decl.id, true);
                    if (this.eat(tt.eq)) {
                        decl.init = this.parseMaybeAssign(isFor);
                    }
                    else if (kind === tt._const && !(this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
                        this.unexpected();
                    }
                    else if (decl.id.type != "Identifier" && !(isFor && (this.type === tt._in || this.isContextual("of")))) {
                        this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
                    }
                    else {
                        decl.init = null;
                    }
                    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
                    if (!this.eat(tt.comma)) break;
                }
                return node;
            };

            // Parse a function declaration or literal (depending on the
            // `isStatement` parameter).

            pp.parseFunction = function(node, isStatement, allowExpressionBody) {
                this.initFunction(node);
                if (this.options.ecmaVersion >= 6) node.generator = this.eat(tt.star);
                if (isStatement || this.type === tt.name) node.id = this.parseIdent();
                this.expect(tt.parenL);
                node.params = this.parseBindingList(tt.parenR, false, false);
                this.parseFunctionBody(node, allowExpressionBody);
                return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
            };

            // Parse a class declaration or literal (depending on the
            // `isStatement` parameter).

            pp.parseClass = function(node, isStatement) {
                this.next();
                node.id = this.type === tt.name ? this.parseIdent() : isStatement ? this.unexpected() : null;
                node.superClass = this.eat(tt._extends) ? this.parseExprSubscripts() : null;
                var classBody = this.startNode();
                classBody.body = [];
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (this.eat(tt.semi)) continue;
                    var method = this.startNode();
                    var isGenerator = this.eat(tt.star);
                    this.parsePropertyName(method);
                    if (this.type !== tt.parenL && !method.computed && method.key.type === "Identifier" && method.key.name === "static") {
                        if (isGenerator) this.unexpected();
                        method["static"] = true;
                        isGenerator = this.eat(tt.star);
                        this.parsePropertyName(method);
                    }
                    else {
                        method["static"] = false;
                    }
                    method.kind = "method";
                    if (!method.computed && !isGenerator) {
                        if (method.key.type === "Identifier") {
                            if (this.type !== tt.parenL && (method.key.name === "get" || method.key.name === "set")) {
                                method.kind = method.key.name;
                                this.parsePropertyName(method);
                            }
                            else if (!method["static"] && method.key.name === "constructor") {
                                method.kind = "constructor";
                            }
                        }
                        else if (!method["static"] && method.key.type === "Literal" && method.key.value === "constructor") {
                            method.kind = "constructor";
                        }
                    }
                    method.value = this.parseMethod(isGenerator);
                    classBody.body.push(this.finishNode(method, "MethodDefinition"));
                }
                node.body = this.finishNode(classBody, "ClassBody");
                return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
            };

            // Parses module export declaration.

            pp.parseExport = function(node) {
                this.next();
                // export * from '...'
                if (this.eat(tt.star)) {
                    this.expectContextual("from");
                    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
                    this.semicolon();
                    return this.finishNode(node, "ExportAllDeclaration");
                }
                if (this.eat(tt._default)) {
                    // export default ...
                    var expr = this.parseMaybeAssign();
                    var needsSemi = true;
                    if (expr.type == "FunctionExpression" || expr.type == "ClassExpression") {
                        needsSemi = false;
                        if (expr.id) {
                            expr.type = expr.type == "FunctionExpression" ? "FunctionDeclaration" : "ClassDeclaration";
                        }
                    }
                    node.declaration = expr;
                    if (needsSemi) this.semicolon();
                    return this.finishNode(node, "ExportDefaultDeclaration");
                }
                // export var|const|let|function|class ...
                if (this.type.keyword) {
                    node.declaration = this.parseStatement(true);
                    node.specifiers = [];
                    node.source = null;
                }
                else {
                    // export { x, y as z } [from '...']
                    node.declaration = null;
                    node.specifiers = this.parseExportSpecifiers();
                    if (this.eatContextual("from")) {
                        node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
                    }
                    else {
                        node.source = null;
                    }
                    this.semicolon();
                }
                return this.finishNode(node, "ExportNamedDeclaration");
            };

            // Parses a comma-separated list of module exports.

            pp.parseExportSpecifiers = function() {
                var nodes = [],
                    first = true;
                // export { x, y as z } [from '...']
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR)) break;
                    }
                    else first = false;

                    var node = this.startNode();
                    node.local = this.parseIdent(this.type === tt._default);
                    node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
                    nodes.push(this.finishNode(node, "ExportSpecifier"));
                }
                return nodes;
            };

            // Parses import declaration.

            pp.parseImport = function(node) {
                this.next();
                // import '...'
                if (this.type === tt.string) {
                    node.specifiers = empty;
                    node.source = this.parseExprAtom();
                    node.kind = "";
                }
                else {
                    node.specifiers = this.parseImportSpecifiers();
                    this.expectContextual("from");
                    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
                }
                this.semicolon();
                return this.finishNode(node, "ImportDeclaration");
            };

            // Parses a comma-separated list of module imports.

            pp.parseImportSpecifiers = function() {
                var nodes = [],
                    first = true;
                if (this.type === tt.name) {
                    // import defaultObj, { x, y as z } from '...'
                    var node = this.startNode();
                    node.local = this.parseIdent();
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
                    if (!this.eat(tt.comma)) return nodes;
                }
                if (this.type === tt.star) {
                    var node = this.startNode();
                    this.next();
                    this.expectContextual("as");
                    node.local = this.parseIdent();
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, "ImportNamespaceSpecifier"));
                    return nodes;
                }
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR)) break;
                    }
                    else first = false;

                    var node = this.startNode();
                    node.imported = this.parseIdent(true);
                    node.local = this.eatContextual("as") ? this.parseIdent() : node.imported;
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, "ImportSpecifier"));
                }
                return nodes;
            };

        }, {
            "./state": 9,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        11: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // The algorithm used to determine whether a regexp can appear at a
            // given point in the program is loosely based on sweet.js' approach.
            // See https://github.com/mozilla/sweet.js/wiki/design

            var Parser = _dereq_("./state").Parser;

            var tt = _dereq_("./tokentype").types;

            var lineBreak = _dereq_("./whitespace").lineBreak;

            var TokContext = exports.TokContext = function TokContext(token, isExpr, preserveSpace, override) {
                _classCallCheck(this, TokContext);

                this.token = token;
                this.isExpr = isExpr;
                this.preserveSpace = preserveSpace;
                this.override = override;
            };

            var types = {
                b_stat: new TokContext("{", false),
                b_expr: new TokContext("{", true),
                b_tmpl: new TokContext("${", true),
                p_stat: new TokContext("(", false),
                p_expr: new TokContext("(", true),
                q_tmpl: new TokContext("`", true, true, function(p) {
                    return p.readTmplToken();
                }),
                f_expr: new TokContext("function", true)
            };

            exports.types = types;
            var pp = Parser.prototype;

            pp.initialContext = function() {
                return [types.b_stat];
            };

            pp.braceIsBlock = function(prevType) {
                var parent = undefined;
                if (prevType === tt.colon && (parent = this.curContext()).token == "{") return !parent.isExpr;
                if (prevType === tt._return) return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
                if (prevType === tt._else || prevType === tt.semi || prevType === tt.eof) return true;
                if (prevType == tt.braceL) return this.curContext() === types.b_stat;
                return !this.exprAllowed;
            };

            pp.updateContext = function(prevType) {
                var update = undefined,
                    type = this.type;
                if (type.keyword && prevType == tt.dot) this.exprAllowed = false;
                else if (update = type.updateContext) update.call(this, prevType);
                else this.exprAllowed = type.beforeExpr;
            };

            // Token-specific context update code

            tt.parenR.updateContext = tt.braceR.updateContext = function() {
                if (this.context.length == 1) {
                    this.exprAllowed = true;
                    return;
                }
                var out = this.context.pop();
                if (out === types.b_stat && this.curContext() === types.f_expr) {
                    this.context.pop();
                    this.exprAllowed = false;
                }
                else if (out === types.b_tmpl) {
                    this.exprAllowed = true;
                }
                else {
                    this.exprAllowed = !out.isExpr;
                }
            };

            tt.braceL.updateContext = function(prevType) {
                this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
                this.exprAllowed = true;
            };

            tt.dollarBraceL.updateContext = function() {
                this.context.push(types.b_tmpl);
                this.exprAllowed = true;
            };

            tt.parenL.updateContext = function(prevType) {
                var statementParens = prevType === tt._if || prevType === tt._for || prevType === tt._with || prevType === tt._while;
                this.context.push(statementParens ? types.p_stat : types.p_expr);
                this.exprAllowed = true;
            };

            tt.incDec.updateContext = function() {};

            tt._function.updateContext = function() {
                if (this.curContext() !== types.b_stat) this.context.push(types.f_expr);
                this.exprAllowed = false;
            };

            tt.backQuote.updateContext = function() {
                if (this.curContext() === types.q_tmpl) this.context.pop();
                else this.context.push(types.q_tmpl);
                this.exprAllowed = false;
            };

            // tokExprAllowed stays unchanged

        }, {
            "./state": 9,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        12: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var _identifier = _dereq_("./identifier");

            var isIdentifierStart = _identifier.isIdentifierStart;
            var isIdentifierChar = _identifier.isIdentifierChar;

            var _tokentype = _dereq_("./tokentype");

            var tt = _tokentype.types;
            var keywordTypes = _tokentype.keywords;

            var Parser = _dereq_("./state").Parser;

            var SourceLocation = _dereq_("./location").SourceLocation;

            var _whitespace = _dereq_("./whitespace");

            var lineBreak = _whitespace.lineBreak;
            var lineBreakG = _whitespace.lineBreakG;
            var isNewLine = _whitespace.isNewLine;
            var nonASCIIwhitespace = _whitespace.nonASCIIwhitespace;

            // Object type used to represent tokens. Note that normally, tokens
            // simply exist as properties on the parser object. This is only
            // used for the onToken callback and the external tokenizer.

            var Token = exports.Token = function Token(p) {
                _classCallCheck(this, Token);

                this.type = p.type;
                this.value = p.value;
                this.start = p.start;
                this.end = p.end;
                if (p.options.locations) this.loc = new SourceLocation(p, p.startLoc, p.endLoc);
                if (p.options.ranges) this.range = [p.start, p.end];
            };

            // ## Tokenizer

            var pp = Parser.prototype;

            // Move to the next token

            pp.next = function() {
                if (this.options.onToken) this.options.onToken(new Token(this));

                this.lastTokEnd = this.end;
                this.lastTokStart = this.start;
                this.lastTokEndLoc = this.endLoc;
                this.lastTokStartLoc = this.startLoc;
                this.nextToken();
            };

            pp.getToken = function() {
                this.next();
                return new Token(this);
            };

            // If we're in an ES6 environment, make parsers iterable
            if (typeof Symbol !== "undefined") pp[Symbol.iterator] = function() {
                var self = this;
                return {
                    next: function next() {
                        var token = self.getToken();
                        return {
                            done: token.type === tt.eof,
                            value: token
                        };
                    }
                };
            };

            // Toggle strict mode. Re-reads the next number or string to please
            // pedantic tests (`"use strict"; 010;` should fail).

            pp.setStrict = function(strict) {
                this.strict = strict;
                if (this.type !== tt.num && this.type !== tt.string) return;
                this.pos = this.start;
                if (this.options.locations) {
                    while (this.pos < this.lineStart) {
                        this.lineStart = this.input.lastIndexOf("\n", this.lineStart - 2) + 1;
                        --this.curLine;
                    }
                }
                this.nextToken();
            };

            pp.curContext = function() {
                return this.context[this.context.length - 1];
            };

            // Read a single token, updating the parser object's token-related
            // properties.

            pp.nextToken = function() {
                var curContext = this.curContext();
                if (!curContext || !curContext.preserveSpace) this.skipSpace();

                this.start = this.pos;
                if (this.options.locations) this.startLoc = this.curPosition();
                if (this.pos >= this.input.length) return this.finishToken(tt.eof);

                if (curContext.override) return curContext.override(this);
                else this.readToken(this.fullCharCodeAtPos());
            };

            pp.readToken = function(code) {
                // Identifier or keyword. '\uXXXX' sequences are allowed in
                // identifiers, so '\' also dispatches to that.
                if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */ ) return this.readWord();

                return this.getTokenFromCode(code);
            };

            pp.fullCharCodeAtPos = function() {
                var code = this.input.charCodeAt(this.pos);
                if (code <= 55295 || code >= 57344) return code;
                var next = this.input.charCodeAt(this.pos + 1);
                return (code << 10) + next - 56613888;
            };

            pp.skipBlockComment = function() {
                var startLoc = this.options.onComment && this.options.locations && this.curPosition();
                var start = this.pos,
                    end = this.input.indexOf("*/", this.pos += 2);
                if (end === -1) this.raise(this.pos - 2, "Unterminated comment");
                this.pos = end + 2;
                if (this.options.locations) {
                    lineBreakG.lastIndex = start;
                    var match = undefined;
                    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
                        ++this.curLine;
                        this.lineStart = match.index + match[0].length;
                    }
                }
                if (this.options.onComment) this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.options.locations && this.curPosition());
            };

            pp.skipLineComment = function(startSkip) {
                var start = this.pos;
                var startLoc = this.options.onComment && this.options.locations && this.curPosition();
                var ch = this.input.charCodeAt(this.pos += startSkip);
                while (this.pos < this.input.length && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
                    ++this.pos;
                    ch = this.input.charCodeAt(this.pos);
                }
                if (this.options.onComment) this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos, startLoc, this.options.locations && this.curPosition());
            };

            // Called at the start of the parse and after every token. Skips
            // whitespace and comments, and.

            pp.skipSpace = function() {
                while (this.pos < this.input.length) {
                    var ch = this.input.charCodeAt(this.pos);
                    if (ch === 32) {
                        // ' '
                        ++this.pos;
                    }
                    else if (ch === 13) {
                        ++this.pos;
                        var next = this.input.charCodeAt(this.pos);
                        if (next === 10) {
                            ++this.pos;
                        }
                        if (this.options.locations) {
                            ++this.curLine;
                            this.lineStart = this.pos;
                        }
                    }
                    else if (ch === 10 || ch === 8232 || ch === 8233) {
                        ++this.pos;
                        if (this.options.locations) {
                            ++this.curLine;
                            this.lineStart = this.pos;
                        }
                    }
                    else if (ch > 8 && ch < 14) {
                        ++this.pos;
                    }
                    else if (ch === 47) {
                        // '/'
                        var next = this.input.charCodeAt(this.pos + 1);
                        if (next === 42) {
                            // '*'
                            this.skipBlockComment();
                        }
                        else if (next === 47) {
                            // '/'
                            this.skipLineComment(2);
                        }
                        else break;
                    }
                    else if (ch === 160) {
                        // '\xa0'
                        ++this.pos;
                    }
                    else if (ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
                        ++this.pos;
                    }
                    else {
                        break;
                    }
                }
            };

            // Called at the end of every token. Sets `end`, `val`, and
            // maintains `context` and `exprAllowed`, and skips the space after
            // the token, so that the next one's `start` will point at the
            // right position.

            pp.finishToken = function(type, val) {
                this.end = this.pos;
                if (this.options.locations) this.endLoc = this.curPosition();
                var prevType = this.type;
                this.type = type;
                this.value = val;

                this.updateContext(prevType);
            };

            // ### Token reading

            // This is the function that is called to fetch the next token. It
            // is somewhat obscure, because it works in character codes rather
            // than characters, and because operator parsing has been inlined
            // into it.
            //
            // All in the name of speed.
            //
            pp.readToken_dot = function() {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next >= 48 && next <= 57) return this.readNumber(true);
                var next2 = this.input.charCodeAt(this.pos + 2);
                if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
                    // 46 = dot '.'
                    this.pos += 3;
                    return this.finishToken(tt.ellipsis);
                }
                else {
                    ++this.pos;
                    return this.finishToken(tt.dot);
                }
            };

            pp.readToken_slash = function() {
                // '/'
                var next = this.input.charCodeAt(this.pos + 1);
                if (this.exprAllowed) {
                    ++this.pos;
                    return this.readRegexp();
                }
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.slash, 1);
            };

            pp.readToken_mult_modulo = function(code) {
                // '%*'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(code === 42 ? tt.star : tt.modulo, 1);
            };

            pp.readToken_pipe_amp = function(code) {
                // '|&'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === code) return this.finishOp(code === 124 ? tt.logicalOR : tt.logicalAND, 2);
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(code === 124 ? tt.bitwiseOR : tt.bitwiseAND, 1);
            };

            pp.readToken_caret = function() {
                // '^'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.bitwiseXOR, 1);
            };

            pp.readToken_plus_min = function(code) {
                // '+-'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === code) {
                    if (next == 45 && this.input.charCodeAt(this.pos + 2) == 62 && lineBreak.test(this.input.slice(this.lastTokEnd, this.pos))) {
                        // A `-->` line comment
                        this.skipLineComment(3);
                        this.skipSpace();
                        return this.nextToken();
                    }
                    return this.finishOp(tt.incDec, 2);
                }
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.plusMin, 1);
            };

            pp.readToken_lt_gt = function(code) {
                // '<>'
                var next = this.input.charCodeAt(this.pos + 1);
                var size = 1;
                if (next === code) {
                    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
                    if (this.input.charCodeAt(this.pos + size) === 61) return this.finishOp(tt.assign, size + 1);
                    return this.finishOp(tt.bitShift, size);
                }
                if (next == 33 && code == 60 && this.input.charCodeAt(this.pos + 2) == 45 && this.input.charCodeAt(this.pos + 3) == 45) {
                    if (this.inModule) unexpected();
                    // `<!--`, an XML-style comment that should be interpreted as a line comment
                    this.skipLineComment(4);
                    this.skipSpace();
                    return this.nextToken();
                }
                if (next === 61) size = this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2;
                return this.finishOp(tt.relational, size);
            };

            pp.readToken_eq_excl = function(code) {
                // '=!'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 61) return this.finishOp(tt.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
                if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
                    // '=>'
                    this.pos += 2;
                    return this.finishToken(tt.arrow);
                }
                return this.finishOp(code === 61 ? tt.eq : tt.prefix, 1);
            };

            pp.getTokenFromCode = function(code) {
                switch (code) {
                    // The interpretation of a dot depends on whether it is followed
                    // by a digit or another two dots.
                case 46:
                    // '.'
                    return this.readToken_dot();

                    // Punctuation tokens.
                case 40:
                    ++this.pos;
                    return this.finishToken(tt.parenL);
                case 41:
                    ++this.pos;
                    return this.finishToken(tt.parenR);
                case 59:
                    ++this.pos;
                    return this.finishToken(tt.semi);
                case 44:
                    ++this.pos;
                    return this.finishToken(tt.comma);
                case 91:
                    ++this.pos;
                    return this.finishToken(tt.bracketL);
                case 93:
                    ++this.pos;
                    return this.finishToken(tt.bracketR);
                case 123:
                    ++this.pos;
                    return this.finishToken(tt.braceL);
                case 125:
                    ++this.pos;
                    return this.finishToken(tt.braceR);
                case 58:
                    ++this.pos;
                    return this.finishToken(tt.colon);
                case 63:
                    ++this.pos;
                    return this.finishToken(tt.question);

                case 96:
                    // '`'
                    if (this.options.ecmaVersion < 6) break;
                    ++this.pos;
                    return this.finishToken(tt.backQuote);

                case 48:
                    // '0'
                    var next = this.input.charCodeAt(this.pos + 1);
                    if (next === 120 || next === 88) return this.readRadixNumber(16); // '0x', '0X' - hex number
                    if (this.options.ecmaVersion >= 6) {
                        if (next === 111 || next === 79) return this.readRadixNumber(8); // '0o', '0O' - octal number
                        if (next === 98 || next === 66) return this.readRadixNumber(2); // '0b', '0B' - binary number
                    }
                    // Anything else beginning with a digit is an integer, octal
                    // number, or float.
                case 49:
                case 50:
                case 51:
                case 52:
                case 53:
                case 54:
                case 55:
                case 56:
                case 57:
                    // 1-9
                    return this.readNumber(false);

                    // Quotes produce strings.
                case 34:
                case 39:
                    // '"', "'"
                    return this.readString(code);

                    // Operators are parsed inline in tiny state machines. '=' (61) is
                    // often referred to. `finishOp` simply skips the amount of
                    // characters it is given as second argument, and returns a token
                    // of the type given by its first argument.

                case 47:
                    // '/'
                    return this.readToken_slash();

                case 37:
                case 42:
                    // '%*'
                    return this.readToken_mult_modulo(code);

                case 124:
                case 38:
                    // '|&'
                    return this.readToken_pipe_amp(code);

                case 94:
                    // '^'
                    return this.readToken_caret();

                case 43:
                case 45:
                    // '+-'
                    return this.readToken_plus_min(code);

                case 60:
                case 62:
                    // '<>'
                    return this.readToken_lt_gt(code);

                case 61:
                case 33:
                    // '=!'
                    return this.readToken_eq_excl(code);

                case 126:
                    // '~'
                    return this.finishOp(tt.prefix, 1);
                }

                this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
            };

            pp.finishOp = function(type, size) {
                var str = this.input.slice(this.pos, this.pos + size);
                this.pos += size;
                return this.finishToken(type, str);
            };

            var regexpUnicodeSupport = false;
            try {
                new RegExp("￿", "u");
                regexpUnicodeSupport = true;
            }
            catch (e) {}

            // Parse a regular expression. Some context-awareness is necessary,
            // since a '/' inside a '[]' set does not end the expression.

            pp.readRegexp = function() {
                var escaped = undefined,
                    inClass = undefined,
                    start = this.pos;
                for (;;) {
                    if (this.pos >= this.input.length) this.raise(start, "Unterminated regular expression");
                    var ch = this.input.charAt(this.pos);
                    if (lineBreak.test(ch)) this.raise(start, "Unterminated regular expression");
                    if (!escaped) {
                        if (ch === "[") inClass = true;
                        else if (ch === "]" && inClass) inClass = false;
                        else if (ch === "/" && !inClass) break;
                        escaped = ch === "\\";
                    }
                    else escaped = false;
                    ++this.pos;
                }
                var content = this.input.slice(start, this.pos);
                ++this.pos;
                // Need to use `readWord1` because '\uXXXX' sequences are allowed
                // here (don't ask).
                var mods = this.readWord1();
                var tmp = content;
                if (mods) {
                    var validFlags = /^[gmsiy]*$/;
                    if (this.options.ecmaVersion >= 6) validFlags = /^[gmsiyu]*$/;
                    if (!validFlags.test(mods)) this.raise(start, "Invalid regular expression flag");
                    if (mods.indexOf("u") >= 0 && !regexpUnicodeSupport) {
                        // Replace each astral symbol and every Unicode escape sequence that
                        // possibly represents an astral symbol or a paired surrogate with a
                        // single ASCII symbol to avoid throwing on regular expressions that
                        // are only valid in combination with the `/u` flag.
                        // Note: replacing with the ASCII symbol `x` might cause false
                        // negatives in unlikely scenarios. For example, `[\u{61}-b]` is a
                        // perfectly valid pattern that is equivalent to `[a-b]`, but it would
                        // be replaced by `[x-b]` which throws an error.
                        tmp = tmp.replace(/\\u([a-fA-F0-9]{4})|\\u\{([0-9a-fA-F]+)\}|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x");
                    }
                }
                // Detect invalid regular expressions.
                try {
                    new RegExp(tmp);
                }
                catch (e) {
                    if (e instanceof SyntaxError) this.raise(start, "Error parsing regular expression: " + e.message);
                    this.raise(e);
                }
                // Get a regular expression object for this pattern-flag pair, or `null` in
                // case the current environment doesn't support the flags it uses.
                var value = undefined;
                try {
                    value = new RegExp(content, mods);
                }
                catch (err) {
                    value = null;
                }
                return this.finishToken(tt.regexp, {
                    pattern: content,
                    flags: mods,
                    value: value
                });
            };

            // Read an integer in the given radix. Return null if zero digits
            // were read, the integer value otherwise. When `len` is given, this
            // will return `null` unless the integer has exactly `len` digits.

            pp.readInt = function(radix, len) {
                var start = this.pos,
                    total = 0;
                for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
                    var code = this.input.charCodeAt(this.pos),
                        val = undefined;
                    if (code >= 97) val = code - 97 + 10; // a
                    else if (code >= 65) val = code - 65 + 10; // A
                    else if (code >= 48 && code <= 57) val = code - 48; // 0-9
                    else val = Infinity;
                    if (val >= radix) break;
                    ++this.pos;
                    total = total * radix + val;
                }
                if (this.pos === start || len != null && this.pos - start !== len) return null;

                return total;
            };

            pp.readRadixNumber = function(radix) {
                this.pos += 2; // 0x
                var val = this.readInt(radix);
                if (val == null) this.raise(this.start + 2, "Expected number in radix " + radix);
                if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number");
                return this.finishToken(tt.num, val);
            };

            // Read an integer, octal integer, or floating-point number.

            pp.readNumber = function(startsWithDot) {
                var start = this.pos,
                    isFloat = false,
                    octal = this.input.charCodeAt(this.pos) === 48;
                if (!startsWithDot && this.readInt(10) === null) this.raise(start, "Invalid number");
                if (this.input.charCodeAt(this.pos) === 46) {
                    ++this.pos;
                    this.readInt(10);
                    isFloat = true;
                }
                var next = this.input.charCodeAt(this.pos);
                if (next === 69 || next === 101) {
                    // 'eE'
                    next = this.input.charCodeAt(++this.pos);
                    if (next === 43 || next === 45)++this.pos; // '+-'
                    if (this.readInt(10) === null) this.raise(start, "Invalid number");
                    isFloat = true;
                }
                if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number");

                var str = this.input.slice(start, this.pos),
                    val = undefined;
                if (isFloat) val = parseFloat(str);
                else if (!octal || str.length === 1) val = parseInt(str, 10);
                else if (/[89]/.test(str) || this.strict) this.raise(start, "Invalid number");
                else val = parseInt(str, 8);
                return this.finishToken(tt.num, val);
            };

            // Read a string value, interpreting backslash-escapes.

            pp.readCodePoint = function() {
                var ch = this.input.charCodeAt(this.pos),
                    code = undefined;

                if (ch === 123) {
                    if (this.options.ecmaVersion < 6) this.unexpected();
                    ++this.pos;
                    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
                    ++this.pos;
                    if (code > 1114111) this.unexpected();
                }
                else {
                    code = this.readHexChar(4);
                }
                return code;
            };

            function codePointToString(code) {
                // UTF-16 Decoding
                if (code <= 65535) {
                    return String.fromCharCode(code);
                }
                return String.fromCharCode((code - 65536 >> 10) + 55296, (code - 65536 & 1023) + 56320);
            }

            pp.readString = function(quote) {
                var out = "",
                    chunkStart = ++this.pos;
                for (;;) {
                    if (this.pos >= this.input.length) this.raise(this.start, "Unterminated string constant");
                    var ch = this.input.charCodeAt(this.pos);
                    if (ch === quote) break;
                    if (ch === 92) {
                        // '\'
                        out += this.input.slice(chunkStart, this.pos);
                        out += this.readEscapedChar();
                        chunkStart = this.pos;
                    }
                    else {
                        if (isNewLine(ch)) this.raise(this.start, "Unterminated string constant");
                        ++this.pos;
                    }
                }
                out += this.input.slice(chunkStart, this.pos++);
                return this.finishToken(tt.string, out);
            };

            // Reads template string tokens.

            pp.readTmplToken = function() {
                var out = "",
                    chunkStart = this.pos;
                for (;;) {
                    if (this.pos >= this.input.length) this.raise(this.start, "Unterminated template");
                    var ch = this.input.charCodeAt(this.pos);
                    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
                        // '`', '${'
                        if (this.pos === this.start && this.type === tt.template) {
                            if (ch === 36) {
                                this.pos += 2;
                                return this.finishToken(tt.dollarBraceL);
                            }
                            else {
                                ++this.pos;
                                return this.finishToken(tt.backQuote);
                            }
                        }
                        out += this.input.slice(chunkStart, this.pos);
                        return this.finishToken(tt.template, out);
                    }
                    if (ch === 92) {
                        // '\'
                        out += this.input.slice(chunkStart, this.pos);
                        out += this.readEscapedChar();
                        chunkStart = this.pos;
                    }
                    else if (isNewLine(ch)) {
                        out += this.input.slice(chunkStart, this.pos);
                        ++this.pos;
                        if (ch === 13 && this.input.charCodeAt(this.pos) === 10) {
                            ++this.pos;
                            out += "\n";
                        }
                        else {
                            out += String.fromCharCode(ch);
                        }
                        if (this.options.locations) {
                            ++this.curLine;
                            this.lineStart = this.pos;
                        }
                        chunkStart = this.pos;
                    }
                    else {
                        ++this.pos;
                    }
                }
            };

            // Used to read escaped characters

            pp.readEscapedChar = function() {
                var ch = this.input.charCodeAt(++this.pos);
                var octal = /^[0-7]+/.exec(this.input.slice(this.pos, this.pos + 3));
                if (octal) octal = octal[0];
                while (octal && parseInt(octal, 8) > 255) octal = octal.slice(0, - 1);
                if (octal === "0") octal = null;
                ++this.pos;
                if (octal) {
                    if (this.strict) this.raise(this.pos - 2, "Octal literal in strict mode");
                    this.pos += octal.length - 1;
                    return String.fromCharCode(parseInt(octal, 8));
                }
                else {
                    switch (ch) {
                    case 110:
                        return "\n"; // 'n' -> '\n'
                    case 114:
                        return "\r"; // 'r' -> '\r'
                    case 120:
                        return String.fromCharCode(this.readHexChar(2)); // 'x'
                    case 117:
                        return codePointToString(this.readCodePoint()); // 'u'
                    case 116:
                        return "\t"; // 't' -> '\t'
                    case 98:
                        return "\b"; // 'b' -> '\b'
                    case 118:
                        return "\u000b"; // 'v' -> '\u000b'
                    case 102:
                        return "\f"; // 'f' -> '\f'
                    case 48:
                        return "\u0000"; // 0 -> '\0'
                    case 13:
                        if (this.input.charCodeAt(this.pos) === 10)++this.pos; // '\r\n'
                    case 10:
                        // ' \n'
                        if (this.options.locations) {
                            this.lineStart = this.pos;
                            ++this.curLine;
                        }
                        return "";
                    default:
                        return String.fromCharCode(ch);
                    }
                }
            };

            // Used to read character escape sequences ('\x', '\u', '\U').

            pp.readHexChar = function(len) {
                var n = this.readInt(16, len);
                if (n === null) this.raise(this.start, "Bad character escape sequence");
                return n;
            };

            // Used to signal to callers of `readWord1` whether the word
            // contained any escape sequences. This is needed because words with
            // escape sequences must not be interpreted as keywords.

            var containsEsc;

            // Read an identifier, and return it as a string. Sets `containsEsc`
            // to whether the word contained a '\u' escape.
            //
            // Incrementally adds only escaped chars, adding other chunks as-is
            // as a micro-optimization.

            pp.readWord1 = function() {
                containsEsc = false;
                var word = "",
                    first = true,
                    chunkStart = this.pos;
                var astral = this.options.ecmaVersion >= 6;
                while (this.pos < this.input.length) {
                    var ch = this.fullCharCodeAtPos();
                    if (isIdentifierChar(ch, astral)) {
                        this.pos += ch <= 65535 ? 1 : 2;
                    }
                    else if (ch === 92) {
                        // "\"
                        containsEsc = true;
                        word += this.input.slice(chunkStart, this.pos);
                        var escStart = this.pos;
                        if (this.input.charCodeAt(++this.pos) != 117) // "u"
                        this.raise(this.pos, "Expecting Unicode escape sequence \\uXXXX");
                        ++this.pos;
                        var esc = this.readCodePoint();
                        if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral)) this.raise(escStart, "Invalid Unicode escape");
                        word += codePointToString(esc);
                        chunkStart = this.pos;
                    }
                    else {
                        break;
                    }
                    first = false;
                }
                return word + this.input.slice(chunkStart, this.pos);
            };

            // Read an identifier or keyword token. Will check for reserved
            // words when necessary.

            pp.readWord = function() {
                var word = this.readWord1();
                var type = tt.name;
                if ((this.options.ecmaVersion >= 6 || !containsEsc) && this.isKeyword(word)) type = keywordTypes[word];
                return this.finishToken(type, word);
            };

        }, {
            "./identifier": 3,
            "./location": 4,
            "./state": 9,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        13: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // ## Token types

            // The assignment of fine-grained, information-carrying type objects
            // allows the tokenizer to store the information it has about a
            // token in a way that is very cheap for the parser to look up.

            // All token type variables start with an underscore, to make them
            // easy to recognize.

            // The `beforeExpr` property is used to disambiguate between regular
            // expressions and divisions. It is set on all token types that can
            // be followed by an expression (thus, a slash after them would be a
            // regular expression).
            //
            // `isLoop` marks a keyword as starting a loop, which is important
            // to know when parsing a label, in order to allow or disallow
            // continue jumps to that label.

            var TokenType = exports.TokenType = function TokenType(label) {
                var conf = arguments[1] === undefined ? {} : arguments[1];

                _classCallCheck(this, TokenType);

                this.label = label;
                this.keyword = conf.keyword;
                this.beforeExpr = !! conf.beforeExpr;
                this.startsExpr = !! conf.startsExpr;
                this.isLoop = !! conf.isLoop;
                this.isAssign = !! conf.isAssign;
                this.prefix = !! conf.prefix;
                this.postfix = !! conf.postfix;
                this.binop = conf.binop || null;
                this.updateContext = null;
            };

            function binop(name, prec) {
                return new TokenType(name, {
                    beforeExpr: true,
                    binop: prec
                });
            }
            var beforeExpr = {
                beforeExpr: true
            },
            startsExpr = {
                startsExpr: true
            };

            var types = {
                num: new TokenType("num", startsExpr),
                regexp: new TokenType("regexp", startsExpr),
                string: new TokenType("string", startsExpr),
                name: new TokenType("name", startsExpr),
                eof: new TokenType("eof"),

                // Punctuation token types.
                bracketL: new TokenType("[", {
                    beforeExpr: true,
                    startsExpr: true
                }),
                bracketR: new TokenType("]"),
                braceL: new TokenType("{", {
                    beforeExpr: true,
                    startsExpr: true
                }),
                braceR: new TokenType("}"),
                parenL: new TokenType("(", {
                    beforeExpr: true,
                    startsExpr: true
                }),
                parenR: new TokenType(")"),
                comma: new TokenType(",", beforeExpr),
                semi: new TokenType(";", beforeExpr),
                colon: new TokenType(":", beforeExpr),
                dot: new TokenType("."),
                question: new TokenType("?", beforeExpr),
                arrow: new TokenType("=>", beforeExpr),
                template: new TokenType("template"),
                ellipsis: new TokenType("...", beforeExpr),
                backQuote: new TokenType("`", startsExpr),
                dollarBraceL: new TokenType("${", {
                    beforeExpr: true,
                    startsExpr: true
                }),

                // Operators. These carry several kinds of properties to help the
                // parser use them properly (the presence of these properties is
                // what categorizes them as operators).
                //
                // `binop`, when present, specifies that this operator is a binary
                // operator, and will refer to its precedence.
                //
                // `prefix` and `postfix` mark the operator as a prefix or postfix
                // unary operator.
                //
                // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
                // binary operators with a very low precedence, that should result
                // in AssignmentExpression nodes.

                eq: new TokenType("=", {
                    beforeExpr: true,
                    isAssign: true
                }),
                assign: new TokenType("_=", {
                    beforeExpr: true,
                    isAssign: true
                }),
                incDec: new TokenType("++/--", {
                    prefix: true,
                    postfix: true,
                    startsExpr: true
                }),
                prefix: new TokenType("prefix", {
                    beforeExpr: true,
                    prefix: true,
                    startsExpr: true
                }),
                logicalOR: binop("||", 1),
                logicalAND: binop("&&", 2),
                bitwiseOR: binop("|", 3),
                bitwiseXOR: binop("^", 4),
                bitwiseAND: binop("&", 5),
                equality: binop("==/!=", 6),
                relational: binop("</>", 7),
                bitShift: binop("<</>>", 8),
                plusMin: new TokenType("+/-", {
                    beforeExpr: true,
                    binop: 9,
                    prefix: true,
                    startsExpr: true
                }),
                modulo: binop("%", 10),
                star: binop("*", 10),
                slash: binop("/", 10)
            };

            exports.types = types;
            // Map keyword names to token types.

            var keywords = {};

            exports.keywords = keywords;
            // Succinct definitions of keyword token types
            function kw(name) {
                var options = arguments[1] === undefined ? {} : arguments[1];

                options.keyword = name;
                keywords[name] = types["_" + name] = new TokenType(name, options);
            }

            kw("break");
            kw("case", beforeExpr);
            kw("catch");
            kw("continue");
            kw("debugger");
            kw("default");
            kw("do", {
                isLoop: true
            });
            kw("else", beforeExpr);
            kw("finally");
            kw("for", {
                isLoop: true
            });
            kw("function");
            kw("if");
            kw("return", beforeExpr);
            kw("switch");
            kw("throw", beforeExpr);
            kw("try");
            kw("var");
            kw("let");
            kw("const");
            kw("while", {
                isLoop: true
            });
            kw("with");
            kw("new", {
                beforeExpr: true,
                startsExpr: true
            });
            kw("this", startsExpr);
            kw("super", startsExpr);
            kw("class");
            kw("extends", beforeExpr);
            kw("export");
            kw("import");
            kw("yield", {
                beforeExpr: true,
                startsExpr: true
            });
            kw("null", startsExpr);
            kw("true", startsExpr);
            kw("false", startsExpr);
            kw("in", {
                beforeExpr: true,
                binop: 7
            });
            kw("instanceof", {
                beforeExpr: true,
                binop: 7
            });
            kw("typeof", {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });
            kw("void", {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });
            kw("delete", {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });

        }, {}],
        14: [function(_dereq_, module, exports) {
            "use strict";

            exports.isArray = isArray;

            // Checks if an object has a property.

            exports.has = has;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            function isArray(obj) {
                return Object.prototype.toString.call(obj) === "[object Array]";
            }

            function has(obj, propName) {
                return Object.prototype.hasOwnProperty.call(obj, propName);
            }

        }, {}],
        15: [function(_dereq_, module, exports) {
            "use strict";

            exports.isNewLine = isNewLine;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // Matches a whole line break (where CRLF is considered a single
            // line break). Used to count lines.

            var lineBreak = /\r\n?|\n|\u2028|\u2029/;
            exports.lineBreak = lineBreak;
            var lineBreakG = new RegExp(lineBreak.source, "g");

            exports.lineBreakG = lineBreakG;

            function isNewLine(code) {
                return code === 10 || code === 13 || code === 8232 || code == 8233;
            }

            var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
            exports.nonASCIIwhitespace = nonASCIIwhitespace;

        }, {}]
    }, {}, [1])(1)
});

//#endregion


//#region acorn/dist/acorn_loose.js

(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    }
    else if (typeof define === "function" && define.amd) {
        define([], f)
    }
    else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        }
        else if (typeof global !== "undefined") {
            g = global
        }
        else if (typeof self !== "undefined") {
            g = self
        }
        else {
            g = this
        }(g.acorn || (g.acorn = {})).loose = f()
    }
})(function() {
    var define, module, exports;
    return (function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {
                    exports: {}
                };
                t[o][0].call(l.exports, function(e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }
        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    })({
        1: [function(_dereq_, module, exports) {
            "use strict";

            var _interopRequireWildcard = function(obj) {
                return obj && obj.__esModule ? obj : {
                    "default": obj
                };
            };

            exports.parse_dammit = parse_dammit;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // Acorn: Loose parser
            //
            // This module provides an alternative parser (`parse_dammit`) that
            // exposes that same interface as `parse`, but will try to parse
            // anything as JavaScript, repairing syntax error the best it can.
            // There are circumstances in which it will raise an error and give
            // up, but they are very rare. The resulting AST will be a mostly
            // valid JavaScript AST (as per the [Mozilla parser API][api], except
            // that:
            //
            // - Return outside functions is allowed
            //
            // - Label consistency (no conflicts, break only to existing labels)
            //   is not enforced.
            //
            // - Bogus Identifier nodes with a name of `"✖"` are inserted whenever
            //   the parser got too confused to return anything meaningful.
            //
            // [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API
            //
            // The expected use for this is to *first* try `acorn.parse`, and only
            // if that fails switch to `parse_dammit`. The loose parser might
            // parse badly indented code incorrectly, so **don't** use it as
            // your default parser.
            //
            // Quite a lot of acorn.js is duplicated here. The alternative was to
            // add a *lot* of extra cruft to that file, making it less readable
            // and slower. Copying and editing the code allowed me to make
            // invasive changes and simplifications without creating a complicated
            // tangle.

            var acorn = _interopRequireWildcard(_dereq_(".."));

            var _state = _dereq_("./state");

            var LooseParser = _state.LooseParser;

            _dereq_("./tokenize");

            _dereq_("./parseutil");

            _dereq_("./statement");

            _dereq_("./expression");

            exports.LooseParser = _state.LooseParser;

            acorn.defaultOptions.tabSize = 4;

            function parse_dammit(input, options) {
                var p = new LooseParser(input, options);
                p.next();
                return p.parseTopLevel();
            }

            acorn.parse_dammit = parse_dammit;
            acorn.LooseParser = LooseParser;

        }, {
            "..": 2,
            "./expression": 3,
            "./parseutil": 4,
            "./state": 5,
            "./statement": 6,
            "./tokenize": 7
        }],
        2: [function(_dereq_, module, exports) {
            "use strict";

            module.exports = typeof acorn != "undefined" ? acorn : _dereq_("./acorn");

        }, {}],
        3: [function(_dereq_, module, exports) {
            "use strict";

            var LooseParser = _dereq_("./state").LooseParser;

            var isDummy = _dereq_("./parseutil").isDummy;

            var tt = _dereq_("..").tokTypes;

            var lp = LooseParser.prototype;

            lp.checkLVal = function(expr, binding) {
                if (!expr) return expr;
                switch (expr.type) {
                case "Identifier":
                    return expr;

                case "MemberExpression":
                    return binding ? this.dummyIdent() : expr;

                case "ObjectPattern":
                case "ArrayPattern":
                case "RestElement":
                case "AssignmentPattern":
                    if (this.options.ecmaVersion >= 6) return expr;

                default:
                    return this.dummyIdent();
                }
            };

            lp.parseExpression = function(noIn) {
                var start = this.storeCurrentPos();
                var expr = this.parseMaybeAssign(noIn);
                if (this.tok.type === tt.comma) {
                    var node = this.startNodeAt(start);
                    node.expressions = [expr];
                    while (this.eat(tt.comma)) node.expressions.push(this.parseMaybeAssign(noIn));
                    return this.finishNode(node, "SequenceExpression");
                }
                return expr;
            };

            lp.parseParenExpression = function() {
                this.pushCx();
                this.expect(tt.parenL);
                var val = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                return val;
            };

            lp.parseMaybeAssign = function(noIn) {
                var start = this.storeCurrentPos();
                var left = this.parseMaybeConditional(noIn);
                if (this.tok.type.isAssign) {
                    var node = this.startNodeAt(start);
                    node.operator = this.tok.value;
                    node.left = this.tok.type === tt.eq ? this.toAssignable(left) : this.checkLVal(left);
                    this.next();
                    node.right = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, "AssignmentExpression");
                }
                return left;
            };

            lp.parseMaybeConditional = function(noIn) {
                var start = this.storeCurrentPos();
                var expr = this.parseExprOps(noIn);
                if (this.eat(tt.question)) {
                    var node = this.startNodeAt(start);
                    node.test = expr;
                    node.consequent = this.parseMaybeAssign();
                    node.alternate = this.expect(tt.colon) ? this.parseMaybeAssign(noIn) : this.dummyIdent();
                    return this.finishNode(node, "ConditionalExpression");
                }
                return expr;
            };

            lp.parseExprOps = function(noIn) {
                var start = this.storeCurrentPos();
                var indent = this.curIndent,
                    line = this.curLineStart;
                return this.parseExprOp(this.parseMaybeUnary(noIn), start, - 1, noIn, indent, line);
            };

            lp.parseExprOp = function(left, start, minPrec, noIn, indent, line) {
                if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine()) return left;
                var prec = this.tok.type.binop;
                if (prec != null && (!noIn || this.tok.type !== tt._in)) {
                    if (prec > minPrec) {
                        var node = this.startNodeAt(start);
                        node.left = left;
                        node.operator = this.tok.value;
                        this.next();
                        if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine()) {
                            node.right = this.dummyIdent();
                        }
                        else {
                            var rightStart = this.storeCurrentPos();
                            node.right = this.parseExprOp(this.parseMaybeUnary(noIn), rightStart, prec, noIn, indent, line);
                        }
                        this.finishNode(node, /&&|\|\|/.test(node.operator) ? "LogicalExpression" : "BinaryExpression");
                        return this.parseExprOp(node, start, minPrec, noIn, indent, line);
                    }
                }
                return left;
            };

            lp.parseMaybeUnary = function(noIn) {
                if (this.tok.type.prefix) {
                    var node = this.startNode(),
                        update = this.tok.type === tt.incDec;
                    node.operator = this.tok.value;
                    node.prefix = true;
                    this.next();
                    node.argument = this.parseMaybeUnary(noIn);
                    if (update) node.argument = this.checkLVal(node.argument);
                    return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
                }
                else if (this.tok.type === tt.ellipsis) {
                    var node = this.startNode();
                    this.next();
                    node.argument = this.parseMaybeUnary(noIn);
                    return this.finishNode(node, "SpreadElement");
                }
                var start = this.storeCurrentPos();
                var expr = this.parseExprSubscripts();
                while (this.tok.type.postfix && !this.canInsertSemicolon()) {
                    var node = this.startNodeAt(start);
                    node.operator = this.tok.value;
                    node.prefix = false;
                    node.argument = this.checkLVal(expr);
                    this.next();
                    expr = this.finishNode(node, "UpdateExpression");
                }
                return expr;
            };

            lp.parseExprSubscripts = function() {
                var start = this.storeCurrentPos();
                return this.parseSubscripts(this.parseExprAtom(), start, false, this.curIndent, this.curLineStart);
            };

            lp.parseSubscripts = function(base, start, noCalls, startIndent, line) {
                for (;;) {
                    if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) {
                        if (this.tok.type == tt.dot && this.curIndent == startIndent)--startIndent;
                        else return base;
                    }

                    if (this.eat(tt.dot)) {
                        var node = this.startNodeAt(start);
                        node.object = base;
                        if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) node.property = this.dummyIdent();
                        else node.property = this.parsePropertyAccessor() || this.dummyIdent();
                        node.computed = false;
                        base = this.finishNode(node, "MemberExpression");
                    }
                    else if (this.tok.type == tt.bracketL) {
                        this.pushCx();
                        this.next();
                        var node = this.startNodeAt(start);
                        node.object = base;
                        node.property = this.parseExpression();
                        node.computed = true;
                        this.popCx();
                        this.expect(tt.bracketR);
                        base = this.finishNode(node, "MemberExpression");
                    }
                    else if (!noCalls && this.tok.type == tt.parenL) {
                        var node = this.startNodeAt(start);
                        node.callee = base;
                        node.arguments = this.parseExprList(tt.parenR);
                        base = this.finishNode(node, "CallExpression");
                    }
                    else if (this.tok.type == tt.backQuote) {
                        var node = this.startNodeAt(start);
                        node.tag = base;
                        node.quasi = this.parseTemplate();
                        base = this.finishNode(node, "TaggedTemplateExpression");
                    }
                    else {
                        return base;
                    }
                }
            };

            lp.parseExprAtom = function() {
                var node = undefined;
                switch (this.tok.type) {
                case tt._this:
                case tt._super:
                    var type = this.tok.type === tt._this ? "ThisExpression" : "Super";
                    node = this.startNode();
                    this.next();
                    return this.finishNode(node, type);

                case tt.name:
                    var start = this.storeCurrentPos();
                    var id = this.parseIdent();
                    return this.eat(tt.arrow) ? this.parseArrowExpression(this.startNodeAt(start), [id]) : id;

                case tt.regexp:
                    node = this.startNode();
                    var val = this.tok.value;
                    node.regex = {
                        pattern: val.pattern,
                        flags: val.flags
                    };
                    node.value = val.value;
                    node.raw = this.input.slice(this.tok.start, this.tok.end);
                    this.next();
                    return this.finishNode(node, "Literal");

                case tt.num:
                case tt.string:
                    node = this.startNode();
                    node.value = this.tok.value;
                    node.raw = this.input.slice(this.tok.start, this.tok.end);
                    this.next();
                    return this.finishNode(node, "Literal");

                case tt._null:
                case tt._true:
                case tt._false:
                    node = this.startNode();
                    node.value = this.tok.type === tt._null ? null : this.tok.type === tt._true;
                    node.raw = this.tok.type.keyword;
                    this.next();
                    return this.finishNode(node, "Literal");

                case tt.parenL:
                    var parenStart = this.storeCurrentPos();
                    this.next();
                    var inner = this.parseExpression();
                    this.expect(tt.parenR);
                    if (this.eat(tt.arrow)) {
                        return this.parseArrowExpression(this.startNodeAt(parenStart), inner.expressions || (isDummy(inner) ? [] : [inner]));
                    }
                    if (this.options.preserveParens) {
                        var par = this.startNodeAt(parenStart);
                        par.expression = inner;
                        inner = this.finishNode(par, "ParenthesizedExpression");
                    }
                    return inner;

                case tt.bracketL:
                    node = this.startNode();
                    node.elements = this.parseExprList(tt.bracketR, true);
                    return this.finishNode(node, "ArrayExpression");

                case tt.braceL:
                    return this.parseObj();

                case tt._class:
                    return this.parseClass();

                case tt._function:
                    node = this.startNode();
                    this.next();
                    return this.parseFunction(node, false);

                case tt._new:
                    return this.parseNew();

                case tt._yield:
                    node = this.startNode();
                    this.next();
                    if (this.semicolon() || this.canInsertSemicolon() || this.tok.type != tt.star && !this.tok.type.startsExpr) {
                        node.delegate = false;
                        node.argument = null;
                    }
                    else {
                        node.delegate = this.eat(tt.star);
                        node.argument = this.parseMaybeAssign();
                    }
                    return this.finishNode(node, "YieldExpression");

                case tt.backQuote:
                    return this.parseTemplate();

                default:
                    return this.dummyIdent();
                }
            };

            lp.parseNew = function() {
                var node = this.startNode(),
                    startIndent = this.curIndent,
                    line = this.curLineStart;
                var meta = this.parseIdent(true);
                if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
                    node.meta = meta;
                    node.property = this.parseIdent(true);
                    return this.finishNode(node, "MetaProperty");
                }
                var start = this.storeCurrentPos();
                node.callee = this.parseSubscripts(this.parseExprAtom(), start, true, startIndent, line);
                if (this.tok.type == tt.parenL) {
                    node.arguments = this.parseExprList(tt.parenR);
                }
                else {
                    node.arguments = [];
                }
                return this.finishNode(node, "NewExpression");
            };

            lp.parseTemplateElement = function() {
                var elem = this.startNode();
                elem.value = {
                    raw: this.input.slice(this.tok.start, this.tok.end),
                    cooked: this.tok.value
                };
                this.next();
                elem.tail = this.tok.type === tt.backQuote;
                return this.finishNode(elem, "TemplateElement");
            };

            lp.parseTemplate = function() {
                var node = this.startNode();
                this.next();
                node.expressions = [];
                var curElt = this.parseTemplateElement();
                node.quasis = [curElt];
                while (!curElt.tail) {
                    this.next();
                    node.expressions.push(this.parseExpression());
                    if (this.expect(tt.braceR)) {
                        curElt = this.parseTemplateElement();
                    }
                    else {
                        curElt = this.startNode();
                        curElt.value = {
                            cooked: "",
                            raw: ""
                        };
                        curElt.tail = true;
                    }
                    node.quasis.push(curElt);
                }
                this.expect(tt.backQuote);
                return this.finishNode(node, "TemplateLiteral");
            };

            lp.parseObj = function() {
                var node = this.startNode();
                node.properties = [];
                this.pushCx();
                var indent = this.curIndent + 1,
                    line = this.curLineStart;
                this.eat(tt.braceL);
                if (this.curIndent + 1 < indent) {
                    indent = this.curIndent;
                    line = this.curLineStart;
                }
                while (!this.closes(tt.braceR, indent, line)) {
                    var prop = this.startNode(),
                        isGenerator = undefined,
                        start = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        start = this.storeCurrentPos();
                        prop.method = false;
                        prop.shorthand = false;
                        isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(prop);
                    if (isDummy(prop.key)) {
                        if (isDummy(this.parseMaybeAssign())) this.next();
                        this.eat(tt.comma);
                        continue;
                    }
                    if (this.eat(tt.colon)) {
                        prop.kind = "init";
                        prop.value = this.parseMaybeAssign();
                    }
                    else if (this.options.ecmaVersion >= 6 && (this.tok.type === tt.parenL || this.tok.type === tt.braceL)) {
                        prop.kind = "init";
                        prop.method = true;
                        prop.value = this.parseMethod(isGenerator);
                    }
                    else if (this.options.ecmaVersion >= 5 && prop.key.type === "Identifier" && !prop.computed && (prop.key.name === "get" || prop.key.name === "set") && (this.tok.type != tt.comma && this.tok.type != tt.braceR)) {
                        prop.kind = prop.key.name;
                        this.parsePropertyName(prop);
                        prop.value = this.parseMethod(false);
                    }
                    else {
                        prop.kind = "init";
                        if (this.options.ecmaVersion >= 6) {
                            if (this.eat(tt.eq)) {
                                var assign = this.startNodeAt(start);
                                assign.operator = "=";
                                assign.left = prop.key;
                                assign.right = this.parseMaybeAssign();
                                prop.value = this.finishNode(assign, "AssignmentExpression");
                            }
                            else {
                                prop.value = prop.key;
                            }
                        }
                        else {
                            prop.value = this.dummyIdent();
                        }
                        prop.shorthand = true;
                    }
                    node.properties.push(this.finishNode(prop, "Property"));
                    this.eat(tt.comma);
                }
                this.popCx();
                if (!this.eat(tt.braceR)) {
                    // If there is no closing brace, make the node span to the start
                    // of the next token (this is useful for Tern)
                    this.last.end = this.tok.start;
                    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
                }
                return this.finishNode(node, "ObjectExpression");
            };

            lp.parsePropertyName = function(prop) {
                if (this.options.ecmaVersion >= 6) {
                    if (this.eat(tt.bracketL)) {
                        prop.computed = true;
                        prop.key = this.parseExpression();
                        this.expect(tt.bracketR);
                        return;
                    }
                    else {
                        prop.computed = false;
                    }
                }
                var key = this.tok.type === tt.num || this.tok.type === tt.string ? this.parseExprAtom() : this.parseIdent();
                prop.key = key || this.dummyIdent();
            };

            lp.parsePropertyAccessor = function() {
                if (this.tok.type === tt.name || this.tok.type.keyword) return this.parseIdent();
            };

            lp.parseIdent = function() {
                var name = this.tok.type === tt.name ? this.tok.value : this.tok.type.keyword;
                if (!name) return this.dummyIdent();
                var node = this.startNode();
                this.next();
                node.name = name;
                return this.finishNode(node, "Identifier");
            };

            lp.initFunction = function(node) {
                node.id = null;
                node.params = [];
                if (this.options.ecmaVersion >= 6) {
                    node.generator = false;
                    node.expression = false;
                }
            };

            // Convert existing expression atom to assignable pattern
            // if possible.

            lp.toAssignable = function(node, binding) {
                if (this.options.ecmaVersion >= 6 && node) {
                    switch (node.type) {
                    case "ObjectExpression":
                        node.type = "ObjectPattern";
                        var props = node.properties;
                        for (var i = 0; i < props.length; i++) {
                            this.toAssignable(props[i].value, binding);
                        }
                        break;

                    case "ArrayExpression":
                        node.type = "ArrayPattern";
                        this.toAssignableList(node.elements, binding);
                        break;

                    case "SpreadElement":
                        node.type = "RestElement";
                        node.argument = this.toAssignable(node.argument, binding);
                        break;

                    case "AssignmentExpression":
                        node.type = "AssignmentPattern";
                        break;
                    }
                }
                return this.checkLVal(node, binding);
            };

            lp.toAssignableList = function(exprList, binding) {
                for (var i = 0; i < exprList.length; i++) {
                    exprList[i] = this.toAssignable(exprList[i], binding);
                }
                return exprList;
            };

            lp.parseFunctionParams = function(params) {
                params = this.parseExprList(tt.parenR);
                return this.toAssignableList(params, true);
            };

            lp.parseMethod = function(isGenerator) {
                var node = this.startNode();
                this.initFunction(node);
                node.params = this.parseFunctionParams();
                node.generator = isGenerator || false;
                node.expression = this.options.ecmaVersion >= 6 && this.tok.type !== tt.braceL;
                node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
                return this.finishNode(node, "FunctionExpression");
            };

            lp.parseArrowExpression = function(node, params) {
                this.initFunction(node);
                node.params = this.toAssignableList(params, true);
                node.expression = this.tok.type !== tt.braceL;
                node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
                return this.finishNode(node, "ArrowFunctionExpression");
            };

            lp.parseExprList = function(close, allowEmpty) {
                this.pushCx();
                var indent = this.curIndent,
                    line = this.curLineStart,
                    elts = [];
                this.next(); // Opening bracket
                while (!this.closes(close, indent + 1, line)) {
                    if (this.eat(tt.comma)) {
                        elts.push(allowEmpty ? null : this.dummyIdent());
                        continue;
                    }
                    var elt = this.parseMaybeAssign();
                    if (isDummy(elt)) {
                        if (this.closes(close, indent, line)) break;
                        this.next();
                    }
                    else {
                        elts.push(elt);
                    }
                    this.eat(tt.comma);
                }
                this.popCx();
                if (!this.eat(close)) {
                    // If there is no closing brace, make the node span to the start
                    // of the next token (this is useful for Tern)
                    this.last.end = this.tok.start;
                    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
                }
                return elts;
            };

        }, {
            "..": 2,
            "./parseutil": 4,
            "./state": 5
        }],
        4: [function(_dereq_, module, exports) {
            "use strict";

            exports.isDummy = isDummy;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var LooseParser = _dereq_("./state").LooseParser;

            var _ = _dereq_("..");

            var Node = _.Node;
            var SourceLocation = _.SourceLocation;
            var lineBreak = _.lineBreak;
            var isNewLine = _.isNewLine;
            var tt = _.tokTypes;

            var lp = LooseParser.prototype;

            lp.startNode = function() {
                var node = new Node();
                node.start = this.tok.start;
                if (this.options.locations) node.loc = new SourceLocation(this.toks, this.tok.loc.start);
                if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
                if (this.options.ranges) node.range = [this.tok.start, 0];
                return node;
            };

            lp.storeCurrentPos = function() {
                return this.options.locations ? [this.tok.start, this.tok.loc.start] : this.tok.start;
            };

            lp.startNodeAt = function(pos) {
                var node = new Node();
                if (this.options.locations) {
                    node.start = pos[0];
                    node.loc = new SourceLocation(this.toks, pos[1]);
                    pos = pos[0];
                }
                else {
                    node.start = pos;
                }
                if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
                if (this.options.ranges) node.range = [pos, 0];
                return node;
            };

            lp.finishNode = function(node, type) {
                node.type = type;
                node.end = this.last.end;
                if (this.options.locations) node.loc.end = this.last.loc.end;
                if (this.options.ranges) node.range[1] = this.last.end;
                return node;
            };

            lp.dummyIdent = function() {
                var dummy = this.startNode();
                dummy.name = "✖";
                return this.finishNode(dummy, "Identifier");
            };

            function isDummy(node) {
                return node.name == "✖";
            }

            lp.eat = function(type) {
                if (this.tok.type === type) {
                    this.next();
                    return true;
                }
                else {
                    return false;
                }
            };

            lp.isContextual = function(name) {
                return this.tok.type === tt.name && this.tok.value === name;
            };

            lp.eatContextual = function(name) {
                return this.tok.value === name && this.eat(tt.name);
            };

            lp.canInsertSemicolon = function() {
                return this.tok.type === tt.eof || this.tok.type === tt.braceR || lineBreak.test(this.input.slice(this.last.end, this.tok.start));
            };

            lp.semicolon = function() {
                return this.eat(tt.semi);
            };

            lp.expect = function(type) {
                if (this.eat(type)) return true;
                for (var i = 1; i <= 2; i++) {
                    if (this.lookAhead(i).type == type) {
                        for (var j = 0; j < i; j++) {
                            this.next();
                        }
                        return true;
                    }
                }
            };

            lp.pushCx = function() {
                this.context.push(this.curIndent);
            };
            lp.popCx = function() {
                this.curIndent = this.context.pop();
            };

            lp.lineEnd = function(pos) {
                while (pos < this.input.length && !isNewLine(this.input.charCodeAt(pos)))++pos;
                return pos;
            };

            lp.indentationAfter = function(pos) {
                for (var count = 0;; ++pos) {
                    var ch = this.input.charCodeAt(pos);
                    if (ch === 32)++count;
                    else if (ch === 9) count += this.options.tabSize;
                    else return count;
                }
            };

            lp.closes = function(closeTok, indent, line, blockHeuristic) {
                if (this.tok.type === closeTok || this.tok.type === tt.eof) return true;
                return line != this.curLineStart && this.curIndent < indent && this.tokenStartsLine() && (!blockHeuristic || this.nextLineStart >= this.input.length || this.indentationAfter(this.nextLineStart) < indent);
            };

            lp.tokenStartsLine = function() {
                for (var p = this.tok.start - 1; p >= this.curLineStart; --p) {
                    var ch = this.input.charCodeAt(p);
                    if (ch !== 9 && ch !== 32) return false;
                }
                return true;
            };

        }, {
            "..": 2,
            "./state": 5
        }],
        5: [function(_dereq_, module, exports) {
            "use strict";

            exports.LooseParser = LooseParser;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var _ = _dereq_("..");

            var tokenizer = _.tokenizer;
            var SourceLocation = _.SourceLocation;
            var tt = _.tokTypes;

            function LooseParser(input, options) {
                this.toks = tokenizer(input, options);
                this.options = this.toks.options;
                this.input = this.toks.input;
                this.tok = this.last = {
                    type: tt.eof,
                    start: 0,
                    end: 0
                };
                if (this.options.locations) {
                    var here = this.toks.curPosition();
                    this.tok.loc = new SourceLocation(this.toks, here, here);
                }
                this.ahead = []; // Tokens ahead
                this.context = []; // Indentation contexted
                this.curIndent = 0;
                this.curLineStart = 0;
                this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
            }

        }, {
            "..": 2
        }],
        6: [function(_dereq_, module, exports) {
            "use strict";

            var LooseParser = _dereq_("./state").LooseParser;

            var isDummy = _dereq_("./parseutil").isDummy;

            var _ = _dereq_("..");

            var getLineInfo = _.getLineInfo;
            var tt = _.tokTypes;

            var lp = LooseParser.prototype;

            lp.parseTopLevel = function() {
                var node = this.startNodeAt(this.options.locations ? [0, getLineInfo(this.input, 0)] : 0);
                node.body = [];
                while (this.tok.type !== tt.eof) node.body.push(this.parseStatement());
                this.last = this.tok;
                if (this.options.ecmaVersion >= 6) {
                    node.sourceType = this.options.sourceType;
                }
                return this.finishNode(node, "Program");
            };

            lp.parseStatement = function() {
                var starttype = this.tok.type,
                    node = this.startNode();

                switch (starttype) {
                case tt._break:
                case tt._continue:
                    this.next();
                    var isBreak = starttype === tt._break;
                    if (this.semicolon() || this.canInsertSemicolon()) {
                        node.label = null;
                    }
                    else {
                        node.label = this.tok.type === tt.name ? this.parseIdent() : null;
                        this.semicolon();
                    }
                    return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");

                case tt._debugger:
                    this.next();
                    this.semicolon();
                    return this.finishNode(node, "DebuggerStatement");

                case tt._do:
                    this.next();
                    node.body = this.parseStatement();
                    node.test = this.eat(tt._while) ? this.parseParenExpression() : this.dummyIdent();
                    this.semicolon();
                    return this.finishNode(node, "DoWhileStatement");

                case tt._for:
                    this.next();
                    this.pushCx();
                    this.expect(tt.parenL);
                    if (this.tok.type === tt.semi) return this.parseFor(node, null);
                    if (this.tok.type === tt._var || this.tok.type === tt._let || this.tok.type === tt._const) {
                        var _init = this.parseVar(true);
                        if (_init.declarations.length === 1 && (this.tok.type === tt._in || this.isContextual("of"))) {
                            return this.parseForIn(node, _init);
                        }
                        return this.parseFor(node, _init);
                    }
                    var init = this.parseExpression(true);
                    if (this.tok.type === tt._in || this.isContextual("of")) return this.parseForIn(node, this.toAssignable(init));
                    return this.parseFor(node, init);

                case tt._function:
                    this.next();
                    return this.parseFunction(node, true);

                case tt._if:
                    this.next();
                    node.test = this.parseParenExpression();
                    node.consequent = this.parseStatement();
                    node.alternate = this.eat(tt._else) ? this.parseStatement() : null;
                    return this.finishNode(node, "IfStatement");

                case tt._return:
                    this.next();
                    if (this.eat(tt.semi) || this.canInsertSemicolon()) node.argument = null;
                    else {
                        node.argument = this.parseExpression();
                        this.semicolon();
                    }
                    return this.finishNode(node, "ReturnStatement");

                case tt._switch:
                    var blockIndent = this.curIndent,
                        line = this.curLineStart;
                    this.next();
                    node.discriminant = this.parseParenExpression();
                    node.cases = [];
                    this.pushCx();
                    this.expect(tt.braceL);

                    var cur = undefined;
                    while (!this.closes(tt.braceR, blockIndent, line, true)) {
                        if (this.tok.type === tt._case || this.tok.type === tt._default) {
                            var isCase = this.tok.type === tt._case;
                            if (cur) this.finishNode(cur, "SwitchCase");
                            node.cases.push(cur = this.startNode());
                            cur.consequent = [];
                            this.next();
                            if (isCase) cur.test = this.parseExpression();
                            else cur.test = null;
                            this.expect(tt.colon);
                        }
                        else {
                            if (!cur) {
                                node.cases.push(cur = this.startNode());
                                cur.consequent = [];
                                cur.test = null;
                            }
                            cur.consequent.push(this.parseStatement());
                        }
                    }
                    if (cur) this.finishNode(cur, "SwitchCase");
                    this.popCx();
                    this.eat(tt.braceR);
                    return this.finishNode(node, "SwitchStatement");

                case tt._throw:
                    this.next();
                    node.argument = this.parseExpression();
                    this.semicolon();
                    return this.finishNode(node, "ThrowStatement");

                case tt._try:
                    this.next();
                    node.block = this.parseBlock();
                    node.handler = null;
                    if (this.tok.type === tt._catch) {
                        var clause = this.startNode();
                        this.next();
                        this.expect(tt.parenL);
                        clause.param = this.toAssignable(this.parseExprAtom(), true);
                        this.expect(tt.parenR);
                        clause.guard = null;
                        clause.body = this.parseBlock();
                        node.handler = this.finishNode(clause, "CatchClause");
                    }
                    node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;
                    if (!node.handler && !node.finalizer) return node.block;
                    return this.finishNode(node, "TryStatement");

                case tt._var:
                case tt._let:
                case tt._const:
                    return this.parseVar();

                case tt._while:
                    this.next();
                    node.test = this.parseParenExpression();
                    node.body = this.parseStatement();
                    return this.finishNode(node, "WhileStatement");

                case tt._with:
                    this.next();
                    node.object = this.parseParenExpression();
                    node.body = this.parseStatement();
                    return this.finishNode(node, "WithStatement");

                case tt.braceL:
                    return this.parseBlock();

                case tt.semi:
                    this.next();
                    return this.finishNode(node, "EmptyStatement");

                case tt._class:
                    return this.parseClass(true);

                case tt._import:
                    return this.parseImport();

                case tt._export:
                    return this.parseExport();

                default:
                    var expr = this.parseExpression();
                    if (isDummy(expr)) {
                        this.next();
                        if (this.tok.type === tt.eof) return this.finishNode(node, "EmptyStatement");
                        return this.parseStatement();
                    }
                    else if (starttype === tt.name && expr.type === "Identifier" && this.eat(tt.colon)) {
                        node.body = this.parseStatement();
                        node.label = expr;
                        return this.finishNode(node, "LabeledStatement");
                    }
                    else {
                        node.expression = expr;
                        this.semicolon();
                        return this.finishNode(node, "ExpressionStatement");
                    }
                }
            };

            lp.parseBlock = function() {
                var node = this.startNode();
                this.pushCx();
                this.expect(tt.braceL);
                var blockIndent = this.curIndent,
                    line = this.curLineStart;
                node.body = [];
                while (!this.closes(tt.braceR, blockIndent, line, true)) node.body.push(this.parseStatement());
                this.popCx();
                this.eat(tt.braceR);
                return this.finishNode(node, "BlockStatement");
            };

            lp.parseFor = function(node, init) {
                node.init = init;
                node.test = node.update = null;
                if (this.eat(tt.semi) && this.tok.type !== tt.semi) node.test = this.parseExpression();
                if (this.eat(tt.semi) && this.tok.type !== tt.parenR) node.update = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                node.body = this.parseStatement();
                return this.finishNode(node, "ForStatement");
            };

            lp.parseForIn = function(node, init) {
                var type = this.tok.type === tt._in ? "ForInStatement" : "ForOfStatement";
                this.next();
                node.left = init;
                node.right = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                node.body = this.parseStatement();
                return this.finishNode(node, type);
            };

            lp.parseVar = function(noIn) {
                var node = this.startNode();
                node.kind = this.tok.type.keyword;
                this.next();
                node.declarations = [];
                do {
                    var decl = this.startNode();
                    decl.id = this.options.ecmaVersion >= 6 ? this.toAssignable(this.parseExprAtom(), true) : this.parseIdent();
                    decl.init = this.eat(tt.eq) ? this.parseMaybeAssign(noIn) : null;
                    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
                } while (this.eat(tt.comma));
                if (!node.declarations.length) {
                    var decl = this.startNode();
                    decl.id = this.dummyIdent();
                    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
                }
                if (!noIn) this.semicolon();
                return this.finishNode(node, "VariableDeclaration");
            };

            lp.parseClass = function(isStatement) {
                var node = this.startNode();
                this.next();
                if (this.tok.type === tt.name) node.id = this.parseIdent();
                else if (isStatement) node.id = this.dummyIdent();
                else node.id = null;
                node.superClass = this.eat(tt._extends) ? this.parseExpression() : null;
                node.body = this.startNode();
                node.body.body = [];
                this.pushCx();
                var indent = this.curIndent + 1,
                    line = this.curLineStart;
                this.eat(tt.braceL);
                if (this.curIndent + 1 < indent) {
                    indent = this.curIndent;
                    line = this.curLineStart;
                }
                while (!this.closes(tt.braceR, indent, line)) {
                    if (this.semicolon()) continue;
                    var method = this.startNode(),
                        isGenerator = undefined,
                        start = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        method["static"] = false;
                        isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(method);
                    if (isDummy(method.key)) {
                        if (isDummy(this.parseMaybeAssign())) this.next();
                        this.eat(tt.comma);
                        continue;
                    }
                    if (method.key.type === "Identifier" && !method.computed && method.key.name === "static" && (this.tok.type != tt.parenL && this.tok.type != tt.braceL)) {
                        method["static"] = true;
                        isGenerator = this.eat(tt.star);
                        this.parsePropertyName(method);
                    }
                    else {
                        method["static"] = false;
                    }
                    if (this.options.ecmaVersion >= 5 && method.key.type === "Identifier" && !method.computed && (method.key.name === "get" || method.key.name === "set") && this.tok.type !== tt.parenL && this.tok.type !== tt.braceL) {
                        method.kind = method.key.name;
                        this.parsePropertyName(method);
                        method.value = this.parseMethod(false);
                    }
                    else {
                        if (!method.computed && !method["static"] && !isGenerator && (method.key.type === "Identifier" && method.key.name === "constructor" || method.key.type === "Literal" && method.key.value === "constructor")) {
                            method.kind = "constructor";
                        }
                        else {
                            method.kind = "method";
                        }
                        method.value = this.parseMethod(isGenerator);
                    }
                    node.body.body.push(this.finishNode(method, "MethodDefinition"));
                }
                this.popCx();
                if (!this.eat(tt.braceR)) {
                    // If there is no closing brace, make the node span to the start
                    // of the next token (this is useful for Tern)
                    this.last.end = this.tok.start;
                    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
                }
                this.semicolon();
                this.finishNode(node.body, "ClassBody");
                return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
            };

            lp.parseFunction = function(node, isStatement) {
                this.initFunction(node);
                if (this.options.ecmaVersion >= 6) {
                    node.generator = this.eat(tt.star);
                }
                if (this.tok.type === tt.name) node.id = this.parseIdent();
                else if (isStatement) node.id = this.dummyIdent();
                node.params = this.parseFunctionParams();
                node.body = this.parseBlock();
                return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
            };

            lp.parseExport = function() {
                var node = this.startNode();
                this.next();
                if (this.eat(tt.star)) {
                    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
                    return this.finishNode(node, "ExportAllDeclaration");
                }
                if (this.eat(tt._default)) {
                    var expr = this.parseMaybeAssign();
                    if (expr.id) {
                        switch (expr.type) {
                        case "FunctionExpression":
                            expr.type = "FunctionDeclaration";
                            break;
                        case "ClassExpression":
                            expr.type = "ClassDeclaration";
                            break;
                        }
                    }
                    node.declaration = expr;
                    this.semicolon();
                    return this.finishNode(node, "ExportDefaultDeclaration");
                }
                if (this.tok.type.keyword) {
                    node.declaration = this.parseStatement();
                    node.specifiers = [];
                    node.source = null;
                }
                else {
                    node.declaration = null;
                    node.specifiers = this.parseExportSpecifierList();
                    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
                    this.semicolon();
                }
                return this.finishNode(node, "ExportNamedDeclaration");
            };

            lp.parseImport = function() {
                var node = this.startNode();
                this.next();
                if (this.tok.type === tt.string) {
                    node.specifiers = [];
                    node.source = this.parseExprAtom();
                    node.kind = "";
                }
                else {
                    var elt = undefined;
                    if (this.tok.type === tt.name && this.tok.value !== "from") {
                        elt = this.startNode();
                        elt.local = this.parseIdent();
                        this.finishNode(elt, "ImportDefaultSpecifier");
                        this.eat(tt.comma);
                    }
                    node.specifiers = this.parseImportSpecifierList();
                    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
                    if (elt) node.specifiers.unshift(elt);
                }
                this.semicolon();
                return this.finishNode(node, "ImportDeclaration");
            };

            lp.parseImportSpecifierList = function() {
                var elts = [];
                if (this.tok.type === tt.star) {
                    var elt = this.startNode();
                    this.next();
                    if (this.eatContextual("as")) elt.local = this.parseIdent();
                    elts.push(this.finishNode(elt, "ImportNamespaceSpecifier"));
                }
                else {
                    var indent = this.curIndent,
                        line = this.curLineStart,
                        continuedLine = this.nextLineStart;
                    this.pushCx();
                    this.eat(tt.braceL);
                    if (this.curLineStart > continuedLine) continuedLine = this.curLineStart;
                    while (!this.closes(tt.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
                        var elt = this.startNode();
                        if (this.eat(tt.star)) {
                            if (this.eatContextual("as")) elt.local = this.parseIdent();
                            this.finishNode(elt, "ImportNamespaceSpecifier");
                        }
                        else {
                            if (this.isContextual("from")) break;
                            elt.imported = this.parseIdent();
                            elt.local = this.eatContextual("as") ? this.parseIdent() : elt.imported;
                            this.finishNode(elt, "ImportSpecifier");
                        }
                        elts.push(elt);
                        this.eat(tt.comma);
                    }
                    this.eat(tt.braceR);
                    this.popCx();
                }
                return elts;
            };

            lp.parseExportSpecifierList = function() {
                var elts = [];
                var indent = this.curIndent,
                    line = this.curLineStart,
                    continuedLine = this.nextLineStart;
                this.pushCx();
                this.eat(tt.braceL);
                if (this.curLineStart > continuedLine) continuedLine = this.curLineStart;
                while (!this.closes(tt.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
                    if (this.isContextual("from")) break;
                    var elt = this.startNode();
                    elt.local = this.parseIdent();
                    elt.exported = this.eatContextual("as") ? this.parseIdent() : elt.local;
                    this.finishNode(elt, "ExportSpecifier");
                    elts.push(elt);
                    this.eat(tt.comma);
                }
                this.eat(tt.braceR);
                this.popCx();
                return elts;
            };

        }, {
            "..": 2,
            "./parseutil": 4,
            "./state": 5
        }],
        7: [function(_dereq_, module, exports) {
            "use strict";

            var _ = _dereq_("..");

            var tt = _.tokTypes;
            var Token = _.Token;
            var isNewLine = _.isNewLine;
            var SourceLocation = _.SourceLocation;
            var getLineInfo = _.getLineInfo;
            var lineBreakG = _.lineBreakG;

            var LooseParser = _dereq_("./state").LooseParser;

            var lp = LooseParser.prototype;

            function isSpace(ch) {
                return ch < 14 && ch > 8 || ch === 32 || ch === 160 || isNewLine(ch);
            }

            lp.next = function() {
                this.last = this.tok;
                if (this.ahead.length) this.tok = this.ahead.shift();
                else this.tok = this.readToken();

                if (this.tok.start >= this.nextLineStart) {
                    while (this.tok.start >= this.nextLineStart) {
                        this.curLineStart = this.nextLineStart;
                        this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
                    }
                    this.curIndent = this.indentationAfter(this.curLineStart);
                }
            };

            lp.readToken = function() {
                for (;;) {
                    try {
                        this.toks.next();
                        if (this.toks.type === tt.dot && this.input.substr(this.toks.end, 1) === "." && this.options.ecmaVersion >= 6) {
                            this.toks.end++;
                            this.toks.type = tt.ellipsis;
                        }
                        return new Token(this.toks);
                    }
                    catch (e) {
                        if (!(e instanceof SyntaxError)) throw e;

                        // Try to skip some text, based on the error message, and then continue
                        var msg = e.message,
                            pos = e.raisedAt,
                            replace = true;
                        if (/unterminated/i.test(msg)) {
                            pos = this.lineEnd(e.pos + 1);
                            if (/string/.test(msg)) {
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.string,
                                    value: this.input.slice(e.pos + 1, pos)
                                };
                            }
                            else if (/regular expr/i.test(msg)) {
                                var re = this.input.slice(e.pos, pos);
                                try {
                                    re = new RegExp(re);
                                }
                                catch (e) {}
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.regexp,
                                    value: re
                                };
                            }
                            else if (/template/.test(msg)) {
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.template,
                                    value: this.input.slice(e.pos, pos)
                                };
                            }
                            else {
                                replace = false;
                            }
                        }
                        else if (/invalid (unicode|regexp|number)|expecting unicode|octal literal|is reserved|directly after number/i.test(msg)) {
                            while (pos < this.input.length && !isSpace(this.input.charCodeAt(pos)))++pos;
                        }
                        else if (/character escape|expected hexadecimal/i.test(msg)) {
                            while (pos < this.input.length) {
                                var ch = this.input.charCodeAt(pos++);
                                if (ch === 34 || ch === 39 || isNewLine(ch)) break;
                            }
                        }
                        else if (/unexpected character/i.test(msg)) {
                            pos++;
                            replace = false;
                        }
                        else if (/regular expression/i.test(msg)) {
                            replace = true;
                        }
                        else {
                            throw e;
                        }
                        this.resetTo(pos);
                        if (replace === true) replace = {
                            start: pos,
                            end: pos,
                            type: tt.name,
                            value: "✖"
                        };
                        if (replace) {
                            if (this.options.locations) replace.loc = new SourceLocation(this.toks, getLineInfo(this.input, replace.start), getLineInfo(this.input, replace.end));
                            return replace;
                        }
                    }
                }
            };

            lp.resetTo = function(pos) {
                this.toks.pos = pos;
                var ch = this.input.charAt(pos - 1);
                this.toks.exprAllowed = !ch || /[\[\{\(,;:?\/*=+\-~!|&%^<>]/.test(ch) || /[enwfd]/.test(ch) && /\b(keywords|case|else|return|throw|new|in|(instance|type)of|delete|void)$/.test(this.input.slice(pos - 10, pos));

                if (this.options.locations) {
                    this.toks.curLine = 1;
                    this.toks.lineStart = lineBreakG.lastIndex = 0;
                    var match = undefined;
                    while ((match = lineBreakG.exec(this.input)) && match.index < pos) {
                        ++this.toks.curLine;
                        this.toks.lineStart = match.index + match[0].length;
                    }
                }
            };

            lp.lookAhead = function(n) {
                while (n > this.ahead.length) this.ahead.push(this.readToken());
                return this.ahead[n - 1];
            };

        }, {
            "..": 2,
            "./state": 5
        }]
    }, {}, [1])(1)
});

//#endregion


//#region acorn/dist/walk.js

(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    }
    else if (typeof define === "function" && define.amd) {
        define([], f)
    }
    else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        }
        else if (typeof global !== "undefined") {
            g = global
        }
        else if (typeof self !== "undefined") {
            g = self
        }
        else {
            g = this
        }(g.acorn || (g.acorn = {})).walk = f()
    }
})(function() {
    var define, module, exports;
    return (function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {
                    exports: {}
                };
                t[o][0].call(l.exports, function(e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }
        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    })({
        1: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            // AST walker module for Mozilla Parser API compatible trees

            // A simple walk is one where you simply specify callbacks to be
            // called on specific nodes. The last two arguments are optional. A
            // simple use would be
            //
            //     walk.simple(myTree, {
            //         Expression: function(node) { ... }
            //     });
            //
            // to do something with all expressions. All Parser API node types
            // can be used to identify node types, as well as Expression,
            // Statement, and ScopeBody, which denote categories of nodes.
            //
            // The base argument can be used to pass a custom (recursive)
            // walker, and state can be used to give this walked an initial
            // state.

            exports.simple = simple;

            // An ancestor walk builds up an array of ancestor nodes (including
            // the current node) and passes them to the callback as the state parameter.
            exports.ancestor = ancestor;

            // A recursive walk is one where your functions override the default
            // walkers. They can modify and replace the state parameter that's
            // threaded through the walk, and can opt how and whether to walk
            // their child nodes (by calling their third argument on these
            // nodes).
            exports.recursive = recursive;

            // Find a node with a given start, end, and type (all are optional,
            // null can be used as wildcard). Returns a {node, state} object, or
            // undefined when it doesn't find a matching node.
            exports.findNodeAt = findNodeAt;

            // Find the innermost node of a given type that contains the given
            // position. Interface similar to findNodeAt.
            exports.findNodeAround = findNodeAround;

            // Find the outermost matching node after a given position.
            exports.findNodeAfter = findNodeAfter;

            // Find the outermost matching node before a given position.
            exports.findNodeBefore = findNodeBefore;

            // Used to create a custom walker. Will fill in all missing node
            // type properties with the defaults.
            exports.make = make;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            function simple(node, visitors, base, state) {
                if (!base) base = exports.base;
                (function c(node, st, override) {
                    var type = override || node.type,
                        found = visitors[type];
                    base[type](node, st, c);
                    if (found) found(node, st);
                })(node, state);
            }

            function ancestor(node, visitors, base, state) {
                if (!base) base = exports.base;
                if (!state) state = [];
                (function c(node, st, override) {
                    var type = override || node.type,
                        found = visitors[type];
                    if (node != st[st.length - 1]) {
                        st = st.slice();
                        st.push(node);
                    }
                    base[type](node, st, c);
                    if (found) found(node, st);
                })(node, state);
            }

            function recursive(node, state, funcs, base) {
                var visitor = funcs ? exports.make(funcs, base) : base;
                (function c(node, st, override) {
                    visitor[override || node.type](node, st, c);
                })(node, state);
            }

            function makeTest(test) {
                if (typeof test == "string") {
                    return function(type) {
                        return type == test;
                    };
                }
                else if (!test) {
                    return function() {
                        return true;
                    };
                }
                else {
                    return test;
                }
            }

            var Found = function Found(node, state) {
                _classCallCheck(this, Found);

                this.node = node;
                this.state = state;
            };

            function findNodeAt(node, start, end, test, base, state) {
                test = makeTest(test);
                if (!base) base = exports.base;
                try {;
                    (function c(node, st, override) {
                        var type = override || node.type;
                        if ((start == null || node.start <= start) && (end == null || node.end >= end)) base[type](node, st, c);
                        if (test(type, node) && (start == null || node.start == start) && (end == null || node.end == end)) throw new Found(node, st);
                    })(node, state);
                }
                catch (e) {
                    if (e instanceof Found) {
                        return e;
                    }
                    throw e;
                }
            }

            function findNodeAround(node, pos, test, base, state) {
                test = makeTest(test);
                if (!base) base = exports.base;
                try {;
                    (function c(node, st, override) {
                        var type = override || node.type;
                        if (node.start > pos || node.end < pos) {
                            return;
                        }
                        base[type](node, st, c);
                        if (test(type, node)) throw new Found(node, st);
                    })(node, state);
                }
                catch (e) {
                    if (e instanceof Found) {
                        return e;
                    }
                    throw e;
                }
            }

            function findNodeAfter(node, pos, test, base, state) {
                test = makeTest(test);
                if (!base) base = exports.base;
                try {;
                    (function c(node, st, override) {
                        if (node.end < pos) {
                            return;
                        }
                        var type = override || node.type;
                        if (node.start >= pos && test(type, node)) throw new Found(node, st);
                        base[type](node, st, c);
                    })(node, state);
                }
                catch (e) {
                    if (e instanceof Found) {
                        return e;
                    }
                    throw e;
                }
            }

            function findNodeBefore(node, pos, test, base, state) {
                test = makeTest(test);
                if (!base) base = exports.base;
                var max = undefined;
                (function c(node, st, override) {
                    if (node.start > pos) {
                        return;
                    }
                    var type = override || node.type;
                    if (node.end <= pos && (!max || max.node.end < node.end) && test(type, node)) max = new Found(node, st);
                    base[type](node, st, c);
                })(node, state);
                return max;
            }

            function make(funcs, base) {
                if (!base) base = exports.base;
                var visitor = {};
                for (var type in base) visitor[type] = base[type];
                for (var type in funcs) visitor[type] = funcs[type];
                return visitor;
            }

            function skipThrough(node, st, c) {
                c(node, st);
            }

            function ignore(_node, _st, _c) {}

            // Node walkers.

            var base = {};

            exports.base = base;
            base.Program = base.BlockStatement = function(node, st, c) {
                for (var i = 0; i < node.body.length; ++i) {
                    c(node.body[i], st, "Statement");
                }
            };
            base.Statement = skipThrough;
            base.EmptyStatement = ignore;
            base.ExpressionStatement = base.ParenthesizedExpression = function(node, st, c) {
                return c(node.expression, st, "Expression");
            };
            base.IfStatement = function(node, st, c) {
                c(node.test, st, "Expression");
                c(node.consequent, st, "Statement");
                if (node.alternate) c(node.alternate, st, "Statement");
            };
            base.LabeledStatement = function(node, st, c) {
                return c(node.body, st, "Statement");
            };
            base.BreakStatement = base.ContinueStatement = ignore;
            base.WithStatement = function(node, st, c) {
                c(node.object, st, "Expression");
                c(node.body, st, "Statement");
            };
            base.SwitchStatement = function(node, st, c) {
                c(node.discriminant, st, "Expression");
                for (var i = 0; i < node.cases.length; ++i) {
                    var cs = node.cases[i];
                    if (cs.test) c(cs.test, st, "Expression");
                    for (var j = 0; j < cs.consequent.length; ++j) {
                        c(cs.consequent[j], st, "Statement");
                    }
                }
            };
            base.ReturnStatement = base.YieldExpression = function(node, st, c) {
                if (node.argument) c(node.argument, st, "Expression");
            };
            base.ThrowStatement = base.SpreadElement = base.RestElement = function(node, st, c) {
                return c(node.argument, st, "Expression");
            };
            base.TryStatement = function(node, st, c) {
                c(node.block, st, "Statement");
                if (node.handler) c(node.handler.body, st, "ScopeBody");
                if (node.finalizer) c(node.finalizer, st, "Statement");
            };
            base.WhileStatement = base.DoWhileStatement = function(node, st, c) {
                c(node.test, st, "Expression");
                c(node.body, st, "Statement");
            };
            base.ForStatement = function(node, st, c) {
                if (node.init) c(node.init, st, "ForInit");
                if (node.test) c(node.test, st, "Expression");
                if (node.update) c(node.update, st, "Expression");
                c(node.body, st, "Statement");
            };
            base.ForInStatement = base.ForOfStatement = function(node, st, c) {
                c(node.left, st, "ForInit");
                c(node.right, st, "Expression");
                c(node.body, st, "Statement");
            };
            base.ForInit = function(node, st, c) {
                if (node.type == "VariableDeclaration") c(node, st);
                else c(node, st, "Expression");
            };
            base.DebuggerStatement = ignore;

            base.FunctionDeclaration = function(node, st, c) {
                return c(node, st, "Function");
            };
            base.VariableDeclaration = function(node, st, c) {
                for (var i = 0; i < node.declarations.length; ++i) {
                    var decl = node.declarations[i];
                    if (decl.init) c(decl.init, st, "Expression");
                }
            };

            base.Function = function(node, st, c) {
                return c(node.body, st, "ScopeBody");
            };
            base.ScopeBody = function(node, st, c) {
                return c(node, st, "Statement");
            };

            base.Expression = skipThrough;
            base.ThisExpression = base.Super = base.MetaProperty = ignore;
            base.ArrayExpression = base.ArrayPattern = function(node, st, c) {
                for (var i = 0; i < node.elements.length; ++i) {
                    var elt = node.elements[i];
                    if (elt) c(elt, st, "Expression");
                }
            };
            base.ObjectExpression = base.ObjectPattern = function(node, st, c) {
                for (var i = 0; i < node.properties.length; ++i) {
                    c(node.properties[i], st);
                }
            };
            base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
            base.SequenceExpression = base.TemplateLiteral = function(node, st, c) {
                for (var i = 0; i < node.expressions.length; ++i) {
                    c(node.expressions[i], st, "Expression");
                }
            };
            base.UnaryExpression = base.UpdateExpression = function(node, st, c) {
                c(node.argument, st, "Expression");
            };
            base.BinaryExpression = base.AssignmentExpression = base.AssignmentPattern = base.LogicalExpression = function(node, st, c) {
                c(node.left, st, "Expression");
                c(node.right, st, "Expression");
            };
            base.ConditionalExpression = function(node, st, c) {
                c(node.test, st, "Expression");
                c(node.consequent, st, "Expression");
                c(node.alternate, st, "Expression");
            };
            base.NewExpression = base.CallExpression = function(node, st, c) {
                c(node.callee, st, "Expression");
                if (node.arguments) for (var i = 0; i < node.arguments.length; ++i) {
                    c(node.arguments[i], st, "Expression");
                }
            };
            base.MemberExpression = function(node, st, c) {
                c(node.object, st, "Expression");
                if (node.computed) c(node.property, st, "Expression");
            };
            base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function(node, st, c) {
                return c(node.declaration, st);
            };
            base.ImportDeclaration = function(node, st, c) {
                for (var i = 0; i < node.specifiers.length; i++) {
                    c(node.specifiers[i], st);
                }
            };
            base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.Literal = ignore;

            base.TaggedTemplateExpression = function(node, st, c) {
                c(node.tag, st, "Expression");
                c(node.quasi, st);
            };
            base.ClassDeclaration = base.ClassExpression = function(node, st, c) {
                if (node.superClass) c(node.superClass, st, "Expression");
                for (var i = 0; i < node.body.body.length; i++) {
                    c(node.body.body[i], st);
                }
            };
            base.MethodDefinition = base.Property = function(node, st, c) {
                if (node.computed) c(node.key, st, "Expression");
                c(node.value, st, "Expression");
            };
            base.ComprehensionExpression = function(node, st, c) {
                for (var i = 0; i < node.blocks.length; i++) {
                    c(node.blocks[i].right, st, "Expression");
                }
                c(node.body, st, "Expression");
            };

        }, {}]
    }, {}, [1])(1)
});

//#endregion


//#region tern/lib/signal.js

(function(root, mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(exports);
    if (typeof define == "function" && define.amd) // AMD
    return define(["exports"], mod);
    mod((root.tern || (root.tern = {})).signal = {}); // Plain browser env
})(this, function(exports) {
    function on(type, f) {
        var handlers = this._handlers || (this._handlers = Object.create(null));
        (handlers[type] || (handlers[type] = [])).push(f);
    }

    function off(type, f) {
        var arr = this._handlers && this._handlers[type];
        if (arr) for (var i = 0; i < arr.length; ++i)
        if (arr[i] == f) {
            arr.splice(i, 1);
            break;
        }
    }

    function signal(type, a1, a2, a3, a4) {
        var arr = this._handlers && this._handlers[type];
        if (arr) for (var i = 0; i < arr.length; ++i) arr[i].call(this, a1, a2, a3, a4);
    }

    exports.mixin = function(obj) {
        obj.on = on;
        obj.off = off;
        obj.signal = signal;
        return obj;
    };
});

//#endregion


//#region tern/lib/tern.js

// The Tern server object

// A server is a stateful object that manages the analysis for a
// project, and defines an interface for querying the code in the
// project.

(function(root, mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(exports, require("./infer"), require("./signal"),
    require("acorn"), require("acorn/dist/walk"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["exports", "./infer", "./signal", "acorn/dist/acorn", "acorn/dist/walk"], mod);
    mod(root.tern || (root.tern = {}), tern, tern.signal, acorn, acorn.walk); // Plain browser env
})(this, function(exports, infer, signal, acorn, walk) {
    "use strict";

    var plugins = Object.create(null);
    exports.registerPlugin = function(name, init) {
        plugins[name] = init;
    };

    var defaultOptions = exports.defaultOptions = {
        debug: false,
        async: false,
        getFile: function(_f, c) {
            if (this.async) c(null, null);
        },
        defs: [],
        plugins: {},
        fetchTimeout: 1000,
        dependencyBudget: 20000,
        reuseInstances: true,
        stripCRs: false
    };

    var queryTypes = {
        completions: {
            takesFile: true,
            run: findCompletions
        },
        properties: {
            run: findProperties
        },
        type: {
            takesFile: true,
            run: findTypeAt
        },
        documentation: {
            takesFile: true,
            run: findDocs
        },
        definition: {
            takesFile: true,
            run: findDef
        },
        refs: {
            takesFile: true,
            fullFile: true,
            run: findRefs
        },
        rename: {
            takesFile: true,
            fullFile: true,
            run: buildRename
        },
        files: {
            run: listFiles
        }
    };

    exports.defineQueryType = function(name, desc) {
        queryTypes[name] = desc;
    };

    function File(name, parent) {
        this.name = name;
        this.parent = parent;
        this.scope = this.text = this.ast = this.lineOffsets = null;
    }
    File.prototype.asLineChar = function(pos) {
        return asLineChar(this, pos);
    };

    function updateText(file, text, srv) {
        file.text = srv.options.stripCRs ? text.replace(/\r\n/g, "\n") : text;
        infer.withContext(srv.cx, function() {
            file.ast = infer.parse(file.text, srv.passes, {
                directSourceFile: file,
                allowReturnOutsideFunction: true
            });
        });
        file.lineOffsets = null;
    }

    var Server = exports.Server = function(options) {
        this.cx = null;
        this.options = options || {};
        for (var o in defaultOptions) if (!options.hasOwnProperty(o)) options[o] = defaultOptions[o];

        this.handlers = Object.create(null);
        this.files = [];
        this.fileMap = Object.create(null);
        this.needsPurge = [];
        this.budgets = Object.create(null);
        this.uses = 0;
        this.pending = 0;
        this.asyncError = null;
        this.passes = Object.create(null);

        this.defs = options.defs.slice(0);
        for (var plugin in options.plugins) if (options.plugins.hasOwnProperty(plugin) && plugin in plugins) {
            var init = plugins[plugin](this, options.plugins[plugin]);
            if (init && init.defs) {
                if (init.loadFirst) this.defs.unshift(init.defs);
                else this.defs.push(init.defs);
            }
            if (init && init.passes) for (var type in init.passes) if (init.passes.hasOwnProperty(type))
            (this.passes[type] || (this.passes[type] = [])).push(init.passes[type]);
        }

        this.reset();
    };
    Server.prototype = signal.mixin({
        addFile: function(name, /*optional*/ text, parent) {
            // Don't crash when sloppy plugins pass non-existent parent ids
            if (parent && !(parent in this.fileMap)) parent = null;
            ensureFile(this, name, parent, text);
        },
        delFile: function(name) {
            var file = this.findFile(name);
            if (file) {
                this.needsPurge.push(file.name);
                this.files.splice(this.files.indexOf(file), 1);
                delete this.fileMap[name];
            }
        },
        reset: function() {
            this.signal("reset");
            this.cx = new infer.Context(this.defs, this);
            this.uses = 0;
            this.budgets = Object.create(null);
            for (var i = 0; i < this.files.length; ++i) {
                var file = this.files[i];
                file.scope = null;
            }
        },

        request: function(doc, c) {
            var inv = invalidDoc(doc);
            if (inv) return c(inv);

            var self = this;
            doRequest(this, doc, function(err, data) {
                c(err, data);
                if (self.uses > 40) {
                    self.reset();
                    analyzeAll(self, null, function() {});
                }
            });
        },

        findFile: function(name) {
            return this.fileMap[name];
        },

        flush: function(c) {
            var cx = this.cx;
            analyzeAll(this, null, function(err) {
                if (err) return c(err);
                infer.withContext(cx, c);
            });
        },

        startAsyncAction: function() {
            ++this.pending;
        },
        finishAsyncAction: function(err) {
            if (err) this.asyncError = err;
            if (--this.pending === 0) this.signal("everythingFetched");
        }
    });

    function doRequest(srv, doc, c) {
        if (doc.query && !queryTypes.hasOwnProperty(doc.query.type)) return c("No query type '" + doc.query.type + "' defined");

        var query = doc.query;
        // Respond as soon as possible when this just uploads files
        if (!query) c(null, {});

        var files = doc.files || [];
        if (files.length)++srv.uses;
        for (var i = 0; i < files.length; ++i) {
            var file = files[i];
            if (file.type == "delete") srv.delFile(file.name);
            else ensureFile(srv, file.name, null, file.type == "full" ? file.text : null);
        }

        var timeBudget = typeof doc.timeout == "number" ? [doc.timeout] : null;
        if (!query) {
            analyzeAll(srv, timeBudget, function() {});
            return;
        }

        var queryType = queryTypes[query.type];
        if (queryType.takesFile) {
            if (typeof query.file != "string") return c(".query.file must be a string");
            if (!/^#/.test(query.file)) ensureFile(srv, query.file, null);
        }

        analyzeAll(srv, timeBudget, function(err) {
            if (err) return c(err);
            var file = queryType.takesFile && resolveFile(srv, files, query.file);
            if (queryType.fullFile && file.type == "part") return c("Can't run a " + query.type + " query on a file fragment");

            function run() {
                var result;
                try {
                    result = queryType.run(srv, query, file);
                }
                catch (e) {
                    if (srv.options.debug && e.name != "TernError") console.error(e.stack);
                    return c(e);
                }
                c(null, result);
            }
            infer.withContext(srv.cx, timeBudget ? function() {
                infer.withTimeout(timeBudget[0], run);
            } : run);
        });
    }

    function analyzeFile(srv, file) {
        infer.withContext(srv.cx, function() {
            file.scope = srv.cx.topScope;
            srv.signal("beforeLoad", file);
            infer.analyze(file.ast, file.name, file.scope, srv.passes);
            srv.signal("afterLoad", file);
        });
        return file;
    }

    function ensureFile(srv, name, parent, text) {
        var known = srv.findFile(name);
        if (known) {
            if (text != null) {
                if (known.scope) {
                    srv.needsPurge.push(name);
                    known.scope = null;
                }
                updateText(known, text, srv);
            }
            if (parentDepth(srv, known.parent) > parentDepth(srv, parent)) {
                known.parent = parent;
                if (known.excluded) known.excluded = null;
            }
            return;
        }

        var file = new File(name, parent);
        srv.files.push(file);
        srv.fileMap[name] = file;
        if (text != null) {
            updateText(file, text, srv);
        }
        else if (srv.options.async) {
            srv.startAsyncAction();
            srv.options.getFile(name, function(err, text) {
                updateText(file, text || "", srv);
                srv.finishAsyncAction(err);
            });
        }
        else {
            updateText(file, srv.options.getFile(name) || "", srv);
        }
    }

    function fetchAll(srv, c) {
        var done = true,
            returned = false;
        srv.files.forEach(function(file) {
            if (file.text != null) return;
            if (srv.options.async) {
                done = false;
                srv.options.getFile(file.name, function(err, text) {
                    if (err && !returned) {
                        returned = true;
                        return c(err);
                    }
                    updateText(file, text || "", srv);
                    fetchAll(srv, c);
                });
            }
            else {
                try {
                    updateText(file, srv.options.getFile(file.name) || "", srv);
                }
                catch (e) {
                    return c(e);
                }
            }
        });
        if (done) c();
    }

    function waitOnFetch(srv, timeBudget, c) {
        var done = function() {
            srv.off("everythingFetched", done);
            clearTimeout(timeout);
            analyzeAll(srv, timeBudget, c);
        };
        srv.on("everythingFetched", done);
        var timeout = setTimeout(done, srv.options.fetchTimeout);
    }

    function analyzeAll(srv, timeBudget, c) {
        if (srv.pending) return waitOnFetch(srv, timeBudget, c);

        var e = srv.fetchError;
        if (e) {
            srv.fetchError = null;
            return c(e);
        }

        if (srv.needsPurge.length > 0) infer.withContext(srv.cx, function() {
            infer.purge(srv.needsPurge);
            srv.needsPurge.length = 0;
        });

        var done = true;
        // The second inner loop might add new files. The outer loop keeps
        // repeating both inner loops until all files have been looked at.
        for (var i = 0; i < srv.files.length;) {
            var toAnalyze = [];
            for (; i < srv.files.length; ++i) {
                var file = srv.files[i];
                if (file.text == null) done = false;
                else if (file.scope == null && !file.excluded) toAnalyze.push(file);
            }
            toAnalyze.sort(function(a, b) {
                return parentDepth(srv, a.parent) - parentDepth(srv, b.parent);
            });
            for (var j = 0; j < toAnalyze.length; j++) {
                var file = toAnalyze[j];
                if (file.parent && !chargeOnBudget(srv, file)) {
                    file.excluded = true;
                }
                else if (timeBudget) {
                    var startTime = +new Date;
                    infer.withTimeout(timeBudget[0], function() {
                        analyzeFile(srv, file);
                    });
                    timeBudget[0] -= +new Date - startTime;
                }
                else {
                    analyzeFile(srv, file);
                }
            }
        }
        if (done) c();
        else waitOnFetch(srv, timeBudget, c);
    }

    function firstLine(str) {
        var end = str.indexOf("\n");
        if (end < 0) return str;
        return str.slice(0, end);
    }

    function findMatchingPosition(line, file, near) {
        var pos = Math.max(0, near - 500),
            closest = null;
        if (!/^\s*$/.test(line)) for (;;) {
            var found = file.indexOf(line, pos);
            if (found < 0 || found > near + 500) break;
            if (closest == null || Math.abs(closest - near) > Math.abs(found - near)) closest = found;
            pos = found + line.length;
        }
        return closest;
    }

    function scopeDepth(s) {
        for (var i = 0; s; ++i, s = s.prev) {}
        return i;
    }

    function ternError(msg) {
        var err = new Error(msg);
        err.name = "TernError";
        return err;
    }

    function resolveFile(srv, localFiles, name) {
        var isRef = name.match(/^#(\d+)$/);
        if (!isRef) return srv.findFile(name);

        var file = localFiles[isRef[1]];
        if (!file || file.type == "delete") throw ternError("Reference to unknown file " + name);
        if (file.type == "full") return srv.findFile(file.name);

        // This is a partial file

        var realFile = file.backing = srv.findFile(file.name);
        var offset = file.offset;
        if (file.offsetLines) offset = {
            line: file.offsetLines,
            ch: 0
        };
        file.offset = offset = resolvePos(realFile, file.offsetLines == null ? file.offset : {
            line: file.offsetLines,
            ch: 0
        }, true);
        var line = firstLine(file.text);
        var foundPos = findMatchingPosition(line, realFile.text, offset);
        var pos = foundPos == null ? Math.max(0, realFile.text.lastIndexOf("\n", offset)) : foundPos;
        var inObject, atFunction;

        infer.withContext(srv.cx, function() {
            infer.purge(file.name, pos, pos + file.text.length);

            var text = file.text,
                m;
            if (m = text.match(/(?:"([^"]*)"|([\w$]+))\s*:\s*function\b/)) {
                var objNode = walk.findNodeAround(file.backing.ast, pos, "ObjectExpression");
                if (objNode && objNode.node.objType) inObject = {
                    type: objNode.node.objType,
                    prop: m[2] || m[1]
                };
            }
            if (foundPos && (m = line.match(/^(.*?)\bfunction\b/))) {
                var cut = m[1].length,
                    white = "";
                for (var i = 0; i < cut; ++i) white += " ";
                text = white + text.slice(cut);
                atFunction = true;
            }

            var scopeStart = infer.scopeAt(realFile.ast, pos, realFile.scope);
            var scopeEnd = infer.scopeAt(realFile.ast, pos + text.length, realFile.scope);
            var scope = file.scope = scopeDepth(scopeStart) < scopeDepth(scopeEnd) ? scopeEnd : scopeStart;
            file.ast = infer.parse(text, srv.passes, {
                directSourceFile: file,
                allowReturnOutsideFunction: true
            });
            infer.analyze(file.ast, file.name, scope, srv.passes);

            // This is a kludge to tie together the function types (if any)
            // outside and inside of the fragment, so that arguments and
            // return values have some information known about them.
            tieTogether: if (inObject || atFunction) {
                var newInner = infer.scopeAt(file.ast, line.length, scopeStart);
                if (!newInner.fnType) break tieTogether;
                if (inObject) {
                    var prop = inObject.type.getProp(inObject.prop);
                    prop.addType(newInner.fnType);
                }
                else if (atFunction) {
                    var inner = infer.scopeAt(realFile.ast, pos + line.length, realFile.scope);
                    if (inner == scopeStart || !inner.fnType) break tieTogether;
                    var fOld = inner.fnType,
                        fNew = newInner.fnType;
                    if (!fNew || (fNew.name != fOld.name && fOld.name)) break tieTogether;
                    for (var i = 0, e = Math.min(fOld.args.length, fNew.args.length); i < e; ++i)
                    fOld.args[i].propagate(fNew.args[i]);
                    fOld.self.propagate(fNew.self);
                    fNew.retval.propagate(fOld.retval);
                }
            }
        });
        return file;
    }

    // Budget management

    function astSize(node) {
        var size = 0;
        walk.simple(node, {
            Expression: function() {
                ++size;
            }
        });
        return size;
    }

    function parentDepth(srv, parent) {
        var depth = 0;
        while (parent) {
            parent = srv.findFile(parent).parent;
            ++depth;
        }
        return depth;
    }

    function budgetName(srv, file) {
        for (;;) {
            var parent = srv.findFile(file.parent);
            if (!parent.parent) break;
            file = parent;
        }
        return file.name;
    }

    function chargeOnBudget(srv, file) {
        var bName = budgetName(srv, file);
        var size = astSize(file.ast);
        var known = srv.budgets[bName];
        if (known == null) known = srv.budgets[bName] = srv.options.dependencyBudget;
        if (known < size) return false;
        srv.budgets[bName] = known - size;
        return true;
    }

    // Query helpers

    function isPosition(val) {
        return typeof val == "number" || typeof val == "object" && typeof val.line == "number" && typeof val.ch == "number";
    }

    // Baseline query document validation
    function invalidDoc(doc) {
        if (doc.query) {
            if (typeof doc.query.type != "string") return ".query.type must be a string";
            if (doc.query.start && !isPosition(doc.query.start)) return ".query.start must be a position";
            if (doc.query.end && !isPosition(doc.query.end)) return ".query.end must be a position";
        }
        if (doc.files) {
            if (!Array.isArray(doc.files)) return "Files property must be an array";
            for (var i = 0; i < doc.files.length; ++i) {
                var file = doc.files[i];
                if (typeof file != "object") return ".files[n] must be objects";
                else if (typeof file.name != "string") return ".files[n].name must be a string";
                else if (file.type == "delete") continue;
                else if (typeof file.text != "string") return ".files[n].text must be a string";
                else if (file.type == "part") {
                    if (!isPosition(file.offset) && typeof file.offsetLines != "number") return ".files[n].offset must be a position";
                }
                else if (file.type != "full") return ".files[n].type must be \"full\" or \"part\"";
            }
        }
    }

    var offsetSkipLines = 25;

    function findLineStart(file, line) {
        var text = file.text,
            offsets = file.lineOffsets || (file.lineOffsets = [0]);
        var pos = 0,
            curLine = 0;
        var storePos = Math.min(Math.floor(line / offsetSkipLines), offsets.length - 1);
        var pos = offsets[storePos],
            curLine = storePos * offsetSkipLines;

        while (curLine < line) {
            ++curLine;
            pos = text.indexOf("\n", pos) + 1;
            if (pos === 0) return null;
            if (curLine % offsetSkipLines === 0) offsets.push(pos);
        }
        return pos;
    }

    var resolvePos = exports.resolvePos = function(file, pos, tolerant) {
        if (typeof pos != "number") {
            var lineStart = findLineStart(file, pos.line);
            if (lineStart == null) {
                if (tolerant) pos = file.text.length;
                else throw ternError("File doesn't contain a line " + pos.line);
            }
            else {
                pos = lineStart + pos.ch;
            }
        }
        if (pos > file.text.length) {
            if (tolerant) pos = file.text.length;
            else throw ternError("Position " + pos + " is outside of file.");
        }
        return pos;
    };

    function asLineChar(file, pos) {
        if (!file) return {
            line: 0,
            ch: 0
        };
        var offsets = file.lineOffsets || (file.lineOffsets = [0]);
        var text = file.text,
            line, lineStart;
        for (var i = offsets.length - 1; i >= 0; --i) if (offsets[i] <= pos) {
            line = i * offsetSkipLines;
            lineStart = offsets[i];
        }
        for (;;) {
            var eol = text.indexOf("\n", lineStart);
            if (eol >= pos || eol < 0) break;
            lineStart = eol + 1;
            ++line;
        }
        return {
            line: line,
            ch: pos - lineStart
        };
    }

    var outputPos = exports.outputPos = function(query, file, pos) {
        if (query.lineCharPositions) {
            var out = asLineChar(file, pos);
            if (file.type == "part") out.line += file.offsetLines != null ? file.offsetLines : asLineChar(file.backing, file.offset).line;
            return out;
        }
        else {
            return pos + (file.type == "part" ? file.offset : 0);
        }
    };

    // Delete empty fields from result objects
    function clean(obj) {
        for (var prop in obj) if (obj[prop] == null) delete obj[prop];
        return obj;
    }

    function maybeSet(obj, prop, val) {
        if (val != null) obj[prop] = val;
    }

    // Built-in query types

    function compareCompletions(a, b) {
        if (typeof a != "string") {
            a = a.name;
            b = b.name;
        }
        var aUp = /^[A-Z]/.test(a),
            bUp = /^[A-Z]/.test(b);
        if (aUp == bUp) return a < b ? -1 : a == b ? 0 : 1;
        else return aUp ? 1 : -1;
    }

    function isStringAround(node, start, end) {
        return node.type == "Literal" && typeof node.value == "string" && node.start == start - 1 && node.end <= end + 1;
    }

    function pointInProp(objNode, point) {
        for (var i = 0; i < objNode.properties.length; i++) {
            var curProp = objNode.properties[i];
            if (curProp.key.start <= point && curProp.key.end >= point) return curProp;
        }
    }

    var jsKeywords = ("break do instanceof typeof case else new var " + "catch finally return void continue for switch while debugger " + "function this with default if throw delete in try").split(" ");

    function findCompletions(srv, query, file) {
        if (query.end == null) throw ternError("missing .query.end field");
        if (srv.passes.completion) for (var i = 0; i < srv.passes.completion.length; i++) {
            var result = srv.passes.completion[i](file, query);
            if (result) return result;
        }

        var wordStart = resolvePos(file, query.end),
            wordEnd = wordStart,
            text = file.text;
        while (wordStart && acorn.isIdentifierChar(text.charCodeAt(wordStart - 1)))--wordStart;
        if (query.expandWordForward !== false) while (wordEnd < text.length && acorn.isIdentifierChar(text.charCodeAt(wordEnd)))++wordEnd;
        var word = text.slice(wordStart, wordEnd),
            completions = [],
            ignoreObj;
        if (query.caseInsensitive) word = word.toLowerCase();
        var wrapAsObjs = query.types || query.depths || query.docs || query.urls || query.origins;

        function gather(prop, obj, depth, addInfo) {
            // 'hasOwnProperty' and such are usually just noise, leave them
            // out when no prefix is provided.
            if (query.omitObjectPrototype !== false && obj == srv.cx.protos.Object && !word) return;
            if (query.filter !== false && word && (query.caseInsensitive ? prop.toLowerCase() : prop).indexOf(word) !== 0) return;
            if (ignoreObj && ignoreObj.props[prop]) return;
            for (var i = 0; i < completions.length; ++i) {
                var c = completions[i];
                if ((wrapAsObjs ? c.name : c) == prop) return;
            }
            var rec = wrapAsObjs ? {
                name: prop
            } : prop;
            completions.push(rec);

            if (obj && (query.types || query.docs || query.urls || query.origins)) {
                var val = obj.props[prop];
                infer.resetGuessing();
                var type = val.getType();
                rec.guess = infer.didGuess();
                if (query.types) rec.type = infer.toString(val);
                if (query.docs) maybeSet(rec, "doc", val.doc || type && type.doc);
                if (query.urls) maybeSet(rec, "url", val.url || type && type.url);
                if (query.origins) maybeSet(rec, "origin", val.origin || type && type.origin);
            }
            if (query.depths) rec.depth = depth;
            if (wrapAsObjs && addInfo) addInfo(rec);
        }

        var hookname, prop, objType, isKey;

        var exprAt = infer.findExpressionAround(file.ast, null, wordStart, file.scope);
        var memberExpr, objLit;
        // Decide whether this is an object property, either in a member
        // expression or an object literal.
        if (exprAt) {
            if (exprAt.node.type == "MemberExpression" && exprAt.node.object.end < wordStart) {
                memberExpr = exprAt;
            }
            else if (isStringAround(exprAt.node, wordStart, wordEnd)) {
                var parent = infer.parentNode(exprAt.node, file.ast);
                if (parent.type == "MemberExpression" && parent.property == exprAt.node) memberExpr = {
                    node: parent,
                    state: exprAt.state
                };
            }
            else if (exprAt.node.type == "ObjectExpression") {
                var objProp = pointInProp(exprAt.node, wordEnd);
                if (objProp) {
                    objLit = exprAt;
                    prop = isKey = objProp.key.name;
                }
                else if (!word && !/:\s*$/.test(file.text.slice(0, wordStart))) {
                    objLit = exprAt;
                    prop = isKey = true;
                }
            }
        }

        if (objLit) {
            // Since we can't use the type of the literal itself to complete
            // its properties (it doesn't contain the information we need),
            // we have to try asking the surrounding expression for type info.
            objType = infer.typeFromContext(file.ast, objLit);
            ignoreObj = objLit.node.objType;
        }
        else if (memberExpr) {
            prop = memberExpr.node.property;
            prop = prop.type == "Literal" ? prop.value.slice(1) : prop.name;
            memberExpr.node = memberExpr.node.object;
            objType = infer.expressionType(memberExpr);
        }
        else if (text.charAt(wordStart - 1) == ".") {
            var pathStart = wordStart - 1;
            while (pathStart && (text.charAt(pathStart - 1) == "." || acorn.isIdentifierChar(text.charCodeAt(pathStart - 1)))) pathStart--;
            var path = text.slice(pathStart, wordStart - 1);
            if (path) {
                objType = infer.def.parsePath(path, file.scope).getObjType();
                prop = word;
            }
        }

        if (prop != null) {
            srv.cx.completingProperty = prop;

            if (objType) infer.forAllPropertiesOf(objType, gather);

            if (!completions.length && query.guess !== false && objType && objType.guessProperties) objType.guessProperties(function(p, o, d) {
                if (p != prop && p != "✖") gather(p, o, d);
            });
            if (!completions.length && word.length >= 2 && query.guess !== false) for (var prop in srv.cx.props) gather(prop, srv.cx.props[prop][0], 0);
            hookname = "memberCompletion";
        }
        else {
            infer.forAllLocalsAt(file.ast, wordStart, file.scope, gather);
            if (query.includeKeywords) jsKeywords.forEach(function(kw) {
                gather(kw, null, 0, function(rec) {
                    rec.isKeyword = true;
                });
            });
            hookname = "variableCompletion";
        }
        if (srv.passes[hookname]) srv.passes[hookname].forEach(function(hook) {
            hook(file, wordStart, wordEnd, gather);
        });

        if (query.sort !== false) completions.sort(compareCompletions);
        srv.cx.completingProperty = null;

        return {
            start: outputPos(query, file, wordStart),
            end: outputPos(query, file, wordEnd),
            isProperty: !! prop,
            isObjectKey: !! isKey,
            completions: completions
        };
    }

    function findProperties(srv, query) {
        var prefix = query.prefix,
            found = [];
        for (var prop in srv.cx.props)
        if (prop != "<i>" && (!prefix || prop.indexOf(prefix) === 0)) found.push(prop);
        if (query.sort !== false) found.sort(compareCompletions);
        return {
            completions: found
        };
    }

    var findExpr = exports.findQueryExpr = function(file, query, wide) {
        if (query.end == null) throw ternError("missing .query.end field");

        if (query.variable) {
            var scope = infer.scopeAt(file.ast, resolvePos(file, query.end), file.scope);
            return {
                node: {
                    type: "Identifier",
                    name: query.variable,
                    start: query.end,
                    end: query.end + 1
                },
                state: scope
            };
        }
        else {
            var start = query.start && resolvePos(file, query.start),
                end = resolvePos(file, query.end);
            var expr = infer.findExpressionAt(file.ast, start, end, file.scope);
            if (expr) return expr;
            expr = infer.findExpressionAround(file.ast, start, end, file.scope);
            if (expr && (expr.node.type == "ObjectExpression" || wide || (start == null ? end : start) - expr.node.start < 20 || expr.node.end - end < 20)) return expr;
            return null;
        }
    };

    function findExprOrThrow(file, query, wide) {
        var expr = findExpr(file, query, wide);
        if (expr) return expr;
        throw ternError("No expression at the given position.");
    }

    function ensureObj(tp) {
        if (!tp || !(tp = tp.getType()) || !(tp instanceof infer.Obj)) return null;
        return tp;
    }

    function findExprType(srv, query, file, expr) {
        var type;
        if (expr) {
            infer.resetGuessing();
            type = infer.expressionType(expr);
        }
        if (srv.passes["typeAt"]) {
            var pos = resolvePos(file, query.end);
            srv.passes["typeAt"].forEach(function(hook) {
                type = hook(file, pos, expr, type);
            });
        }
        if (!type) throw ternError("No type found at the given position.");

        var objProp;
        if (expr.node.type == "ObjectExpression" && query.end != null && (objProp = pointInProp(expr.node, resolvePos(file, query.end)))) {
            var name = objProp.key.name;
            var fromCx = ensureObj(infer.typeFromContext(file.ast, expr));
            if (fromCx && fromCx.hasProp(name)) {
                type = fromCx.hasProp(name);
            }
            else {
                var fromLocal = ensureObj(type);
                if (fromLocal && fromLocal.hasProp(name)) type = fromLocal.hasProp(name);
            }
        }
        return type;
    };

    function findTypeAt(srv, query, file) {
        var expr = findExpr(file, query),
            exprName;
        var type = findExprType(srv, query, file, expr),
            exprType = type;
        if (query.preferFunction) type = type.getFunctionType() || type.getType();
        else type = type.getType();

        if (expr) {
            if (expr.node.type == "Identifier") exprName = expr.node.name;
            else if (expr.node.type == "MemberExpression" && !expr.node.computed) exprName = expr.node.property.name;
        }

        if (query.depth != null && typeof query.depth != "number") throw ternError(".query.depth must be a number");

        var result = {
            guess: infer.didGuess(),
            type: infer.toString(exprType, query.depth),
            name: type && type.name,
            exprName: exprName
        };
        if (type) storeTypeDocs(type, result);
        if (!result.doc && exprType.doc) result.doc = exprType.doc;

        return clean(result);
    }

    function findDocs(srv, query, file) {
        var expr = findExpr(file, query);
        var type = findExprType(srv, query, file, expr);
        var result = {
            url: type.url,
            doc: type.doc,
            type: infer.toString(type)
        };
        var inner = type.getType();
        if (inner) storeTypeDocs(inner, result);
        return clean(result);
    }

    function storeTypeDocs(type, out) {
        if (!out.url) out.url = type.url;
        if (!out.doc) out.doc = type.doc;
        if (!out.origin) out.origin = type.origin;
        var ctor, boring = infer.cx().protos;
        if (!out.url && !out.doc && type.proto && (ctor = type.proto.hasCtor) && type.proto != boring.Object && type.proto != boring.Function && type.proto != boring.Array) {
            out.url = ctor.url;
            out.doc = ctor.doc;
        }
    }

    var getSpan = exports.getSpan = function(obj) {
        if (!obj.origin) return;
        if (obj.originNode) {
            var node = obj.originNode;
            if (/^Function/.test(node.type) && node.id) node = node.id;
            return {
                origin: obj.origin,
                node: node
            };
        }
        if (obj.span) return {
            origin: obj.origin,
            span: obj.span
        };
    };

    var storeSpan = exports.storeSpan = function(srv, query, span, target) {
        target.origin = span.origin;
        if (span.span) {
            var m = /^(\d+)\[(\d+):(\d+)\]-(\d+)\[(\d+):(\d+)\]$/.exec(span.span);
            target.start = query.lineCharPositions ? {
                line: Number(m[2]),
                ch: Number(m[3])
            } : Number(m[1]);
            target.end = query.lineCharPositions ? {
                line: Number(m[5]),
                ch: Number(m[6])
            } : Number(m[4]);
        }
        else {
            var file = srv.findFile(span.origin);
            target.start = outputPos(query, file, span.node.start);
            target.end = outputPos(query, file, span.node.end);
        }
    };

    function findDef(srv, query, file) {
        var expr = findExpr(file, query);
        var type = findExprType(srv, query, file, expr);
        if (infer.didGuess()) return {};

        var span = getSpan(type);
        var result = {
            url: type.url,
            doc: type.doc,
            origin: type.origin
        };

        if (type.types) for (var i = type.types.length - 1; i >= 0; --i) {
            var tp = type.types[i];
            storeTypeDocs(tp, result);
            if (!span) span = getSpan(tp);
        }

        if (span && span.node) { // refers to a loaded file
            var spanFile = span.node.sourceFile || srv.findFile(span.origin);
            var start = outputPos(query, spanFile, span.node.start),
                end = outputPos(query, spanFile, span.node.end);
            result.start = start;
            result.end = end;
            result.file = span.origin;
            var cxStart = Math.max(0, span.node.start - 50);
            result.contextOffset = span.node.start - cxStart;
            result.context = spanFile.text.slice(cxStart, cxStart + 50);
        }
        else if (span) { // external
            result.file = span.origin;
            storeSpan(srv, query, span, result);
        }
        return clean(result);
    }

    function findRefsToVariable(srv, query, file, expr, checkShadowing) {
        var name = expr.node.name;

        for (var scope = expr.state; scope && !(name in scope.props); scope = scope.prev) {}
        if (!scope) throw ternError("Could not find a definition for " + name + " " + !! srv.cx.topScope.props.x);

        var type, refs = [];

        function storeRef(file) {
            return function(node, scopeHere) {
                if (checkShadowing) for (var s = scopeHere; s != scope; s = s.prev) {
                    var exists = s.hasProp(checkShadowing);
                    if (exists) throw ternError("Renaming `" + name + "` to `" + checkShadowing + "` would make a variable at line " + (asLineChar(file, node.start).line + 1) + " point to the definition at line " + (asLineChar(file, exists.name.start).line + 1));
                }
                refs.push({
                    file: file.name,
                    start: outputPos(query, file, node.start),
                    end: outputPos(query, file, node.end)
                });
            };
        }

        if (scope.originNode) {
            type = "local";
            if (checkShadowing) {
                for (var prev = scope.prev; prev; prev = prev.prev)
                if (checkShadowing in prev.props) break;
                if (prev) infer.findRefs(scope.originNode, scope, checkShadowing, prev, function(node) {
                    throw ternError("Renaming `" + name + "` to `" + checkShadowing + "` would shadow the definition used at line " + (asLineChar(file, node.start).line + 1));
                });
            }
            infer.findRefs(scope.originNode, scope, name, scope, storeRef(file));
        }
        else {
            type = "global";
            for (var i = 0; i < srv.files.length; ++i) {
                var cur = srv.files[i];
                infer.findRefs(cur.ast, cur.scope, name, scope, storeRef(cur));
            }
        }

        return {
            refs: refs,
            type: type,
            name: name
        };
    }

    function findRefsToProperty(srv, query, expr, prop) {
        var objType = infer.expressionType(expr).getObjType();
        if (!objType) throw ternError("Couldn't determine type of base object.");

        var refs = [];

        function storeRef(file) {
            return function(node) {
                refs.push({
                    file: file.name,
                    start: outputPos(query, file, node.start),
                    end: outputPos(query, file, node.end)
                });
            };
        }
        for (var i = 0; i < srv.files.length; ++i) {
            var cur = srv.files[i];
            infer.findPropRefs(cur.ast, cur.scope, objType, prop.name, storeRef(cur));
        }

        return {
            refs: refs,
            name: prop.name
        };
    }

    function findRefs(srv, query, file) {
        var expr = findExprOrThrow(file, query, true);
        if (expr && expr.node.type == "Identifier") {
            return findRefsToVariable(srv, query, file, expr);
        }
        else if (expr && expr.node.type == "MemberExpression" && !expr.node.computed) {
            var p = expr.node.property;
            expr.node = expr.node.object;
            return findRefsToProperty(srv, query, expr, p);
        }
        else if (expr && expr.node.type == "ObjectExpression") {
            var pos = resolvePos(file, query.end);
            for (var i = 0; i < expr.node.properties.length; ++i) {
                var k = expr.node.properties[i].key;
                if (k.start <= pos && k.end >= pos) return findRefsToProperty(srv, query, expr, k);
            }
        }
        throw ternError("Not at a variable or property name.");
    }

    function buildRename(srv, query, file) {
        if (typeof query.newName != "string") throw ternError(".query.newName should be a string");
        var expr = findExprOrThrow(file, query);
        if (!expr || expr.node.type != "Identifier") throw ternError("Not at a variable.");

        var data = findRefsToVariable(srv, query, file, expr, query.newName),
            refs = data.refs;
        delete data.refs;
        data.files = srv.files.map(function(f) {
            return f.name;
        });

        var changes = data.changes = [];
        for (var i = 0; i < refs.length; ++i) {
            var use = refs[i];
            use.text = query.newName;
            changes.push(use);
        }

        return data;
    }

    function listFiles(srv) {
        return {
            files: srv.files.map(function(f) {
                return f.name;
            })
        };
    }

    exports.version = "0.10.0";
});

//#endregion


//#region tern/lib/def.js

// Type description parser
//
// Type description JSON files (such as ecma5.json and browser.json)
// are used to
//
// A) describe types that come from native code
//
// B) to cheaply load the types for big libraries, or libraries that
//    can't be inferred well

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return exports.init = mod;
    if (typeof define == "function" && define.amd) // AMD
    return define({
        init: mod
    });
    tern.def = {
        init: mod
    };
})(function(exports, infer) {
    "use strict";

    function hop(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
    }

    var TypeParser = exports.TypeParser = function(spec, start, base, forceNew) {
        this.pos = start || 0;
        this.spec = spec;
        this.base = base;
        this.forceNew = forceNew;
    };

    function unwrapType(type, self, args) {
        return type.call ? type(self, args) : type;
    }

    function extractProp(type, prop) {
        if (prop == "!ret") {
            if (type.retval) return type.retval;
            var rv = new infer.AVal;
            type.propagate(new infer.IsCallee(infer.ANull, [], null, rv));
            return rv;
        }
        else {
            return type.getProp(prop);
        }
    }

    function computedFunc(args, retType) {
        return function(self, cArgs) {
            var realArgs = [];
            for (var i = 0; i < args.length; i++) realArgs.push(unwrapType(args[i], self, cArgs));
            return new infer.Fn(name, infer.ANull, realArgs, unwrapType(retType, self, cArgs));
        };
    }

    function computedUnion(types) {
        return function(self, args) {
            var union = new infer.AVal;
            for (var i = 0; i < types.length; i++) unwrapType(types[i], self, args).propagate(union);
            return union;
        };
    }

    function computedArray(inner) {
        return function(self, args) {
            return new infer.Arr(inner(self, args));
        };
    }

    TypeParser.prototype = {
        eat: function(str) {
            if (str.length == 1 ? this.spec.charAt(this.pos) == str : this.spec.indexOf(str, this.pos) == this.pos) {
                this.pos += str.length;
                return true;
            }
        },
        word: function(re) {
            var word = "",
                ch, re = re || /[\w$]/;
            while ((ch = this.spec.charAt(this.pos)) && re.test(ch)) {
                word += ch;
                ++this.pos;
            }
            return word;
        },
        error: function() {
            throw new Error("Unrecognized type spec: " + this.spec + " (at " + this.pos + ")");
        },
        parseFnType: function(comp, name, top) {
            var args = [],
                names = [],
                computed = false;
            if (!this.eat(")")) for (var i = 0;; ++i) {
                var colon = this.spec.indexOf(": ", this.pos),
                    argname;
                if (colon != -1) {
                    argname = this.spec.slice(this.pos, colon);
                    if (/^[$\w?]+$/.test(argname)) this.pos = colon + 2;
                    else argname = null;
                }
                names.push(argname);
                var argType = this.parseType(comp);
                if (argType.call) computed = true;
                args.push(argType);
                if (!this.eat(", ")) {
                    this.eat(")") || this.error();
                    break;
                }
            }
            var retType, computeRet, computeRetStart, fn;
            if (this.eat(" -> ")) {
                var retStart = this.pos;
                retType = this.parseType(true);
                if (retType.call) {
                    if (top) {
                        computeRet = retType;
                        retType = infer.ANull;
                        computeRetStart = retStart;
                    }
                    else {
                        computed = true;
                    }
                }
            }
            else {
                retType = infer.ANull;
            }
            if (computed) return computedFunc(args, retType);

            if (top && (fn = this.base)) infer.Fn.call(this.base, name, infer.ANull, args, names, retType);
            else fn = new infer.Fn(name, infer.ANull, args, names, retType);
            if (computeRet) fn.computeRet = computeRet;
            if (computeRetStart != null) fn.computeRetSource = this.spec.slice(computeRetStart, this.pos);
            return fn;
        },
        parseType: function(comp, name, top) {
            var main = this.parseTypeMaybeProp(comp, name, top);
            if (!this.eat("|")) return main;
            var types = [main],
                computed = main.call;
            for (;;) {
                var next = this.parseTypeMaybeProp(comp, name, top);
                types.push(next);
                if (next.call) computed = true;
                if (!this.eat("|")) break;
            }
            if (computed) return computedUnion(types);
            var union = new infer.AVal;
            for (var i = 0; i < types.length; i++) types[i].propagate(union);
            return union;
        },
        parseTypeMaybeProp: function(comp, name, top) {
            var result = this.parseTypeInner(comp, name, top);
            while (comp && this.eat(".")) result = this.extendWithProp(result);
            return result;
        },
        extendWithProp: function(base) {
            var propName = this.word(/[\w<>$!]/) || this.error();
            if (base.apply) return function(self, args) {
                return extractProp(base(self, args), propName);
            };
            return extractProp(base, propName);
        },
        parseTypeInner: function(comp, name, top) {
            if (this.eat("fn(")) {
                return this.parseFnType(comp, name, top);
            }
            else if (this.eat("[")) {
                var inner = this.parseType(comp);
                this.eat("]") || this.error();
                if (inner.call) return computedArray(inner);
                if (top && this.base) {
                    infer.Arr.call(this.base, inner);
                    return this.base;
                }
                return new infer.Arr(inner);
            }
            else if (this.eat("+")) {
                var path = this.word(/[\w$<>\.!]/);
                var base = parsePath(path + ".prototype");
                var type;
                if (!(base instanceof infer.Obj)) base = parsePath(path);
                if (!(base instanceof infer.Obj)) return base;
                if (comp && this.eat("[")) return this.parsePoly(base);
                if (top && this.forceNew) return new infer.Obj(base);
                return infer.getInstance(base);
            }
            else if (comp && this.eat("!")) {
                var arg = this.word(/\d/);
                if (arg) {
                    arg = Number(arg);
                    return function(_self, args) {
                        return args[arg] || infer.ANull;
                    };
                }
                else if (this.eat("this")) {
                    return function(self) {
                        return self;
                    };
                }
                else if (this.eat("custom:")) {
                    var fname = this.word(/[\w$]/);
                    return customFunctions[fname] || function() {
                        return infer.ANull;
                    };
                }
                else {
                    return this.fromWord("!" + this.word(/[\w$<>\.!]/));
                }
            }
            else if (this.eat("?")) {
                return infer.ANull;
            }
            else {
                return this.fromWord(this.word(/[\w$<>\.!`]/));
            }
        },
        fromWord: function(spec) {
            var cx = infer.cx();
            switch (spec) {
            case "number":
                return cx.num;
            case "string":
                return cx.str;
            case "bool":
                return cx.bool;
            case "<top>":
                return cx.topScope;
            }
            if (cx.localDefs && spec in cx.localDefs) return cx.localDefs[spec];
            return parsePath(spec);
        },
        parsePoly: function(base) {
            var propName = "<i>",
                match;
            if (match = this.spec.slice(this.pos).match(/^\s*(\w+)\s*=\s*/)) {
                propName = match[1];
                this.pos += match[0].length;
            }
            var value = this.parseType(true);
            if (!this.eat("]")) this.error();
            if (value.call) return function(self, args) {
                var instance = infer.getInstance(base);
                value(self, args).propagate(instance.defProp(propName));
                return instance;
            };
            var instance = infer.getInstance(base);
            value.propagate(instance.defProp(propName));
            return instance;
        }
    };

    function parseType(spec, name, base, forceNew) {
        var type = new TypeParser(spec, null, base, forceNew).parseType(false, name, true);
        if (/^fn\(/.test(spec)) for (var i = 0; i < type.args.length; ++i)(function(i) {
            var arg = type.args[i];
            if (arg instanceof infer.Fn && arg.args && arg.args.length) addEffect(type, function(_self, fArgs) {
                var fArg = fArgs[i];
                if (fArg) fArg.propagate(new infer.IsCallee(infer.cx().topScope, arg.args, null, infer.ANull));
            });
        })(i);
        return type;
    }

    function addEffect(fn, handler, replaceRet) {
        var oldCmp = fn.computeRet,
            rv = fn.retval;
        fn.computeRet = function(self, args, argNodes) {
            var handled = handler(self, args, argNodes);
            var old = oldCmp ? oldCmp(self, args, argNodes) : rv;
            return replaceRet ? handled : old;
        };
    }

    var parseEffect = exports.parseEffect = function(effect, fn) {
        var m;
        if (effect.indexOf("propagate ") == 0) {
            var p = new TypeParser(effect, 10);
            var origin = p.parseType(true);
            if (!p.eat(" ")) p.error();
            var target = p.parseType(true);
            addEffect(fn, function(self, args) {
                unwrapType(origin, self, args).propagate(unwrapType(target, self, args));
            });
        }
        else if (effect.indexOf("call ") == 0) {
            var andRet = effect.indexOf("and return ", 5) == 5;
            var p = new TypeParser(effect, andRet ? 16 : 5);
            var getCallee = p.parseType(true),
                getSelf = null,
                getArgs = [];
            if (p.eat(" this=")) getSelf = p.parseType(true);
            while (p.eat(" ")) getArgs.push(p.parseType(true));
            addEffect(fn, function(self, args) {
                var callee = unwrapType(getCallee, self, args);
                var slf = getSelf ? unwrapType(getSelf, self, args) : infer.ANull,
                    as = [];
                for (var i = 0; i < getArgs.length; ++i) as.push(unwrapType(getArgs[i], self, args));
                var result = andRet ? new infer.AVal : infer.ANull;
                callee.propagate(new infer.IsCallee(slf, as, null, result));
                return result;
            }, andRet);
        }
        else if (m = effect.match(/^custom (\S+)\s*(.*)/)) {
            var customFunc = customFunctions[m[1]];
            if (customFunc) addEffect(fn, m[2] ? customFunc(m[2]) : customFunc);
        }
        else if (effect.indexOf("copy ") == 0) {
            var p = new TypeParser(effect, 5);
            var getFrom = p.parseType(true);
            p.eat(" ");
            var getTo = p.parseType(true);
            addEffect(fn, function(self, args) {
                var from = unwrapType(getFrom, self, args),
                    to = unwrapType(getTo, self, args);
                from.forAllProps(function(prop, val, local) {
                    if (local && prop != "<i>") to.propagate(new infer.PropHasSubset(prop, val));
                });
            });
        }
        else {
            throw new Error("Unknown effect type: " + effect);
        }
    };

    var currentTopScope;

    var parsePath = exports.parsePath = function(path, scope) {
        var cx = infer.cx(),
            cached = cx.paths[path],
            origPath = path;
        if (cached != null) return cached;
        cx.paths[path] = infer.ANull;

        var base = scope || currentTopScope || cx.topScope;

        if (cx.localDefs) for (var name in cx.localDefs) {
            if (path.indexOf(name) == 0) {
                if (path == name) return cx.paths[path] = cx.localDefs[path];
                if (path.charAt(name.length) == ".") {
                    base = cx.localDefs[name];
                    path = path.slice(name.length + 1);
                    break;
                }
            }
        }

        var parts = path.split(".");
        for (var i = 0; i < parts.length && base != infer.ANull; ++i) {
            var prop = parts[i];
            if (prop.charAt(0) == "!") {
                if (prop == "!proto") {
                    base = (base instanceof infer.Obj && base.proto) || infer.ANull;
                }
                else {
                    var fn = base.getFunctionType();
                    if (!fn) {
                        base = infer.ANull;
                    }
                    else if (prop == "!ret") {
                        base = fn.retval && fn.retval.getType(false) || infer.ANull;
                    }
                    else {
                        var arg = fn.args && fn.args[Number(prop.slice(1))];
                        base = (arg && arg.getType(false)) || infer.ANull;
                    }
                }
            }
            else if (base instanceof infer.Obj) {
                var propVal = (prop == "prototype" && base instanceof infer.Fn) ? base.getProp(prop) : base.props[prop];
                if (!propVal || propVal.isEmpty()) base = infer.ANull;
                else base = propVal.types[0];
            }
        }
        // Uncomment this to get feedback on your poorly written .json files
        // if (base == infer.ANull) console.error("bad path: " + origPath + " (" + cx.curOrigin + ")");
        cx.paths[origPath] = base == infer.ANull ? null : base;
        return base;
    };

    function emptyObj(ctor) {
        var empty = Object.create(ctor.prototype);
        empty.props = Object.create(null);
        empty.isShell = true;
        return empty;
    }

    function isSimpleAnnotation(spec) {
        if (!spec["!type"] || /^(fn\(|\[)/.test(spec["!type"])) return false;
        for (var prop in spec)
        if (prop != "!type" && prop != "!doc" && prop != "!url" && prop != "!span" && prop != "!data") return false;
        return true;
    }

    function passOne(base, spec, path) {
        if (!base) {
            var tp = spec["!type"];
            if (tp) {
                if (/^fn\(/.test(tp)) base = emptyObj(infer.Fn);
                else if (tp.charAt(0) == "[") base = emptyObj(infer.Arr);
                else throw new Error("Invalid !type spec: " + tp);
            }
            else if (spec["!stdProto"]) {
                base = infer.cx().protos[spec["!stdProto"]];
            }
            else {
                base = emptyObj(infer.Obj);
            }
            base.name = path;
        }

        for (var name in spec) if (hop(spec, name) && name.charCodeAt(0) != 33) {
            var inner = spec[name];
            if (typeof inner == "string" || isSimpleAnnotation(inner)) continue;
            var prop = base.defProp(name);
            passOne(prop.getObjType(), inner, path ? path + "." + name : name).propagate(prop);
        }
        return base;
    }

    function passTwo(base, spec, path) {
        if (base.isShell) {
            delete base.isShell;
            var tp = spec["!type"];
            if (tp) {
                parseType(tp, path, base);
            }
            else {
                var proto = spec["!proto"] && parseType(spec["!proto"]);
                infer.Obj.call(base, proto instanceof infer.Obj ? proto : true, path);
            }
        }

        var effects = spec["!effects"];
        if (effects && base instanceof infer.Fn) for (var i = 0; i < effects.length; ++i)
        parseEffect(effects[i], base);
        copyInfo(spec, base);

        for (var name in spec) if (hop(spec, name) && name.charCodeAt(0) != 33) {
            var inner = spec[name],
                known = base.defProp(name),
                innerPath = path ? path + "." + name : name;
            if (typeof inner == "string") {
                if (known.isEmpty()) parseType(inner, innerPath).propagate(known);
            }
            else {
                if (!isSimpleAnnotation(inner)) passTwo(known.getObjType(), inner, innerPath);
                else if (known.isEmpty()) parseType(inner["!type"], innerPath, null, true).propagate(known);
                else continue;
                if (inner["!doc"]) known.doc = inner["!doc"];
                if (inner["!url"]) known.url = inner["!url"];
                if (inner["!span"]) known.span = inner["!span"];
            }
        }
        return base;
    }

    function copyInfo(spec, type) {
        if (spec["!doc"]) type.doc = spec["!doc"];
        if (spec["!url"]) type.url = spec["!url"];
        if (spec["!span"]) type.span = spec["!span"];
        if (spec["!data"]) type.metaData = spec["!data"];
    }

    function runPasses(type, arg) {
        var parent = infer.cx().parent,
            pass = parent && parent.passes && parent.passes[type];
        if (pass) for (var i = 0; i < pass.length; i++) pass[i](arg);
    }

    function doLoadEnvironment(data, scope) {
        var cx = infer.cx();

        infer.addOrigin(cx.curOrigin = data["!name"] || "env#" + cx.origins.length);
        cx.localDefs = cx.definitions[cx.curOrigin] = Object.create(null);

        runPasses("preLoadDef", data);

        passOne(scope, data);

        var def = data["!define"];
        if (def) {
            for (var name in def) {
                var spec = def[name];
                cx.localDefs[name] = typeof spec == "string" ? parsePath(spec) : passOne(null, spec, name);
            }
            for (var name in def) {
                var spec = def[name];
                if (typeof spec != "string") passTwo(cx.localDefs[name], def[name], name);
            }
        }

        passTwo(scope, data);

        runPasses("postLoadDef", data);

        cx.curOrigin = cx.localDefs = null;
    }

    exports.load = function(data, scope) {
        if (!scope) scope = infer.cx().topScope;
        var oldScope = currentTopScope;
        currentTopScope = scope;
        try {
            doLoadEnvironment(data, scope);
        }
        finally {
            currentTopScope = oldScope;
        }
    };

    exports.parse = function(data, origin, path) {
        var cx = infer.cx();
        if (origin) {
            cx.origin = origin;
            cx.localDefs = cx.definitions[origin];
        }

        try {
            if (typeof data == "string") return parseType(data, path);
            else return passTwo(passOne(null, data, path), data, path);
        }
        finally {
            if (origin) cx.origin = cx.localDefs = null;
        }
    };

    // Used to register custom logic for more involved effect or type
    // computation.
    var customFunctions = Object.create(null);
    infer.registerFunction = function(name, f) {
        customFunctions[name] = f;
    };

    var IsCreated = infer.constraint("created, target, spec", {
        addType: function(tp) {
            if (tp instanceof infer.Obj && this.created++ < 5) {
                var derived = new infer.Obj(tp),
                    spec = this.spec;
                if (spec instanceof infer.AVal) spec = spec.getObjType(false);
                if (spec instanceof infer.Obj) for (var prop in spec.props) {
                    var cur = spec.props[prop].types[0];
                    var p = derived.defProp(prop);
                    if (cur && cur instanceof infer.Obj && cur.props.value) {
                        var vtp = cur.props.value.getType(false);
                        if (vtp) p.addType(vtp);
                    }
                }
                this.target.addType(derived);
            }
        }
    });

    infer.registerFunction("Object_create", function(_self, args, argNodes) {
        if (argNodes && argNodes.length && argNodes[0].type == "Literal" && argNodes[0].value == null) return new infer.Obj();

        var result = new infer.AVal;
        if (args[0]) args[0].propagate(new IsCreated(0, result, args[1]));
        return result;
    });

    var PropSpec = infer.constraint("target", {
        addType: function(tp) {
            if (!(tp instanceof infer.Obj)) return;
            if (tp.hasProp("value")) tp.getProp("value").propagate(this.target);
            else if (tp.hasProp("get")) tp.getProp("get").propagate(new infer.IsCallee(infer.ANull, [], null, this.target));
        }
    });

    infer.registerFunction("Object_defineProperty", function(_self, args, argNodes) {
        if (argNodes && argNodes.length >= 3 && argNodes[1].type == "Literal" && typeof argNodes[1].value == "string") {
            var obj = args[0],
                connect = new infer.AVal;
            obj.propagate(new infer.PropHasSubset(argNodes[1].value, connect, argNodes[1]));
            args[2].propagate(new PropSpec(connect));
        }
        return infer.ANull;
    });

    var IsBound = infer.constraint("self, args, target", {
        addType: function(tp) {
            if (!(tp instanceof infer.Fn)) return;
            this.target.addType(new infer.Fn(tp.name, tp.self, tp.args.slice(this.args.length),
            tp.argNames.slice(this.args.length), tp.retval));
            this.self.propagate(tp.self);
            for (var i = 0; i < Math.min(tp.args.length, this.args.length); ++i)
            this.args[i].propagate(tp.args[i]);
        }
    });

    infer.registerFunction("Function_bind", function(self, args) {
        if (!args.length) return infer.ANull;
        var result = new infer.AVal;
        self.propagate(new IsBound(args[0], args.slice(1), result));
        return result;
    });

    infer.registerFunction("Array_ctor", function(_self, args) {
        var arr = new infer.Arr;
        if (args.length != 1 || !args[0].hasType(infer.cx().num)) {
            var content = arr.getProp("<i>");
            for (var i = 0; i < args.length; ++i) args[i].propagate(content);
        }
        return arr;
    });

    infer.registerFunction("Promise_ctor", function(_self, args, argNodes) {
        if (args.length < 1) return infer.ANull;
        var self = new infer.Obj(infer.cx().definitions.ecma6["Promise.prototype"]);
        var valProp = self.defProp("value", argNodes && argNodes[0]);
        var valArg = new infer.AVal;
        valArg.propagate(valProp);
        var exec = new infer.Fn("execute", infer.ANull, [valArg], ["value"], infer.ANull);
        var reject = infer.cx().definitions.ecma6.promiseReject;
        args[0].propagate(new infer.IsCallee(infer.ANull, [exec, reject], null, infer.ANull));
        return self;
    });

    return exports;
});

//#endregion


//#region tern/lib/infer.js

// Main type inference engine

// Walks an AST, building up a graph of abstract values and constraints
// that cause types to flow from one node to another. Also defines a
// number of utilities for accessing ASTs and scopes.

// Analysis is done in a context, which is tracked by the dynamically
// bound cx variable. Use withContext to set the current context.

// For memory-saving reasons, individual types export an interface
// similar to abstract values (which can hold multiple types), and can
// thus be used in place abstract values that only ever contain a
// single type.

(function(root, mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(exports, require("acorn"), require("acorn/dist/acorn_loose"), require("acorn/dist/walk"),
    require("./def"), require("./signal"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["exports", "acorn/dist/acorn", "acorn/dist/acorn_loose", "acorn/dist/walk", "./def", "./signal"], mod);
    mod(root.tern || (root.tern = {}), acorn, acorn, acorn.walk, tern.def, tern.signal); // Plain browser env
})(this, function(exports, acorn, acorn_loose, walk, def, signal) {
    "use strict";

    var toString = exports.toString = function(type, maxDepth, parent) {
        return !type || type == parent ? "?" : type.toString(maxDepth, parent);
    };

    // A variant of AVal used for unknown, dead-end values. Also serves
    // as prototype for AVals, Types, and Constraints because it
    // implements 'empty' versions of all the methods that the code
    // expects.
    var ANull = exports.ANull = signal.mixin({
        addType: function() {},
        propagate: function() {},
        getProp: function() {
            return ANull;
        },
        forAllProps: function() {},
        hasType: function() {
            return false;
        },
        isEmpty: function() {
            return true;
        },
        getFunctionType: function() {},
        getObjType: function() {},
        getType: function() {},
        gatherProperties: function() {},
        propagatesTo: function() {},
        typeHint: function() {},
        propHint: function() {},
        toString: function() {
            return "?";
        }
    });

    function extend(proto, props) {
        var obj = Object.create(proto);
        if (props) for (var prop in props) obj[prop] = props[prop];
        return obj;
    }

    // ABSTRACT VALUES

    var WG_DEFAULT = 100,
        WG_NEW_INSTANCE = 90,
        WG_MADEUP_PROTO = 10,
        WG_MULTI_MEMBER = 5,
        WG_CATCH_ERROR = 5,
        WG_GLOBAL_THIS = 90,
        WG_SPECULATIVE_THIS = 2;

    var AVal = exports.AVal = function() {
        this.types = [];
        this.forward = null;
        this.maxWeight = 0;
    };
    AVal.prototype = extend(ANull, {
        addType: function(type, weight) {
            weight = weight || WG_DEFAULT;
            if (this.maxWeight < weight) {
                this.maxWeight = weight;
                if (this.types.length == 1 && this.types[0] == type) return;
                this.types.length = 0;
            }
            else if (this.maxWeight > weight || this.types.indexOf(type) > -1) {
                return;
            }

            this.signal("addType", type);
            this.types.push(type);
            var forward = this.forward;
            if (forward) withWorklist(function(add) {
                for (var i = 0; i < forward.length; ++i) add(type, forward[i], weight);
            });
        },

        propagate: function(target, weight) {
            if (target == ANull || (target instanceof Type && this.forward && this.forward.length > 2)) return;
            if (weight && weight != WG_DEFAULT) target = new Muffle(target, weight);
            (this.forward || (this.forward = [])).push(target);
            var types = this.types;
            if (types.length) withWorklist(function(add) {
                for (var i = 0; i < types.length; ++i) add(types[i], target, weight);
            });
        },

        getProp: function(prop) {
            if (prop == "__proto__" || prop == "✖") return ANull;
            var found = (this.props || (this.props = Object.create(null)))[prop];
            if (!found) {
                found = this.props[prop] = new AVal;
                this.propagate(new PropIsSubset(prop, found));
            }
            return found;
        },

        forAllProps: function(c) {
            this.propagate(new ForAllProps(c));
        },

        hasType: function(type) {
            return this.types.indexOf(type) > -1;
        },
        isEmpty: function() {
            return this.types.length === 0;
        },
        getFunctionType: function() {
            for (var i = this.types.length - 1; i >= 0; --i)
            if (this.types[i] instanceof Fn) return this.types[i];
        },
        getObjType: function() {
            var seen = null;
            for (var i = this.types.length - 1; i >= 0; --i) {
                var type = this.types[i];
                if (!(type instanceof Obj)) continue;
                if (type.name) return type;
                if (!seen) seen = type;
            }
            return seen;
        },

        getType: function(guess) {
            if (this.types.length === 0 && guess !== false) return this.makeupType();
            if (this.types.length === 1) return this.types[0];
            return canonicalType(this.types);
        },

        toString: function(maxDepth, parent) {
            if (this.types.length == 0) return toString(this.makeupType(), maxDepth, parent);
            if (this.types.length == 1) return toString(this.types[0], maxDepth, parent);
            var simplified = simplifyTypes(this.types);
            if (simplified.length > 2) return "?";
            return simplified.map(function(tp) {
                return toString(tp, maxDepth, parent);
            }).join("|");
        },

        computedPropType: function() {
            if (!this.propertyOf || !this.propertyOf.hasProp("<i>")) return null;
            var computedProp = this.propertyOf.getProp("<i>");
            if (computedProp == this) return null;
            return computedProp.getType();
        },

        makeupType: function() {
            var computed = this.computedPropType();
            if (computed) return computed;

            if (!this.forward) return null;
            for (var i = this.forward.length - 1; i >= 0; --i) {
                var hint = this.forward[i].typeHint();
                if (hint && !hint.isEmpty()) {
                    guessing = true;
                    return hint;
                }
            }

            var props = Object.create(null),
                foundProp = null;
            for (var i = 0; i < this.forward.length; ++i) {
                var prop = this.forward[i].propHint();
                if (prop && prop != "length" && prop != "<i>" && prop != "✖" && prop != cx.completingProperty) {
                    props[prop] = true;
                    foundProp = prop;
                }
            }
            if (!foundProp) return null;

            var objs = objsWithProp(foundProp);
            if (objs) {
                var matches = [];
                search: for (var i = 0; i < objs.length; ++i) {
                    var obj = objs[i];
                    for (var prop in props) if (!obj.hasProp(prop)) continue search;
                    if (obj.hasCtor) obj = getInstance(obj);
                    matches.push(obj);
                }
                var canon = canonicalType(matches);
                if (canon) {
                    guessing = true;
                    return canon;
                }
            }
        },

        typeHint: function() {
            return this.types.length ? this.getType() : null;
        },
        propagatesTo: function() {
            return this;
        },

        gatherProperties: function(f, depth) {
            for (var i = 0; i < this.types.length; ++i)
            this.types[i].gatherProperties(f, depth);
        },

        guessProperties: function(f) {
            if (this.forward) for (var i = 0; i < this.forward.length; ++i) {
                var prop = this.forward[i].propHint();
                if (prop) f(prop, null, 0);
            }
            var guessed = this.makeupType();
            if (guessed) guessed.gatherProperties(f);
        }
    });

    function similarAVal(a, b, depth) {
        var typeA = a.getType(false),
            typeB = b.getType(false);
        if (!typeA || !typeB) return true;
        return similarType(typeA, typeB, depth);
    }

    function similarType(a, b, depth) {
        if (!a || depth >= 5) return b;
        if (!a || a == b) return a;
        if (!b) return a;
        if (a.constructor != b.constructor) return false;
        if (a.constructor == Arr) {
            var innerA = a.getProp("<i>").getType(false);
            if (!innerA) return b;
            var innerB = b.getProp("<i>").getType(false);
            if (!innerB || similarType(innerA, innerB, depth + 1)) return b;
        }
        else if (a.constructor == Obj) {
            var propsA = 0,
                propsB = 0,
                same = 0;
            for (var prop in a.props) {
                propsA++;
                if (prop in b.props && similarAVal(a.props[prop], b.props[prop], depth + 1)) same++;
            }
            for (var prop in b.props) propsB++;
            if (propsA && propsB && same < Math.max(propsA, propsB) / 2) return false;
            return propsA > propsB ? a : b;
        }
        else if (a.constructor == Fn) {
            if (a.args.length != b.args.length || !a.args.every(function(tp, i) {
                return similarAVal(tp, b.args[i], depth + 1);
            }) || !similarAVal(a.retval, b.retval, depth + 1) || !similarAVal(a.self, b.self, depth + 1)) return false;
            return a;
        }
        else {
            return false;
        }
    }

    var simplifyTypes = exports.simplifyTypes = function(types) {
        var found = [];
        outer: for (var i = 0; i < types.length; ++i) {
            var tp = types[i];
            for (var j = 0; j < found.length; j++) {
                var similar = similarType(tp, found[j], 0);
                if (similar) {
                    found[j] = similar;
                    continue outer;
                }
            }
            found.push(tp);
        }
        return found;
    };

    function canonicalType(types) {
        var arrays = 0,
            fns = 0,
            objs = 0,
            prim = null;
        for (var i = 0; i < types.length; ++i) {
            var tp = types[i];
            if (tp instanceof Arr)++arrays;
            else if (tp instanceof Fn)++fns;
            else if (tp instanceof Obj)++objs;
            else if (tp instanceof Prim) {
                if (prim && tp.name != prim.name) return null;
                prim = tp;
            }
        }
        var kinds = (arrays && 1) + (fns && 1) + (objs && 1) + (prim && 1);
        if (kinds > 1) return null;
        if (prim) return prim;

        var maxScore = 0,
            maxTp = null;
        for (var i = 0; i < types.length; ++i) {
            var tp = types[i],
                score = 0;
            if (arrays) {
                score = tp.getProp("<i>").isEmpty() ? 1 : 2;
            }
            else if (fns) {
                score = 1;
                for (var j = 0; j < tp.args.length; ++j) if (!tp.args[j].isEmpty())++score;
                if (!tp.retval.isEmpty())++score;
            }
            else if (objs) {
                score = tp.name ? 100 : 2;
            }
            if (score >= maxScore) {
                maxScore = score;
                maxTp = tp;
            }
        }
        return maxTp;
    }

    // PROPAGATION STRATEGIES

    function Constraint() {}
    Constraint.prototype = extend(ANull, {
        init: function() {
            this.origin = cx.curOrigin;
        }
    });

    var constraint = exports.constraint = function(props, methods) {
        var body = "this.init();";
        props = props ? props.split(", ") : [];
        for (var i = 0; i < props.length; ++i)
        body += "this." + props[i] + " = " + props[i] + ";";
        var ctor = Function.apply(null, props.concat([body]));
        ctor.prototype = Object.create(Constraint.prototype);
        for (var m in methods) if (methods.hasOwnProperty(m)) ctor.prototype[m] = methods[m];
        return ctor;
    };

    var PropIsSubset = constraint("prop, target", {
        addType: function(type, weight) {
            if (type.getProp) type.getProp(this.prop).propagate(this.target, weight);
        },
        propHint: function() {
            return this.prop;
        },
        propagatesTo: function() {
            if (this.prop == "<i>" || !/[^\w_]/.test(this.prop)) return {
                target: this.target,
                pathExt: "." + this.prop
            };
        }
    });

    var PropHasSubset = exports.PropHasSubset = constraint("prop, type, originNode", {
        addType: function(type, weight) {
            if (!(type instanceof Obj)) return;
            var prop = type.defProp(this.prop, this.originNode);
            prop.origin = this.origin;
            this.type.propagate(prop, weight);
        },
        propHint: function() {
            return this.prop;
        }
    });

    var ForAllProps = constraint("c", {
        addType: function(type) {
            if (!(type instanceof Obj)) return;
            type.forAllProps(this.c);
        }
    });

    function withDisabledComputing(fn, body) {
        cx.disabledComputing = {
            fn: fn,
            prev: cx.disabledComputing
        };
        try {
            return body();
        }
        finally {
            cx.disabledComputing = cx.disabledComputing.prev;
        }
    }
    var IsCallee = exports.IsCallee = constraint("self, args, argNodes, retval", {
        init: function() {
            Constraint.prototype.init.call(this);
            this.disabled = cx.disabledComputing;
        },
        addType: function(fn, weight) {
            if (!(fn instanceof Fn)) return;
            for (var i = 0; i < this.args.length; ++i) {
                if (i < fn.args.length) this.args[i].propagate(fn.args[i], weight);
                if (fn.arguments) this.args[i].propagate(fn.arguments, weight);
            }
            this.self.propagate(fn.self, this.self == cx.topScope ? WG_GLOBAL_THIS : weight);
            var compute = fn.computeRet;
            if (compute) for (var d = this.disabled; d; d = d.prev)
            if (d.fn == fn || fn.originNode && d.fn.originNode == fn.originNode) compute = null;
            if (compute) compute(this.self, this.args, this.argNodes).propagate(this.retval, weight);
            else fn.retval.propagate(this.retval, weight);
        },
        typeHint: function() {
            var names = [];
            for (var i = 0; i < this.args.length; ++i) names.push("?");
            return new Fn(null, this.self, this.args, names, ANull);
        },
        propagatesTo: function() {
            return {
                target: this.retval,
                pathExt: ".!ret"
            };
        }
    });

    var HasMethodCall = constraint("propName, args, argNodes, retval", {
        init: function() {
            Constraint.prototype.init.call(this);
            this.disabled = cx.disabledComputing;
        },
        addType: function(obj, weight) {
            var callee = new IsCallee(obj, this.args, this.argNodes, this.retval);
            callee.disabled = this.disabled;
            obj.getProp(this.propName).propagate(callee, weight);
        },
        propHint: function() {
            return this.propName;
        }
    });

    var IsCtor = exports.IsCtor = constraint("target, noReuse", {
        addType: function(f, weight) {
            if (!(f instanceof Fn)) return;
            if (cx.parent && !cx.parent.options.reuseInstances) this.noReuse = true;
            f.getProp("prototype").propagate(new IsProto(this.noReuse ? false : f, this.target), weight);
        }
    });

    var getInstance = exports.getInstance = function(obj, ctor) {
        if (ctor === false) return new Obj(obj);

        if (!ctor) ctor = obj.hasCtor;
        if (!obj.instances) obj.instances = [];
        for (var i = 0; i < obj.instances.length; ++i) {
            var cur = obj.instances[i];
            if (cur.ctor == ctor) return cur.instance;
        }
        var instance = new Obj(obj, ctor && ctor.name);
        instance.origin = obj.origin;
        obj.instances.push({
            ctor: ctor,
            instance: instance
        });
        return instance;
    };

    var IsProto = exports.IsProto = constraint("ctor, target", {
        addType: function(o, _weight) {
            if (!(o instanceof Obj)) return;
            if ((this.count = (this.count || 0) + 1) > 8) return;
            if (o == cx.protos.Array) this.target.addType(new Arr);
            else this.target.addType(getInstance(o, this.ctor));
        }
    });

    var FnPrototype = constraint("fn", {
        addType: function(o, _weight) {
            if (o instanceof Obj && !o.hasCtor) {
                o.hasCtor = this.fn;
                var adder = new SpeculativeThis(o, this.fn);
                adder.addType(this.fn);
                o.forAllProps(function(_prop, val, local) {
                    if (local) val.propagate(adder);
                });
            }
        }
    });

    var IsAdded = constraint("other, target", {
        addType: function(type, weight) {
            if (type == cx.str) this.target.addType(cx.str, weight);
            else if (type == cx.num && this.other.hasType(cx.num)) this.target.addType(cx.num, weight);
        },
        typeHint: function() {
            return this.other;
        }
    });

    var IfObj = exports.IfObj = constraint("target", {
        addType: function(t, weight) {
            if (t instanceof Obj) this.target.addType(t, weight);
        },
        propagatesTo: function() {
            return this.target;
        }
    });

    var SpeculativeThis = constraint("obj, ctor", {
        addType: function(tp) {
            if (tp instanceof Fn && tp.self && tp.self.isEmpty()) tp.self.addType(getInstance(this.obj, this.ctor), WG_SPECULATIVE_THIS);
        }
    });

    var Muffle = constraint("inner, weight", {
        addType: function(tp, weight) {
            this.inner.addType(tp, Math.min(weight, this.weight));
        },
        propagatesTo: function() {
            return this.inner.propagatesTo();
        },
        typeHint: function() {
            return this.inner.typeHint();
        },
        propHint: function() {
            return this.inner.propHint();
        }
    });

    // TYPE OBJECTS

    var Type = exports.Type = function() {};
    Type.prototype = extend(ANull, {
        constructor: Type,
        propagate: function(c, w) {
            c.addType(this, w);
        },
        hasType: function(other) {
            return other == this;
        },
        isEmpty: function() {
            return false;
        },
        typeHint: function() {
            return this;
        },
        getType: function() {
            return this;
        }
    });

    var Prim = exports.Prim = function(proto, name) {
        this.name = name;
        this.proto = proto;
    };
    Prim.prototype = extend(Type.prototype, {
        constructor: Prim,
        toString: function() {
            return this.name;
        },
        getProp: function(prop) {
            return this.proto.hasProp(prop) || ANull;
        },
        gatherProperties: function(f, depth) {
            if (this.proto) this.proto.gatherProperties(f, depth);
        }
    });

    var Obj = exports.Obj = function(proto, name) {
        if (!this.props) this.props = Object.create(null);
        this.proto = proto === true ? cx.protos.Object : proto;
        if (proto && !name && proto.name && !(this instanceof Fn)) {
            var match = /^(.*)\.prototype$/.exec(this.proto.name);
            if (match) name = match[1];
        }
        this.name = name;
        this.maybeProps = null;
        this.origin = cx.curOrigin;
    };
    Obj.prototype = extend(Type.prototype, {
        constructor: Obj,
        toString: function(maxDepth) {
            if (!maxDepth && this.name) return this.name;
            var props = [],
                etc = false;
            for (var prop in this.props) if (prop != "<i>") {
                if (props.length > 5) {
                    etc = true;
                    break;
                }
                if (maxDepth) props.push(prop + ": " + toString(this.props[prop], maxDepth - 1));
                else props.push(prop);
            }
            props.sort();
            if (etc) props.push("...");
            return "{" + props.join(", ") + "}";
        },
        hasProp: function(prop, searchProto) {
            var found = this.props[prop];
            if (searchProto !== false) for (var p = this.proto; p && !found; p = p.proto) found = p.props[prop];
            return found;
        },
        defProp: function(prop, originNode) {
            var found = this.hasProp(prop, false);
            if (found) {
                if (originNode && !found.originNode) found.originNode = originNode;
                return found;
            }
            if (prop == "__proto__" || prop == "✖") return ANull;

            var av = this.maybeProps && this.maybeProps[prop];
            if (av) {
                delete this.maybeProps[prop];
                this.maybeUnregProtoPropHandler();
            }
            else {
                av = new AVal;
                av.propertyOf = this;
            }

            this.props[prop] = av;
            av.originNode = originNode;
            av.origin = cx.curOrigin;
            this.broadcastProp(prop, av, true);
            return av;
        },
        getProp: function(prop) {
            var found = this.hasProp(prop, true) || (this.maybeProps && this.maybeProps[prop]);
            if (found) return found;
            if (prop == "__proto__" || prop == "✖") return ANull;
            var av = this.ensureMaybeProps()[prop] = new AVal;
            av.propertyOf = this;
            return av;
        },
        broadcastProp: function(prop, val, local) {
            if (local) {
                this.signal("addProp", prop, val);
                // If this is a scope, it shouldn't be registered
                if (!(this instanceof Scope)) registerProp(prop, this);
            }

            if (this.onNewProp) for (var i = 0; i < this.onNewProp.length; ++i) {
                var h = this.onNewProp[i];
                h.onProtoProp ? h.onProtoProp(prop, val, local) : h(prop, val, local);
            }
        },
        onProtoProp: function(prop, val, _local) {
            var maybe = this.maybeProps && this.maybeProps[prop];
            if (maybe) {
                delete this.maybeProps[prop];
                this.maybeUnregProtoPropHandler();
                this.proto.getProp(prop).propagate(maybe);
            }
            this.broadcastProp(prop, val, false);
        },
        ensureMaybeProps: function() {
            if (!this.maybeProps) {
                if (this.proto) this.proto.forAllProps(this);
                this.maybeProps = Object.create(null);
            }
            return this.maybeProps;
        },
        removeProp: function(prop) {
            var av = this.props[prop];
            delete this.props[prop];
            this.ensureMaybeProps()[prop] = av;
            av.types.length = 0;
        },
        forAllProps: function(c) {
            if (!this.onNewProp) {
                this.onNewProp = [];
                if (this.proto) this.proto.forAllProps(this);
            }
            this.onNewProp.push(c);
            for (var o = this; o; o = o.proto) for (var prop in o.props) {
                if (c.onProtoProp) c.onProtoProp(prop, o.props[prop], o == this);
                else c(prop, o.props[prop], o == this);
            }
        },
        maybeUnregProtoPropHandler: function() {
            if (this.maybeProps) {
                for (var _n in this.maybeProps) return;
                this.maybeProps = null;
            }
            if (!this.proto || this.onNewProp && this.onNewProp.length) return;
            this.proto.unregPropHandler(this);
        },
        unregPropHandler: function(handler) {
            for (var i = 0; i < this.onNewProp.length; ++i)
            if (this.onNewProp[i] == handler) {
                this.onNewProp.splice(i, 1);
                break;
            }
            this.maybeUnregProtoPropHandler();
        },
        gatherProperties: function(f, depth) {
            for (var prop in this.props) if (prop != "<i>") f(prop, this, depth);
            if (this.proto) this.proto.gatherProperties(f, depth + 1);
        },
        getObjType: function() {
            return this;
        }
    });

    var Fn = exports.Fn = function(name, self, args, argNames, retval) {
        Obj.call(this, cx.protos.Function, name);
        this.self = self;
        this.args = args;
        this.argNames = argNames;
        this.retval = retval;
    };
    Fn.prototype = extend(Obj.prototype, {
        constructor: Fn,
        toString: function(maxDepth) {
            if (maxDepth) maxDepth--;
            var str = "fn(";
            for (var i = 0; i < this.args.length; ++i) {
                if (i) str += ", ";
                var name = this.argNames[i];
                if (name && name != "?") str += name + ": ";
                str += toString(this.args[i], maxDepth, this);
            }
            str += ")";
            if (!this.retval.isEmpty()) str += " -> " + toString(this.retval, maxDepth, this);
            return str;
        },
        getProp: function(prop) {
            if (prop == "prototype") {
                var known = this.hasProp(prop, false);
                if (!known) {
                    known = this.defProp(prop);
                    var proto = new Obj(true, this.name && this.name + ".prototype");
                    proto.origin = this.origin;
                    known.addType(proto, WG_MADEUP_PROTO);
                }
                return known;
            }
            return Obj.prototype.getProp.call(this, prop);
        },
        defProp: function(prop, originNode) {
            if (prop == "prototype") {
                var found = this.hasProp(prop, false);
                if (found) return found;
                found = Obj.prototype.defProp.call(this, prop, originNode);
                found.origin = this.origin;
                found.propagate(new FnPrototype(this));
                return found;
            }
            return Obj.prototype.defProp.call(this, prop, originNode);
        },
        getFunctionType: function() {
            return this;
        }
    });

    var Arr = exports.Arr = function(contentType) {
        Obj.call(this, cx.protos.Array);
        var content = this.defProp("<i>");
        if (contentType) contentType.propagate(content);
    };
    Arr.prototype = extend(Obj.prototype, {
        constructor: Arr,
        toString: function(maxDepth) {
            return "[" + toString(this.getProp("<i>"), maxDepth, this) + "]";
        }
    });

    // THE PROPERTY REGISTRY

    function registerProp(prop, obj) {
        var data = cx.props[prop] || (cx.props[prop] = []);
        data.push(obj);
    }

    function objsWithProp(prop) {
        return cx.props[prop];
    }

    // INFERENCE CONTEXT

    exports.Context = function(defs, parent) {
        this.parent = parent;
        this.props = Object.create(null);
        this.protos = Object.create(null);
        this.origins = [];
        this.curOrigin = "ecma5";
        this.paths = Object.create(null);
        this.definitions = Object.create(null);
        this.purgeGen = 0;
        this.workList = null;
        this.disabledComputing = null;

        exports.withContext(this, function() {
            cx.protos.Object = new Obj(null, "Object.prototype");
            cx.topScope = new Scope();
            cx.topScope.name = "<top>";
            cx.protos.Array = new Obj(true, "Array.prototype");
            cx.protos.Function = new Obj(true, "Function.prototype");
            cx.protos.RegExp = new Obj(true, "RegExp.prototype");
            cx.protos.String = new Obj(true, "String.prototype");
            cx.protos.Number = new Obj(true, "Number.prototype");
            cx.protos.Boolean = new Obj(true, "Boolean.prototype");
            cx.str = new Prim(cx.protos.String, "string");
            cx.bool = new Prim(cx.protos.Boolean, "bool");
            cx.num = new Prim(cx.protos.Number, "number");
            cx.curOrigin = null;

            if (defs) for (var i = 0; i < defs.length; ++i)
            def.load(defs[i]);
        });
    };

    var cx = null;
    exports.cx = function() {
        return cx;
    };

    exports.withContext = function(context, f) {
        var old = cx;
        cx = context;
        try {
            return f();
        }
        finally {
            cx = old;
        }
    };

    exports.TimedOut = function() {
        this.message = "Timed out";
        this.stack = (new Error()).stack;
    };
    exports.TimedOut.prototype = Object.create(Error.prototype);
    exports.TimedOut.prototype.name = "infer.TimedOut";

    var timeout;
    exports.withTimeout = function(ms, f) {
        var end = +new Date + ms;
        var oldEnd = timeout;
        if (oldEnd && oldEnd < end) return f();
        timeout = end;
        try {
            return f();
        }
        finally {
            timeout = oldEnd;
        }
    };

    exports.addOrigin = function(origin) {
        if (cx.origins.indexOf(origin) < 0) cx.origins.push(origin);
    };

    var baseMaxWorkDepth = 20,
        reduceMaxWorkDepth = 0.0001;

    function withWorklist(f) {
        if (cx.workList) return f(cx.workList);

        var list = [],
            depth = 0;
        var add = cx.workList = function(type, target, weight) {
            if (depth < baseMaxWorkDepth - reduceMaxWorkDepth * list.length) list.push(type, target, weight, depth);
        };
        try {
            var ret = f(add);
            for (var i = 0; i < list.length; i += 4) {
                if (timeout && +new Date >= timeout) throw new exports.TimedOut();
                depth = list[i + 3] + 1;
                list[i + 1].addType(list[i], list[i + 2]);
            }
            return ret;
        }
        finally {
            cx.workList = null;
        }
    }

    // SCOPES

    var Scope = exports.Scope = function(prev) {
        Obj.call(this, prev || true);
        this.prev = prev;
    };
    Scope.prototype = extend(Obj.prototype, {
        constructor: Scope,
        defVar: function(name, originNode) {
            for (var s = this;; s = s.proto) {
                var found = s.props[name];
                if (found) return found;
                if (!s.prev) return s.defProp(name, originNode);
            }
        }
    });

    // RETVAL COMPUTATION HEURISTICS

    function maybeInstantiate(scope, score) {
        if (scope.fnType) scope.fnType.instantiateScore = (scope.fnType.instantiateScore || 0) + score;
    }

    var NotSmaller = {};

    function nodeSmallerThan(node, n) {
        try {
            walk.simple(node, {
                Expression: function() {
                    if (--n <= 0) throw NotSmaller;
                }
            });
            return true;
        }
        catch (e) {
            if (e == NotSmaller) return false;
            throw e;
        }
    }

    function maybeTagAsInstantiated(node, scope) {
        var score = scope.fnType.instantiateScore;
        if (!cx.disabledComputing && score && scope.fnType.args.length && nodeSmallerThan(node, score * 5)) {
            maybeInstantiate(scope.prev, score / 2);
            setFunctionInstantiated(node, scope);
            return true;
        }
        else {
            scope.fnType.instantiateScore = null;
        }
    }

    function setFunctionInstantiated(node, scope) {
        var fn = scope.fnType;
        // Disconnect the arg avals, so that we can add info to them without side effects
        for (var i = 0; i < fn.args.length; ++i) fn.args[i] = new AVal;
        fn.self = new AVal;
        fn.computeRet = function(self, args) {
            // Prevent recursion
            return withDisabledComputing(fn, function() {
                var oldOrigin = cx.curOrigin;
                cx.curOrigin = fn.origin;
                var scopeCopy = new Scope(scope.prev);
                scopeCopy.originNode = scope.originNode;
                for (var v in scope.props) {
                    var local = scopeCopy.defProp(v, scope.props[v].originNode);
                    for (var i = 0; i < args.length; ++i) if (fn.argNames[i] == v && i < args.length) args[i].propagate(local);
                }
                var argNames = fn.argNames.length != args.length ? fn.argNames.slice(0, args.length) : fn.argNames;
                while (argNames.length < args.length) argNames.push("?");
                scopeCopy.fnType = new Fn(fn.name, self, args, argNames, ANull);
                scopeCopy.fnType.originNode = fn.originNode;
                if (fn.arguments) {
                    var argset = scopeCopy.fnType.arguments = new AVal;
                    scopeCopy.defProp("arguments").addType(new Arr(argset));
                    for (var i = 0; i < args.length; ++i) args[i].propagate(argset);
                }
                node.body.scope = scopeCopy;
                walk.recursive(node.body, scopeCopy, null, scopeGatherer);
                walk.recursive(node.body, scopeCopy, null, inferWrapper);
                cx.curOrigin = oldOrigin;
                return scopeCopy.fnType.retval;
            });
        };
    }

    function maybeTagAsGeneric(scope) {
        var fn = scope.fnType,
            target = fn.retval;
        if (target == ANull) return;
        var targetInner, asArray;
        if (!target.isEmpty() && (targetInner = target.getType()) instanceof Arr) target = asArray = targetInner.getProp("<i>");

        function explore(aval, path, depth) {
            if (depth > 3 || !aval.forward) return;
            for (var i = 0; i < aval.forward.length; ++i) {
                var prop = aval.forward[i].propagatesTo();
                if (!prop) continue;
                var newPath = path,
                    dest;
                if (prop instanceof AVal) {
                    dest = prop;
                }
                else if (prop.target instanceof AVal) {
                    newPath += prop.pathExt;
                    dest = prop.target;
                }
                else continue;
                if (dest == target) return newPath;
                var found = explore(dest, newPath, depth + 1);
                if (found) return found;
            }
        }

        var foundPath = explore(fn.self, "!this", 0);
        for (var i = 0; !foundPath && i < fn.args.length; ++i)
        foundPath = explore(fn.args[i], "!" + i, 0);

        if (foundPath) {
            if (asArray) foundPath = "[" + foundPath + "]";
            var p = new def.TypeParser(foundPath);
            var parsed = p.parseType(true);
            fn.computeRet = parsed.apply ? parsed : function() {
                return parsed;
            };
            fn.computeRetSource = foundPath;
            return true;
        }
    }

    // SCOPE GATHERING PASS

    function addVar(scope, nameNode) {
        return scope.defProp(nameNode.name, nameNode);
    }

    var scopeGatherer = walk.make({
        Function: function(node, scope, c) {
            var inner = node.body.scope = new Scope(scope);
            inner.originNode = node;
            var argVals = [],
                argNames = [];
            for (var i = 0; i < node.params.length; ++i) {
                var param = node.params[i];
                argNames.push(param.name);
                argVals.push(addVar(inner, param));
            }
            inner.fnType = new Fn(node.id && node.id.name, new AVal, argVals, argNames, ANull);
            inner.fnType.originNode = node;
            if (node.id) {
                var decl = node.type == "FunctionDeclaration";
                addVar(decl ? scope : inner, node.id);
            }
            c(node.body, inner, "ScopeBody");
        },
        TryStatement: function(node, scope, c) {
            c(node.block, scope, "Statement");
            if (node.handler) {
                var v = addVar(scope, node.handler.param);
                c(node.handler.body, scope, "ScopeBody");
                var e5 = cx.definitions.ecma5;
                if (e5 && v.isEmpty()) getInstance(e5["Error.prototype"]).propagate(v, WG_CATCH_ERROR);
            }
            if (node.finalizer) c(node.finalizer, scope, "Statement");
        },
        VariableDeclaration: function(node, scope, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];
                addVar(scope, decl.id);
                if (decl.init) c(decl.init, scope, "Expression");
            }
        }
    });

    // CONSTRAINT GATHERING PASS

    function propName(node, scope, c) {
        var prop = node.property;
        if (!node.computed) return prop.name;
        if (prop.type == "Literal" && typeof prop.value == "string") return prop.value;
        if (c) infer(prop, scope, c, ANull);
        return "<i>";
    }

    function unopResultType(op) {
        switch (op) {
        case "+":
        case "-":
        case "~":
            return cx.num;
        case "!":
            return cx.bool;
        case "typeof":
            return cx.str;
        case "void":
        case "delete":
            return ANull;
        }
    }

    function binopIsBoolean(op) {
        switch (op) {
        case "==":
        case "!=":
        case "===":
        case "!==":
        case "<":
        case ">":
        case ">=":
        case "<=":
        case "in":
        case "instanceof":
            return true;
        }
    }

    function literalType(node) {
        if (node.regex) return getInstance(cx.protos.RegExp);
        switch (typeof node.value) {
        case "boolean":
            return cx.bool;
        case "number":
            return cx.num;
        case "string":
            return cx.str;
        case "object":
        case "function":
            if (!node.value) return ANull;
            return getInstance(cx.protos.RegExp);
        }
    }

    function ret(f) {
        return function(node, scope, c, out, name) {
            var r = f(node, scope, c, name);
            if (out) r.propagate(out);
            return r;
        };
    }

    function fill(f) {
        return function(node, scope, c, out, name) {
            if (!out) out = new AVal;
            f(node, scope, c, out, name);
            return out;
        };
    }

    var inferExprVisitor = {
        ArrayExpression: ret(function(node, scope, c) {
            var eltval = new AVal;
            for (var i = 0; i < node.elements.length; ++i) {
                var elt = node.elements[i];
                if (elt) infer(elt, scope, c, eltval);
            }
            return new Arr(eltval);
        }),
        ObjectExpression: ret(function(node, scope, c, name) {
            var obj = node.objType = new Obj(true, name);
            obj.originNode = node;

            for (var i = 0; i < node.properties.length; ++i) {
                var prop = node.properties[i],
                    key = prop.key,
                    name;
                if (prop.value.name == "✖") continue;

                if (key.type == "Identifier") {
                    name = key.name;
                }
                else if (typeof key.value == "string") {
                    name = key.value;
                }
                if (!name || prop.kind == "set") {
                    infer(prop.value, scope, c, ANull);
                    continue;
                }

                var val = obj.defProp(name, key),
                    out = val;
                val.initializer = true;
                if (prop.kind == "get") out = new IsCallee(obj, [], null, val);
                infer(prop.value, scope, c, out, name);
            }
            return obj;
        }),
        FunctionExpression: ret(function(node, scope, c, name) {
            var inner = node.body.scope,
                fn = inner.fnType;
            if (name && !fn.name) fn.name = name;
            c(node.body, scope, "ScopeBody");
            maybeTagAsInstantiated(node, inner) || maybeTagAsGeneric(inner);
            if (node.id) inner.getProp(node.id.name).addType(fn);
            return fn;
        }),
        SequenceExpression: ret(function(node, scope, c) {
            for (var i = 0, l = node.expressions.length - 1; i < l; ++i)
            infer(node.expressions[i], scope, c, ANull);
            return infer(node.expressions[l], scope, c);
        }),
        UnaryExpression: ret(function(node, scope, c) {
            infer(node.argument, scope, c, ANull);
            return unopResultType(node.operator);
        }),
        UpdateExpression: ret(function(node, scope, c) {
            infer(node.argument, scope, c, ANull);
            return cx.num;
        }),
        BinaryExpression: ret(function(node, scope, c) {
            if (node.operator == "+") {
                var lhs = infer(node.left, scope, c);
                var rhs = infer(node.right, scope, c);
                if (lhs.hasType(cx.str) || rhs.hasType(cx.str)) return cx.str;
                if (lhs.hasType(cx.num) && rhs.hasType(cx.num)) return cx.num;
                var result = new AVal;
                lhs.propagate(new IsAdded(rhs, result));
                rhs.propagate(new IsAdded(lhs, result));
                return result;
            }
            else {
                infer(node.left, scope, c, ANull);
                infer(node.right, scope, c, ANull);
                return binopIsBoolean(node.operator) ? cx.bool : cx.num;
            }
        }),
        AssignmentExpression: ret(function(node, scope, c) {
            var rhs, name, pName;
            if (node.left.type == "MemberExpression") {
                pName = propName(node.left, scope, c);
                if (node.left.object.type == "Identifier") name = node.left.object.name + "." + pName;
            }
            else {
                name = node.left.name;
            }

            if (node.operator != "=" && node.operator != "+=") {
                infer(node.right, scope, c, ANull);
                rhs = cx.num;
            }
            else {
                rhs = infer(node.right, scope, c, null, name);
            }

            if (node.left.type == "MemberExpression") {
                var obj = infer(node.left.object, scope, c);
                if (pName == "prototype") maybeInstantiate(scope, 20);
                if (pName == "<i>") {
                    // This is a hack to recognize for/in loops that copy
                    // properties, and do the copying ourselves, insofar as we
                    // manage, because such loops tend to be relevant for type
                    // information.
                    var v = node.left.property.name,
                        local = scope.props[v],
                        over = local && local.iteratesOver;
                    if (over) {
                        maybeInstantiate(scope, 20);
                        var fromRight = node.right.type == "MemberExpression" && node.right.computed && node.right.property.name == v;
                        over.forAllProps(function(prop, val, local) {
                            if (local && prop != "prototype" && prop != "<i>") obj.propagate(new PropHasSubset(prop, fromRight ? val : ANull));
                        });
                        return rhs;
                    }
                }
                obj.propagate(new PropHasSubset(pName, rhs, node.left.property));
            }
            else { // Identifier
                rhs.propagate(scope.defVar(node.left.name, node.left));
            }
            return rhs;
        }),
        LogicalExpression: fill(function(node, scope, c, out) {
            infer(node.left, scope, c, out);
            infer(node.right, scope, c, out);
        }),
        ConditionalExpression: fill(function(node, scope, c, out) {
            infer(node.test, scope, c, ANull);
            infer(node.consequent, scope, c, out);
            infer(node.alternate, scope, c, out);
        }),
        NewExpression: fill(function(node, scope, c, out, name) {
            if (node.callee.type == "Identifier" && node.callee.name in scope.props) maybeInstantiate(scope, 20);

            for (var i = 0, args = []; i < node.arguments.length; ++i)
            args.push(infer(node.arguments[i], scope, c));
            var callee = infer(node.callee, scope, c);
            var self = new AVal;
            callee.propagate(new IsCtor(self, name && /\.prototype$/.test(name)));
            self.propagate(out, WG_NEW_INSTANCE);
            callee.propagate(new IsCallee(self, args, node.arguments, new IfObj(out)));
        }),
        CallExpression: fill(function(node, scope, c, out) {
            for (var i = 0, args = []; i < node.arguments.length; ++i)
            args.push(infer(node.arguments[i], scope, c));
            if (node.callee.type == "MemberExpression") {
                var self = infer(node.callee.object, scope, c);
                var pName = propName(node.callee, scope, c);
                if ((pName == "call" || pName == "apply") && scope.fnType && scope.fnType.args.indexOf(self) > -1) maybeInstantiate(scope, 30);
                self.propagate(new HasMethodCall(pName, args, node.arguments, out));
            }
            else {
                var callee = infer(node.callee, scope, c);
                if (scope.fnType && scope.fnType.args.indexOf(callee) > -1) maybeInstantiate(scope, 30);
                var knownFn = callee.getFunctionType();
                if (knownFn && knownFn.instantiateScore && scope.fnType) maybeInstantiate(scope, knownFn.instantiateScore / 5);
                callee.propagate(new IsCallee(cx.topScope, args, node.arguments, out));
            }
        }),
        MemberExpression: fill(function(node, scope, c, out) {
            var name = propName(node, scope);
            var obj = infer(node.object, scope, c);
            var prop = obj.getProp(name);
            if (name == "<i>") {
                var propType = infer(node.property, scope, c);
                if (!propType.hasType(cx.num)) return prop.propagate(out, WG_MULTI_MEMBER);
            }
            prop.propagate(out);
        }),
        Identifier: ret(function(node, scope) {
            if (node.name == "arguments" && scope.fnType && !(node.name in scope.props)) scope.defProp(node.name, scope.fnType.originNode).addType(new Arr(scope.fnType.arguments = new AVal));
            return scope.getProp(node.name);
        }),
        ThisExpression: ret(function(_node, scope) {
            return scope.fnType ? scope.fnType.self : cx.topScope;
        }),
        Literal: ret(function(node) {
            return literalType(node);
        })
    };

    function infer(node, scope, c, out, name) {
        return inferExprVisitor[node.type](node, scope, c, out, name);
    }

    var inferWrapper = walk.make({
        Expression: function(node, scope, c) {
            infer(node, scope, c, ANull);
        },

        FunctionDeclaration: function(node, scope, c) {
            var inner = node.body.scope,
                fn = inner.fnType;
            c(node.body, scope, "ScopeBody");
            maybeTagAsInstantiated(node, inner) || maybeTagAsGeneric(inner);
            var prop = scope.getProp(node.id.name);
            prop.addType(fn);
        },

        VariableDeclaration: function(node, scope, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i],
                    prop = scope.getProp(decl.id.name);
                if (decl.init) infer(decl.init, scope, c, prop, decl.id.name);
            }
        },

        ReturnStatement: function(node, scope, c) {
            if (!node.argument) return;
            var output = ANull;
            if (scope.fnType) {
                if (scope.fnType.retval == ANull) scope.fnType.retval = new AVal;
                output = scope.fnType.retval;
            }
            infer(node.argument, scope, c, output);
        },

        ForInStatement: function(node, scope, c) {
            var source = infer(node.right, scope, c);
            if ((node.right.type == "Identifier" && node.right.name in scope.props) || (node.right.type == "MemberExpression" && node.right.property.name == "prototype")) {
                maybeInstantiate(scope, 5);
                var varName;
                if (node.left.type == "Identifier") {
                    varName = node.left.name;
                }
                else if (node.left.type == "VariableDeclaration") {
                    varName = node.left.declarations[0].id.name;
                }
                if (varName && varName in scope.props) scope.getProp(varName).iteratesOver = source;
            }
            c(node.body, scope, "Statement");
        },

        ScopeBody: function(node, scope, c) {
            c(node, node.scope || scope);
        }
    });

    // PARSING

    function runPasses(passes, pass) {
        var arr = passes && passes[pass];
        var args = Array.prototype.slice.call(arguments, 2);
        if (arr) for (var i = 0; i < arr.length; ++i) arr[i].apply(null, args);
    }

    var parse = exports.parse = function(text, passes, options) {
        var ast;
        try {
            ast = acorn.parse(text, options);
        }
        catch (e) {
            ast = acorn_loose.parse_dammit(text, options);
        }
        runPasses(passes, "postParse", ast, text);
        return ast;
    };

    // ANALYSIS INTERFACE

    exports.analyze = function(ast, name, scope, passes) {
        if (typeof ast == "string") ast = parse(ast);

        if (!name) name = "file#" + cx.origins.length;
        exports.addOrigin(cx.curOrigin = name);

        if (!scope) scope = cx.topScope;
        walk.recursive(ast, scope, null, scopeGatherer);
        runPasses(passes, "preInfer", ast, scope);
        walk.recursive(ast, scope, null, inferWrapper);
        runPasses(passes, "postInfer", ast, scope);

        cx.curOrigin = null;
    };

    // PURGING

    exports.purge = function(origins, start, end) {
        var test = makePredicate(origins, start, end);
        ++cx.purgeGen;
        cx.topScope.purge(test);
        for (var prop in cx.props) {
            var list = cx.props[prop];
            for (var i = 0; i < list.length; ++i) {
                var obj = list[i],
                    av = obj.props[prop];
                if (!av || test(av, av.originNode)) list.splice(i--, 1);
            }
            if (!list.length) delete cx.props[prop];
        }
    };

    function makePredicate(origins, start, end) {
        var arr = Array.isArray(origins);
        if (arr && origins.length == 1) {
            origins = origins[0];
            arr = false;
        }
        if (arr) {
            if (end == null) return function(n) {
                return origins.indexOf(n.origin) > -1;
            };
            return function(n, pos) {
                return pos && pos.start >= start && pos.end <= end && origins.indexOf(n.origin) > -1;
            };
        }
        else {
            if (end == null) return function(n) {
                return n.origin == origins;
            };
            return function(n, pos) {
                return pos && pos.start >= start && pos.end <= end && n.origin == origins;
            };
        }
    }

    AVal.prototype.purge = function(test) {
        if (this.purgeGen == cx.purgeGen) return;
        this.purgeGen = cx.purgeGen;
        for (var i = 0; i < this.types.length; ++i) {
            var type = this.types[i];
            if (test(type, type.originNode)) this.types.splice(i--, 1);
            else type.purge(test);
        }
        if (this.forward) for (var i = 0; i < this.forward.length; ++i) {
            var f = this.forward[i];
            if (test(f)) {
                this.forward.splice(i--, 1);
                if (this.props) this.props = null;
            }
            else if (f.purge) {
                f.purge(test);
            }
        }
    };
    ANull.purge = function() {};
    Obj.prototype.purge = function(test) {
        if (this.purgeGen == cx.purgeGen) return true;
        this.purgeGen = cx.purgeGen;
        for (var p in this.props) {
            var av = this.props[p];
            if (test(av, av.originNode)) this.removeProp(p);
            av.purge(test);
        }
    };
    Fn.prototype.purge = function(test) {
        if (Obj.prototype.purge.call(this, test)) return;
        this.self.purge(test);
        this.retval.purge(test);
        for (var i = 0; i < this.args.length; ++i) this.args[i].purge(test);
    };

    // EXPRESSION TYPE DETERMINATION

    function findByPropertyName(name) {
        guessing = true;
        var found = objsWithProp(name);
        if (found) for (var i = 0; i < found.length; ++i) {
            var val = found[i].getProp(name);
            if (!val.isEmpty()) return val;
        }
        return ANull;
    }

    var typeFinder = {
        ArrayExpression: function(node, scope) {
            var eltval = new AVal;
            for (var i = 0; i < node.elements.length; ++i) {
                var elt = node.elements[i];
                if (elt) findType(elt, scope).propagate(eltval);
            }
            return new Arr(eltval);
        },
        ObjectExpression: function(node) {
            return node.objType;
        },
        FunctionExpression: function(node) {
            return node.body.scope.fnType;
        },
        SequenceExpression: function(node, scope) {
            return findType(node.expressions[node.expressions.length - 1], scope);
        },
        UnaryExpression: function(node) {
            return unopResultType(node.operator);
        },
        UpdateExpression: function() {
            return cx.num;
        },
        BinaryExpression: function(node, scope) {
            if (binopIsBoolean(node.operator)) return cx.bool;
            if (node.operator == "+") {
                var lhs = findType(node.left, scope);
                var rhs = findType(node.right, scope);
                if (lhs.hasType(cx.str) || rhs.hasType(cx.str)) return cx.str;
            }
            return cx.num;
        },
        AssignmentExpression: function(node, scope) {
            return findType(node.right, scope);
        },
        LogicalExpression: function(node, scope) {
            var lhs = findType(node.left, scope);
            return lhs.isEmpty() ? findType(node.right, scope) : lhs;
        },
        ConditionalExpression: function(node, scope) {
            var lhs = findType(node.consequent, scope);
            return lhs.isEmpty() ? findType(node.alternate, scope) : lhs;
        },
        NewExpression: function(node, scope) {
            var f = findType(node.callee, scope).getFunctionType();
            var proto = f && f.getProp("prototype").getObjType();
            if (!proto) return ANull;
            return getInstance(proto, f);
        },
        CallExpression: function(node, scope) {
            var f = findType(node.callee, scope).getFunctionType();
            if (!f) return ANull;
            if (f.computeRet) {
                for (var i = 0, args = []; i < node.arguments.length; ++i)
                args.push(findType(node.arguments[i], scope));
                var self = ANull;
                if (node.callee.type == "MemberExpression") self = findType(node.callee.object, scope);
                return f.computeRet(self, args, node.arguments);
            }
            else {
                return f.retval;
            }
        },
        MemberExpression: function(node, scope) {
            var propN = propName(node, scope),
                obj = findType(node.object, scope).getType();
            if (obj) return obj.getProp(propN);
            if (propN == "<i>") return ANull;
            return findByPropertyName(propN);
        },
        Identifier: function(node, scope) {
            return scope.hasProp(node.name) || ANull;
        },
        ThisExpression: function(_node, scope) {
            return scope.fnType ? scope.fnType.self : cx.topScope;
        },
        Literal: function(node) {
            return literalType(node);
        }
    };

    function findType(node, scope) {
        return typeFinder[node.type](node, scope);
    }

    var searchVisitor = exports.searchVisitor = walk.make({
        Function: function(node, _st, c) {
            var scope = node.body.scope;
            if (node.id) c(node.id, scope);
            for (var i = 0; i < node.params.length; ++i)
            c(node.params[i], scope);
            c(node.body, scope, "ScopeBody");
        },
        TryStatement: function(node, st, c) {
            if (node.handler) c(node.handler.param, st);
            walk.base.TryStatement(node, st, c);
        },
        VariableDeclaration: function(node, st, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];
                c(decl.id, st);
                if (decl.init) c(decl.init, st, "Expression");
            }
        }
    });
    exports.fullVisitor = walk.make({
        MemberExpression: function(node, st, c) {
            c(node.object, st, "Expression");
            c(node.property, st, node.computed ? "Expression" : null);
        },
        ObjectExpression: function(node, st, c) {
            for (var i = 0; i < node.properties.length; ++i) {
                c(node.properties[i].value, st, "Expression");
                c(node.properties[i].key, st);
            }
        }
    }, searchVisitor);

    exports.findExpressionAt = function(ast, start, end, defaultScope, filter) {
        var test = filter || function(_t, node) {
                if (node.type == "Identifier" && node.name == "✖") return false;
                return typeFinder.hasOwnProperty(node.type);
            };
        return walk.findNodeAt(ast, start, end, test, searchVisitor, defaultScope || cx.topScope);
    };

    exports.findExpressionAround = function(ast, start, end, defaultScope, filter) {
        var test = filter || function(_t, node) {
                if (start != null && node.start > start) return false;
                if (node.type == "Identifier" && node.name == "✖") return false;
                return typeFinder.hasOwnProperty(node.type);
            };
        return walk.findNodeAround(ast, end, test, searchVisitor, defaultScope || cx.topScope);
    };

    exports.expressionType = function(found) {
        return findType(found.node, found.state);
    };

    // Finding the expected type of something, from context

    exports.parentNode = function(child, ast) {
        var stack = [];

        function c(node, st, override) {
            if (node.start <= child.start && node.end >= child.end) {
                var top = stack[stack.length - 1];
                if (node == child) throw {
                    found: top
                };
                if (top != node) stack.push(node);
                walk.base[override || node.type](node, st, c);
                if (top != node) stack.pop();
            }
        }
        try {
            c(ast, null);
        }
        catch (e) {
            if (e.found) return e.found;
            throw e;
        }
    };

    var findTypeFromContext = {
        ArrayExpression: function(parent, _, get) {
            return get(parent, true).getProp("<i>");
        },
        ObjectExpression: function(parent, node, get) {
            for (var i = 0; i < parent.properties.length; ++i) {
                var prop = node.properties[i];
                if (prop.value == node) return get(parent, true).getProp(prop.key.name);
            }
        },
        UnaryExpression: function(parent) {
            return unopResultType(parent.operator);
        },
        UpdateExpression: function() {
            return cx.num;
        },
        BinaryExpression: function(parent) {
            return binopIsBoolean(parent.operator) ? cx.bool : cx.num;
        },
        AssignmentExpression: function(parent, _, get) {
            return get(parent.left);
        },
        LogicalExpression: function(parent, _, get) {
            return get(parent, true);
        },
        ConditionalExpression: function(parent, node, get) {
            if (parent.consequent == node || parent.alternate == node) return get(parent, true);
        },
        NewExpression: function(parent, node, get) {
            return this.CallExpression(parent, node, get);
        },
        CallExpression: function(parent, node, get) {
            for (var i = 0; i < parent.arguments.length; i++) {
                var arg = parent.arguments[i];
                if (arg == node) {
                    var calleeType = get(parent.callee).getFunctionType();
                    if (calleeType instanceof Fn) return calleeType.args[i];
                    break;
                }
            }
        },
        ReturnStatement: function(_parent, node, get) {
            var fnNode = walk.findNodeAround(node.sourceFile.ast, node.start, "Function");
            if (fnNode) {
                var fnType = get(fnNode.node, true).getFunctionType();
                if (fnType) return fnType.retval.getType();
            }
        },
        VariableDeclaration: function(parent, node, get) {
            for (var i = 0; i < parent.declarations.length; i++) {
                var decl = parent.declarations[i];
                if (decl.init == node) return get(decl.id);
            }
        }
    };

    exports.typeFromContext = function(ast, found) {
        var parent = exports.parentNode(found.node, ast);
        if (!parent) console.log(ast, found.node);
        var type = null;
        if (findTypeFromContext.hasOwnProperty(parent.type)) {
            type = findTypeFromContext[parent.type](parent, found.node, function(node, fromContext) {
                var obj = {
                    node: node,
                    state: found.state
                };
                var tp = fromContext ? exports.typeFromContext(ast, obj) : exports.expressionType(obj);
                return tp || ANull;
            });
        }
        return type || exports.expressionType(found);
    };

    // Flag used to indicate that some wild guessing was used to produce
    // a type or set of completions.
    var guessing = false;

    exports.resetGuessing = function(val) {
        guessing = val;
    };
    exports.didGuess = function() {
        return guessing;
    };

    exports.forAllPropertiesOf = function(type, f) {
        type.gatherProperties(f, 0);
    };

    var refFindWalker = walk.make({}, searchVisitor);

    exports.findRefs = function(ast, baseScope, name, refScope, f) {
        refFindWalker.Identifier = function(node, scope) {
            if (node.name != name) return;
            for (var s = scope; s; s = s.prev) {
                if (s == refScope) f(node, scope);
                if (name in s.props) return;
            }
        };
        walk.recursive(ast, baseScope, null, refFindWalker);
    };

    var simpleWalker = walk.make({
        Function: function(node, _st, c) {
            c(node.body, node.body.scope, "ScopeBody");
        }
    });

    exports.findPropRefs = function(ast, scope, objType, propName, f) {
        walk.simple(ast, {
            MemberExpression: function(node, scope) {
                if (node.computed || node.property.name != propName) return;
                if (findType(node.object, scope).getType() == objType) f(node.property);
            },
            ObjectExpression: function(node, scope) {
                if (findType(node, scope).getType() != objType) return;
                for (var i = 0; i < node.properties.length; ++i)
                if (node.properties[i].key.name == propName) f(node.properties[i].key);
            }
        }, simpleWalker, scope);
    };

    // LOCAL-VARIABLE QUERIES

    var scopeAt = exports.scopeAt = function(ast, pos, defaultScope) {
        var found = walk.findNodeAround(ast, pos, function(tp, node) {
            return tp == "ScopeBody" && node.scope;
        });
        if (found) return found.node.scope;
        else return defaultScope || cx.topScope;
    };

    exports.forAllLocalsAt = function(ast, pos, defaultScope, f) {
        var scope = scopeAt(ast, pos, defaultScope);
        scope.gatherProperties(f, 0);
    };

    // INIT DEF MODULE

    // Delayed initialization because of cyclic dependencies.
    def = exports.def = def.init({}, exports);
});

//#endregion


//#region tern/lib/comment.js

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(exports);
    if (typeof define == "function" && define.amd) // AMD
    return define(["exports"], mod);
    mod(tern.comment || (tern.comment = {}));
})(function(exports) {
    function isSpace(ch) {
        return (ch < 14 && ch > 8) || ch === 32 || ch === 160;
    }

    function onOwnLine(text, pos) {
        for (; pos > 0; --pos) {
            var ch = text.charCodeAt(pos - 1);
            if (ch == 10) break;
            if (!isSpace(ch)) return false;
        }
        return true;
    }

    // Gather comments directly before a function
    exports.commentsBefore = function(text, pos) {
        var found = null,
            emptyLines = 0,
            topIsLineComment;
        out: while (pos > 0) {
            var prev = text.charCodeAt(pos - 1);
            if (prev == 10) {
                for (var scan = --pos, sawNonWS = false; scan > 0; --scan) {
                    prev = text.charCodeAt(scan - 1);
                    if (prev == 47 && text.charCodeAt(scan - 2) == 47) {
                        if (!onOwnLine(text, scan - 2)) break out;
                        var content = text.slice(scan, pos);
                        if (!emptyLines && topIsLineComment) found[0] = content + "\n" + found[0];
                        else(found || (found = [])).unshift(content);
                        topIsLineComment = true;
                        emptyLines = 0;
                        pos = scan - 2;
                        break;
                    }
                    else if (prev == 10) {
                        if (!sawNonWS && ++emptyLines > 1) break out;
                        break;
                    }
                    else if (!sawNonWS && !isSpace(prev)) {
                        sawNonWS = true;
                    }
                }
            }
            else if (prev == 47 && text.charCodeAt(pos - 2) == 42) {
                for (var scan = pos - 2; scan > 1; --scan) {
                    if (text.charCodeAt(scan - 1) == 42 && text.charCodeAt(scan - 2) == 47) {
                        if (!onOwnLine(text, scan - 2)) break out;
                        (found || (found = [])).unshift(text.slice(scan, pos - 2));
                        topIsLineComment = false;
                        emptyLines = 0;
                        break;
                    }
                }
                pos = scan - 2;
            }
            else if (isSpace(prev)) {
                --pos;
            }
            else {
                break;
            }
        }
        return found;
    };

    exports.commentAfter = function(text, pos) {
        while (pos < text.length) {
            var next = text.charCodeAt(pos);
            if (next == 47) {
                var after = text.charCodeAt(pos + 1),
                    end;
                if (after == 47) // line comment
                end = text.indexOf("\n", pos + 2);
                else if (after == 42) // block comment
                end = text.indexOf("*/", pos + 2);
                else return;
                return text.slice(pos + 2, end < 0 ? text.length : end);
            }
            else if (isSpace(next)) {
                ++pos;
            }
        }
    };

    exports.ensureCommentsBefore = function(text, node) {
        if (node.hasOwnProperty("commentsBefore")) return node.commentsBefore;
        return node.commentsBefore = exports.commentsBefore(text, node.start);
    };
});

//#endregion


//#region tern/plugin/requirejs.js

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern"], mod);
    mod(tern, tern);
})(function(infer, tern) {
    "use strict";

    function flattenPath(path) {
        if (!/(^|\/)(\.\/|[^\/]+\/\.\.\/)/.test(path)) return path;
        var parts = path.split("/");
        for (var i = 0; i < parts.length; ++i) {
            if (parts[i] == "." || !parts[i]) parts.splice(i--, 1);
            else if (i && parts[i] == "..") parts.splice(i---1, 2);
        }
        return parts.join("/");
    }

    function resolveName(name, data) {
        var excl = name.indexOf("!");
        if (excl > -1) name = name.slice(0, excl);

        var opts = data.options;
        var hasExt = /\.js$/.test(name);
        if (hasExt || /^(?:\w+:|\/)/.test(name)) return name + (hasExt ? "" : ".js");

        var base = opts.baseURL || "";
        if (base && base.charAt(base.length - 1) != "/") base += "/";
        if (opts.paths) {
            var known = opts.paths[name];
            if (known) return flattenPath(base + known + ".js");
            var dir = name.match(/^([^\/]+)(\/.*)$/);
            if (dir) {
                var known = opts.paths[dir[1]];
                if (known) return flattenPath(base + known + dir[2] + ".js");
            }
        }
        return flattenPath(base + name + ".js");
    }

    function getRequire(data) {
        if (!data.require) {
            data.require = new infer.Fn("require", infer.ANull, [infer.cx().str], ["module"], new infer.AVal);
            data.require.computeRet = function(_self, _args, argNodes) {
                if (argNodes.length && argNodes[0].type == "Literal" && typeof argNodes[0].value == "string") return getInterface(path.join(path.dirname(data.currentFile), argNodes[0].value), data);
                return infer.ANull;
            };
        }
        return data.require;
    }

    function getModuleInterface(data, exports) {
        var mod = new infer.Obj(infer.cx().definitions.requirejs.module, "module");
        var expProp = mod.defProp("exports");
        expProp.propagate(getModule(data.currentFile, data));
        exports.propagate(expProp, EXPORT_OBJ_WEIGHT);
        return mod;
    }

    function getExports(data) {
        var exports = new infer.Obj(true, "exports");
        getModule(data.currentFile, data).addType(exports, EXPORT_OBJ_WEIGHT);
        return exports;
    }

    function getInterface(name, data) {
        if (data.options.override && Object.prototype.hasOwnProperty.call(data.options.override, name)) {
            var over = data.options.override[name];
            if (typeof over == "string" && over.charAt(0) == "=") return infer.def.parsePath(over.slice(1));
            if (typeof over == "object") {
                var known = getKnownModule(name, data);
                if (known) return known;
                var scope = data.interfaces[stripJSExt(name)] = new infer.Obj(null, stripJSExt(name));
                infer.def.load(over, scope);
                return scope;
            }
            name = over;
        }

        if (!/^(https?:|\/)|\.js$/.test(name)) name = resolveName(name, data);
        name = flattenPath(name);

        var known = getKnownModule(name, data);

        if (!known) {
            known = getModule(name, data);
            data.server.addFile(name, null, data.currentFile);
        }
        return known;
    }

    function getKnownModule(name, data) {
        return data.interfaces[stripJSExt(name)];
    }

    function getModule(name, data) {
        var known = getKnownModule(name, data);
        if (!known) {
            known = data.interfaces[stripJSExt(name)] = new infer.AVal;
            known.origin = name;
        }
        return known;
    }

    var EXPORT_OBJ_WEIGHT = 50;

    function stripJSExt(f) {
        return f.replace(/\.js$/, '');
    }

    var path = {
        dirname: function(path) {
            var lastSep = path.lastIndexOf("/");
            return lastSep == -1 ? "" : path.slice(0, lastSep);
        },
        relative: function(from, to) {
            if (to.indexOf(from) == 0) return to.slice(from.length);
            else return to;
        },
        join: function(a, b) {
            if (b && b.charAt(0) != ".") return b;
            if (a && b) return a + "/" + b;
            else return (a || "") + (b || "");
        }
    };

    infer.registerFunction("requireJS", function(_self, args, argNodes) {
        var server = infer.cx().parent,
            data = server && server._requireJS;
        if (!data || !args.length) return infer.ANull;

        var name = data.currentFile;
        var out = getModule(name, data);

        var deps = [],
            fn, exports, mod;

        function interf(name) {
            if (name == "require") return getRequire(data);
            if (name == "exports") return exports || (exports = getExports(data));
            if (name == "module") return mod || (mod = getModuleInterface(data, exports || (exports = getExports(data))));
            return getInterface(name, data);
        }

        if (argNodes && args.length > 1) {
            var node = argNodes[args.length == 2 ? 0 : 1];
            var base = path.relative(server.options.projectDir, path.dirname(node.sourceFile.name));
            if (node.type == "Literal" && typeof node.value == "string") {
                deps.push(interf(path.join(base, node.value), data));
            }
            else if (node.type == "ArrayExpression") for (var i = 0; i < node.elements.length; ++i) {
                var elt = node.elements[i];
                if (elt.type == "Literal" && typeof elt.value == "string") deps.push(interf(path.join(base, elt.value), data));
            }
        }
        else if (argNodes && args.length == 1 && argNodes[0].type == "FunctionExpression" && argNodes[0].params.length) {
            // Simplified CommonJS call
            deps.push(interf("require", data), interf("exports", data), interf("module", data));
            fn = args[0];
        }

        if (!fn) {
            fn = args[Math.min(args.length - 1, 2)];
            if (!fn.isEmpty() && !fn.getFunctionType()) fn = null;
        }

        if (fn) fn.propagate(new infer.IsCallee(infer.ANull, deps, null, out));
        else if (args.length) args[0].propagate(out);

        return infer.ANull;
    });

    // Parse simple ObjectExpression AST nodes to their corresponding JavaScript objects.
    function parseExprNode(node) {
        switch (node.type) {
        case "ArrayExpression":
            return node.elements.map(parseExprNode);
        case "Literal":
            return node.value;
        case "ObjectExpression":
            var obj = {};
            node.properties.forEach(function(prop) {
                var key = prop.key.name || prop.key.value;
                obj[key] = parseExprNode(prop.value);
            });
            return obj;
        }
    }

    infer.registerFunction("requireJSConfig", function(_self, _args, argNodes) {
        var server = infer.cx().parent,
            data = server && server._requireJS;
        if (data && argNodes && argNodes.length && argNodes[0].type == "ObjectExpression") {
            var config = parseExprNode(argNodes[0]);
            for (var key in config) if (config.hasOwnProperty(key)) {
                var value = config[key],
                    exists = data.options[key];
                if (!exists) {
                    data.options[key] = value;
                }
                else if (key == "paths") {
                    for (var path in value) if (value.hasOwnProperty(path) && !data.options.paths[path]) data.options.paths[path] = value[path];
                }
            }
        }
        return infer.ANull;
    });

    function preCondenseReach(state) {
        var interfaces = infer.cx().parent._requireJS.interfaces;
        var rjs = state.roots["!requirejs"] = new infer.Obj(null);
        for (var name in interfaces) {
            var prop = rjs.defProp(name.replace(/\./g, "`"));
            interfaces[name].propagate(prop);
            prop.origin = interfaces[name].origin;
        }
    }

    function postLoadDef(data) {
        var cx = infer.cx(),
            interfaces = cx.definitions[data["!name"]]["!requirejs"];
        var data = cx.parent._requireJS;
        if (interfaces) for (var name in interfaces.props) {
            interfaces.props[name].propagate(getInterface(name, data));
        }
    }

    tern.registerPlugin("requirejs", function(server, options) {
        server._requireJS = {
            interfaces: Object.create(null),
            options: options || {},
            currentFile: null,
            server: server
        };

        server.on("beforeLoad", function(file) {
            this._requireJS.currentFile = file.name;
        });
        server.on("reset", function() {
            this._requireJS.interfaces = Object.create(null);
            this._requireJS.require = null;
        });
        return {
            defs: defs,
            passes: {
                preCondenseReach: preCondenseReach,
                postLoadDef: postLoadDef
            }
        };
    });

    var defs = {
        "!name": "requirejs",
        "!define": {
            module: {
                id: "string",
                uri: "string",
                config: "fn() -> ?"
            },
            config: {
                "!url": "http://requirejs.org/docs/api.html#config",
                baseUrl: {
                    "!type": "string",
                    "!doc": "the root path to use for all module lookups",
                    "!url": "http://requirejs.org/docs/api.html#config-baseUrl"
                },
                paths: {
                    "!type": "?",
                    "!doc": "path mappings for module names not found directly under baseUrl. The path settings are assumed to be relative to baseUrl, unless the paths setting starts with a '/' or has a URL protocol in it ('like http:').",
                    "!url": "http://requirejs.org/docs/api.html#config-paths"
                },
                shim: {
                    "!type": "?",
                    "!doc": "Configure the dependencies, exports, and custom initialization for older, traditional 'browser globals' scripts that do not use define() to declare the dependencies and set a module value.",
                    "!url": "http://requirejs.org/docs/api.html#config-shim"
                },
                map: {
                    "!type": "?",
                    "!doc": "For the given module prefix, instead of loading the module with the given ID, substitute a different module ID.",
                    "!url": "http://requirejs.org/docs/api.html#config-map"
                },
                config: {
                    "!type": "?",
                    "!doc": "There is a common need to pass configuration info to a module. That configuration info is usually known as part of the application, and there needs to be a way to pass that down to a module. In RequireJS, that is done with the config option for requirejs.config(). Modules can then read that info by asking for the special dependency 'module' and calling module.config().",
                    "!url": "http://requirejs.org/docs/api.html#config-moduleconfig"
                },
                packages: {
                    "!type": "?",
                    "!doc": "configures loading modules from CommonJS packages. See the packages topic for more information.",
                    "!url": "http://requirejs.org/docs/api.html#config-packages"
                },
                nodeIdCompat: {
                    "!type": "?",
                    "!doc": "Node treats module ID example.js and example the same. By default these are two different IDs in RequireJS. If you end up using modules installed from npm, then you may need to set this config value to true to avoid resolution issues.",
                    "!url": "http://requirejs.org/docs/api.html#config-nodeIdCompat"
                },
                waitSeconds: {
                    "!type": "number",
                    "!doc": "The number of seconds to wait before giving up on loading a script. Setting it to 0 disables the timeout. The default is 7 seconds.",
                    "!url": "http://requirejs.org/docs/api.html#config-waitSeconds"
                },
                context: {
                    "!type": "number",
                    "!doc": "A name to give to a loading context. This allows require.js to load multiple versions of modules in a page, as long as each top-level require call specifies a unique context string. To use it correctly, see the Multiversion Support section.",
                    "!url": "http://requirejs.org/docs/api.html#config-context"
                },
                deps: {
                    "!type": "?",
                    "!doc": "An array of dependencies to load. Useful when require is defined as a config object before require.js is loaded, and you want to specify dependencies to load as soon as require() is defined. Using deps is just like doing a require([]) call, but done as soon as the loader has processed the configuration. It does not block any other require() calls from starting their requests for modules, it is just a way to specify some modules to load asynchronously as part of a config block.",
                    "!url": "http://requirejs.org/docs/api.html#config-deps"
                },
                callback: {
                    "!type": "fn()",
                    "!doc": "A function to execute after deps have been loaded. Useful when require is defined as a config object before require.js is loaded, and you want to specify a function to require after the configuration's deps array has been loaded.",
                    "!url": "http://requirejs.org/docs/api.html#config-callback"
                },
                enforceDefine: {
                    "!type": "bool",
                    "!doc": "If set to true, an error will be thrown if a script loads that does not call define() or have a shim exports string value that can be checked. See Catching load failures in IE for more information.",
                    "!url": "http://requirejs.org/docs/api.html#config-enforceDefine"
                },
                xhtml: {
                    "!type": "bool",
                    "!doc": "If set to true, document.createElementNS() will be used to create script elements.",
                    "!url": "http://requirejs.org/docs/api.html#config-xhtml"
                },
                urlArgs: {
                    "!type": "string",
                    "!doc": "Extra query string arguments appended to URLs that RequireJS uses to fetch resources. Most useful to cache bust when the browser or server is not configured correctly.",
                    "!url": "http://requirejs.org/docs/api.html#config-urlArgs"
                },
                scriptType: {
                    "!type": "string",
                    "!doc": "Specify the value for the type='' attribute used for script tags inserted into the document by RequireJS. Default is 'text/javascript'. To use Firefox's JavaScript 1.8 features, use 'text/javascript;version=1.8'.",
                    "!url": "http://requirejs.org/docs/api.html#config-scriptType"
                },
                skipDataMain: {
                    "!type": "bool",
                    "!doc": "Introduced in RequireJS 2.1.9: If set to true, skips the data-main attribute scanning done to start module loading. Useful if RequireJS is embedded in a utility library that may interact with other RequireJS library on the page, and the embedded version should not do data-main loading.",
                    "!url": "http://requirejs.org/docs/api.html#config-skipDataMain"
                }
            }
        },
        requirejs: {
            "!type": "fn(deps: [string], callback: fn(), errback: fn()) -> !custom:requireJS",
            onError: {
                "!type": "fn(err: +Error)",
                "!doc": "To detect errors that are not caught by local errbacks, you can override requirejs.onError()",
                "!url": "http://requirejs.org/docs/api.html#requirejsonerror"
            },
            load: {
                "!type": "fn(context: ?, moduleName: string, url: string)"
            },
            config: "fn(config: config) -> !custom:requireJSConfig",
            version: "string",
            isBrowser: "bool"
        },
        require: "requirejs",
        define: {
            "!type": "fn(deps: [string], callback: fn()) -> !custom:requireJS",
            amd: {
                jQuery: "bool"
            }
        }
    };
});

//#endregion


//#region tern/plugin/component.js

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"), require);
    if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern"], mod);
    mod(tern, tern);
})(function(infer, tern, require) {
    "use strict";

    function resolvePath(base, path) {
        var slash = base.lastIndexOf("/");
        var m;

        if (slash >= 0) path = base.slice(0, slash + 1) + path;
        while (m = /[^\/]*[^\/\.][^\/]*\/\.\.\//.exec(path))
        path = path.slice(0, m.index) + path.slice(m.index + m[0].length);

        return path.replace(/(^|[^\.])\.\//g, "$1");
    }

    function resolveModule(server, name) {
        server.addFile(name, null, server._component.currentName);
        return getModule(server._component, name);
    }

    function getModule(data, name) {
        return data.modules[name] || (data.modules[name] = new infer.AVal);
    }

    function exportsFromScope(scope) {
        var mType = scope.getProp("module").getType();
        var exportsVal = mType && mType.getProp("exports");

        if (!(exportsVal instanceof infer.AVal) || exportsVal.isEmpty()) return scope.getProp("exports");
        else return exportsVal.types[exportsVal.types.length - 1];
    }

    function buildWrappingScope(parent, origin, node) {
        var scope = new infer.Scope(parent);
        var cx = infer.cx();
        scope.originNode = node;
        cx.definitions.component.require.propagate(scope.defProp("require"));

        var type = cx.definitions.component.Module.getProp("prototype").getType();
        var module = new infer.Obj(type);
        module.propagate(scope.defProp("module"));

        var exports = new infer.Obj(true, "exports", origin);
        exports.propagate(scope.defProp("exports"));
        exports.propagate(module.defProp("exports"));

        return scope;
    }

    // Assume node.js & access to local file system
    if (require)(function() {
        var fs = require("fs");
        var path = require("path");

        var win = /win/.test(process.platform);
        var resolve = path.resolve;

        if (win) resolve = function(base, file) {
            return path.resolve(base, file).replace(/\\/g, "/");
        };

        resolveModule = function(server, name, relative) {
            var data = server._component;
            var dir = server.options.projectDir || "";
            var file = name;

            if (data.options.dontLoad == true) return infer.ANull;

            if (data.options.dontLoad && new RegExp(data.options.dontLoad).test(name)) return infer.ANull;

            if (data.options.load && !new RegExp(data.options.load).test(name)) return infer.ANull;

            if (!relative) {
                try {
                    var cmp = JSON.parse(fs.readFileSync(resolve(dir, "component.json")));
                    if (!cmp.dependencies) return infer.ANull;
                    var dpx = new RegExp("(.*?)\/" + name, 'i');
                    var dep = Object.keys(cmp.dependencies).filter(function(dependency) {
                        return dpx.test(dependency);
                    }).pop();
                    var author = dep.match(/(.*?)\/.*?/i).shift();
                    author = author.substring(0, author.length - 1);
                    file = resolve(dir, "components/" + author + "-" + name);
                }
                catch (e) {}
            }

            try {
                var pkg = JSON.parse(fs.readFileSync(resolve(dir, file + "/component.json")));
            }
            catch (e) {}

            if (pkg && pkg.main) {
                file += "/" + pkg.main;
            }
            else {
                try {
                    if (fs.statSync(resolve(dir, file)).isDirectory()) file += "/index.js";
                }
                catch (e) {}
            }

            if (!/\.js$/.test(file)) file += ".js";

            try {
                if (!fs.statSync(resolve(dir, file)).isFile()) return infer.ANull;
            }
            catch (e) {
                return infer.ANull;
            }

            server.addFile(file, null, data.currentName);
            return data.modules[file] = data.modules[name] = new infer.AVal;
        };
    })();

    tern.registerPlugin("component", function(server, options) {
        server._component = {
            modules: Object.create(null),
            options: options || {},
            currentFile: null,
            currentName: null,
            server: server
        };

        server.on("beforeLoad", function(file) {
            this._component.currentFile = file.name.replace(/\\/g, "/");
            this._component.currentName = file.name;
            file.scope = buildWrappingScope(file.scope, file.name, file.ast);
        });

        server.on("afterLoad", function(file) {
            this._component.currentFile = this._component.currentName = null;
            exportsFromScope(file.scope).propagate(getModule(this._component, file.name));
        });

        server.on("reset", function() {
            this._component.modules = Object.create(null);
        });

        return {
            defs: defs
        };
    });

    infer.registerFunction("componentRequire", function(_self, _args, argNodes) {
        if (!argNodes || !argNodes.length || argNodes[0].type != "Literal" || typeof argNodes[0].value != "string") return infer.ANull;

        var cx = infer.cx();
        var server = cx.parent;
        var data = server._component;
        var name = argNodes[0].value;

        var locals = cx.definitions.component;
        if (locals[name] && /^[a-z_]*$/.test(name)) return locals[name];

        var relative = /^\.{0,2}\//.test(name);
        if (relative) {
            if (!data.currentFile) return argNodes[0].required || infer.ANull;
            name = resolvePath(data.currentFile, name);
        }

        if (name in data.modules) return data.modules[name];

        var result;
        if (data.options.modules && data.options.modules.hasOwnProperty(name)) {
            var scope = buildWrappingScope(cx.topScope, name);
            infer.def.load(data.options.modules[name], scope);
            result = data.modules[name] = exportsFromScope(scope);
        }
        else {
            result = resolveModule(server, name, relative);
        }

        return argNodes[0].required = result;
    });

    var defs = {
        "!name": "component",
        "!define": {
            require: {
                "!type": "fn(id: string) -> !custom:componentRequire",
                "!doc": "Require the given path/module",
                modules: {
                    "!doc": "Registered modules"
                },
                aliases: {
                    "!doc": "Registered aliases"
                },
                resolve: {
                    "!type": "fn(path: string) -> string",
                    "!doc": "Resolve path"
                },
                normalize: {
                    "!type": "fn(curr: string, path: string) -> string",
                    "!doc": "Normalize `path` relative to the current path"
                },
                register: {
                    "!type": "fn(path: string, definition: fn())",
                    "!doc": "Register module at `path` with callback `definition`"
                },
                alias: {
                    "!type": "fn(from: string, to: string)",
                    "!doc": "Alias a module definition"
                },
                relative: {
                    "!type": "fn(parent: string) -> fn()",
                    "!doc": "Return a require function relative to the `parent` path"
                }
            },
            Module: {
                "!type": "fn()",
                prototype: {
                    exports: {
                        "!type": "?",
                        "!doc": "The exports object is created by the Module system. Sometimes this is not acceptable, many want their module to be an instance of some class. To do this assign the desired export object to module.exports. For example suppose we were making a module called a.js"
                    },
                    require: {
                        "!type": "require",
                        "!doc": "The module.require method provides a way to load a module as if require() was called from the original module."
                    },
                    id: {
                        "!type": "string",
                        "!doc": "The identifier for the module. Typically this is the fully resolved filename."
                    },
                    filename: {
                        "!type": "string",
                        "!doc": "The fully resolved filename to the module."
                    },
                    loaded: {
                        "!type": "bool",
                        "!doc": "Whether or not the module is done loading, or is in the process of loading."
                    },
                    parent: {
                        "!type": "+Module",
                        "!doc": "The module that required this one."
                    },
                    children: {
                        "!type": "[+Module]",
                        "!doc": "The module objects required by this one."
                    }
                }
            }
        }
    };
});

//#endregion


//#region tern/plugin/node.js

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"), require);
    if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern"], mod);
    mod(tern, tern);
})(function(infer, tern, require) {
    "use strict";

    function resolvePath(base, path) {
        if (path[0] == "/") return path;
        var slash = base.lastIndexOf("/"),
            m;
        if (slash >= 0) path = base.slice(0, slash + 1) + path;
        while (m = /[^\/]*[^\/\.][^\/]*\/\.\.\//.exec(path))
        path = path.slice(0, m.index) + path.slice(m.index + m[0].length);
        return path.replace(/(^|[^\.])\.\//g, "$1");
    }

    function relativePath(from, to) {
        if (from[from.length - 1] != "/") from += "/";
        if (to.indexOf(from) == 0) return to.slice(from.length);
        else return to;
    }

    function getModule(data, name) {
        return data.modules[name] || (data.modules[name] = new infer.AVal);
    }

    var WG_DEFAULT_EXPORT = 95;

    function buildWrappingScope(parent, origin, node) {
        var scope = new infer.Scope(parent);
        scope.originNode = node;
        infer.cx().definitions.node.require.propagate(scope.defProp("require"));
        var module = new infer.Obj(infer.cx().definitions.node.Module.getProp("prototype").getType());
        module.propagate(scope.defProp("module"));
        var exports = new infer.Obj(true, "exports");
        module.origin = exports.origin = origin;
        module.originNode = exports.originNode = scope.originNode;
        exports.propagate(scope.defProp("exports"));
        var moduleExports = scope.exports = module.defProp("exports");
        exports.propagate(moduleExports, WG_DEFAULT_EXPORT);
        return scope;
    }

    function resolveModule(server, name, _parent) {
        server.addFile(name, null, server._node.currentOrigin);
        return getModule(server._node, name);
    }

    // Assume node.js & access to local file system
    if (require)(function() {
        var fs = require("fs"),
            module_ = require("module"),
            path = require("path");

        relativePath = path.relative;

        resolveModule = function(server, name, parent) {
            var data = server._node;
            if (data.options.dontLoad == true || data.options.dontLoad && new RegExp(data.options.dontLoad).test(name) || data.options.load && !new RegExp(data.options.load).test(name)) return infer.ANull;

            if (data.modules[name]) return data.modules[name];

            var currentModule = {
                id: parent,
                paths: module_._nodeModulePaths(path.dirname(parent))
            };
            try {
                var file = module_._resolveFilename(name, currentModule);
            }
            catch (e) {
                return infer.ANull;
            }

            var norm = normPath(file);
            if (data.modules[norm]) return data.modules[norm];

            if (fs.existsSync(file) && /^(\.js)?$/.test(path.extname(file))) server.addFile(relativePath(server.options.projectDir, file), null, data.currentOrigin);
            return data.modules[norm] = new infer.AVal;
        };
    })();

    function normPath(name) {
        return name.replace(/\\/g, "/");
    }

    function resolveProjectPath(server, pth) {
        return resolvePath(normPath(server.options.projectDir || "") + "/", normPath(pth));
    }

    infer.registerFunction("nodeRequire", function(_self, _args, argNodes) {
        if (!argNodes || !argNodes.length || argNodes[0].type != "Literal" || typeof argNodes[0].value != "string") return infer.ANull;
        var cx = infer.cx(),
            server = cx.parent,
            data = server._node,
            name = argNodes[0].value;
        var locals = cx.definitions.node;
        var result;

        if (locals[name] && /^[a-z_]*$/.test(name)) {
            result = locals[name];
        }
        else if (name in data.modules) {
            result = data.modules[name];
        }
        else if (data.options.modules && data.options.modules.hasOwnProperty(name)) {
            var scope = buildWrappingScope(cx.topScope, name);
            infer.def.load(data.options.modules[name], scope);
            result = data.modules[name] = scope.exports;
        }
        else {
            // data.currentFile is only available while analyzing a file; at query
            // time, determine the calling file from the caller's AST.
            var currentFile = data.currentFile || resolveProjectPath(server, argNodes[0].sourceFile.name);

            var relative = /^\.{0,2}\//.test(name);
            if (relative) {
                if (!currentFile) return argNodes[0].required || infer.ANull;
                name = resolvePath(currentFile, name);
            }
            result = resolveModule(server, name, currentFile);
        }
        return argNodes[0].required = result;
    });

    function preCondenseReach(state) {
        var mods = infer.cx().parent._node.modules;
        var node = state.roots["!node"] = new infer.Obj(null);
        for (var name in mods) {
            var mod = mods[name];
            var id = mod.origin || name;
            var prop = node.defProp(id.replace(/\./g, "`"));
            mod.propagate(prop);
            prop.origin = mod.origin;
        }
    }

    function postLoadDef(data) {
        var cx = infer.cx(),
            mods = cx.definitions[data["!name"]]["!node"];
        var data = cx.parent._node;
        if (mods) for (var name in mods.props) {
            var origin = name.replace(/`/g, ".");
            var mod = getModule(data, origin);
            mod.origin = origin;
            mods.props[name].propagate(mod);
        }
    }

    function findTypeAt(_file, _pos, expr, type) {
        var isStringLiteral = expr.node.type === "Literal" && typeof expr.node.value === "string";
        var isRequireArg = !! expr.node.required;

        if (isStringLiteral && isRequireArg) {
            // The `type` is a value shared for all string literals.
            // We must create a copy before modifying `origin` and `originNode`.
            // Otherwise all string literals would point to the last jump location
            type = Object.create(type);

            // Provide a custom origin location pointing to the require()d file
            var exportedType;
            if (expr.node.required && (exportedType = expr.node.required.getType())) {
                type.origin = exportedType.origin;
                type.originNode = exportedType.originNode;
            }
        }

        return type;
    }

    tern.registerPlugin("node", function(server, options) {
        server._node = {
            modules: Object.create(null),
            options: options || {},
            currentFile: null,
            currentRequires: [],
            currentOrigin: null,
            server: server
        };

        server.on("beforeLoad", function(file) {
            this._node.currentFile = resolveProjectPath(server, file.name);
            this._node.currentOrigin = file.name;
            this._node.currentRequires = [];
            file.scope = buildWrappingScope(file.scope, this._node.currentOrigin, file.ast);
        });

        server.on("afterLoad", function(file) {
            var mod = getModule(this._node, this._node.currentFile);
            mod.origin = this._node.currentOrigin;
            file.scope.exports.propagate(mod);
            this._node.currentFile = null;
            this._node.currentOrigin = null;
        });

        server.on("reset", function() {
            this._node.modules = Object.create(null);
        });

        return {
            defs: defs,
            passes: {
                preCondenseReach: preCondenseReach,
                postLoadDef: postLoadDef,
                completion: findCompletions,
                typeAt: findTypeAt
            }
        };
    });

    // Completes CommonJS module names in strings passed to require
    function findCompletions(file, query) {
        var wordEnd = tern.resolvePos(file, query.end);
        var callExpr = infer.findExpressionAround(file.ast, null, wordEnd, file.scope, "CallExpression");
        if (!callExpr) return;
        var callNode = callExpr.node;
        if (callNode.callee.type != "Identifier" || callNode.callee.name != "require" || callNode.arguments.length < 1) return;
        var argNode = callNode.arguments[0];
        if (argNode.type != "Literal" || typeof argNode.value != "string" || argNode.start > wordEnd || argNode.end < wordEnd) return;

        var word = argNode.raw.slice(1, wordEnd - argNode.start),
            quote = argNode.raw.charAt(0);
        if (word && word.charAt(word.length - 1) == quote) word = word.slice(0, word.length - 1);
        var completions = completeModuleName(query, file, word);
        if (argNode.end == wordEnd + 1 && file.text.charAt(wordEnd) == quote)++wordEnd;
        return {
            start: tern.outputPos(query, file, argNode.start),
            end: tern.outputPos(query, file, wordEnd),
            isProperty: false,
            completions: completions.map(function(rec) {
                var name = typeof rec == "string" ? rec : rec.name;
                var string = JSON.stringify(name);
                if (quote == "'") string = quote + string.slice(1, string.length - 1).replace(/'/g, "\\'") + quote;
                if (typeof rec == "string") return string;
                rec.displayName = name;
                rec.name = string;
                return rec;
            })
        };
    }

    function completeModuleName(query, file, word) {
        var completions = [];
        var cx = infer.cx(),
            server = cx.parent,
            data = server._node;
        var currentFile = data.currentFile || resolveProjectPath(server, file.name);
        var wrapAsObjs = query.types || query.depths || query.docs || query.urls || query.origins;

        function gather(modules) {
            for (var name in modules) {
                if (name == currentFile) continue;

                var moduleName = resolveModulePath(name, currentFile);
                if (moduleName && !(query.filter !== false && word && (query.caseInsensitive ? moduleName.toLowerCase() : moduleName).indexOf(word) !== 0)) {
                    var rec = wrapAsObjs ? {
                        name: moduleName
                    } : moduleName;
                    completions.push(rec);

                    if (query.types || query.docs || query.urls || query.origins) {
                        var val = modules[name];
                        infer.resetGuessing();
                        var type = val.getType();
                        rec.guess = infer.didGuess();
                        if (query.types) rec.type = infer.toString(val);
                        if (query.docs) maybeSet(rec, "doc", val.doc || type && type.doc);
                        if (query.urls) maybeSet(rec, "url", val.url || type && type.url);
                        if (query.origins) maybeSet(rec, "origin", val.origin || type && type.origin);
                    }
                }
            }
        }

        if (query.caseInsensitive) word = word.toLowerCase();
        gather(cx.definitions.node);
        gather(data.modules);
        return completions;
    }

    /**
     * Resolve the module path of the given module name by using the current file.
     */
    function resolveModulePath(name, currentFile) {

        function startsWith(str, prefix) {
            return str.slice(0, prefix.length) == prefix;
        }

        function endsWith(str, suffix) {
            return str.slice(-suffix.length) == suffix;
        }

        if (name.indexOf('/') == -1) return name;
        // module name has '/', compute the module path
        var modulePath = normPath(relativePath(currentFile + '/..', name));
        if (startsWith(modulePath, 'node_modules')) {
            // module name starts with node_modules, remove it
            modulePath = modulePath.substring('node_modules'.length + 1, modulePath.length);
            if (endsWith(modulePath, 'index.js')) {
                // module name ends with index.js, remove it.
                modulePath = modulePath.substring(0, modulePath.length - 'index.js'.length - 1);
            }
        }
        else if (!startsWith(modulePath, '../')) {
            // module name is not inside node_modules and there is not ../, add ./
            modulePath = './' + modulePath;
        }
        if (endsWith(modulePath, '.js')) {
            // remove js extension
            modulePath = modulePath.substring(0, modulePath.length - '.js'.length);
        }
        return modulePath;
    }

    function maybeSet(obj, prop, val) {
        if (val != null) obj[prop] = val;
    }

    tern.defineQueryType("node_exports", {
        takesFile: true,
        run: function(server, query, file) {
            function describe(aval) {
                var target = {}, type = aval.getType(false);
                target.type = infer.toString(aval, 3);
                var doc = aval.doc || (type && type.doc),
                    url = aval.url || (type && type.url);
                if (doc) target.doc = doc;
                if (url) target.url = url;
                var span = tern.getSpan(aval) || (type && tern.getSpan(type));
                if (span) tern.storeSpan(server, query, span, target);
                return target;
            }

            var known = server._node.modules[resolveProjectPath(server, file.name)];
            if (!known) return {};
            var type = known.getObjType(false);
            var resp = describe(known);
            if (type instanceof infer.Obj) {
                var props = resp.props = {};
                for (var prop in type.props)
                props[prop] = describe(type.props[prop]);
            }
            return resp;
        }
    });

    var defs = {
        "!name": "node",
        "!define": {
            require: {
                "!type": "fn(id: string) -> !custom:nodeRequire",
                resolve: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/globals.html#globals_require_resolve",
                    "!doc": "Use the internal require() machinery to look up the location of a module, but rather than loading the module, just return the resolved filename."
                },
                cache: {
                    "!url": "http://nodejs.org/api/globals.html#globals_require_cache",
                    "!doc": "Modules are cached in this object when they are required. By deleting a key value from this object, the next require will reload the module."
                },
                extensions: {
                    "!url": "http://nodejs.org/api/globals.html#globals_require_extensions",
                    "!doc": "Instruct require on how to handle certain file extensions."
                },
                "!url": "http://nodejs.org/api/globals.html#globals_require",
                "!doc": "To require modules."
            },
            Module: {
                "!type": "fn()",
                prototype: {
                    exports: {
                        "!type": "?",
                        "!url": "http://nodejs.org/api/modules.html#modules_module_exports",
                        "!doc": "The exports object is created by the Module system. Sometimes this is not acceptable, many want their module to be an instance of some class. To do this assign the desired export object to module.exports. For example suppose we were making a module called a.js"
                    },
                    require: {
                        "!type": "require",
                        "!url": "http://nodejs.org/api/modules.html#modules_module_require_id",
                        "!doc": "The module.require method provides a way to load a module as if require() was called from the original module."
                    },
                    id: {
                        "!type": "string",
                        "!url": "http://nodejs.org/api/modules.html#modules_module_id",
                        "!doc": "The identifier for the module. Typically this is the fully resolved filename."
                    },
                    filename: {
                        "!type": "string",
                        "!url": "http://nodejs.org/api/modules.html#modules_module_filename",
                        "!doc": "The fully resolved filename to the module."
                    },
                    loaded: {
                        "!type": "bool",
                        "!url": "http://nodejs.org/api/modules.html#modules_module_loaded",
                        "!doc": "Whether or not the module is done loading, or is in the process of loading."
                    },
                    parent: {
                        "!type": "+Module",
                        "!url": "http://nodejs.org/api/modules.html#modules_module_parent",
                        "!doc": "The module that required this one."
                    },
                    children: {
                        "!type": "[+Module]",
                        "!url": "http://nodejs.org/api/modules.html#modules_module_children",
                        "!doc": "The module objects required by this one."
                    }
                }
            },
            events: {
                EventEmitter: {
                    prototype: {
                        addListener: {
                            "!type": "fn(event: string, listener: fn())",
                            "!url": "http://nodejs.org/api/events.html#events_emitter_addlistener_event_listener",
                            "!doc": "Adds a listener to the end of the listeners array for the specified event."
                        },
                        on: {
                            "!type": "fn(event: string, listener: fn())",
                            "!url": "http://nodejs.org/api/events.html#events_emitter_on_event_listener",
                            "!doc": "Adds a listener to the end of the listeners array for the specified event."
                        },
                        once: {
                            "!type": "fn(event: string, listener: fn())",
                            "!url": "http://nodejs.org/api/events.html#events_emitter_once_event_listener",
                            "!doc": "Adds a one time listener for the event. This listener is invoked only the next time the event is fired, after which it is removed."
                        },
                        removeListener: {
                            "!type": "fn(event: string, listener: fn())",
                            "!url": "http://nodejs.org/api/events.html#events_emitter_removelistener_event_listener",
                            "!doc": "Remove a listener from the listener array for the specified event. Caution: changes array indices in the listener array behind the listener."
                        },
                        removeAllListeners: {
                            "!type": "fn(event: string)",
                            "!url": "http://nodejs.org/api/events.html#events_emitter_removealllisteners_event",
                            "!doc": "Removes all listeners, or those of the specified event."
                        },
                        setMaxListeners: {
                            "!type": "fn(n: number)",
                            "!url": "http://nodejs.org/api/events.html#events_emitter_setmaxlisteners_n",
                            "!doc": "By default EventEmitters will print a warning if more than 10 listeners are added for a particular event. This is a useful default which helps finding memory leaks. Obviously not all Emitters should be limited to 10. This function allows that to be increased. Set to zero for unlimited."
                        },
                        listeners: {
                            "!type": "fn(event: string) -> [fn()]",
                            "!url": "http://nodejs.org/api/events.html#events_emitter_listeners_event",
                            "!doc": "Returns an array of listeners for the specified event."
                        },
                        emit: {
                            "!type": "fn(event: string)",
                            "!url": "http://nodejs.org/api/events.html#events_emitter_emit_event_arg1_arg2",
                            "!doc": "Execute each of the listeners in order with the supplied arguments."
                        }
                    },
                    "!url": "http://nodejs.org/api/events.html#events_class_events_eventemitter",
                    "!doc": "To access the EventEmitter class, require('events').EventEmitter."
                }
            },
            stream: {
                "!type": "fn()",
                prototype: {
                    "!proto": "events.EventEmitter.prototype",
                    pipe: {
                        "!type": "fn(destination: +stream.Writable, options?: ?)",
                        "!url": "http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options",
                        "!doc": "Connects this readable stream to destination WriteStream. Incoming data on this stream gets written to destination. Properly manages back-pressure so that a slow destination will not be overwhelmed by a fast readable stream."
                    }
                },
                Writable: {
                    "!type": "fn(options?: ?)",
                    prototype: {
                        "!proto": "stream.prototype",
                        write: {
                            "!type": "fn(chunk: +Buffer, encoding?: string, callback?: fn()) -> bool",
                            "!url": "http://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback_1",
                            "!doc": "Writes chunk to the stream. Returns true if the data has been flushed to the underlying resource. Returns false to indicate that the buffer is full, and the data will be sent out in the future. The 'drain' event will indicate when the buffer is empty again."
                        },
                        end: {
                            "!type": "fn(chunk: +Buffer, encoding?: string, callback?: fn()) -> bool",
                            "!url": "http://nodejs.org/api/stream.html#stream_writable_end_chunk_encoding_callback",
                            "!doc": "Call this method to signal the end of the data being written to the stream."
                        }
                    },
                    "!url": "http://nodejs.org/api/stream.html#stream_class_stream_writable",
                    "!doc": "A Writable Stream has the following methods, members, and events."
                },
                Readable: {
                    "!type": "fn(options?: ?)",
                    prototype: {
                        "!proto": "stream.prototype",
                        setEncoding: {
                            "!type": "fn(encoding: string)",
                            "!url": "http://nodejs.org/api/stream.html#stream_readable_setencoding_encoding",
                            "!doc": "Makes the 'data' event emit a string instead of a Buffer. encoding can be 'utf8', 'utf16le' ('ucs2'), 'ascii', or 'hex'."
                        },
                        pause: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/stream.html#stream_readable_pause",
                            "!doc": "Switches the readable stream into \"old mode\", where data is emitted using a 'data' event rather than being buffered for consumption via the read() method."
                        },
                        resume: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/stream.html#stream_readable_resume",
                            "!doc": "Switches the readable stream into \"old mode\", where data is emitted using a 'data' event rather than being buffered for consumption via the read() method."
                        },
                        destroy: "fn()",
                        unpipe: {
                            "!type": "fn(dest?: +stream.Writable)",
                            "!url": "http://nodejs.org/api/stream.html#stream_readable_unpipe_destination",
                            "!doc": "Undo a previously established pipe(). If no destination is provided, then all previously established pipes are removed."
                        },
                        push: {
                            "!type": "fn(chunk: +Buffer) -> bool",
                            "!url": "http://nodejs.org/api/stream.html#stream_readable_push_chunk",
                            "!doc": "Explicitly insert some data into the read queue. If called with null, will signal the end of the data."
                        },
                        unshift: {
                            "!type": "fn(chunk: +Buffer) -> bool",
                            "!url": "http://nodejs.org/api/stream.html#stream_readable_unshift_chunk",
                            "!doc": "This is the corollary of readable.push(chunk). Rather than putting the data at the end of the read queue, it puts it at the front of the read queue."
                        },
                        wrap: {
                            "!type": "fn(stream: ?) -> +stream.Readable",
                            "!url": "http://nodejs.org/api/stream.html#stream_readable_wrap_stream",
                            "!doc": "If you are using an older Node library that emits 'data' events and has a pause() method that is advisory only, then you can use the wrap() method to create a Readable stream that uses the old stream as its data source."
                        },
                        read: {
                            "!type": "fn(size?: number) -> +Buffer",
                            "!url": "http://nodejs.org/api/stream.html#stream_readable_read_size_1",
                            "!doc": "Call this method to consume data once the 'readable' event is emitted."
                        }
                    },
                    "!url": "http://nodejs.org/api/stream.html#stream_class_stream_readable",
                    "!doc": "A Readable Stream has the following methods, members, and events."
                },
                Duplex: {
                    "!type": "fn(options?: ?)",
                    prototype: {
                        "!proto": "stream.Readable.prototype",
                        write: "fn(chunk: +Buffer, encoding?: string, callback?: fn()) -> bool",
                        end: "fn(chunk: +Buffer, encoding?: string, callback?: fn()) -> bool"
                    },
                    "!url": "http://nodejs.org/api/stream.html#stream_class_stream_duplex",
                    "!doc": "A \"duplex\" stream is one that is both Readable and Writable, such as a TCP socket connection."
                },
                Transform: {
                    "!type": "fn(options?: ?)",
                    prototype: {
                        "!proto": "stream.Duplex.prototype"
                    },
                    "!url": "http://nodejs.org/api/stream.html#stream_class_stream_transform",
                    "!doc": "A \"transform\" stream is a duplex stream where the output is causally connected in some way to the input, such as a zlib stream or a crypto stream."
                },
                PassThrough: "stream.Transform",
                "!url": "http://nodejs.org/api/stream.html#stream_stream",
                "!doc": "A stream is an abstract interface implemented by various objects in Node. For example a request to an HTTP server is a stream, as is stdout. Streams are readable, writable, or both. All streams are instances of EventEmitter"
            },
            querystring: {
                stringify: {
                    "!type": "fn(obj: ?, sep?: string, eq?: string) -> string",
                    "!url": "http://nodejs.org/api/querystring.html#querystring_querystring_stringify_obj_sep_eq",
                    "!doc": "Serialize an object to a query string. Optionally override the default separator ('&') and assignment ('=') characters."
                },
                parse: {
                    "!type": "fn(str: string, sep?: string, eq?: string, options?: ?) -> ?",
                    "!url": "http://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options",
                    "!doc": "Deserialize a query string to an object. Optionally override the default separator ('&') and assignment ('=') characters."
                },
                escape: {
                    "!type": "fn(string) -> string",
                    "!url": "http://nodejs.org/api/querystring.html#querystring_querystring_escape",
                    "!doc": "The escape function used by querystring.stringify, provided so that it could be overridden if necessary."
                },
                unescape: {
                    "!type": "fn(string) -> string",
                    "!url": "http://nodejs.org/api/querystring.html#querystring_querystring_unescape",
                    "!doc": "The unescape function used by querystring.parse, provided so that it could be overridden if necessary."
                }
            },
            http: {
                STATUS_CODES: {},
                createServer: {
                    "!type": "fn(listener?: fn(request: +http.IncomingMessage, response: +http.ServerResponse)) -> +http.Server",
                    "!url": "http://nodejs.org/api/http.html#http_http_createserver_requestlistener",
                    "!doc": "Returns a new web server object."
                },
                Server: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "events.EventEmitter.prototype",
                        listen: {
                            "!type": "fn(port: number, hostname?: string, backlog?: number, callback?: fn())",
                            "!url": "http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback",
                            "!doc": "Begin accepting connections on the specified port and hostname. If the hostname is omitted, the server will accept connections directed to any IPv4 address (INADDR_ANY)."
                        },
                        close: {
                            "!type": "fn(callback?: ?)",
                            "!url": "http://nodejs.org/api/http.html#http_server_close_callback",
                            "!doc": "Stops the server from accepting new connections."
                        },
                        maxHeadersCount: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/http.html#http_server_maxheaderscount",
                            "!doc": "Limits maximum incoming headers count, equal to 1000 by default. If set to 0 - no limit will be applied."
                        },
                        setTimeout: {
                            "!type": "fn(timeout: number, callback?: fn())",
                            "!url": "http://nodejs.org/api/http.html#http_server_settimeout_msecs_callback",
                            "!doc": "Sets the timeout value for sockets, and emits a 'timeout' event on the Server object, passing the socket as an argument, if a timeout occurs."
                        },
                        timeout: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/http.html#http_server_timeout",
                            "!doc": "The number of milliseconds of inactivity before a socket is presumed to have timed out."
                        }
                    },
                    "!url": "http://nodejs.org/api/http.html#http_class_http_server",
                    "!doc": "Class for HTTP server objects."
                },
                ServerResponse: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Writable.prototype",
                        writeContinue: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/http.html#http_response_writecontinue",
                            "!doc": "Sends a HTTP/1.1 100 Continue message to the client, indicating that the request body should be sent."
                        },
                        writeHead: {
                            "!type": "fn(statusCode: number, headers?: ?)",
                            "!url": "http://nodejs.org/api/http.html#http_response_writehead_statuscode_reasonphrase_headers",
                            "!doc": "Sends a response header to the request. The status code is a 3-digit HTTP status code, like 404. The last argument, headers, are the response headers. Optionally one can give a human-readable reasonPhrase as the second argument."
                        },
                        setTimeout: {
                            "!type": "fn(timeout: number, callback?: fn())",
                            "!url": "http://nodejs.org/api/http.html#http_response_settimeout_msecs_callback",
                            "!doc": "Sets the Socket's timeout value to msecs. If a callback is provided, then it is added as a listener on the 'timeout' event on the response object."
                        },
                        statusCode: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/http.html#http_response_statuscode",
                            "!doc": "When using implicit headers (not calling response.writeHead() explicitly), this property controls the status code that will be sent to the client when the headers get flushed."
                        },
                        setHeader: {
                            "!type": "fn(name: string, value: string)",
                            "!url": "http://nodejs.org/api/http.html#http_response_setheader_name_value",
                            "!doc": "Sets a single header value for implicit headers. If this header already exists in the to-be-sent headers, its value will be replaced. Use an array of strings here if you need to send multiple headers with the same name."
                        },
                        headersSent: {
                            "!type": "bool",
                            "!url": "http://nodejs.org/api/http.html#http_response_headerssent",
                            "!doc": "Boolean (read-only). True if headers were sent, false otherwise."
                        },
                        sendDate: {
                            "!type": "bool",
                            "!url": "http://nodejs.org/api/http.html#http_response_senddate",
                            "!doc": "When true, the Date header will be automatically generated and sent in the response if it is not already present in the headers. Defaults to true."
                        },
                        getHeader: {
                            "!type": "fn(name: string) -> string",
                            "!url": "http://nodejs.org/api/http.html#http_response_getheader_name",
                            "!doc": "Reads out a header that's already been queued but not sent to the client. Note that the name is case insensitive. This can only be called before headers get implicitly flushed."
                        },
                        removeHeader: {
                            "!type": "fn(name: string)",
                            "!url": "http://nodejs.org/api/http.html#http_response_removeheader_name",
                            "!doc": "Removes a header that's queued for implicit sending."
                        },
                        addTrailers: {
                            "!type": "fn(headers: ?)",
                            "!url": "http://nodejs.org/api/http.html#http_response_addtrailers_headers",
                            "!doc": "This method adds HTTP trailing headers (a header but at the end of the message) to the response."
                        }
                    },
                    "!url": "http://nodejs.org/api/http.html#http_class_http_serverresponse",
                    "!doc": "This object is created internally by a HTTP server--not by the user. It is passed as the second parameter to the 'request' event."
                },
                request: {
                    "!type": "fn(options: ?, callback?: fn(res: +http.IncomingMessage)) -> +http.ClientRequest",
                    "!url": "http://nodejs.org/api/http.html#http_http_request_options_callback",
                    "!doc": "Node maintains several connections per server to make HTTP requests. This function allows one to transparently issue requests."
                },
                get: {
                    "!type": "fn(options: ?, callback?: fn(res: +http.IncomingMessage)) -> +http.ClientRequest",
                    "!url": "http://nodejs.org/api/http.html#http_http_get_options_callback",
                    "!doc": "Since most requests are GET requests without bodies, Node provides this convenience method. The only difference between this method and http.request() is that it sets the method to GET and calls req.end() automatically."
                },
                globalAgent: {
                    "!type": "+http.Agent",
                    "!url": "http://nodejs.org/api/http.html#http_http_globalagent",
                    "!doc": "Global instance of Agent which is used as the default for all http client requests."
                },
                Agent: {
                    "!type": "fn()",
                    prototype: {
                        maxSockets: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/http.html#http_agent_maxsockets",
                            "!doc": "By default set to 5. Determines how many concurrent sockets the agent can have open per host."
                        },
                        sockets: {
                            "!type": "[+net.Socket]",
                            "!url": "http://nodejs.org/api/http.html#http_agent_sockets",
                            "!doc": "An object which contains arrays of sockets currently in use by the Agent. Do not modify."
                        },
                        requests: {
                            "!type": "[+http.ClientRequest]",
                            "!url": "http://nodejs.org/api/http.html#http_agent_requests",
                            "!doc": "An object which contains queues of requests that have not yet been assigned to sockets. Do not modify."
                        }
                    },
                    "!url": "http://nodejs.org/api/http.html#http_class_http_agent",
                    "!doc": "In node 0.5.3+ there is a new implementation of the HTTP Agent which is used for pooling sockets used in HTTP client requests."
                },
                ClientRequest: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Writable.prototype",
                        abort: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/http.html#http_request_abort",
                            "!doc": "Aborts a request. (New since v0.3.8.)"
                        },
                        setTimeout: {
                            "!type": "fn(timeout: number, callback?: fn())",
                            "!url": "http://nodejs.org/api/http.html#http_request_settimeout_timeout_callback",
                            "!doc": "Once a socket is assigned to this request and is connected socket.setTimeout() will be called."
                        },
                        setNoDelay: {
                            "!type": "fn(noDelay?: fn())",
                            "!url": "http://nodejs.org/api/http.html#http_request_setnodelay_nodelay",
                            "!doc": "Once a socket is assigned to this request and is connected socket.setNoDelay() will be called."
                        },
                        setSocketKeepAlive: {
                            "!type": "fn(enable?: bool, initialDelay?: number)",
                            "!url": "http://nodejs.org/api/http.html#http_request_setsocketkeepalive_enable_initialdelay",
                            "!doc": "Once a socket is assigned to this request and is connected socket.setKeepAlive() will be called."
                        }
                    },
                    "!url": "http://nodejs.org/api/http.html#http_class_http_clientrequest",
                    "!doc": "This object is created internally and returned from http.request(). It represents an in-progress request whose header has already been queued. The header is still mutable using the setHeader(name, value), getHeader(name), removeHeader(name) API. The actual header will be sent along with the first data chunk or when closing the connection."
                },
                IncomingMessage: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Readable.prototype",
                        httpVersion: {
                            "!type": "string",
                            "!url": "http://nodejs.org/api/http.html#http_message_httpversion",
                            "!doc": "In case of server request, the HTTP version sent by the client. In the case of client response, the HTTP version of the connected-to server. Probably either '1.1' or '1.0'."
                        },
                        headers: {
                            "!type": "?",
                            "!url": "http://nodejs.org/api/http.html#http_message_headers",
                            "!doc": "The request/response headers object."
                        },
                        trailers: {
                            "!type": "?",
                            "!url": "http://nodejs.org/api/http.html#http_message_trailers",
                            "!doc": "The request/response trailers object. Only populated after the 'end' event."
                        },
                        setTimeout: {
                            "!type": "fn(timeout: number, callback?: fn())",
                            "!url": "http://nodejs.org/api/http.html#http_message_settimeout_msecs_callback",
                            "!doc": "Calls message.connection.setTimeout(msecs, callback)."
                        },
                        setEncoding: {
                            "!type": "fn(encoding?: string)",
                            "!url": "http://nodejs.org/api/http.html#http_message_setencoding_encoding",
                            "!doc": "Set the encoding for data emitted by the 'data' event."
                        },
                        pause: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/http.html#http_message_pause",
                            "!doc": "Pauses request/response from emitting events. Useful to throttle back a download."
                        },
                        resume: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/http.html#http_message_resume",
                            "!doc": "Resumes a paused request/response."
                        },
                        method: {
                            "!type": "string",
                            "!url": "http://nodejs.org/api/http.html#http_message_method",
                            "!doc": "Only valid for request obtained from http.Server."
                        },
                        url: {
                            "!type": "string",
                            "!url": "http://nodejs.org/api/http.html#http_message_url",
                            "!doc": "Only valid for request obtained from http.Server."
                        },
                        statusCode: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/http.html#http_message_statuscode",
                            "!doc": "Only valid for response obtained from http.ClientRequest."
                        },
                        socket: {
                            "!type": "+net.Socket",
                            "!url": "http://nodejs.org/api/http.html#http_message_socket",
                            "!doc": "The net.Socket object associated with the connection."
                        }
                    },
                    "!url": "http://nodejs.org/api/http.html#http_http_incomingmessage",
                    "!doc": "An IncomingMessage object is created by http.Server or http.ClientRequest and passed as the first argument to the 'request' and 'response' event respectively. It may be used to access response status, headers and data."
                }
            },
            https: {
                Server: "http.Server",
                createServer: {
                    "!type": "fn(listener?: fn(request: +http.IncomingMessage, response: +http.ServerResponse)) -> +https.Server",
                    "!url": "http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener",
                    "!doc": "Returns a new HTTPS web server object. The options is similar to tls.createServer(). The requestListener is a function which is automatically added to the 'request' event."
                },
                request: {
                    "!type": "fn(options: ?, callback?: fn(res: +http.IncomingMessage)) -> +http.ClientRequest",
                    "!url": "http://nodejs.org/api/https.html#https_https_request_options_callback",
                    "!doc": "Makes a request to a secure web server."
                },
                get: {
                    "!type": "fn(options: ?, callback?: fn(res: +http.IncomingMessage)) -> +http.ClientRequest",
                    "!url": "http://nodejs.org/api/https.html#https_https_get_options_callback",
                    "!doc": "Like http.get() but for HTTPS."
                },
                Agent: "http.Agent",
                globalAgent: "http.globalAgent"
            },
            cluster: {
                "!proto": "events.EventEmitter.prototype",
                settings: {
                    exec: "string",
                    args: "[string]",
                    silent: "bool",
                    "!url": "http://nodejs.org/api/cluster.html#cluster_cluster_settings",
                    "!doc": "All settings set by the .setupMaster is stored in this settings object. This object is not supposed to be changed or set manually, by you."
                },
                Worker: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "events.EventEmitter.prototype",
                        id: {
                            "!type": "string",
                            "!url": "http://nodejs.org/api/cluster.html#cluster_worker_id",
                            "!doc": "Each new worker is given its own unique id, this id is stored in the id."
                        },
                        process: {
                            "!type": "+child_process.ChildProcess",
                            "!url": "http://nodejs.org/api/cluster.html#cluster_worker_process",
                            "!doc": "All workers are created using child_process.fork(), the returned object from this function is stored in process."
                        },
                        suicide: {
                            "!type": "bool",
                            "!url": "http://nodejs.org/api/cluster.html#cluster_worker_suicide",
                            "!doc": "This property is a boolean. It is set when a worker dies after calling .kill() or immediately after calling the .disconnect() method. Until then it is undefined."
                        },
                        send: {
                            "!type": "fn(message: ?, sendHandle?: ?)",
                            "!url": "http://nodejs.org/api/cluster.html#cluster_worker_send_message_sendhandle",
                            "!doc": "This function is equal to the send methods provided by child_process.fork(). In the master you should use this function to send a message to a specific worker. However in a worker you can also use process.send(message), since this is the same function."
                        },
                        destroy: "fn()",
                        disconnect: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/cluster.html#cluster_worker_disconnect",
                            "!doc": "When calling this function the worker will no longer accept new connections, but they will be handled by any other listening worker. Existing connection will be allowed to exit as usual. When no more connections exist, the IPC channel to the worker will close allowing it to die graceful. When the IPC channel is closed the disconnect event will emit, this is then followed by the exit event, there is emitted when the worker finally die."
                        },
                        kill: {
                            "!type": "fn(signal?: string)",
                            "!url": "http://nodejs.org/api/cluster.html#cluster_worker_kill_signal_sigterm",
                            "!doc": "This function will kill the worker, and inform the master to not spawn a new worker. The boolean suicide lets you distinguish between voluntary and accidental exit."
                        }
                    },
                    "!url": "http://nodejs.org/api/cluster.html#cluster_class_worker",
                    "!doc": "A Worker object contains all public information and method about a worker. In the master it can be obtained using cluster.workers. In a worker it can be obtained using cluster.worker."
                },
                isMaster: {
                    "!type": "bool",
                    "!url": "http://nodejs.org/api/cluster.html#cluster_cluster_ismaster",
                    "!doc": "True if the process is a master. This is determined by the process.env.NODE_UNIQUE_ID. If process.env.NODE_UNIQUE_ID is undefined, then isMaster is true."
                },
                isWorker: {
                    "!type": "bool",
                    "!url": "http://nodejs.org/api/cluster.html#cluster_cluster_isworker",
                    "!doc": "This boolean flag is true if the process is a worker forked from a master. If the process.env.NODE_UNIQUE_ID is set to a value, then isWorker is true."
                },
                setupMaster: {
                    "!type": "fn(settings?: cluster.settings)",
                    "!url": "http://nodejs.org/api/cluster.html#cluster_cluster_setupmaster_settings",
                    "!doc": "setupMaster is used to change the default 'fork' behavior. The new settings are effective immediately and permanently, they cannot be changed later on."
                },
                fork: {
                    "!type": "fn(env?: ?) -> +cluster.Worker",
                    "!url": "http://nodejs.org/api/cluster.html#cluster_cluster_fork_env",
                    "!doc": "Spawn a new worker process. This can only be called from the master process."
                },
                disconnect: {
                    "!type": "fn(callback?: fn())",
                    "!url": "http://nodejs.org/api/cluster.html#cluster_cluster_disconnect_callback",
                    "!doc": "When calling this method, all workers will commit a graceful suicide. When they are disconnected all internal handlers will be closed, allowing the master process to die graceful if no other event is waiting."
                },
                worker: {
                    "!type": "+cluster.Worker",
                    "!url": "http://nodejs.org/api/cluster.html#cluster_cluster_worker",
                    "!doc": "A reference to the current worker object. Not available in the master process."
                },
                workers: {
                    "!type": "[+cluster.Worker]",
                    "!url": "http://nodejs.org/api/cluster.html#cluster_cluster_workers",
                    "!doc": "A hash that stores the active worker objects, keyed by id field. Makes it easy to loop through all the workers. It is only available in the master process."
                },
                "!url": "http://nodejs.org/api/cluster.html#cluster_cluster",
                "!doc": "A single instance of Node runs in a single thread. To take advantage of multi-core systems the user will sometimes want to launch a cluster of Node processes to handle the load."
            },
            zlib: {
                Zlib: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Duplex.prototype",
                        flush: {
                            "!type": "fn(callback: fn())",
                            "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_flush_callback",
                            "!doc": "Flush pending data. Don't call this frivolously, premature flushes negatively impact the effectiveness of the compression algorithm."
                        },
                        reset: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_reset",
                            "!doc": "Reset the compressor/decompressor to factory defaults. Only applicable to the inflate and deflate algorithms."
                        }
                    },
                    "!url": "http://nodejs.org/api/zlib.html#zlib_class_zlib_zlib",
                    "!doc": "Not exported by the zlib module. It is documented here because it is the base class of the compressor/decompressor classes."
                },
                deflate: {
                    "!type": "fn(buf: +Buffer, callback: fn())",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_deflate_buf_callback",
                    "!doc": "Compress a string with Deflate."
                },
                deflateRaw: {
                    "!type": "fn(buf: +Buffer, callback: fn())",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_deflateraw_buf_callback",
                    "!doc": "Compress a string with DeflateRaw."
                },
                gzip: {
                    "!type": "fn(buf: +Buffer, callback: fn())",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_gzip_buf_callback",
                    "!doc": "Compress a string with Gzip."
                },
                gunzip: {
                    "!type": "fn(buf: +Buffer, callback: fn())",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_gunzip_buf_callback",
                    "!doc": "Decompress a raw Buffer with Gunzip."
                },
                inflate: {
                    "!type": "fn(buf: +Buffer, callback: fn())",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_inflate_buf_callback",
                    "!doc": "Decompress a raw Buffer with Inflate."
                },
                inflateRaw: {
                    "!type": "fn(buf: +Buffer, callback: fn())",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_inflateraw_buf_callback",
                    "!doc": "Decompress a raw Buffer with InflateRaw."
                },
                unzip: {
                    "!type": "fn(buf: +Buffer, callback: fn())",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_unzip_buf_callback",
                    "!doc": "Decompress a raw Buffer with Unzip."
                },
                Gzip: {
                    "!type": "fn()",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_class_zlib_gzip",
                    "!doc": "Compress data using gzip.",
                    prototype: {
                        "!proto:": "zlib.Zlib.prototype"
                    }
                },
                createGzip: {
                    "!type": "fn(options: ?) -> +zlib.Zlib",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_creategzip_options",
                    "!doc": "Returns a new Gzip object with an options."
                },
                Gunzip: {
                    "!type": "fn()",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_class_zlib_gunzip",
                    "!doc": "Decompress a gzip stream.",
                    prototype: {
                        "!proto:": "zlib.Zlib.prototype"
                    }
                },
                createGunzip: {
                    "!type": "fn(options: ?) -> +zlib.Gunzip",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_creategunzip_options",
                    "!doc": "Returns a new Gunzip object with an options."
                },
                Deflate: {
                    "!type": "fn()",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_class_zlib_deflate",
                    "!doc": "Compress data using deflate.",
                    prototype: {
                        "!proto:": "zlib.Zlib.prototype"
                    }
                },
                createDeflate: {
                    "!type": "fn(options: ?) -> +zlib.Deflate",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_createdeflate_options",
                    "!doc": "Returns a new Deflate object with an options."
                },
                Inflate: {
                    "!type": "fn()",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_class_zlib_inflate",
                    "!doc": "Decompress a deflate stream.",
                    prototype: {
                        "!proto:": "zlib.Zlib.prototype"
                    }
                },
                createInflate: {
                    "!type": "fn(options: ?) -> +zlib.Inflate",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_createinflate_options",
                    "!doc": "Returns a new Inflate object with an options."
                },
                InflateRaw: {
                    "!type": "fn()",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_class_zlib_inflateraw",
                    "!doc": "Decompress a raw deflate stream.",
                    prototype: {
                        "!proto:": "zlib.Zlib.prototype"
                    }
                },
                createInflateRaw: {
                    "!type": "fn(options: ?) -> +zlib.InflateRaw",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_createinflateraw_options",
                    "!doc": "Returns a new InflateRaw object with an options."
                },
                DeflateRaw: {
                    "!type": "fn()",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_class_zlib_deflateraw",
                    "!doc": "Compress data using deflate, and do not append a zlib header.",
                    prototype: {
                        "!proto:": "zlib.Zlib.prototype"
                    }
                },
                createDeflateRaw: {
                    "!type": "fn(options: ?) -> +zlib.DeflateRaw",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_createdeflateraw_options",
                    "!doc": "Returns a new DeflateRaw object with an options."
                },
                Unzip: {
                    "!type": "fn()",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_class_zlib_unzip",
                    "!doc": "Decompress either a Gzip- or Deflate-compressed stream by auto-detecting the header.",
                    prototype: {
                        "!proto:": "zlib.Zlib.prototype"
                    }
                },
                createUnzip: {
                    "!type": "fn(options: ?) -> +zlib.Unzip",
                    "!url": "http://nodejs.org/api/zlib.html#zlib_zlib_createunzip_options",
                    "!doc": "Returns a new Unzip object with an options."
                },
                Z_NO_FLUSH: "number",
                Z_PARTIAL_FLUSH: "number",
                Z_SYNC_FLUSH: "number",
                Z_FULL_FLUSH: "number",
                Z_FINISH: "number",
                Z_BLOCK: "number",
                Z_TREES: "number",
                Z_OK: "number",
                Z_STREAM_END: "number",
                Z_NEED_DICT: "number",
                Z_ERRNO: "number",
                Z_STREAM_ERROR: "number",
                Z_DATA_ERROR: "number",
                Z_MEM_ERROR: "number",
                Z_BUF_ERROR: "number",
                Z_VERSION_ERROR: "number",
                Z_NO_COMPRESSION: "number",
                Z_BEST_SPEED: "number",
                Z_BEST_COMPRESSION: "number",
                Z_DEFAULT_COMPRESSION: "number",
                Z_FILTERED: "number",
                Z_HUFFMAN_ONLY: "number",
                Z_RLE: "number",
                Z_FIXED: "number",
                Z_DEFAULT_STRATEGY: "number",
                Z_BINARY: "number",
                Z_TEXT: "number",
                Z_ASCII: "number",
                Z_UNKNOWN: "number",
                Z_DEFLATED: "number",
                Z_NULL: "number"
            },
            os: {
                tmpdir: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/os.html#os_os_tmpdir",
                    "!doc": "Returns the operating system's default directory for temp files."
                },
                endianness: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/os.html#os_os_endianness",
                    "!doc": "Returns the endianness of the CPU. Possible values are \"BE\" or \"LE\"."
                },
                hostname: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/os.html#os_os_hostname",
                    "!doc": "Returns the hostname of the operating system."
                },
                type: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/os.html#os_os_type",
                    "!doc": "Returns the operating system name."
                },
                platform: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/os.html#os_os_platform",
                    "!doc": "Returns the operating system platform."
                },
                arch: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/os.html#os_os_arch",
                    "!doc": "Returns the operating system CPU architecture."
                },
                release: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/os.html#os_os_release",
                    "!doc": "Returns the operating system release."
                },
                uptime: {
                    "!type": "fn() -> number",
                    "!url": "http://nodejs.org/api/os.html#os_os_uptime",
                    "!doc": "Returns the system uptime in seconds."
                },
                loadavg: {
                    "!type": "fn() -> [number]",
                    "!url": "http://nodejs.org/api/os.html#os_os_loadavg",
                    "!doc": "Returns an array containing the 1, 5, and 15 minute load averages."
                },
                totalmem: {
                    "!type": "fn() -> number",
                    "!url": "http://nodejs.org/api/os.html#os_os_totalmem",
                    "!doc": "Returns the total amount of system memory in bytes."
                },
                freemem: {
                    "!type": "fn() -> number",
                    "!url": "http://nodejs.org/api/os.html#os_os_freemem",
                    "!doc": "Returns the amount of free system memory in bytes."
                },
                cpus: {
                    "!type": "fn() -> [os.cpuSpec]",
                    "!url": "http://nodejs.org/api/os.html#os_os_cpus",
                    "!doc": "Returns an array of objects containing information about each CPU/core installed: model, speed (in MHz), and times (an object containing the number of milliseconds the CPU/core spent in: user, nice, sys, idle, and irq)."
                },
                networkInterfaces: {
                    "!type": "fn() -> ?",
                    "!url": "http://nodejs.org/api/os.html#os_os_networkinterfaces",
                    "!doc": "Get a list of network interfaces."
                },
                EOL: {
                    "!type": "string",
                    "!url": "http://nodejs.org/api/os.html#os_os_eol",
                    "!doc": "A constant defining the appropriate End-of-line marker for the operating system."
                }
            },
            punycode: {
                decode: {
                    "!type": "fn(string: string) -> string",
                    "!url": "http://nodejs.org/api/punycode.html#punycode_punycode_decode_string",
                    "!doc": "Converts a Punycode string of ASCII code points to a string of Unicode code points."
                },
                encode: {
                    "!type": "fn(string: string) -> string",
                    "!url": "http://nodejs.org/api/punycode.html#punycode_punycode_encode_string",
                    "!doc": "Converts a string of Unicode code points to a Punycode string of ASCII code points."
                },
                toUnicode: {
                    "!type": "fn(domain: string) -> string",
                    "!url": "http://nodejs.org/api/punycode.html#punycode_punycode_tounicode_domain",
                    "!doc": "Converts a Punycode string representing a domain name to Unicode. Only the Punycoded parts of the domain name will be converted, i.e. it doesn't matter if you call it on a string that has already been converted to Unicode."
                },
                toASCII: {
                    "!type": "fn(domain: string) -> string",
                    "!url": "http://nodejs.org/api/punycode.html#punycode_punycode_toascii_domain",
                    "!doc": "Converts a Unicode string representing a domain name to Punycode. Only the non-ASCII parts of the domain name will be converted, i.e. it doesn't matter if you call it with a domain that's already in ASCII."
                },
                ucs2: {
                    decode: {
                        "!type": "fn(string: string) -> string",
                        "!url": "http://nodejs.org/api/punycode.html#punycode_punycode_ucs2_decode_string",
                        "!doc": "Creates an array containing the decimal code points of each Unicode character in the string. While JavaScript uses UCS-2 internally, this function will convert a pair of surrogate halves (each of which UCS-2 exposes as separate characters) into a single code point, matching UTF-16."
                    },
                    encode: {
                        "!type": "fn(codePoints: [number]) -> string",
                        "!url": "http://nodejs.org/api/punycode.html#punycode_punycode_ucs2_encode_codepoints",
                        "!doc": "Creates a string based on an array of decimal code points."
                    }
                },
                version: {
                    "!type": "?",
                    "!url": "http://nodejs.org/api/punycode.html#punycode_punycode_version",
                    "!doc": "A string representing the current Punycode.js version number."
                }
            },
            repl: {
                start: {
                    "!type": "fn(options: ?) -> +events.EventEmitter",
                    "!url": "http://nodejs.org/api/repl.html#repl_repl_start_options",
                    "!doc": "Returns and starts a REPLServer instance."
                }
            },
            readline: {
                createInterface: {
                    "!type": "fn(options: ?) -> +readline.Interface",
                    "!url": "http://nodejs.org/api/readline.html#readline_readline_createinterface_options",
                    "!doc": "Creates a readline Interface instance."
                },
                Interface: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "events.EventEmitter.prototype",
                        setPrompt: {
                            "!type": "fn(prompt: string, length: number)",
                            "!url": "http://nodejs.org/api/readline.html#readline_rl_setprompt_prompt_length",
                            "!doc": "Sets the prompt, for example when you run node on the command line, you see > , which is node's prompt."
                        },
                        prompt: {
                            "!type": "fn(preserveCursor?: bool)",
                            "!url": "http://nodejs.org/api/readline.html#readline_rl_prompt_preservecursor",
                            "!doc": "Readies readline for input from the user, putting the current setPrompt options on a new line, giving the user a new spot to write. Set preserveCursor to true to prevent the cursor placement being reset to 0."
                        },
                        question: {
                            "!type": "fn(query: string, callback: fn())",
                            "!url": "http://nodejs.org/api/readline.html#readline_rl_question_query_callback",
                            "!doc": "Prepends the prompt with query and invokes callback with the user's response. Displays the query to the user, and then invokes callback with the user's response after it has been typed."
                        },
                        pause: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/readline.html#readline_rl_pause",
                            "!doc": "Pauses the readline input stream, allowing it to be resumed later if needed."
                        },
                        resume: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/readline.html#readline_rl_resume",
                            "!doc": "Resumes the readline input stream."
                        },
                        close: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/readline.html#readline_rl_close",
                            "!doc": "Closes the Interface instance, relinquishing control on the input and output streams. The \"close\" event will also be emitted."
                        },
                        write: {
                            "!type": "fn(data: ?, key?: ?)",
                            "!url": "http://nodejs.org/api/readline.html#readline_rl_write_data_key",
                            "!doc": "Writes data to output stream. key is an object literal to represent a key sequence; available if the terminal is a TTY."
                        }
                    },
                    "!url": "http://nodejs.org/api/readline.html#readline_class_interface",
                    "!doc": "The class that represents a readline interface with an input and output stream."
                }
            },
            vm: {
                createContext: {
                    "!type": "fn(initSandbox?: ?) -> ?",
                    "!url": "http://nodejs.org/api/vm.html#vm_vm_createcontext_initsandbox",
                    "!doc": "vm.createContext creates a new context which is suitable for use as the 2nd argument of a subsequent call to vm.runInContext. A (V8) context comprises a global object together with a set of build-in objects and functions. The optional argument initSandbox will be shallow-copied to seed the initial contents of the global object used by the context."
                },
                Script: {
                    "!type": "fn()",
                    prototype: {
                        runInThisContext: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/vm.html#vm_script_runinthiscontext",
                            "!doc": "Similar to vm.runInThisContext but a method of a precompiled Script object. script.runInThisContext runs the code of script and returns the result. Running code does not have access to local scope, but does have access to the global object (v8: in actual context)."
                        },
                        runInNewContext: {
                            "!type": "fn(sandbox?: ?)",
                            "!url": "http://nodejs.org/api/vm.html#vm_script_runinnewcontext_sandbox",
                            "!doc": "Similar to vm.runInNewContext a method of a precompiled Script object. script.runInNewContext runs the code of script with sandbox as the global object and returns the result. Running code does not have access to local scope. sandbox is optional."
                        }
                    },
                    "!url": "http://nodejs.org/api/vm.html#vm_class_script",
                    "!doc": "A class for running scripts. Returned by vm.createScript."
                },
                runInThisContext: {
                    "!type": "fn(code: string, filename?: string)",
                    "!url": "http://nodejs.org/api/vm.html#vm_vm_runinthiscontext_code_filename",
                    "!doc": "vm.runInThisContext() compiles code, runs it and returns the result. Running code does not have access to local scope. filename is optional, it's used only in stack traces."
                },
                runInNewContext: {
                    "!type": "fn(code: string, sandbox?: ?, filename?: string)",
                    "!url": "http://nodejs.org/api/vm.html#vm_vm_runinnewcontext_code_sandbox_filename",
                    "!doc": "vm.runInNewContext compiles code, then runs it in sandbox and returns the result. Running code does not have access to local scope. The object sandbox will be used as the global object for code. sandbox and filename are optional, filename is only used in stack traces."
                },
                runInContext: {
                    "!type": "fn(code: string, context: ?, filename?: string)",
                    "!url": "http://nodejs.org/api/vm.html#vm_vm_runincontext_code_context_filename",
                    "!doc": "vm.runInContext compiles code, then runs it in context and returns the result. A (V8) context comprises a global object, together with a set of built-in objects and functions. Running code does not have access to local scope and the global object held within context will be used as the global object for code. filename is optional, it's used only in stack traces."
                },
                createScript: {
                    "!type": "fn(code: string, filename?: string) -> +vm.Script",
                    "!url": "http://nodejs.org/api/vm.html#vm_vm_createscript_code_filename",
                    "!doc": "createScript compiles code but does not run it. Instead, it returns a vm.Script object representing this compiled code. This script can be run later many times using methods below. The returned script is not bound to any global object. It is bound before each run, just for that run. filename is optional, it's only used in stack traces."
                }
            },
            child_process: {
                ChildProcess: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "events.EventEmitter.prototype",
                        stdin: {
                            "!type": "+stream.Writable",
                            "!url": "http://nodejs.org/api/child_process.html#child_process_child_stdin",
                            "!doc": "A Writable Stream that represents the child process's stdin. Closing this stream via end() often causes the child process to terminate."
                        },
                        stdout: {
                            "!type": "+stream.Readable",
                            "!url": "http://nodejs.org/api/child_process.html#child_process_child_stdout",
                            "!doc": "A Readable Stream that represents the child process's stdout."
                        },
                        stderr: {
                            "!type": "+stream.Readable",
                            "!url": "http://nodejs.org/api/child_process.html#child_process_child_stderr",
                            "!doc": "A Readable Stream that represents the child process's stderr."
                        },
                        pid: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/child_process.html#child_process_child_pid",
                            "!doc": "The PID of the child process."
                        },
                        kill: {
                            "!type": "fn(signal?: string)",
                            "!url": "http://nodejs.org/api/child_process.html#child_process_child_kill_signal",
                            "!doc": "Send a signal to the child process. If no argument is given, the process will be sent 'SIGTERM'."
                        },
                        send: {
                            "!type": "fn(message: ?, sendHandle?: ?)",
                            "!url": "http://nodejs.org/api/child_process.html#child_process_child_send_message_sendhandle",
                            "!doc": "When using child_process.fork() you can write to the child using child.send(message, [sendHandle]) and messages are received by a 'message' event on the child."
                        },
                        disconnect: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/child_process.html#child_process_child_disconnect",
                            "!doc": "To close the IPC connection between parent and child use the child.disconnect() method. This allows the child to exit gracefully since there is no IPC channel keeping it alive. When calling this method the disconnect event will be emitted in both parent and child, and the connected flag will be set to false. Please note that you can also call process.disconnect() in the child process."
                        }
                    },
                    "!url": "http://nodejs.org/api/child_process.html#child_process_class_childprocess",
                    "!doc": "ChildProcess is an EventEmitter."
                },
                spawn: {
                    "!type": "fn(command: string, args?: [string], options?: ?) -> +child_process.ChildProcess",
                    "!url": "http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options",
                    "!doc": "Launches a new process with the given command, with command line arguments in args. If omitted, args defaults to an empty Array."
                },
                exec: {
                    "!type": "fn(command: string, callback: fn(error: ?, stdout: +Buffer, stderr: +Buffer)) -> +child_process.ChildProcess",
                    "!url": "http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback",
                    "!doc": "Runs a command in a shell and buffers the output."
                },
                execFile: {
                    "!type": "fn(file: string, args: [string], options: ?, callback: fn(error: ?, stdout: +Buffer, stderr: +Buffer)) -> +child_process.ChildProcess",
                    "!url": "http://nodejs.org/api/child_process.html#child_process_child_process_execfile_file_args_options_callback",
                    "!doc": "This is similar to child_process.exec() except it does not execute a subshell but rather the specified file directly. This makes it slightly leaner than child_process.exec. It has the same options."
                },
                fork: {
                    "!type": "fn(modulePath: string, args?: [string], options?: ?) -> +child_process.ChildProcess",
                    "!url": "http://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options",
                    "!doc": "This is a special case of the spawn() functionality for spawning Node processes. In addition to having all the methods in a normal ChildProcess instance, the returned object has a communication channel built-in."
                }
            },
            url: {
                parse: {
                    "!type": "fn(urlStr: string, parseQueryString?: bool, slashesDenoteHost?: bool) -> url.type",
                    "!url": "http://nodejs.org/api/url.html#url_url_parse_urlstr_parsequerystring_slashesdenotehost",
                    "!doc": "Take a URL string, and return an object."
                },
                format: {
                    "!type": "fn(url: url.type) -> string",
                    "!url": "http://nodejs.org/api/url.html#url_url_format_urlobj",
                    "!doc": "Take a parsed URL object, and return a formatted URL string."
                },
                resolve: {
                    "!type": "fn(from: string, to: string) -> string",
                    "!url": "http://nodejs.org/api/url.html#url_url_resolve_from_to",
                    "!doc": "Take a base URL, and a href URL, and resolve them as a browser would for an anchor tag."
                }
            },
            dns: {
                lookup: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, address: string, family: number)) -> string",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_lookup_domain_family_callback",
                    "!doc": "Resolves a domain (e.g. 'google.com') into the first found A (IPv4) or AAAA (IPv6) record. The family can be the integer 4 or 6. Defaults to null that indicates both Ip v4 and v6 address family."
                },
                resolve: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, addresses: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_resolve_domain_rrtype_callback",
                    "!doc": "Resolves a domain (e.g. 'google.com') into an array of the record types specified by rrtype. Valid rrtypes are 'A' (IPV4 addresses, default), 'AAAA' (IPV6 addresses), 'MX' (mail exchange records), 'TXT' (text records), 'SRV' (SRV records), 'PTR' (used for reverse IP lookups), 'NS' (name server records) and 'CNAME' (canonical name records)."
                },
                resolve4: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, addresses: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_resolve4_domain_callback",
                    "!doc": "The same as dns.resolve(), but only for IPv4 queries (A records). addresses is an array of IPv4 addresses (e.g. ['74.125.79.104', '74.125.79.105', '74.125.79.106'])."
                },
                resolve6: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, addresses: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_resolve6_domain_callback",
                    "!doc": "The same as dns.resolve4() except for IPv6 queries (an AAAA query)."
                },
                resolveMx: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, addresses: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_resolvemx_domain_callback",
                    "!doc": "The same as dns.resolve(), but only for mail exchange queries (MX records)."
                },
                resolveTxt: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, addresses: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_resolvetxt_domain_callback",
                    "!doc": "The same as dns.resolve(), but only for text queries (TXT records). addresses is an array of the text records available for domain (e.g., ['v=spf1 ip4:0.0.0.0 ~all'])."
                },
                resolveSrv: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, addresses: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_resolvesrv_domain_callback",
                    "!doc": "The same as dns.resolve(), but only for service records (SRV records). addresses is an array of the SRV records available for domain. Properties of SRV records are priority, weight, port, and name (e.g., [{'priority': 10, {'weight': 5, 'port': 21223, 'name': 'service.example.com'}, ...])."
                },
                resolveNs: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, addresses: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_resolvens_domain_callback",
                    "!doc": "The same as dns.resolve(), but only for name server records (NS records). addresses is an array of the name server records available for domain (e.g., ['ns1.example.com', 'ns2.example.com'])."
                },
                resolveCname: {
                    "!type": "fn(domain: string, callback: fn(err: +Error, addresses: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_resolvecname_domain_callback",
                    "!doc": "The same as dns.resolve(), but only for canonical name records (CNAME records). addresses is an array of the canonical name records available for domain (e.g., ['bar.example.com'])."
                },
                reverse: {
                    "!type": "fn(ip: string, callback: fn(err: +Error, domains: [string])) -> [string]",
                    "!url": "http://nodejs.org/api/dns.html#dns_dns_reverse_ip_callback",
                    "!doc": "Reverse resolves an ip address to an array of domain names."
                }
            },
            net: {
                createServer: {
                    "!type": "fn(options?: ?, connectionListener?: fn(socket: +net.Socket)) -> +net.Server",
                    "!url": "http://nodejs.org/api/net.html#net_net_createserver_options_connectionlistener",
                    "!doc": "Creates a new TCP server. The connectionListener argument is automatically set as a listener for the 'connection' event."
                },
                Server: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "net.Socket.prototype",
                        listen: {
                            "!type": "fn(port: number, hostname?: string, backlog?: number, callback?: fn())",
                            "!url": "http://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback",
                            "!doc": "Begin accepting connections on the specified port and host. If the host is omitted, the server will accept connections directed to any IPv4 address (INADDR_ANY). A port value of zero will assign a random port."
                        },
                        close: {
                            "!type": "fn(callback?: fn())",
                            "!url": "http://nodejs.org/api/net.html#net_server_close_callback",
                            "!doc": "Stops the server from accepting new connections and keeps existing connections. This function is asynchronous, the server is finally closed when all connections are ended and the server emits a 'close' event. Optionally, you can pass a callback to listen for the 'close' event."
                        },
                        maxConnections: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/net.html#net_server_maxconnections",
                            "!doc": "Set this property to reject connections when the server's connection count gets high."
                        },
                        getConnections: {
                            "!type": "fn(callback: fn(err: +Error, count: number))",
                            "!url": "http://nodejs.org/api/net.html#net_server_getconnections_callback",
                            "!doc": "Asynchronously get the number of concurrent connections on the server. Works when sockets were sent to forks."
                        }
                    },
                    "!url": "http://nodejs.org/api/net.html#net_class_net_server",
                    "!doc": "This class is used to create a TCP or UNIX server. A server is a net.Socket that can listen for new incoming connections."
                },
                Socket: {
                    "!type": "fn(options: ?)",
                    prototype: {
                        "!proto": "events.EventEmitter.prototype",
                        connect: {
                            "!type": "fn(port: number, host?: string, connectionListener?: fn())",
                            "!url": "http://nodejs.org/api/net.html#net_socket_connect_port_host_connectlistener",
                            "!doc": "Opens the connection for a given socket. If port and host are given, then the socket will be opened as a TCP socket, if host is omitted, localhost will be assumed. If a path is given, the socket will be opened as a unix socket to that path."
                        },
                        bufferSize: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/net.html#net_socket_buffersize",
                            "!doc": "net.Socket has the property that socket.write() always works. This is to help users get up and running quickly. The computer cannot always keep up with the amount of data that is written to a socket - the network connection simply might be too slow. Node will internally queue up the data written to a socket and send it out over the wire when it is possible. (Internally it is polling on the socket's file descriptor for being writable)."
                        },
                        setEncoding: {
                            "!type": "fn(encoding?: string)",
                            "!url": "http://nodejs.org/api/net.html#net_socket_setencoding_encoding",
                            "!doc": "Set the encoding for the socket as a Readable Stream."
                        },
                        write: {
                            "!type": "fn(data: +Buffer, encoding?: string, callback?: fn())",
                            "!url": "http://nodejs.org/api/net.html#net_socket_write_data_encoding_callback",
                            "!doc": "Sends data on the socket. The second parameter specifies the encoding in the case of a string--it defaults to UTF8 encoding."
                        },
                        end: {
                            "!type": "fn(data?: +Buffer, encoding?: string)",
                            "!url": "http://nodejs.org/api/net.html#net_socket_end_data_encoding",
                            "!doc": "Half-closes the socket. i.e., it sends a FIN packet. It is possible the server will still send some data."
                        },
                        destroy: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/net.html#net_socket_destroy",
                            "!doc": "Ensures that no more I/O activity happens on this socket. Only necessary in case of errors (parse error or so)."
                        },
                        pause: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/net.html#net_socket_pause",
                            "!doc": "Pauses the reading of data. That is, 'data' events will not be emitted. Useful to throttle back an upload."
                        },
                        resume: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/net.html#net_socket_resume",
                            "!doc": "Resumes reading after a call to pause()."
                        },
                        setTimeout: {
                            "!type": "fn(timeout: number, callback?: fn())",
                            "!url": "http://nodejs.org/api/net.html#net_socket_settimeout_timeout_callback",
                            "!doc": "Sets the socket to timeout after timeout milliseconds of inactivity on the socket. By default net.Socket do not have a timeout."
                        },
                        setKeepAlive: {
                            "!type": "fn(enable?: bool, initialDelay?: number)",
                            "!url": "http://nodejs.org/api/net.html#net_socket_setkeepalive_enable_initialdelay",
                            "!doc": "Enable/disable keep-alive functionality, and optionally set the initial delay before the first keepalive probe is sent on an idle socket. enable defaults to false."
                        },
                        address: {
                            "!type": "fn() -> net.address",
                            "!url": "http://nodejs.org/api/net.html#net_socket_address",
                            "!doc": "Returns the bound address, the address family name and port of the socket as reported by the operating system. Returns an object with three properties, e.g. { port: 12346, family: 'IPv4', address: '127.0.0.1' }"
                        },
                        unref: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/net.html#net_socket_unref",
                            "!doc": "Calling unref on a socket will allow the program to exit if this is the only active socket in the event system. If the socket is already unrefd calling unref again will have no effect."
                        },
                        ref: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/net.html#net_socket_ref",
                            "!doc": "Opposite of unref, calling ref on a previously unrefd socket will not let the program exit if it's the only socket left (the default behavior). If the socket is refd calling ref again will have no effect."
                        },
                        remoteAddress: {
                            "!type": "string",
                            "!url": "http://nodejs.org/api/net.html#net_socket_remoteaddress",
                            "!doc": "The string representation of the remote IP address. For example, '74.125.127.100' or '2001:4860:a005::68'."
                        },
                        remotePort: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/net.html#net_socket_remoteport",
                            "!doc": "The numeric representation of the remote port. For example, 80 or 21."
                        },
                        localPort: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/net.html#net_socket_localport",
                            "!doc": "The numeric representation of the local port. For example, 80 or 21."
                        },
                        bytesRead: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/net.html#net_socket_bytesread",
                            "!doc": "The amount of received bytes."
                        },
                        bytesWritten: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/net.html#net_socket_byteswritten",
                            "!doc": "The amount of bytes sent."
                        },
                        setNoDelay: {
                            "!type": "fn(noDelay?: fn())",
                            "!url": "http://nodejs.org/api/net.html#net_socket_setnodelay_nodelay",
                            "!doc": "Disables the Nagle algorithm. By default TCP connections use the Nagle algorithm, they buffer data before sending it off. Setting true for noDelay will immediately fire off data each time socket.write() is called. noDelay defaults to true."
                        },
                        localAddress: {
                            "!type": "string",
                            "!url": "http://nodejs.org/api/net.html#net_socket_localaddress",
                            "!doc": "The string representation of the local IP address the remote client is connecting on. For example, if you are listening on '0.0.0.0' and the client connects on '192.168.1.1', the value would be '192.168.1.1'."
                        }
                    },
                    "!url": "http://nodejs.org/api/net.html#net_class_net_socket",
                    "!doc": "This object is an abstraction of a TCP or UNIX socket. net.Socket instances implement a duplex Stream interface. They can be created by the user and used as a client (with connect()) or they can be created by Node and passed to the user through the 'connection' event of a server."
                },
                connect: {
                    "!type": "fn(options: ?, connectionListener?: fn()) -> +net.Socket",
                    "!url": "http://nodejs.org/api/net.html#net_net_connect_options_connectionlistener",
                    "!doc": "Constructs a new socket object and opens the socket to the given location. When the socket is established, the 'connect' event will be emitted."
                },
                createConnection: {
                    "!type": "fn(options: ?, connectionListener?: fn()) -> +net.Socket",
                    "!url": "http://nodejs.org/api/net.html#net_net_createconnection_options_connectionlistener",
                    "!doc": "Constructs a new socket object and opens the socket to the given location. When the socket is established, the 'connect' event will be emitted."
                },
                isIP: {
                    "!type": "fn(input: string) -> number",
                    "!url": "http://nodejs.org/api/net.html#net_net_isip_input",
                    "!doc": "Tests if input is an IP address. Returns 0 for invalid strings, returns 4 for IP version 4 addresses, and returns 6 for IP version 6 addresses."
                },
                isIPv4: {
                    "!type": "fn(input: string) -> bool",
                    "!url": "http://nodejs.org/api/net.html#net_net_isipv4_input",
                    "!doc": "Returns true if input is a version 4 IP address, otherwise returns false."
                },
                isIPv6: {
                    "!type": "fn(input: string) -> bool",
                    "!url": "http://nodejs.org/api/net.html#net_net_isipv6_input",
                    "!doc": "Returns true if input is a version 6 IP address, otherwise returns false."
                }
            },
            dgram: {
                createSocket: {
                    "!type": "fn(type: string, callback?: fn()) -> +dgram.Socket",
                    "!url": "http://nodejs.org/api/dgram.html#dgram_dgram_createsocket_type_callback",
                    "!doc": "Creates a datagram Socket of the specified types. Valid types are udp4 and udp6."
                },
                Socket: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "events.EventEmitter.prototype",
                        send: {
                            "!type": "fn(buf: +Buffer, offset: number, length: number, port: number, address: string, callback?: fn())",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_send_buf_offset_length_port_address_callback",
                            "!doc": "For UDP sockets, the destination port and IP address must be specified. A string may be supplied for the address parameter, and it will be resolved with DNS. An optional callback may be specified to detect any DNS errors and when buf may be re-used. Note that DNS lookups will delay the time that a send takes place, at least until the next tick. The only way to know for sure that a send has taken place is to use the callback."
                        },
                        bind: {
                            "!type": "fn(port: number, address?: string)",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_bind_port_address_callback",
                            "!doc": "For UDP sockets, listen for datagrams on a named port and optional address. If address is not specified, the OS will try to listen on all addresses."
                        },
                        close: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_close",
                            "!doc": "Close the underlying socket and stop listening for data on it."
                        },
                        address: {
                            address: "string",
                            family: "string",
                            port: "number",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_address",
                            "!doc": "Returns an object containing the address information for a socket. For UDP sockets, this object will contain address , family and port."
                        },
                        setBroadcast: {
                            "!type": "fn(flag: bool)",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_setbroadcast_flag",
                            "!doc": "Sets or clears the SO_BROADCAST socket option. When this option is set, UDP packets may be sent to a local interface's broadcast address."
                        },
                        setTTL: {
                            "!type": "fn(ttl: number)",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_setttl_ttl",
                            "!doc": "Sets the IP_TTL socket option. TTL stands for \"Time to Live,\" but in this context it specifies the number of IP hops that a packet is allowed to go through. Each router or gateway that forwards a packet decrements the TTL. If the TTL is decremented to 0 by a router, it will not be forwarded. Changing TTL values is typically done for network probes or when multicasting."
                        },
                        setMulticastTTL: {
                            "!type": "fn(ttl: number)",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_setmulticastttl_ttl",
                            "!doc": "Sets the IP_MULTICAST_TTL socket option. TTL stands for \"Time to Live,\" but in this context it specifies the number of IP hops that a packet is allowed to go through, specifically for multicast traffic. Each router or gateway that forwards a packet decrements the TTL. If the TTL is decremented to 0 by a router, it will not be forwarded."
                        },
                        setMulticastLoopback: {
                            "!type": "fn(flag: bool)",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_setmulticastloopback_flag",
                            "!doc": "Sets or clears the IP_MULTICAST_LOOP socket option. When this option is set, multicast packets will also be received on the local interface."
                        },
                        addMembership: {
                            "!type": "fn(multicastAddress: string, multicastInterface?: string)",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_addmembership_multicastaddress_multicastinterface",
                            "!doc": "Tells the kernel to join a multicast group with IP_ADD_MEMBERSHIP socket option."
                        },
                        dropMembership: {
                            "!type": "fn(multicastAddress: string, multicastInterface?: string)",
                            "!url": "http://nodejs.org/api/dgram.html#dgram_socket_dropmembership_multicastaddress_multicastinterface",
                            "!doc": "Opposite of addMembership - tells the kernel to leave a multicast group with IP_DROP_MEMBERSHIP socket option. This is automatically called by the kernel when the socket is closed or process terminates, so most apps will never need to call this."
                        }
                    },
                    "!url": "http://nodejs.org/api/dgram.html#dgram_class_dgram_socket",
                    "!doc": "The dgram Socket class encapsulates the datagram functionality. It should be created via dgram.createSocket(type, [callback])."
                }
            },
            fs: {
                rename: {
                    "!type": "fn(oldPath: string, newPath: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_rename_oldpath_newpath_callback",
                    "!doc": "Asynchronous rename(2). No arguments other than a possible exception are given to the completion callback."
                },
                renameSync: {
                    "!type": "fn(oldPath: string, newPath: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_renamesync_oldpath_newpath",
                    "!doc": "Synchronous rename(2)."
                },
                ftruncate: {
                    "!type": "fn(fd: number, len: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_ftruncate_fd_len_callback",
                    "!doc": "Asynchronous ftruncate(2). No arguments other than a possible exception are given to the completion callback."
                },
                ftruncateSync: {
                    "!type": "fn(fd: number, len: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_ftruncatesync_fd_len",
                    "!doc": "Synchronous ftruncate(2)."
                },
                truncate: {
                    "!type": "fn(path: string, len: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_truncate_path_len_callback",
                    "!doc": "Asynchronous truncate(2). No arguments other than a possible exception are given to the completion callback."
                },
                truncateSync: {
                    "!type": "fn(path: string, len: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_truncatesync_path_len",
                    "!doc": "Synchronous truncate(2)."
                },
                chown: {
                    "!type": "fn(path: string, uid: number, gid: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_chown_path_uid_gid_callback",
                    "!doc": "Asynchronous chown(2). No arguments other than a possible exception are given to the completion callback."
                },
                chownSync: {
                    "!type": "fn(path: string, uid: number, gid: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_chownsync_path_uid_gid",
                    "!doc": "Synchronous chown(2)."
                },
                fchown: {
                    "!type": "fn(fd: number, uid: number, gid: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_fchown_fd_uid_gid_callback",
                    "!doc": "Asynchronous fchown(2). No arguments other than a possible exception are given to the completion callback."
                },
                fchownSync: {
                    "!type": "fn(fd: number, uid: number, gid: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_fchownsync_fd_uid_gid",
                    "!doc": "Synchronous fchown(2)."
                },
                lchown: {
                    "!type": "fn(path: string, uid: number, gid: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_lchown_path_uid_gid_callback",
                    "!doc": "Asynchronous lchown(2). No arguments other than a possible exception are given to the completion callback."
                },
                lchownSync: {
                    "!type": "fn(path: string, uid: number, gid: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_lchownsync_path_uid_gid",
                    "!doc": "Synchronous lchown(2)."
                },
                chmod: {
                    "!type": "fn(path: string, mode: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_chmod_path_mode_callback",
                    "!doc": "Asynchronous chmod(2). No arguments other than a possible exception are given to the completion callback."
                },
                chmodSync: {
                    "!type": "fn(path: string, mode: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_chmodsync_path_mode",
                    "!doc": "Synchronous chmod(2)."
                },
                fchmod: {
                    "!type": "fn(fd: number, mode: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_fchmod_fd_mode_callback",
                    "!doc": "Asynchronous fchmod(2). No arguments other than a possible exception are given to the completion callback."
                },
                fchmodSync: {
                    "!type": "fn(fd: number, mode: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_fchmodsync_fd_mode",
                    "!doc": "Synchronous fchmod(2)."
                },
                lchmod: {
                    "!type": "fn(path: string, mode: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_lchmod_path_mode_callback",
                    "!doc": "Asynchronous lchmod(2). No arguments other than a possible exception are given to the completion callback."
                },
                lchmodSync: {
                    "!type": "fn(path: string, mode: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_lchmodsync_path_mode",
                    "!doc": "Synchronous lchmod(2)."
                },
                stat: {
                    "!type": "fn(path: string, callback?: fn(err: +Error, stats: +fs.Stats) -> ?) -> +fs.Stats",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_stat_path_callback",
                    "!doc": "Asynchronous stat(2). The callback gets two arguments (err, stats) where stats is a fs.Stats object."
                },
                lstat: {
                    "!type": "fn(path: string, callback?: fn(err: +Error, stats: +fs.Stats) -> ?) -> +fs.Stats",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_lstat_path_callback",
                    "!doc": "Asynchronous lstat(2). The callback gets two arguments (err, stats) where stats is a fs.Stats object. lstat() is identical to stat(), except that if path is a symbolic link, then the link itself is stat-ed, not the file that it refers to."
                },
                fstat: {
                    "!type": "fn(fd: number, callback?: fn(err: +Error, stats: +fs.Stats) -> ?) -> +fs.Stats",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_fstat_fd_callback",
                    "!doc": "Asynchronous fstat(2). The callback gets two arguments (err, stats) where stats is a fs.Stats object. fstat() is identical to stat(), except that the file to be stat-ed is specified by the file descriptor fd."
                },
                statSync: {
                    "!type": "fn(path: string) -> +fs.Stats",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_statsync_path",
                    "!doc": "Synchronous stat(2). Returns an instance of fs.Stats."
                },
                lstatSync: {
                    "!type": "fn(path: string) -> +fs.Stats",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_lstatsync_path",
                    "!doc": "Synchronous lstat(2). Returns an instance of fs.Stats."
                },
                fstatSync: {
                    "!type": "fn(fd: number) -> +fs.Stats",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_fstatsync_fd",
                    "!doc": "Synchronous fstat(2). Returns an instance of fs.Stats."
                },
                link: {
                    "!type": "fn(srcpath: string, dstpath: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_link_srcpath_dstpath_callback",
                    "!doc": "Asynchronous link(2). No arguments other than a possible exception are given to the completion callback."
                },
                linkSync: {
                    "!type": "fn(srcpath: string, dstpath: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_linksync_srcpath_dstpath",
                    "!doc": "Synchronous link(2)."
                },
                symlink: {
                    "!type": "fn(srcpath: string, dstpath: string, type?: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_symlink_srcpath_dstpath_type_callback",
                    "!doc": "Asynchronous symlink(2). No arguments other than a possible exception are given to the completion callback. type argument can be either 'dir', 'file', or 'junction' (default is 'file'). It is only used on Windows (ignored on other platforms). Note that Windows junction points require the destination path to be absolute. When using 'junction', the destination argument will automatically be normalized to absolute path."
                },
                symlinkSync: {
                    "!type": "fn(srcpath: string, dstpath: string, type?: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_symlinksync_srcpath_dstpath_type",
                    "!doc": "Synchronous symlink(2)."
                },
                readlink: {
                    "!type": "fn(path: string, callback?: fn(err: +Error, linkString: string))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_readlink_path_callback",
                    "!doc": "Asynchronous readlink(2). The callback gets two arguments (err, linkString)."
                },
                readlinkSync: {
                    "!type": "fn(path: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_readlinksync_path",
                    "!doc": "Synchronous readlink(2). Returns the symbolic link's string value."
                },
                realpath: {
                    "!type": "fn(path: string, cache: string, callback: fn(err: +Error, resolvedPath: string))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_realpath_path_cache_callback",
                    "!doc": "Asynchronous realpath(2). The callback gets two arguments (err, resolvedPath). May use process.cwd to resolve relative paths. cache is an object literal of mapped paths that can be used to force a specific path resolution or avoid additional fs.stat calls for known real paths."
                },
                realpathSync: {
                    "!type": "fn(path: string, cache?: bool) -> string",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_realpathsync_path_cache",
                    "!doc": "Synchronous realpath(2). Returns the resolved path."
                },
                unlink: {
                    "!type": "fn(path: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_unlink_path_callback",
                    "!doc": "Asynchronous unlink(2). No arguments other than a possible exception are given to the completion callback."
                },
                unlinkSync: {
                    "!type": "fn(path: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_unlinksync_path",
                    "!doc": "Synchronous unlink(2)."
                },
                rmdir: {
                    "!type": "fn(path: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_rmdir_path_callback",
                    "!doc": "Asynchronous rmdir(2). No arguments other than a possible exception are given to the completion callback."
                },
                rmdirSync: {
                    "!type": "fn(path: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_rmdirsync_path",
                    "!doc": "Synchronous rmdir(2)."
                },
                mkdir: {
                    "!type": "fn(path: string, mode?: ?, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_mkdir_path_mode_callback",
                    "!doc": "Asynchronous mkdir(2). No arguments other than a possible exception are given to the completion callback. mode defaults to 0777."
                },
                mkdirSync: {
                    "!type": "fn(path: string, mode?: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_mkdirsync_path_mode",
                    "!doc": "Synchronous mkdir(2)."
                },
                readdir: {
                    "!type": "fn(path: string, callback?: fn(err: +Error, files: [string]))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_readdir_path_callback",
                    "!doc": "Asynchronous readdir(3). Reads the contents of a directory. The callback gets two arguments (err, files) where files is an array of the names of the files in the directory excluding '.' and '..'."
                },
                readdirSync: {
                    "!type": "fn(path: string) -> [string]",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_readdirsync_path",
                    "!doc": "Synchronous readdir(3). Returns an array of filenames excluding '.' and '..'."
                },
                close: {
                    "!type": "fn(fd: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_close_fd_callback",
                    "!doc": "Asynchronous close(2). No arguments other than a possible exception are given to the completion callback."
                },
                closeSync: {
                    "!type": "fn(fd: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_closesync_fd",
                    "!doc": "Synchronous close(2)."
                },
                open: {
                    "!type": "fn(path: string, flags: string, mode?: string, callback?: fn(err: +Error, fd: number))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_open_path_flags_mode_callback",
                    "!doc": "Asynchronous file open."
                },
                openSync: {
                    "!type": "fn(path: string, flags: string, mode?: string) -> number",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_opensync_path_flags_mode",
                    "!doc": "Synchronous open(2)."
                },
                utimes: {
                    "!type": "fn(path: string, atime: number, mtime: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_utimes_path_atime_mtime_callback",
                    "!doc": "Change file timestamps of the file referenced by the supplied path."
                },
                utimesSync: {
                    "!type": "fn(path: string, atime: number, mtime: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_utimessync_path_atime_mtime",
                    "!doc": "Change file timestamps of the file referenced by the supplied path."
                },
                futimes: {
                    "!type": "fn(fd: number, atime: number, mtime: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_futimes_fd_atime_mtime_callback",
                    "!doc": "Change the file timestamps of a file referenced by the supplied file descriptor."
                },
                futimesSync: {
                    "!type": "fn(fd: number, atime: number, mtime: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_futimessync_fd_atime_mtime",
                    "!doc": "Change the file timestamps of a file referenced by the supplied file descriptor."
                },
                fsync: {
                    "!type": "fn(fd: number, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_fsync_fd_callback",
                    "!doc": "Asynchronous fsync(2). No arguments other than a possible exception are given to the completion callback."
                },
                fsyncSync: {
                    "!type": "fn(fd: number)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_fsyncsync_fd",
                    "!doc": "Synchronous fsync(2)."
                },
                write: {
                    "!type": "fn(fd: number, buffer: +Buffer, offset: number, length: number, position: number, callback?: fn(err: +Error, written: number, buffer: +Buffer))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_write_fd_buffer_offset_length_position_callback",
                    "!doc": "Write buffer to the file specified by fd."
                },
                writeSync: {
                    "!type": "fn(fd: number, buffer: +Buffer, offset: number, length: number, position: number) -> number",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_writesync_fd_buffer_offset_length_position",
                    "!doc": "Synchronous version of fs.write(). Returns the number of bytes written."
                },
                read: {
                    "!type": "fn(fd: number, buffer: +Buffer, offset: number, length: number, position: number, callback?: fn(err: +Error, bytesRead: number, buffer: +Buffer))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_read_fd_buffer_offset_length_position_callback",
                    "!doc": "Read data from the file specified by fd."
                },
                readSync: {
                    "!type": "fn(fd: number, buffer: +Buffer, offset: number, length: number, position: number) -> number",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_readsync_fd_buffer_offset_length_position",
                    "!doc": "Synchronous version of fs.read. Returns the number of bytesRead."
                },
                readFile: {
                    "!type": "fn(filename: string, callback: fn(err: +Error, data: +Buffer))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_readfile_filename_options_callback",
                    "!doc": "Asynchronously reads the entire contents of a file."
                },
                readFileSync: {
                    "!type": "fn(filename: string, encoding: string) -> +Buffer",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_readfilesync_filename_options",
                    "!doc": "Synchronous version of fs.readFile. Returns the contents of the filename."
                },
                writeFile: {
                    "!type": "fn(filename: string, data: +Buffer, encoding?: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_writefile_filename_data_options_callback",
                    "!doc": "Asynchronously writes data to a file, replacing the file if it already exists. data can be a string or a buffer."
                },
                writeFileSync: {
                    "!type": "fn(filename: string, data: +Buffer, encoding?: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_writefilesync_filename_data_options",
                    "!doc": "The synchronous version of fs.writeFile."
                },
                appendFile: {
                    "!type": "fn(filename: string, data: ?, encoding?: string, callback?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_appendfile_filename_data_options_callback",
                    "!doc": "Asynchronously append data to a file, creating the file if it not yet exists. data can be a string or a buffer."
                },
                appendFileSync: {
                    "!type": "fn(filename: string, data: ?, encoding?: string)",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_appendfilesync_filename_data_options",
                    "!doc": "The synchronous version of fs.appendFile."
                },
                watchFile: {
                    "!type": "fn(filename: string, options: ?, listener: fn(current: +fs.Stats, prev: +fs.Stats))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_watchfile_filename_options_listener",
                    "!doc": "Watch for changes on filename. The callback listener will be called each time the file is accessed."
                },
                unwatchFile: {
                    "!type": "fn(filename: string, listener?: fn())",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_unwatchfile_filename_listener",
                    "!doc": "Stop watching for changes on filename. If listener is specified, only that particular listener is removed. Otherwise, all listeners are removed and you have effectively stopped watching filename."
                },
                watch: {
                    "!type": "fn(filename: string, options?: ?, listener?: fn(event: string, filename: string)) -> +fs.FSWatcher",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener",
                    "!doc": "Watch for changes on filename, where filename is either a file or a directory. The returned object is a fs.FSWatcher."
                },
                exists: {
                    "!type": "fn(path: string, callback?: fn(exists: bool))",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_exists_path_callback",
                    "!doc": "Test whether or not the given path exists by checking with the file system. Then call the callback argument with either true or false."
                },
                existsSync: {
                    "!type": "fn(path: string) -> bool",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_existssync_path",
                    "!doc": "Synchronous version of fs.exists."
                },
                Stats: {
                    "!type": "fn()",
                    prototype: {
                        isFile: "fn() -> bool",
                        isDirectory: "fn() -> bool",
                        isBlockDevice: "fn() -> bool",
                        isCharacterDevice: "fn() -> bool",
                        isSymbolicLink: "fn() -> bool",
                        isFIFO: "fn() -> bool",
                        isSocket: "fn() -> bool",
                        dev: "number",
                        ino: "number",
                        mode: "number",
                        nlink: "number",
                        uid: "number",
                        gid: "number",
                        rdev: "number",
                        size: "number",
                        blksize: "number",
                        blocks: "number",
                        atime: "+Date",
                        mtime: "+Date",
                        ctime: "+Date"
                    },
                    "!url": "http://nodejs.org/api/fs.html#fs_class_fs_stats",
                    "!doc": "Objects returned from fs.stat(), fs.lstat() and fs.fstat() and their synchronous counterparts are of this type."
                },
                createReadStream: {
                    "!type": "fn(path: string, options?: ?) -> +stream.Readable",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_createreadstream_path_options",
                    "!doc": "Returns a new ReadStream object."
                },
                createWriteStream: {
                    "!type": "fn(path: string, options?: ?) -> +stream.Writable",
                    "!url": "http://nodejs.org/api/fs.html#fs_fs_createwritestream_path_options",
                    "!doc": "Returns a new WriteStream object."
                },
                FSWatcher: {
                    "!type": "fn()",
                    prototype: {
                        close: "fn()"
                    },
                    "!url": "http://nodejs.org/api/fs.html#fs_class_fs_fswatcher",
                    "!doc": "Objects returned from fs.watch() are of this type."
                }
            },
            path: {
                normalize: {
                    "!type": "fn(p: string) -> string",
                    "!url": "http://nodejs.org/api/path.html#path_path_normalize_p",
                    "!doc": "Normalize a string path, taking care of '..' and '.' parts."
                },
                join: {
                    "!type": "fn() -> string",
                    "!url": "http://nodejs.org/api/path.html#path_path_join_path1_path2",
                    "!doc": "Join all arguments together and normalize the resulting path."
                },
                resolve: {
                    "!type": "fn(from: string, from2: string, from3: string, from4: string, from5: string, to: string) -> string",
                    "!url": "http://nodejs.org/api/path.html#path_path_resolve_from_to",
                    "!doc": "Resolves to to an absolute path."
                },
                relative: {
                    "!type": "fn(from: string, to: string) -> string",
                    "!url": "http://nodejs.org/api/path.html#path_path_relative_from_to",
                    "!doc": "Solve the relative path from from to to."
                },
                dirname: {
                    "!type": "fn(p: string) -> string",
                    "!url": "http://nodejs.org/api/path.html#path_path_dirname_p",
                    "!doc": "Return the directory name of a path. Similar to the Unix dirname command."
                },
                basename: {
                    "!type": "fn(p: string, ext?: string) -> string",
                    "!url": "http://nodejs.org/api/path.html#path_path_basename_p_ext",
                    "!doc": "Return the last portion of a path. Similar to the Unix basename command."
                },
                extname: {
                    "!type": "fn(p: string) -> string",
                    "!url": "http://nodejs.org/api/path.html#path_path_extname_p",
                    "!doc": "Return the extension of the path, from the last '.' to end of string in the last portion of the path. If there is no '.' in the last portion of the path or the first character of it is '.', then it returns an empty string."
                },
                sep: {
                    "!type": "string",
                    "!url": "http://nodejs.org/api/path.html#path_path_sep",
                    "!doc": "The platform-specific file separator. '\\\\' or '/'."
                },
                delimiter: {
                    "!type": "string",
                    "!url": "http://nodejs.org/api/path.html#path_path_delimiter",
                    "!doc": "The platform-specific path delimiter, ; or ':'."
                }
            },
            string_decoder: {
                StringDecoder: {
                    "!type": "fn(encoding?: string)",
                    prototype: {
                        write: {
                            "!type": "fn(buffer: +Buffer) -> string",
                            "!url": "http://nodejs.org/api/string_decoder.html#string_decoder_decoder_write_buffer",
                            "!doc": "Returns a decoded string."
                        },
                        end: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/string_decoder.html#string_decoder_decoder_end",
                            "!doc": "Returns any trailing bytes that were left in the buffer."
                        }
                    },
                    "!url": "http://nodejs.org/api/string_decoder.html#string_decoder_class_stringdecoder",
                    "!doc": "Accepts a single argument, encoding which defaults to utf8."
                }
            },
            tls: {
                CLIENT_RENEG_LIMIT: "number",
                CLIENT_RENEG_WINDOW: "number",
                SLAB_BUFFER_SIZE: "number",
                getCiphers: {
                    "!type": "fn() -> [string]",
                    "!url": "http://nodejs.org/api/tls.html#tls_tls_getciphers",
                    "!doc": "Returns an array with the names of the supported SSL ciphers."
                },
                Server: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "net.Server.prototype",
                        listen: {
                            "!type": "fn(port: number, host?: string, callback?: fn())",
                            "!url": "http://nodejs.org/api/tls.html#tls_server_listen_port_host_callback",
                            "!doc": "Begin accepting connections on the specified port and host. If the host is omitted, the server will accept connections directed to any IPv4 address (INADDR_ANY)."
                        },
                        close: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/tls.html#tls_server_close",
                            "!doc": "Stops the server from accepting new connections. This function is asynchronous, the server is finally closed when the server emits a 'close' event."
                        },
                        addContext: {
                            "!type": "fn(hostName: string, credentials: tls.Server.credentials)",
                            "!url": "http://nodejs.org/api/tls.html#tls_server_addcontext_hostname_credentials",
                            "!doc": "Add secure context that will be used if client request's SNI hostname is matching passed hostname (wildcards can be used). credentials can contain key, cert and ca."
                        }
                    },
                    "!url": "http://nodejs.org/api/tls.html#tls_class_tls_server",
                    "!doc": "This class is a subclass of net.Server and has the same methods on it. Instead of accepting just raw TCP connections, this accepts encrypted connections using TLS or SSL."
                },
                createServer: {
                    "!type": "fn(options?: ?, connectionListener?: fn(stream: +tls.CleartextStream)) -> +tls.Server",
                    "!url": "http://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener",
                    "!doc": "Creates a new tls.Server. The connectionListener argument is automatically set as a listener for the secureConnection event."
                },
                CleartextStream: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Duplex.prototype",
                        authorized: {
                            "!type": "bool",
                            "!url": "http://nodejs.org/api/tls.html#tls_cleartextstream_authorized",
                            "!doc": "A boolean that is true if the peer certificate was signed by one of the specified CAs, otherwise false"
                        },
                        authorizationError: {
                            "!type": "+Error",
                            "!url": "http://nodejs.org/api/tls.html#tls_cleartextstream_authorizationerror",
                            "!doc": "The reason why the peer's certificate has not been verified. This property becomes available only when cleartextStream.authorized === false."
                        },
                        getPeerCertificate: {
                            "!type": "fn() -> ?",
                            "!url": "http://nodejs.org/api/tls.html#tls_cleartextstream_getpeercertificate",
                            "!doc": "Returns an object representing the peer's certificate. The returned object has some properties corresponding to the field of the certificate."
                        },
                        getCipher: {
                            "!type": "fn() -> tls.cipher",
                            "!url": "http://nodejs.org/api/tls.html#tls_cleartextstream_getcipher",
                            "!doc": "Returns an object representing the cipher name and the SSL/TLS protocol version of the current connection."
                        },
                        address: {
                            "!type": "net.address",
                            "!url": "http://nodejs.org/api/tls.html#tls_cleartextstream_address",
                            "!doc": "Returns the bound address, the address family name and port of the underlying socket as reported by the operating system. Returns an object with three properties, e.g. { port: 12346, family: 'IPv4', address: '127.0.0.1' }"
                        },
                        remoteAddress: {
                            "!type": "string",
                            "!url": "http://nodejs.org/api/tls.html#tls_cleartextstream_remoteaddress",
                            "!doc": "The string representation of the remote IP address. For example, '74.125.127.100' or '2001:4860:a005::68'."
                        },
                        remotePort: {
                            "!type": "number",
                            "!url": "http://nodejs.org/api/tls.html#tls_cleartextstream_remoteport",
                            "!doc": "The numeric representation of the remote port. For example, 443."
                        }
                    },
                    "!url": "http://nodejs.org/api/tls.html#tls_class_tls_cleartextstream",
                    "!doc": "This is a stream on top of the Encrypted stream that makes it possible to read/write an encrypted data as a cleartext data."
                },
                connect: {
                    "!type": "fn(port: number, host?: string, options: ?, listener: fn()) -> +tls.CleartextStream",
                    "!url": "http://nodejs.org/api/tls.html#tls_tls_connect_options_callback",
                    "!doc": "Creates a new client connection to the given port and host (old API) or options.port and options.host. (If host is omitted, it defaults to localhost.)"
                },
                createSecurePair: {
                    "!type": "fn(credentials?: crypto.credentials, isServer?: bool, requestCert?: bool, rejectUnauthorized?: bool) -> +tls.SecurePair",
                    "!url": "http://nodejs.org/api/tls.html#tls_tls_createsecurepair_credentials_isserver_requestcert_rejectunauthorized",
                    "!doc": "Creates a new secure pair object with two streams, one of which reads/writes encrypted data, and one reads/writes cleartext data. Generally the encrypted one is piped to/from an incoming encrypted data stream, and the cleartext one is used as a replacement for the initial encrypted stream."
                },
                SecurePair: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "events.EventEmitter.prototype",
                        cleartext: {
                            "!type": "+tls.CleartextStream",
                            "!url": "http://nodejs.org/api/tls.html#tls_class_securepair",
                            "!doc": "Returned by tls.createSecurePair."
                        },
                        encrypted: {
                            "!type": "+stream.Duplex",
                            "!url": "http://nodejs.org/api/tls.html#tls_class_securepair",
                            "!doc": "Returned by tls.createSecurePair."
                        }
                    },
                    "!url": "http://nodejs.org/api/tls.html#tls_class_securepair",
                    "!doc": "Returned by tls.createSecurePair."
                }
            },
            crypto: {
                getCiphers: {
                    "!type": "fn() -> [string]",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_getciphers",
                    "!doc": "Returns an array with the names of the supported ciphers."
                },
                getHashes: {
                    "!type": "fn() -> [string]",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_gethashes",
                    "!doc": "Returns an array with the names of the supported hash algorithms."
                },
                createCredentials: {
                    "!type": "fn(details?: ?) -> crypto.credentials",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createcredentials_details",
                    "!doc": "Creates a credentials object."
                },
                createHash: {
                    "!type": "fn(algorithm: string) -> +crypto.Hash",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm",
                    "!doc": "Creates and returns a hash object, a cryptographic hash with the given algorithm which can be used to generate hash digests."
                },
                Hash: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Duplex.prototype",
                        update: {
                            "!type": "fn(data: +Buffer, encoding?: string)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_hash_update_data_input_encoding",
                            "!doc": "Updates the hash content with the given data, the encoding of which is given in input_encoding and can be 'utf8', 'ascii' or 'binary'. If no encoding is provided, then a buffer is expected."
                        },
                        digest: {
                            "!type": "fn(encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_hash_digest_encoding",
                            "!doc": "Calculates the digest of all of the passed data to be hashed. The encoding can be 'hex', 'binary' or 'base64'. If no encoding is provided, then a buffer is returned."
                        }
                    },
                    "!url": "http://nodejs.org/api/crypto.html#crypto_class_hash",
                    "!doc": "The class for creating hash digests of data."
                },
                createHmac: {
                    "!type": "fn(algorithm: string, key: string) -> +crypto.Hmac",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createhmac_algorithm_key",
                    "!doc": "Creates and returns a hmac object, a cryptographic hmac with the given algorithm and key."
                },
                Hmac: {
                    "!type": "fn()",
                    prototype: {
                        update: {
                            "!type": "fn(data: +Buffer)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_hmac_update_data",
                            "!doc": "Update the hmac content with the given data. This can be called many times with new data as it is streamed."
                        },
                        digest: {
                            "!type": "fn(encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_hmac_digest_encoding",
                            "!doc": "Calculates the digest of all of the passed data to the hmac. The encoding can be 'hex', 'binary' or 'base64'. If no encoding is provided, then a buffer is returned."
                        }
                    },
                    "!url": "http://nodejs.org/api/crypto.html#crypto_class_hmac",
                    "!doc": "Class for creating cryptographic hmac content."
                },
                createCipher: {
                    "!type": "fn(algorithm: string, password: string) -> +crypto.Cipher",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createcipher_algorithm_password",
                    "!doc": "Creates and returns a cipher object, with the given algorithm and password."
                },
                createCipheriv: {
                    "!type": "fn(algorithm: string, password: string, iv: string) -> +crypto.Cipher",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv",
                    "!doc": "Creates and returns a cipher object, with the given algorithm, key and iv."
                },
                Cipher: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Duplex.prototype",
                        update: {
                            "!type": "fn(data: +Buffer, input_encoding?: string, output_encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_cipher_update_data_input_encoding_output_encoding",
                            "!doc": "Updates the cipher with data, the encoding of which is given in input_encoding and can be 'utf8', 'ascii' or 'binary'. If no encoding is provided, then a buffer is expected."
                        },
                        "final": {
                            "!type": "fn(output_encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_cipher_final_output_encoding",
                            "!doc": "Returns any remaining enciphered contents, with output_encoding being one of: 'binary', 'base64' or 'hex'. If no encoding is provided, then a buffer is returned."
                        },
                        setAutoPadding: {
                            "!type": "fn(auto_padding: bool)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_cipher_setautopadding_auto_padding_true",
                            "!doc": "You can disable automatic padding of the input data to block size. If auto_padding is false, the length of the entire input data must be a multiple of the cipher's block size or final will fail. Useful for non-standard padding, e.g. using 0x0 instead of PKCS padding. You must call this before cipher.final."
                        }
                    },
                    "!url": "http://nodejs.org/api/crypto.html#crypto_class_cipher",
                    "!doc": "Class for encrypting data."
                },
                createDecipher: {
                    "!type": "fn(algorithm: string, password: string) -> +crypto.Decipher",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createdecipher_algorithm_password",
                    "!doc": "Creates and returns a decipher object, with the given algorithm and key. This is the mirror of the createCipher() above."
                },
                createDecipheriv: {
                    "!type": "fn(algorithm: string, key: string, iv: string) -> +crypto.Decipher",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createdecipheriv_algorithm_key_iv",
                    "!doc": "Creates and returns a decipher object, with the given algorithm, key and iv. This is the mirror of the createCipheriv() above."
                },
                Decipher: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Duplex.prototype",
                        update: {
                            "!type": "fn(data: +Buffer, input_encoding?: string, output_encoding?: string)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_decipher_update_data_input_encoding_output_encoding",
                            "!doc": "Updates the decipher with data, which is encoded in 'binary', 'base64' or 'hex'. If no encoding is provided, then a buffer is expected."
                        },
                        "final": {
                            "!type": "fn(output_encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_decipher_final_output_encoding",
                            "!doc": "Returns any remaining plaintext which is deciphered, with output_encoding being one of: 'binary', 'ascii' or 'utf8'. If no encoding is provided, then a buffer is returned."
                        },
                        setAutoPadding: {
                            "!type": "fn(auto_padding: bool)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_decipher_setautopadding_auto_padding_true",
                            "!doc": "You can disable auto padding if the data has been encrypted without standard block padding to prevent decipher.final from checking and removing it. Can only work if the input data's length is a multiple of the ciphers block size. You must call this before streaming data to decipher.update."
                        }
                    },
                    "!url": "http://nodejs.org/api/crypto.html#crypto_class_decipher",
                    "!doc": "Class for decrypting data."
                },
                createSign: {
                    "!type": "fn(algorithm: string) -> +crypto.Sign",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createsign_algorithm",
                    "!doc": "Creates and returns a signing object, with the given algorithm. On recent OpenSSL releases, openssl list-public-key-algorithms will display the available signing algorithms. Examples are 'RSA-SHA256'."
                },
                Sign: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Writable.prototype",
                        update: {
                            "!type": "fn(data: +Buffer)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_sign_update_data",
                            "!doc": "Updates the sign object with data. This can be called many times with new data as it is streamed."
                        },
                        sign: {
                            "!type": "fn(private_key: string, output_format: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_sign_sign_private_key_output_format",
                            "!doc": "Calculates the signature on all the updated data passed through the sign. private_key is a string containing the PEM encoded private key for signing."
                        }
                    },
                    "!url": "http://nodejs.org/api/crypto.html#crypto_class_sign",
                    "!doc": "Class for generating signatures."
                },
                createVerify: {
                    "!type": "fn(algorith: string) -> +crypto.Verify",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_createverify_algorithm",
                    "!doc": "Creates and returns a verification object, with the given algorithm. This is the mirror of the signing object above."
                },
                Verify: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "stream.Writable.prototype",
                        update: {
                            "!type": "fn(data: +Buffer)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_verifier_update_data",
                            "!doc": "Updates the verifier object with data. This can be called many times with new data as it is streamed."
                        },
                        verify: {
                            "!type": "fn(object: string, signature: string, signature_format?: string) -> bool",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_verifier_verify_object_signature_signature_format",
                            "!doc": "Verifies the signed data by using the object and signature. object is a string containing a PEM encoded object, which can be one of RSA public key, DSA public key, or X.509 certificate. signature is the previously calculated signature for the data, in the signature_format which can be 'binary', 'hex' or 'base64'. If no encoding is specified, then a buffer is expected."
                        }
                    },
                    "!url": "http://nodejs.org/api/crypto.html#crypto_class_verify",
                    "!doc": "Class for verifying signatures."
                },
                createDiffieHellman: {
                    "!type": "fn(prime: number, encoding?: string) -> +crypto.DiffieHellman",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_creatediffiehellman_prime_length",
                    "!doc": "Creates a Diffie-Hellman key exchange object and generates a prime of the given bit length. The generator used is 2."
                },
                DiffieHellman: {
                    "!type": "fn()",
                    prototype: {
                        generateKeys: {
                            "!type": "fn(encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_diffiehellman_generatekeys_encoding",
                            "!doc": "Generates private and public Diffie-Hellman key values, and returns the public key in the specified encoding. This key should be transferred to the other party. Encoding can be 'binary', 'hex', or 'base64'. If no encoding is provided, then a buffer is returned."
                        },
                        computeSecret: {
                            "!type": "fn(other_public_key: +Buffer, input_encoding?: string, output_encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_diffiehellman_computesecret_other_public_key_input_encoding_output_encoding",
                            "!doc": "Computes the shared secret using other_public_key as the other party's public key and returns the computed shared secret. Supplied key is interpreted using specified input_encoding, and secret is encoded using specified output_encoding. Encodings can be 'binary', 'hex', or 'base64'. If the input encoding is not provided, then a buffer is expected."
                        },
                        getPrime: {
                            "!type": "fn(encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_diffiehellman_getprime_encoding",
                            "!doc": "Returns the Diffie-Hellman prime in the specified encoding, which can be 'binary', 'hex', or 'base64'. If no encoding is provided, then a buffer is returned."
                        },
                        getGenerator: {
                            "!type": "fn(encoding: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_diffiehellman_getgenerator_encoding",
                            "!doc": "Returns the Diffie-Hellman prime in the specified encoding, which can be 'binary', 'hex', or 'base64'. If no encoding is provided, then a buffer is returned."
                        },
                        getPublicKey: {
                            "!type": "fn(encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_diffiehellman_getpublickey_encoding",
                            "!doc": "Returns the Diffie-Hellman public key in the specified encoding, which can be 'binary', 'hex', or 'base64'. If no encoding is provided, then a buffer is returned."
                        },
                        getPrivateKey: {
                            "!type": "fn(encoding?: string) -> +Buffer",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_diffiehellman_getprivatekey_encoding",
                            "!doc": "Returns the Diffie-Hellman private key in the specified encoding, which can be 'binary', 'hex', or 'base64'. If no encoding is provided, then a buffer is returned."
                        },
                        setPublicKey: {
                            "!type": "fn(public_key: +Buffer, encoding?: string)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_diffiehellman_setpublickey_public_key_encoding",
                            "!doc": "Sets the Diffie-Hellman public key. Key encoding can be 'binary', 'hex' or 'base64'. If no encoding is provided, then a buffer is expected."
                        },
                        setPrivateKey: {
                            "!type": "fn(public_key: +Buffer, encoding?: string)",
                            "!url": "http://nodejs.org/api/crypto.html#crypto_diffiehellman_setprivatekey_private_key_encoding",
                            "!doc": "Sets the Diffie-Hellman private key. Key encoding can be 'binary', 'hex' or 'base64'. If no encoding is provided, then a buffer is expected."
                        }
                    },
                    "!url": "http://nodejs.org/api/crypto.html#crypto_class_diffiehellman",
                    "!doc": "The class for creating Diffie-Hellman key exchanges."
                },
                getDiffieHellman: {
                    "!type": "fn(group_name: string) -> +crypto.DiffieHellman",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_getdiffiehellman_group_name",
                    "!doc": "Creates a predefined Diffie-Hellman key exchange object. The supported groups are: 'modp1', 'modp2', 'modp5' (defined in RFC 2412) and 'modp14', 'modp15', 'modp16', 'modp17', 'modp18' (defined in RFC 3526). The returned object mimics the interface of objects created by crypto.createDiffieHellman() above, but will not allow to change the keys (with diffieHellman.setPublicKey() for example). The advantage of using this routine is that the parties don't have to generate nor exchange group modulus beforehand, saving both processor and communication time."
                },
                pbkdf2: {
                    "!type": "fn(password: string, salt: string, iterations: number, keylen: number, callback: fn(err: +Error, derivedKey: string))",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_pbkdf2_password_salt_iterations_keylen_callback",
                    "!doc": "Asynchronous PBKDF2 applies pseudorandom function HMAC-SHA1 to derive a key of given length from the given password, salt and iterations. The callback gets two arguments (err, derivedKey)."
                },
                pbkdf2Sync: {
                    "!type": "fn(password: string, salt: string, iterations: number, keylen: number) -> string",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_pbkdf2sync_password_salt_iterations_keylen",
                    "!doc": "Synchronous PBKDF2 function. Returns derivedKey or throws error."
                },
                randomBytes: {
                    "!type": "fn(size: number, callback?: fn(err: +Error, buf: +Buffer))",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback",
                    "!doc": "Generates cryptographically strong pseudo-random data."
                },
                pseudoRandomBytes: {
                    "!type": "fn(size: number, callback?: fn(err: +Error, buf: +Buffer))",
                    "!url": "http://nodejs.org/api/crypto.html#crypto_crypto_pseudorandombytes_size_callback",
                    "!doc": "Generates non-cryptographically strong pseudo-random data. The data returned will be unique if it is sufficiently long, but is not necessarily unpredictable. For this reason, the output of this function should never be used where unpredictability is important, such as in the generation of encryption keys."
                },
                DEFAULT_ENCODING: "string"
            },
            util: {
                format: {
                    "!type": "fn(format: string) -> string",
                    "!url": "http://nodejs.org/api/util.html#util_util_format_format",
                    "!doc": "Returns a formatted string using the first argument as a printf-like format."
                },
                debug: {
                    "!type": "fn(msg: string)",
                    "!url": "http://nodejs.org/api/util.html#util_util_debug_string",
                    "!doc": "A synchronous output function. Will block the process and output string immediately to stderr."
                },
                error: {
                    "!type": "fn(msg: string)",
                    "!url": "http://nodejs.org/api/util.html#util_util_error",
                    "!doc": "Same as util.debug() except this will output all arguments immediately to stderr."
                },
                puts: {
                    "!type": "fn(data: string)",
                    "!url": "http://nodejs.org/api/util.html#util_util_puts",
                    "!doc": "A synchronous output function. Will block the process and output all arguments to stdout with newlines after each argument."
                },
                print: {
                    "!type": "fn(data: string)",
                    "!url": "http://nodejs.org/api/util.html#util_util_print",
                    "!doc": "A synchronous output function. Will block the process, cast each argument to a string then output to stdout. Does not place newlines after each argument."
                },
                log: {
                    "!type": "fn(string: string)",
                    "!url": "http://nodejs.org/api/util.html#util_util_log_string",
                    "!doc": "Output with timestamp on stdout."
                },
                inspect: {
                    "!type": "fn(object: ?, options: ?) -> string",
                    "!url": "http://nodejs.org/api/util.html#util_util_inspect_object_options",
                    "!doc": "Return a string representation of object, which is useful for debugging."
                },
                isArray: {
                    "!type": "fn(object: ?) -> bool",
                    "!url": "http://nodejs.org/api/util.html#util_util_isarray_object",
                    "!doc": "Returns true if the given \"object\" is an Array. false otherwise."
                },
                isRegExp: {
                    "!type": "fn(object: ?) -> bool",
                    "!url": "http://nodejs.org/api/util.html#util_util_isregexp_object",
                    "!doc": "Returns true if the given \"object\" is a RegExp. false otherwise."
                },
                isDate: {
                    "!type": "fn(object: ?) -> bool",
                    "!url": "http://nodejs.org/api/util.html#util_util_isdate_object",
                    "!doc": "Returns true if the given \"object\" is a Date. false otherwise."
                },
                isError: {
                    "!type": "fn(object: ?) -> bool",
                    "!url": "http://nodejs.org/api/util.html#util_util_iserror_object",
                    "!doc": "Returns true if the given \"object\" is an Error. false otherwise."
                },
                inherits: {
                    "!type": "fn(constructor: ?, superConstructor: ?)",
                    "!url": "http://nodejs.org/api/util.html#util_util_inherits_constructor_superconstructor",
                    "!doc": "Inherit the prototype methods from one constructor into another. The prototype of constructor will be set to a new object created from superConstructor."
                }
            },
            assert: {
                "!type": "fn(value: ?, message?: string)",
                fail: {
                    "!type": "fn(actual: ?, expected: ?, message: string, operator: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_fail_actual_expected_message_operator",
                    "!doc": "Throws an exception that displays the values for actual and expected separated by the provided operator."
                },
                ok: {
                    "!type": "fn(value: ?, message?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert",
                    "!doc": "This module is used for writing unit tests for your applications, you can access it with require('assert')."
                },
                equal: {
                    "!type": "fn(actual: ?, expected: ?, message?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_equal_actual_expected_message",
                    "!doc": "Tests shallow, coercive equality with the equal comparison operator ( == )."
                },
                notEqual: {
                    "!type": "fn(actual: ?, expected: ?, message?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_notequal_actual_expected_message",
                    "!doc": "Tests shallow, coercive non-equality with the not equal comparison operator ( != )."
                },
                deepEqual: {
                    "!type": "fn(actual: ?, expected: ?, message?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_deepequal_actual_expected_message",
                    "!doc": "Tests for deep equality."
                },
                notDeepEqual: {
                    "!type": "fn(acutal: ?, expected: ?, message?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_notdeepequal_actual_expected_message",
                    "!doc": "Tests for any deep inequality."
                },
                strictEqual: {
                    "!type": "fn(actual: ?, expected: ?, message?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_strictequal_actual_expected_message",
                    "!doc": "Tests strict equality, as determined by the strict equality operator ( === )"
                },
                notStrictEqual: {
                    "!type": "fn(actual: ?, expected: ?, message?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_notstrictequal_actual_expected_message",
                    "!doc": "Tests strict non-equality, as determined by the strict not equal operator ( !== )"
                },
                "throws": {
                    "!type": "fn(block: fn(), error?: ?, messsage?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_throws_block_error_message",
                    "!doc": "Expects block to throw an error. error can be constructor, regexp or validation function."
                },
                doesNotThrow: {
                    "!type": "fn(block: fn(), error?: ?, messsage?: string)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_doesnotthrow_block_message",
                    "!doc": "Expects block not to throw an error."
                },
                ifError: {
                    "!type": "fn(value: ?)",
                    "!url": "http://nodejs.org/api/assert.html#assert_assert_iferror_value",
                    "!doc": "Tests if value is not a false value, throws if it is a true value. Useful when testing the first argument, error in callbacks."
                },
                "!url": "http://nodejs.org/api/assert.html#assert_assert",
                "!doc": "This module is used for writing unit tests for your applications, you can access it with require('assert')."
            },
            tty: {
                isatty: {
                    "!type": "fn(fd: number) -> bool",
                    "!url": "http://nodejs.org/api/tty.html#tty_tty_isatty_fd",
                    "!doc": "Returns true or false depending on if the fd is associated with a terminal."
                }
            },
            domain: {
                create: {
                    "!type": "fn() -> +events.EventEmitter",
                    "!url": "http://nodejs.org/api/domain.html#domain_domain_create",
                    "!doc": "Returns a new Domain object."
                },
                Domain: {
                    "!type": "fn()",
                    prototype: {
                        "!proto": "events.EventEmitter.prototype",
                        run: {
                            "!type": "fn(fn: fn())",
                            "!url": "http://nodejs.org/api/domain.html#domain_domain_run_fn",
                            "!doc": "Run the supplied function in the context of the domain, implicitly binding all event emitters, timers, and lowlevel requests that are created in that context."
                        },
                        members: {
                            "!type": "[+events.EventEmitter]",
                            "!url": "http://nodejs.org/api/domain.html#domain_domain_members",
                            "!doc": "An array of timers and event emitters that have been explicitly added to the domain."
                        },
                        add: {
                            "!type": "fn(emitter: +events.EventEmitter)",
                            "!url": "http://nodejs.org/api/domain.html#domain_domain_add_emitter",
                            "!doc": "Explicitly adds an emitter to the domain. If any event handlers called by the emitter throw an error, or if the emitter emits an error event, it will be routed to the domain's error event, just like with implicit binding."
                        },
                        remove: {
                            "!type": "fn(emitter: +events.EventEmitter)",
                            "!url": "http://nodejs.org/api/domain.html#domain_domain_remove_emitter",
                            "!doc": "The opposite of domain.add(emitter). Removes domain handling from the specified emitter."
                        },
                        bind: {
                            "!type": "fn(callback: fn(err: +Error, data: ?)) -> !0",
                            "!url": "http://nodejs.org/api/domain.html#domain_domain_bind_callback",
                            "!doc": "The returned function will be a wrapper around the supplied callback function. When the returned function is called, any errors that are thrown will be routed to the domain's error event."
                        },
                        intercept: {
                            "!type": "fn(cb: fn(data: ?)) -> !0",
                            "!url": "http://nodejs.org/api/domain.html#domain_domain_intercept_callback",
                            "!doc": "This method is almost identical to domain.bind(callback). However, in addition to catching thrown errors, it will also intercept Error objects sent as the first argument to the function."
                        },
                        dispose: {
                            "!type": "fn()",
                            "!url": "http://nodejs.org/api/domain.html#domain_domain_dispose",
                            "!doc": "The dispose method destroys a domain, and makes a best effort attempt to clean up any and all IO that is associated with the domain. Streams are aborted, ended, closed, and/or destroyed. Timers are cleared. Explicitly bound callbacks are no longer called. Any error events that are raised as a result of this are ignored."
                        }
                    },
                    "!url": "http://nodejs.org/api/domain.html#domain_class_domain",
                    "!doc": "The Domain class encapsulates the functionality of routing errors and uncaught exceptions to the active Domain object."
                }
            },
            "os.cpuSpec": {
                model: "string",
                speed: "number",
                times: {
                    user: "number",
                    nice: "number",
                    sys: "number",
                    idle: "number",
                    irq: "number"
                }
            },
            "process.memoryUsage.type": {
                rss: "number",
                heapTotal: "?",
                number: "?",
                heapUsed: "number"
            },
            "net.address": {
                port: "number",
                family: "string",
                address: "string"
            },
            "url.type": {
                href: "string",
                protocol: "string",
                auth: "string",
                hostname: "string",
                port: "string",
                host: "string",
                pathname: "string",
                search: "string",
                query: "string",
                slashes: "bool",
                hash: "string"
            },
            "tls.Server.credentials": {
                key: "string",
                cert: "string",
                ca: "string"
            },
            "tls.cipher": {
                name: "string",
                version: "string"
            },
            "crypto.credentials": {
                pfx: "string",
                key: "string",
                passphrase: "string",
                cert: "string",
                ca: "string",
                crl: "string",
                ciphers: "string"
            },
            buffer: {
                Buffer: "Buffer",
                INSPECT_MAX_BYTES: "number",
                SlowBuffer: "Buffer"
            },
            module: {},
            timers: {
                setTimeout: {
                    "!type": "fn(callback: fn(), ms: number) -> timers.Timer",
                    "!url": "http://nodejs.org/api/globals.html#globals_settimeout_cb_ms",
                    "!doc": "Run callback cb after at least ms milliseconds. The actual delay depends on external factors like OS timer granularity and system load."
                },
                clearTimeout: {
                    "!type": "fn(id: timers.Timer)",
                    "!url": "http://nodejs.org/api/globals.html#globals_cleartimeout_t",
                    "!doc": "Stop a timer that was previously created with setTimeout(). The callback will not execute."
                },
                setInterval: {
                    "!type": "fn(callback: fn(), ms: number) -> timers.Timer",
                    "!url": "http://nodejs.org/api/globals.html#globals_setinterval_cb_ms",
                    "!doc": "Run callback cb repeatedly every ms milliseconds. Note that the actual interval may vary, depending on external factors like OS timer granularity and system load. It's never less than ms but it may be longer."
                },
                clearInterval: {
                    "!type": "fn(id: timers.Timer)",
                    "!url": "http://nodejs.org/api/globals.html#globals_clearinterval_t",
                    "!doc": "Stop a timer that was previously created with setInterval(). The callback will not execute."
                },
                setImmediate: {
                    "!type": "fn(callback: fn()) -> timers.Timer",
                    "!url": "http://nodejs.org/api/timers.html#timers_setimmediate_callback_arg",
                    "!doc": "Schedule the 'immediate' execution of callback after I/O events callbacks."
                },
                clearImmediate: {
                    "!type": "fn(id: timers.Timer)",
                    "!url": "http://nodejs.org/api/timers.html#timers_clearimmediate_immediateid",
                    "!doc": "Stops an immediate from triggering."
                },
                Timer: {
                    unref: {
                        "!type": "fn()",
                        "!url": "http://nodejs.org/api/timers.html#timers_unref",
                        "!doc": "Create a timer that is active but if it is the only item left in the event loop won't keep the program running."
                    },
                    ref: {
                        "!type": "fn()",
                        "!url": "http://nodejs.org/api/timers.html#timers_unref",
                        "!doc": "Explicitly request the timer hold the program open (cancel the effect of 'unref')."
                    }
                }
            }
        },
        process: {
            stdout: {
                "!type": "+stream.Writable",
                "!url": "http://nodejs.org/api/process.html#process_process_stdout",
                "!doc": "A Writable Stream to stdout."
            },
            stderr: {
                "!type": "+stream.Writable",
                "!url": "http://nodejs.org/api/process.html#process_process_stderr",
                "!doc": "A writable stream to stderr."
            },
            stdin: {
                "!type": "+stream.Readable",
                "!url": "http://nodejs.org/api/process.html#process_process_stdin",
                "!doc": "A Readable Stream for stdin. The stdin stream is paused by default, so one must call process.stdin.resume() to read from it."
            },
            argv: {
                "!type": "[string]",
                "!url": "http://nodejs.org/api/process.html#process_process_argv",
                "!doc": "An array containing the command line arguments. The first element will be 'node', the second element will be the name of the JavaScript file. The next elements will be any additional command line arguments."
            },
            execPath: {
                "!type": "string",
                "!url": "http://nodejs.org/api/process.html#process_process_execpath",
                "!doc": "This is the absolute pathname of the executable that started the process."
            },
            abort: {
                "!type": "fn()",
                "!url": "http://nodejs.org/api/process.html#process_process_abort",
                "!doc": "This causes node to emit an abort. This will cause node to exit and generate a core file."
            },
            chdir: {
                "!type": "fn(directory: string)",
                "!url": "http://nodejs.org/api/process.html#process_process_chdir_directory",
                "!doc": "Changes the current working directory of the process or throws an exception if that fails."
            },
            cwd: {
                "!type": "fn()",
                "!url": "http://nodejs.org/api/process.html#process_process_cwd",
                "!doc": "Returns the current working directory of the process."
            },
            env: {
                "!url": "http://nodejs.org/api/process.html#process_process_env",
                "!doc": "An object containing the user environment."
            },
            exit: {
                "!type": "fn(code?: number)",
                "!url": "http://nodejs.org/api/process.html#process_process_exit_code",
                "!doc": "Ends the process with the specified code. If omitted, exit uses the 'success' code 0."
            },
            getgid: {
                "!type": "fn() -> number",
                "!url": "http://nodejs.org/api/process.html#process_process_getgid",
                "!doc": "Gets the group identity of the process. This is the numerical group id, not the group name."
            },
            setgid: {
                "!type": "fn(id: number)",
                "!url": "http://nodejs.org/api/process.html#process_process_setgid_id",
                "!doc": "Sets the group identity of the process. This accepts either a numerical ID or a groupname string. If a groupname is specified, this method blocks while resolving it to a numerical ID."
            },
            getuid: {
                "!type": "fn() -> number",
                "!url": "http://nodejs.org/api/process.html#process_process_getuid",
                "!doc": "Gets the user identity of the process. This is the numerical userid, not the username."
            },
            setuid: {
                "!type": "fn(id: number)",
                "!url": "http://nodejs.org/api/process.html#process_process_setuid_id",
                "!doc": "Sets the user identity of the process. This accepts either a numerical ID or a username string. If a username is specified, this method blocks while resolving it to a numerical ID."
            },
            version: {
                "!type": "string",
                "!url": "http://nodejs.org/api/process.html#process_process_version",
                "!doc": "A compiled-in property that exposes NODE_VERSION."
            },
            versions: {
                http_parser: "string",
                node: "string",
                v8: "string",
                ares: "string",
                uv: "string",
                zlib: "string",
                openssl: "string",
                "!url": "http://nodejs.org/api/process.html#process_process_versions",
                "!doc": "A property exposing version strings of node and its dependencies."
            },
            config: {
                target_defaults: {
                    cflags: "[?]",
                    default_configuration: "string",
                    defines: "[string]",
                    include_dirs: "[string]",
                    libraries: "[string]"
                },
                variables: {
                    clang: "number",
                    host_arch: "string",
                    node_install_npm: "bool",
                    node_install_waf: "bool",
                    node_prefix: "string",
                    node_shared_openssl: "bool",
                    node_shared_v8: "bool",
                    node_shared_zlib: "bool",
                    node_use_dtrace: "bool",
                    node_use_etw: "bool",
                    node_use_openssl: "bool",
                    target_arch: "string",
                    v8_no_strict_aliasing: "number",
                    v8_use_snapshot: "bool",
                    visibility: "string"
                },
                "!url": "http://nodejs.org/api/process.html#process_process_config",
                "!doc": "An Object containing the JavaScript representation of the configure options that were used to compile the current node executable. This is the same as the \"config.gypi\" file that was produced when running the ./configure script."
            },
            kill: {
                "!type": "fn(pid: number, signal?: string)",
                "!url": "http://nodejs.org/api/process.html#process_process_kill_pid_signal",
                "!doc": "Send a signal to a process. pid is the process id and signal is the string describing the signal to send. Signal names are strings like 'SIGINT' or 'SIGUSR1'. If omitted, the signal will be 'SIGTERM'."
            },
            pid: {
                "!type": "number",
                "!url": "http://nodejs.org/api/process.html#process_process_pid",
                "!doc": "The PID of the process."
            },
            title: {
                "!type": "string",
                "!url": "http://nodejs.org/api/process.html#process_process_title",
                "!doc": "Getter/setter to set what is displayed in 'ps'."
            },
            arch: {
                "!type": "string",
                "!url": "http://nodejs.org/api/process.html#process_process_arch",
                "!doc": "What processor architecture you're running on: 'arm', 'ia32', or 'x64'."
            },
            platform: {
                "!type": "string",
                "!url": "http://nodejs.org/api/process.html#process_process_platform",
                "!doc": "What platform you're running on: 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'"
            },
            memoryUsage: {
                "!type": "fn() -> process.memoryUsage.type",
                "!url": "http://nodejs.org/api/process.html#process_process_memoryusage",
                "!doc": "Returns an object describing the memory usage of the Node process measured in bytes."
            },
            nextTick: {
                "!type": "fn(callback: fn())",
                "!url": "http://nodejs.org/api/process.html#process_process_nexttick_callback",
                "!doc": "On the next loop around the event loop call this callback. This is not a simple alias to setTimeout(fn, 0), it's much more efficient. It typically runs before any other I/O events fire, but there are some exceptions."
            },
            maxTickDepth: {
                "!type": "number",
                "!url": "http://nodejs.org/api/process.html#process_process_maxtickdepth",
                "!doc": "The maximum depth of nextTick-calling nextTick-callbacks that will be evaluated before allowing other forms of I/O to occur."
            },
            umask: {
                "!type": "fn(mask?: number) -> number",
                "!url": "http://nodejs.org/api/process.html#process_process_umask_mask",
                "!doc": "Sets or reads the process's file mode creation mask. Child processes inherit the mask from the parent process. Returns the old mask if mask argument is given, otherwise returns the current mask."
            },
            uptime: {
                "!type": "fn() -> number",
                "!url": "http://nodejs.org/api/process.html#process_process_uptime",
                "!doc": "Number of seconds Node has been running."
            },
            hrtime: {
                "!type": "fn() -> [number]",
                "!url": "http://nodejs.org/api/process.html#process_process_hrtime",
                "!doc": "Returns the current high-resolution real time in a [seconds, nanoseconds] tuple Array. It is relative to an arbitrary time in the past. It is not related to the time of day and therefore not subject to clock drift. The primary use is for measuring performance between intervals."
            },
            "!url": "http://nodejs.org/api/globals.html#globals_process",
            "!doc": "The process object."
        },
        global: {
            "!type": "<top>",
            "!url": "http://nodejs.org/api/globals.html#globals_global",
            "!doc": "In browsers, the top-level scope is the global scope. That means that in browsers if you're in the global scope var something will define a global variable. In Node this is different. The top-level scope is not the global scope; var something inside a Node module will be local to that module."
        },
        console: {
            log: {
                "!type": "fn(text: string)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_log_data",
                "!doc": "Prints to stdout with newline. This function can take multiple arguments in a printf()-like way."
            },
            info: {
                "!type": "fn(text: string)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_info_data",
                "!doc": "Same as console.log."
            },
            error: {
                "!type": "fn(text: string)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_error_data",
                "!doc": "Same as console.log but prints to stderr."
            },
            warn: {
                "!type": "fn(text: string)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_warn_data",
                "!doc": "Same as console.error."
            },
            dir: {
                "!type": "fn(obj: ?)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_dir_obj",
                "!doc": "Uses util.inspect on obj and prints resulting string to stdout."
            },
            time: {
                "!type": "fn(label: string)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_time_label",
                "!doc": "Mark a time."
            },
            timeEnd: {
                "!type": "fn(label: string)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_timeend_label",
                "!doc": "Finish timer, record output."
            },
            trace: {
                "!type": "fn(label: string)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_trace_label",
                "!doc": "Print a stack trace to stderr of the current position."
            },
            assert: {
                "!type": "fn(expression: bool)",
                "!url": "http://nodejs.org/api/stdio.html#stdio_console_assert_expression_message",
                "!doc": "Same as assert.ok() where if the expression evaluates as false throw an AssertionError with message."
            },
            "!url": "http://nodejs.org/api/globals.html#globals_console",
            "!doc": "Used to print to stdout and stderr."
        },
        __filename: {
            "!type": "string",
            "!url": "http://nodejs.org/api/globals.html#globals_filename",
            "!doc": "The filename of the code being executed. This is the resolved absolute path of this code file. For a main program this is not necessarily the same filename used in the command line. The value inside a module is the path to that module file."
        },
        __dirname: {
            "!type": "string",
            "!url": "http://nodejs.org/api/globals.html#globals_dirname",
            "!doc": "The name of the directory that the currently executing script resides in."
        },
        setTimeout: "timers.setTimeout",
        clearTimeout: "timers.clearTimeout",
        setInterval: "timers.setInterval",
        clearInterval: "timers.clearInterval",
        module: {
            "!type": "+Module",
            "!url": "http://nodejs.org/api/globals.html#globals_module",
            "!doc": "A reference to the current module. In particular module.exports is the same as the exports object. module isn't actually a global but rather local to each module."
        },
        Buffer: {
            "!type": "fn(str: string, encoding?: string) -> +Buffer",
            prototype: {
                "!proto": "String.prototype",
                write: "fn(string: string, offset?: number, length?: number, encoding?: string) -> number",
                toString: "fn(encoding?: string, start?: number, end?: number) -> string",
                length: "number",
                copy: "fn(targetBuffer: +Buffer, targetStart?: number, sourceStart?: number, sourceEnd?: number)",
                slice: "fn(start?: number, end?: number) -> +Buffer",
                readUInt8: "fn(offset: number, noAssert?: bool) -> number",
                readUInt16LE: "fn(offset: number, noAssert?: bool) -> number",
                readUInt16BE: "fn(offset: number, noAssert?: bool) -> number",
                readUInt32LE: "fn(offset: number, noAssert?: bool) -> number",
                readUInt32BE: "fn(offset: number, noAssert?: bool) -> number",
                readInt8: "fn(offset: number, noAssert?: bool) -> number",
                readInt16LE: "fn(offset: number, noAssert?: bool) -> number",
                readInt16BE: "fn(offset: number, noAssert?: bool) -> number",
                readInt32LE: "fn(offset: number, noAssert?: bool) -> number",
                readInt32BE: "fn(offset: number, noAssert?: bool) -> number",
                readFloatLE: "fn(offset: number, noAssert?: bool) -> number",
                readFloatBE: "fn(offset: number, noAssert?: bool) -> number",
                readDoubleLE: "fn(offset: number, noAssert?: bool) -> number",
                readDoubleBE: "fn(offset: number, noAssert?: bool) -> number",
                writeUInt8: "fn(value: number, offset: number, noAssert?: bool)",
                writeUInt16LE: "fn(value: number, offset: number, noAssert?: bool)",
                writeUInt16BE: "fn(value: number, offset: number, noAssert?: bool)",
                writeUInt32LE: "fn(value: number, offset: number, noAssert?: bool)",
                writeUInt32BE: "fn(value: number, offset: number, noAssert?: bool)",
                writeInt8: "fn(value: number, offset: number, noAssert?: bool)",
                writeInt16LE: "fn(value: number, offset: number, noAssert?: bool)",
                writeInt16BE: "fn(value: number, offset: number, noAssert?: bool)",
                writeInt32LE: "fn(value: number, offset: number, noAssert?: bool)",
                writeInt32BE: "fn(value: number, offset: number, noAssert?: bool)",
                writeFloatLE: "fn(value: number, offset: number, noAssert?: bool)",
                writeFloatBE: "fn(value: number, offset: number, noAssert?: bool)",
                writeDoubleLE: "fn(value: number, offset: number, noAssert?: bool)",
                writeDoubleBE: "fn(value: number, offset: number, noAssert?: bool)",
                fill: "fn(value: ?, offset?: number, end?: number)"
            },
            isBuffer: "fn(obj: ?) -> bool",
            byteLength: "fn(string: string, encoding?: string) -> number",
            concat: "fn(list: [+Buffer], totalLength?: number) -> +Buffer",
            "!url": "http://nodejs.org/api/globals.html#globals_class_buffer",
            "!doc": "Used to handle binary data."
        }
    };
});

//#endregion


//#region tern/plugin/doc_comment.js

// Parses comments above variable declarations, function declarations,
// and object properties as docstrings and JSDoc-style type
// annotations.

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"), require("../lib/comment"),
    require("acorn"), require("acorn/dist/walk"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern", "../lib/comment", "acorn/dist/acorn", "acorn/dist/walk"], mod);
    mod(tern, tern, tern.comment, acorn, acorn.walk);
})(function(infer, tern, comment, acorn, walk) {
    "use strict";

    var WG_MADEUP = 1,
        WG_STRONG = 101;

    tern.registerPlugin("doc_comment", function(server, options) {
        server.jsdocTypedefs = Object.create(null);
        server.on("reset", function() {
            server.jsdocTypedefs = Object.create(null);
        });
        server._docComment = {
            weight: options && options.strong ? WG_STRONG : undefined,
            fullDocs: options && options.fullDocs
        };

        return {
            passes: {
                postParse: postParse,
                postInfer: postInfer,
                postLoadDef: postLoadDef
            }
        };
    });

    function postParse(ast, text) {
        function attachComments(node) {
            comment.ensureCommentsBefore(text, node);
        }

        walk.simple(ast, {
            VariableDeclaration: attachComments,
            FunctionDeclaration: attachComments,
            AssignmentExpression: function(node) {
                if (node.operator == "=") attachComments(node);
            },
            ObjectExpression: function(node) {
                for (var i = 0; i < node.properties.length; ++i)
                attachComments(node.properties[i]);
            },
            CallExpression: function(node) {
                if (isDefinePropertyCall(node)) attachComments(node);
            }
        });
    }

    function isDefinePropertyCall(node) {
        return node.callee.type == "MemberExpression" && node.callee.object.name == "Object" && node.callee.property.name == "defineProperty" && node.arguments.length >= 3 && typeof node.arguments[1].value == "string";
    }

    function postInfer(ast, scope) {
        jsdocParseTypedefs(ast.sourceFile.text, scope);

        walk.simple(ast, {
            VariableDeclaration: function(node, scope) {
                if (node.commentsBefore) interpretComments(node, node.commentsBefore, scope,
                scope.getProp(node.declarations[0].id.name));
            },
            FunctionDeclaration: function(node, scope) {
                if (node.commentsBefore) interpretComments(node, node.commentsBefore, scope,
                scope.getProp(node.id.name),
                node.body.scope.fnType);
            },
            AssignmentExpression: function(node, scope) {
                if (node.commentsBefore) interpretComments(node, node.commentsBefore, scope,
                infer.expressionType({
                    node: node.left,
                    state: scope
                }));
            },
            ObjectExpression: function(node, scope) {
                for (var i = 0; i < node.properties.length; ++i) {
                    var prop = node.properties[i];
                    if (prop.commentsBefore) interpretComments(prop, prop.commentsBefore, scope,
                    node.objType.getProp(prop.key.name));
                }
            },
            CallExpression: function(node, scope) {
                if (node.commentsBefore && isDefinePropertyCall(node)) {
                    var type = infer.expressionType({
                        node: node.arguments[0],
                        state: scope
                    }).getObjType();
                    if (type && type instanceof infer.Obj) {
                        var prop = type.props[node.arguments[1].value];
                        if (prop) interpretComments(node, node.commentsBefore, scope, prop);
                    }
                }
            }
        }, infer.searchVisitor, scope);
    }

    function postLoadDef(data) {
        var defs = data["!typedef"];
        var cx = infer.cx(),
            orig = data["!name"];
        if (defs) for (var name in defs)
        cx.parent.jsdocTypedefs[name] = maybeInstance(infer.def.parse(defs[name], orig, name), name);
    }

    // COMMENT INTERPRETATION

    function interpretComments(node, comments, scope, aval, type) {
        jsdocInterpretComments(node, scope, aval, comments);
        var cx = infer.cx();

        if (!type && aval instanceof infer.AVal && aval.types.length) {
            type = aval.types[aval.types.length - 1];
            if (!(type instanceof infer.Obj) || type.origin != cx.curOrigin || type.doc) type = null;
        }

        var result = comments[comments.length - 1];
        if (cx.parent._docComment.fullDocs) {
            result = result.trim().replace(/\n[ \t]*\* ?/g, "\n");
        }
        else {
            var dot = result.search(/\.\s/);
            if (dot > 5) result = result.slice(0, dot + 1);
            result = result.trim().replace(/\s*\n\s*\*\s*|\s{1,}/g, " ");
        }
        result = result.replace(/^\s*\*+\s*/, "");

        if (aval instanceof infer.AVal) aval.doc = result;
        if (type) type.doc = result;
    }

    // Parses a subset of JSDoc-style comments in order to include the
    // explicitly defined types in the analysis.

    function skipSpace(str, pos) {
        while (/\s/.test(str.charAt(pos)))++pos;
        return pos;
    }

    function isIdentifier(string) {
        if (!acorn.isIdentifierStart(string.charCodeAt(0))) return false;
        for (var i = 1; i < string.length; i++)
        if (!acorn.isIdentifierChar(string.charCodeAt(i))) return false;
        return true;
    }

    function parseLabelList(scope, str, pos, close) {
        var labels = [],
            types = [],
            madeUp = false;
        for (var first = true;; first = false) {
            pos = skipSpace(str, pos);
            if (first && str.charAt(pos) == close) break;
            var colon = str.indexOf(":", pos);
            if (colon < 0) return null;
            var label = str.slice(pos, colon);
            if (!isIdentifier(label)) return null;
            labels.push(label);
            pos = colon + 1;
            var type = parseType(scope, str, pos);
            if (!type) return null;
            pos = type.end;
            madeUp = madeUp || type.madeUp;
            types.push(type.type);
            pos = skipSpace(str, pos);
            var next = str.charAt(pos);
            ++pos;
            if (next == close) break;
            if (next != ",") return null;
        }
        return {
            labels: labels,
            types: types,
            end: pos,
            madeUp: madeUp
        };
    }

    function parseType(scope, str, pos) {
        var type, union = false,
            madeUp = false;
        for (;;) {
            var inner = parseTypeInner(scope, str, pos);
            if (!inner) return null;
            madeUp = madeUp || inner.madeUp;
            if (union) inner.type.propagate(union);
            else type = inner.type;
            pos = skipSpace(str, inner.end);
            if (str.charAt(pos) != "|") break;
            pos++;
            if (!union) {
                union = new infer.AVal;
                type.propagate(union);
                type = union;
            }
        }
        var isOptional = false;
        if (str.charAt(pos) == "=") {
            ++pos;
            isOptional = true;
        }
        return {
            type: type,
            end: pos,
            isOptional: isOptional,
            madeUp: madeUp
        };
    }

    function parseTypeInner(scope, str, pos) {
        pos = skipSpace(str, pos);
        var type, madeUp = false;

        if (str.indexOf("function(", pos) == pos) {
            var args = parseLabelList(scope, str, pos + 9, ")"),
                ret = infer.ANull;
            if (!args) return null;
            pos = skipSpace(str, args.end);
            if (str.charAt(pos) == ":") {
                ++pos;
                var retType = parseType(scope, str, pos + 1);
                if (!retType) return null;
                pos = retType.end;
                ret = retType.type;
                madeUp = retType.madeUp;
            }
            type = new infer.Fn(null, infer.ANull, args.types, args.labels, ret);
        }
        else if (str.charAt(pos) == "[") {
            var inner = parseType(scope, str, pos + 1);
            if (!inner) return null;
            pos = skipSpace(str, inner.end);
            madeUp = inner.madeUp;
            if (str.charAt(pos) != "]") return null;
            ++pos;
            type = new infer.Arr(inner.type);
        }
        else if (str.charAt(pos) == "{") {
            var fields = parseLabelList(scope, str, pos + 1, "}");
            if (!fields) return null;
            type = new infer.Obj(true);
            for (var i = 0; i < fields.types.length; ++i) {
                var field = type.defProp(fields.labels[i]);
                field.initializer = true;
                fields.types[i].propagate(field);
            }
            pos = fields.end;
            madeUp = fields.madeUp;
        }
        else if (str.charAt(pos) == "(") {
            var inner = parseType(scope, str, pos + 1);
            if (!inner) return null;
            pos = skipSpace(str, inner.end);
            if (str.charAt(pos) != ")") return null;
            ++pos;
            type = inner.type;
        }
        else {
            var start = pos;
            if (!acorn.isIdentifierStart(str.charCodeAt(pos))) return null;
            while (acorn.isIdentifierChar(str.charCodeAt(pos)))++pos;
            if (start == pos) return null;
            var word = str.slice(start, pos);
            if (/^(number|integer)$/i.test(word)) type = infer.cx().num;
            else if (/^bool(ean)?$/i.test(word)) type = infer.cx().bool;
            else if (/^string$/i.test(word)) type = infer.cx().str;
            else if (/^(null|undefined)$/i.test(word)) type = infer.ANull;
            else if (/^array$/i.test(word)) {
                var inner = null;
                if (str.charAt(pos) == "." && str.charAt(pos + 1) == "<") {
                    var inAngles = parseType(scope, str, pos + 2);
                    if (!inAngles) return null;
                    pos = skipSpace(str, inAngles.end);
                    madeUp = inAngles.madeUp;
                    if (str.charAt(pos++) != ">") return null;
                    inner = inAngles.type;
                }
                type = new infer.Arr(inner);
            }
            else if (/^object$/i.test(word)) {
                type = new infer.Obj(true);
                if (str.charAt(pos) == "." && str.charAt(pos + 1) == "<") {
                    var key = parseType(scope, str, pos + 2);
                    if (!key) return null;
                    pos = skipSpace(str, key.end);
                    madeUp = madeUp || key.madeUp;
                    if (str.charAt(pos++) != ",") return null;
                    var val = parseType(scope, str, pos);
                    if (!val) return null;
                    pos = skipSpace(str, val.end);
                    madeUp = key.madeUp || val.madeUp;
                    if (str.charAt(pos++) != ">") return null;
                    val.type.propagate(type.defProp("<i>"));
                }
            }
            else {
                while (str.charCodeAt(pos) == 46 || acorn.isIdentifierChar(str.charCodeAt(pos)))++pos;
                var path = str.slice(start, pos);
                var cx = infer.cx(),
                    defs = cx.parent && cx.parent.jsdocTypedefs,
                    found;
                if (defs && (path in defs)) {
                    type = defs[path];
                }
                else if (found = infer.def.parsePath(path, scope).getObjType()) {
                    type = maybeInstance(found, path);
                }
                else {
                    if (!cx.jsdocPlaceholders) cx.jsdocPlaceholders = Object.create(null);
                    if (!(path in cx.jsdocPlaceholders)) type = cx.jsdocPlaceholders[path] = new infer.Obj(null, path);
                    else type = cx.jsdocPlaceholders[path];
                    madeUp = true;
                }
            }
        }

        return {
            type: type,
            end: pos,
            madeUp: madeUp
        };
    }

    function maybeInstance(type, path) {
        if (type instanceof infer.Fn && /^[A-Z]/.test(path)) {
            var proto = type.getProp("prototype").getObjType();
            if (proto instanceof infer.Obj) return infer.getInstance(proto);
        }
        return type;
    }

    function parseTypeOuter(scope, str, pos) {
        pos = skipSpace(str, pos || 0);
        if (str.charAt(pos) != "{") return null;
        var result = parseType(scope, str, pos + 1);
        if (!result) return null;
        var end = skipSpace(str, result.end);
        if (str.charAt(end) != "}") return null;
        result.end = end + 1;
        return result;
    }

    function jsdocInterpretComments(node, scope, aval, comments) {
        var type, args, ret, foundOne, self, parsed;

        for (var i = 0; i < comments.length; ++i) {
            var comment = comments[i];
            var decl = /(?:\n|$|\*)\s*@(type|param|arg(?:ument)?|returns?|this)\s+(.*)/g,
                m;
            while (m = decl.exec(comment)) {
                if (m[1] == "this" && (parsed = parseType(scope, m[2], 0))) {
                    self = parsed;
                    foundOne = true;
                    continue;
                }

                if (!(parsed = parseTypeOuter(scope, m[2]))) continue;
                foundOne = true;

                switch (m[1]) {
                case "returns":
                case "return":
                    ret = parsed;
                    break;
                case "type":
                    type = parsed;
                    break;
                case "param":
                case "arg":
                case "argument":
                    var name = m[2].slice(parsed.end).match(/^\s*(\[?)\s*([^\]\s=]+)\s*(?:=[^\]]+\s*)?(\]?).*/);
                    if (!name) continue;
                    var argname = name[2] + (parsed.isOptional || (name[1] === '[' && name[3] === ']') ? "?" : "");
                    (args || (args = Object.create(null)))[argname] = parsed;
                    break;
                }
            }
        }

        if (foundOne) applyType(type, self, args, ret, node, aval);
    };

    function jsdocParseTypedefs(text, scope) {
        var cx = infer.cx();

        var re = /\s@typedef\s+(.*)/g,
            m;
        while (m = re.exec(text)) {
            var parsed = parseTypeOuter(scope, m[1]);
            var name = parsed && m[1].slice(parsed.end).match(/^\s*(\S+)/);
            if (name) cx.parent.jsdocTypedefs[name[1]] = parsed.type;
        }
    }

    function propagateWithWeight(type, target) {
        var weight = infer.cx().parent._docComment.weight;
        type.type.propagate(target, weight || (type.madeUp ? WG_MADEUP : undefined));
    }

    function applyType(type, self, args, ret, node, aval) {
        var fn;
        if (node.type == "VariableDeclaration") {
            var decl = node.declarations[0];
            if (decl.init && decl.init.type == "FunctionExpression") fn = decl.init.body.scope.fnType;
        }
        else if (node.type == "FunctionDeclaration") {
            fn = node.body.scope.fnType;
        }
        else if (node.type == "AssignmentExpression") {
            if (node.right.type == "FunctionExpression") fn = node.right.body.scope.fnType;
        }
        else if (node.type == "CallExpression") {}
        else { // An object property
            if (node.value.type == "FunctionExpression") fn = node.value.body.scope.fnType;
        }

        if (fn && (args || ret || self)) {
            if (args) for (var i = 0; i < fn.argNames.length; ++i) {
                var name = fn.argNames[i],
                    known = args[name];
                if (!known && (known = args[name + "?"])) fn.argNames[i] += "?";
                if (known) propagateWithWeight(known, fn.args[i]);
            }
            if (ret) propagateWithWeight(ret, fn.retval);
            if (self) propagateWithWeight(self, fn.self);
        }
        else if (type) {
            propagateWithWeight(type, aval);
        }
    };
});

//#endregion


//#region tern/plugin/complete_strings.js

// When enabled, this plugin will gather (short) strings in your code,
// and completing when inside a string will try to complete to
// previously seen strings. Takes a single option, maxLength, which
// controls the maximum length of string values to gather, and
// defaults to 15.

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"), require("acorn/dist/walk"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern", "acorn/dist/walk"], mod);
    mod(tern, tern, acorn.walk);
})(function(infer, tern, walk) {
    "use strict";

    tern.registerPlugin("complete_strings", function(server, options) {
        server._completeStrings = {
            maxLen: options && options.maxLength || 15,
            seen: Object.create(null)
        };
        server.on("reset", function() {
            server._completeStrings.seen = Object.create(null);
        });
        return {
            passes: {
                postParse: postParse,
                completion: complete
            }
        };
    });

    function postParse(ast) {
        var data = infer.cx().parent._completeStrings;
        walk.simple(ast, {
            Literal: function(node) {
                if (typeof node.value == "string" && node.value && node.value.length < data.maxLen) data.seen[node.value] = ast.sourceFile.name;
            }
        });
    }

    function complete(file, query) {
        var pos = tern.resolvePos(file, query.end);
        var lit = infer.findExpressionAround(file.ast, null, pos, file.scope, "Literal");
        if (!lit || typeof lit.node.value != "string") return;
        var before = lit.node.value.slice(0, pos - lit.node.start - 1);
        var matches = [],
            seen = infer.cx().parent._completeStrings.seen;
        for (var str in seen) if (str.length > before.length && str.indexOf(before) == 0) {
            if (query.types || query.docs || query.urls || query.origins) {
                var rec = {
                    name: JSON.stringify(str),
                    displayName: str
                };
                matches.push(rec);
                if (query.types) rec.type = "string";
                if (query.origins) rec.origin = seen[str];
            }
            else {
                matches.push(JSON.stringify(str));
            }
        }
        if (matches.length) return {
            start: tern.outputPos(query, file, lit.node.start),
            end: tern.outputPos(query, file, pos + (file.text.charAt(pos) == file.text.charAt(lit.node.start) ? 1 : 0)),
            isProperty: false,
            completions: matches
        };
    }
});

//#endregion


//#region tern/plugin/angular.js

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"), require("../lib/comment"),
    require("acorn/dist/walk"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern", "../lib/comment", "acorn/dist/walk"], mod);
    mod(tern, tern, tern.comment, acorn.walk);
})(function(infer, tern, comment, walk) {
    "use strict";

    var SetDoc = infer.constraint("doc", {
        addType: function(type) {
            if (!type.doc) type.doc = this.doc;
        }
    });

    function Injector() {
        this.fields = Object.create(null);
        this.forward = [];
    }

    Injector.prototype.get = function(name) {
        if (name == "$scope") return new infer.Obj(globalInclude("$rootScope").getType(), "$scope");
        if (name in this.fields) return this.fields[name];
        var field = this.fields[name] = new infer.AVal;
        return field;
    };
    Injector.prototype.set = function(name, val, doc, node, depth) {
        if (name == "$scope" || depth && depth > 10) return;
        var field = this.fields[name] || (this.fields[name] = new infer.AVal);
        if (!depth) field.local = true;
        if (!field.origin) field.origin = infer.cx().curOrigin;
        if (typeof node == "string" && !field.span) field.span = node;
        else if (node && typeof node == "object" && !field.originNode) field.originNode = node;
        if (doc) {
            field.doc = doc;
            field.propagate(new SetDoc(doc));
        }
        val.propagate(field);
        for (var i = 0; i < this.forward.length; ++i)
        this.forward[i].set(name, val, doc, node, (depth || 0) + 1);
    };
    Injector.prototype.forwardTo = function(injector) {
        this.forward.push(injector);
        for (var field in this.fields) {
            var val = this.fields[field];
            injector.set(field, val, val.doc, val.span || val.originNode, 1);
        }
    };

    function globalInclude(name) {
        var service = infer.cx().definitions.angular.service;
        if (service.hasProp(name)) return service.getProp(name);
    }

    function getInclude(mod, name) {
        var glob = globalInclude(name);
        if (glob) return glob;
        if (!mod.injector) return infer.ANull;
        return mod.injector ? mod.injector.get(name) : infer.ANull;
    }

    function applyWithInjection(mod, fnType, node, asNew) {
        var deps = [];
        if (node.type == "FunctionExpression") {
            for (var i = 0; i < node.params.length; ++i)
            deps.push(getInclude(mod, node.params[i].name));
        }
        else if (node.type == "ArrayExpression") {
            for (var i = 0; i < node.elements.length - 1; ++i) {
                var elt = node.elements[i];
                if (elt.type == "Literal" && typeof elt.value == "string") deps.push(getInclude(mod, elt.value));
                else deps.push(infer.ANull);
            }
            var last = node.elements[node.elements.length - 1];
            if (last && last.type == "FunctionExpression") fnType = last.body.scope.fnType;
        }
        var result = new infer.AVal;
        if (asNew) {
            var self = new infer.AVal;
            fnType.propagate(new infer.IsCtor(self));
            self.propagate(result, 90);
            fnType.propagate(new infer.IsCallee(self, deps, null, new infer.IfObj(result)));
        }
        else {
            fnType.propagate(new infer.IsCallee(infer.cx().topScope, deps, null, result));
        }
        return result;
    }

    infer.registerFunction("angular_callInject", function(argN) {
        return function(self, args, argNodes) {
            var mod = self.getType();
            if (mod && argNodes && argNodes[argN]) applyWithInjection(mod, args[argN], argNodes[argN]);
        };
    });

    infer.registerFunction("angular_regFieldCall", function(self, args, argNodes) {
        var mod = self.getType();
        if (mod && argNodes && argNodes.length > 1) {
            var result = applyWithInjection(mod, args[1], argNodes[1]);
            if (mod.injector && argNodes[0].type == "Literal") mod.injector.set(argNodes[0].value, result, argNodes[0].angularDoc, argNodes[0]);
        }
    });

    infer.registerFunction("angular_regFieldNew", function(self, args, argNodes) {
        var mod = self.getType();
        if (mod && argNodes && argNodes.length > 1) {
            var result = applyWithInjection(mod, args[1], argNodes[1], true);
            if (mod.injector && argNodes[0].type == "Literal") mod.injector.set(argNodes[0].value, result, argNodes[0].angularDoc, argNodes[0]);
        }
    });

    infer.registerFunction("angular_regField", function(self, args, argNodes) {
        var mod = self.getType();
        if (mod && mod.injector && argNodes && argNodes[0] && argNodes[0].type == "Literal" && args[1]) mod.injector.set(argNodes[0].value, args[1], argNodes[0].angularDoc, argNodes[0]);
    });

    function arrayNodeToStrings(node) {
        var strings = [];
        if (node && node.type == "ArrayExpression") for (var i = 0; i < node.elements.length; ++i) {
            var elt = node.elements[i];
            if (elt.type == "Literal" && typeof elt.value == "string") strings.push(elt.value);
        }
        return strings;
    }

    function moduleProto(cx) {
        var ngDefs = cx.definitions.angular;
        return ngDefs && ngDefs.Module.getProp("prototype").getType();
    }

    function declareMod(name, includes) {
        var cx = infer.cx(),
            data = cx.parent._angular;
        var proto = moduleProto(cx);
        var mod = new infer.Obj(proto || true);
        if (!proto) data.nakedModules.push(mod);
        mod.origin = cx.curOrigin;
        mod.injector = new Injector();
        mod.metaData = {
            includes: includes
        };
        for (var i = 0; i < includes.length; ++i) {
            var depMod = data.modules[includes[i]];
            if (!depMod)
            (data.pendingImports[includes[i]] || (data.pendingImports[includes[i]] = [])).push(mod.injector);
            else if (depMod.injector) depMod.injector.forwardTo(mod.injector);
        }
        if (typeof name == "string") {
            data.modules[name] = mod;
            var pending = data.pendingImports[name];
            if (pending) {
                delete data.pendingImports[name];
                for (var i = 0; i < pending.length; ++i)
                mod.injector.forwardTo(pending[i]);
            }
        }
        return mod;
    }

    infer.registerFunction("angular_module", function(_self, _args, argNodes) {
        var mod, name = argNodes && argNodes[0] && argNodes[0].type == "Literal" && argNodes[0].value;
        if (typeof name == "string") mod = infer.cx().parent._angular.modules[name];
        if (!mod) mod = declareMod(name, arrayNodeToStrings(argNodes && argNodes[1]));
        return mod;
    });

    var IsBound = infer.constraint("self, args, target", {
        addType: function(tp) {
            if (!(tp instanceof infer.Fn)) return;
            this.target.addType(new infer.Fn(tp.name, tp.self, tp.args.slice(this.args.length),
            tp.argNames.slice(this.args.length), tp.retval));
            this.self.propagate(tp.self);
            for (var i = 0; i < Math.min(tp.args.length, this.args.length); ++i)
            this.args[i].propagate(tp.args[i]);
        }
    });

    infer.registerFunction("angular_bind", function(_self, args) {
        if (args.length < 2) return infer.ANull;
        var result = new infer.AVal;
        args[1].propagate(new IsBound(args[0], args.slice(2), result));
        return result;
    });

    function postParse(ast, text) {
        walk.simple(ast, {
            CallExpression: function(node) {
                if (node.callee.type == "MemberExpression" && !node.callee.computed && node.arguments.length && /^(value|constant|controller|factory|provider)$/.test(node.callee.property.name)) {
                    var before = comment.commentsBefore(text, node.callee.property.start - 1);
                    if (before) {
                        var first = before[0],
                            dot = first.search(/\.\s/);
                        if (dot > 5) first = first.slice(0, dot + 1);
                        first = first.trim().replace(/\s*\n\s*\*\s*|\s{1,}/g, " ");
                        node.arguments[0].angularDoc = first;
                    }
                }
            }
        });
    }

    function postLoadDef(json) {
        var cx = infer.cx(),
            defName = json["!name"],
            defs = cx.definitions[defName];
        if (defName == "angular") {
            var proto = moduleProto(cx),
                naked = cx.parent._angular.nakedModules;
            if (proto) for (var i = 0; i < naked.length; ++i) naked[i].proto = proto;
            return;
        }
        var mods = defs && defs["!ng"];
        if (mods) for (var name in mods.props) {
            var obj = mods.props[name].getType();
            var mod = declareMod(name.replace(/`/g, "."), obj.metaData && obj.metaData.includes || []);
            mod.origin = defName;
            for (var prop in obj.props) {
                var val = obj.props[prop],
                    tp = val.getType();
                if (!tp) continue;
                if (/^_inject_/.test(prop)) {
                    if (!tp.name) tp.name = prop.slice(8);
                    mod.injector.set(prop.slice(8), tp, val.doc, val.span);
                }
                else {
                    obj.props[prop].propagate(mod.defProp(prop));
                }
            }
        }
    }

    function preCondenseReach(state) {
        var mods = infer.cx().parent._angular.modules;
        var modObj = new infer.Obj(null),
            found = 0;
        for (var name in mods) {
            var mod = mods[name];
            if (state.origins.indexOf(mod.origin) > -1) {
                var propName = name.replace(/\./g, "`");
                modObj.defProp(propName).addType(mod);
                mod.condenseForceInclude = true;
                ++found;
                if (mod.injector) for (var inj in mod.injector.fields) {
                    var field = mod.injector.fields[inj];
                    if (field.local) state.roots["!ng." + propName + "._inject_" + inj] = field;
                }
            }
        }
        if (found) state.roots["!ng"] = modObj;
    }

    function postCondenseReach(state) {
        var mods = infer.cx().parent._angular.modules;
        for (var path in state.types) {
            var m;
            if (m = path.match(/^!ng\.([^\.]+)\._inject_([^\.]+)^/)) {
                var mod = mods[m[1].replace(/`/g, ".")];
                var field = mod.injector.fields[m[2]];
                var data = state.types[path];
                if (field.span) data.span = field.span;
                if (field.doc) data.doc = field.doc;
            }
        }
    }

    function initServer(server) {
        server._angular = {
            modules: Object.create(null),
            pendingImports: Object.create(null),
            nakedModules: []
        };
    }

    tern.registerPlugin("angular", function(server) {
        initServer(server);
        server.on("reset", function() {
            initServer(server);
        });
        return {
            defs: defs,
            passes: {
                postParse: postParse,
                postLoadDef: postLoadDef,
                preCondenseReach: preCondenseReach,
                postCondenseReach: postCondenseReach
            },
            loadFirst: true
        };
    });

    var defs = {
        "!name": "angular",
        "!define": {
            cacheObj: {
                info: "fn() -> ?",
                put: "fn(key: string, value: ?) -> !1",
                get: "fn(key: string) -> ?",
                remove: "fn(key: string)",
                removeAll: "fn()",
                destroy: "fn()"
            },
            eventObj: {
                targetScope: "service.$rootScope",
                currentScope: "service.$rootScope",
                name: "string",
                stopPropagation: "fn()",
                preventDefault: "fn()",
                defaultPrevented: "bool"
            },
            directiveObj: {
                multiElement: {
                    "!type": "bool",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-multielement-",
                    "!doc": "When this property is set to true, the HTML compiler will collect DOM nodes between nodes with the attributes directive-name-start and directive-name-end, and group them together as the directive elements. It is recommended that this feature be used on directives which are not strictly behavioural (such as ngClick), and which do not manipulate or replace child nodes (such as ngInclude)."
                },
                priority: {
                    "!type": "number",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-priority-",
                    "!doc": "When there are multiple directives defined on a single DOM element, sometimes it is necessary to specify the order in which the directives are applied. The priority is used to sort the directives before their compile functions get called. Priority is defined as a number. Directives with greater numerical priority are compiled first. Pre-link functions are also run in priority order, but post-link functions are run in reverse order. The order of directives with the same priority is undefined. The default priority is 0."
                },
                terminal: {
                    "!type": "bool",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-terminal-",
                    "!doc": "If set to true then the current priority will be the last set of directives which will execute (any directives at the current priority will still execute as the order of execution on same priority is undefined). Note that expressions and other directives used in the directive's template will also be excluded from execution."
                },
                scope: {
                    "!type": "?",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-scope-",
                    "!doc": "If set to true, then a new scope will be created for this directive. If multiple directives on the same element request a new scope, only one new scope is created. The new scope rule does not apply for the root of the template since the root of the template always gets a new scope. If set to {} (object hash), then a new 'isolate' scope is created. The 'isolate' scope differs from normal scope in that it does not prototypically inherit from the parent scope. This is useful when creating reusable components, which should not accidentally read or modify data in the parent scope."
                },
                bindToController: {
                    "!type": "bool",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-bindtocontroller-",
                    "!doc": "When an isolate scope is used for a component (see above), and controllerAs is used, bindToController: true will allow a component to have its properties bound to the controller, rather than to scope. When the controller is instantiated, the initial values of the isolate scope bindings are already available."
                },
                controller: {
                    "!type": "fn()",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-require-",
                    "!doc": "Controller constructor function. The controller is instantiated before the pre-linking phase and it is shared with other directives (see require attribute). This allows the directives to communicate with each other and augment each other's behavior."
                },
                require: {
                    "!type": "string",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-controller-",
                    "!doc": "Require another directive and inject its controller as the fourth argument to the linking function. The require takes a string name (or array of strings) of the directive(s) to pass in. If an array is used, the injected argument will be an array in corresponding order. If no such directive can be found, or if the directive does not have a controller, then an error is raised."
                },
                controllerAs: {
                    "!type": "string",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-controlleras-",
                    "!doc": "Controller alias at the directive scope. An alias for the controller so it can be referenced at the directive template. The directive needs to define a scope for this configuration to be used. Useful in the case when directive is used as component."
                },
                restrict: {
                    "!type": "string",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-restrict-",
                    "!doc": "String of subset of EACM which restricts the directive to a specific directive declaration style. If omitted, the defaults (elements and attributes) are used. E - Element name (default): <my-directive></my-directive>. A - Attribute (default): <div my-directive='exp'></div>. C - Class: <div class='my-directive: exp;'></div>. M - Comment: <!-- directive: my-directive exp --> "
                },
                templateNamespace: {
                    "!type": "string",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-templatenamespace-",
                    "!doc": "String representing the document type used by the markup in the template. AngularJS needs this information as those elements need to be created and cloned in a special way when they are defined outside their usual containers like <svg> and <math>."
                },
                template: {
                    "!type": "string",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-template-",
                    "!doc": "HTML markup that may: Replace the contents of the directive's element (default). Replace the directive's element itself (if replace is true - DEPRECATED). Wrap the contents of the directive's element (if transclude is true)."
                },
                templateUrl: {
                    "!type": "string",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-templateurl-",
                    "!doc": "This is similar to template but the template is loaded from the specified URL, asynchronously."
                },
                transclude: {
                    "!type": "bool",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-transclude-",
                    "!doc": "Extract the contents of the element where the directive appears and make it available to the directive. The contents are compiled and provided to the directive as a transclusion function."
                },
                compile: {
                    "!type": "fn(tElement: +Element, tAttrs: +Attr)",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-transclude-",
                    "!doc": "The compile function deals with transforming the template DOM. Since most directives do not do template transformation, it is not used often."
                },
                link: {
                    "!type": "fn(scope: ?, iElement: +Element, iAttrs: +Attr, controller: ?, transcludeFn: fn())",
                    "!url": "https://docs.angularjs.org/api/ng/service/$compile#-link-",
                    "!doc": "The link function is responsible for registering DOM listeners as well as updating the DOM. It is executed after the template has been cloned. This is where most of the directive logic will be put."
                }
            },
            Module: {
                "!url": "http://docs.angularjs.org/api/angular.Module",
                "!doc": "Interface for configuring angular modules.",
                prototype: {
                    animation: {
                        "!type": "fn(name: string, animationFactory: fn()) -> !this",
                        "!url": "http://docs.angularjs.org/api/angular.Module#animation",
                        "!doc": "Defines an animation hook that can be later used with $animate service and directives that use this service."
                    },
                    config: {
                        "!type": "fn(configFn: fn()) -> !this",
                        "!effects": ["custom angular_callInject 0"],
                        "!url": "http://docs.angularjs.org/api/angular.Module#config",
                        "!doc": "Use this method to register work which needs to be performed on module loading."
                    },
                    constant: "service.$provide.constant",
                    controller: {
                        "!type": "fn(name: string, constructor: fn()) -> !this",
                        "!effects": ["custom angular_regFieldCall"],
                        "!url": "http://docs.angularjs.org/api/ng.$controllerProvider",
                        "!doc": "Register a controller."
                    },
                    directive: {
                        "!type": "fn(name: string, directiveFactory: fn() -> directiveObj) -> !this",
                        "!effects": ["custom angular_regFieldCall"],
                        "!url": "http://docs.angularjs.org/api/ng.$compileProvider#directive",
                        "!doc": "Register a new directive with the compiler."
                    },
                    factory: "service.$provide.factory",
                    filter: {
                        "!type": "fn(name: string, filterFactory: fn()) -> !this",
                        "!effects": ["custom angular_callInject 1"],
                        "!url": "http://docs.angularjs.org/api/ng.$filterProvider",
                        "!doc": "Register filter factory function."
                    },
                    provider: "service.$provide.provider",
                    run: {
                        "!type": "fn(initializationFn: fn()) -> !this",
                        "!effects": ["custom angular_callInject 0"],
                        "!url": "http://docs.angularjs.org/api/angular.Module#run",
                        "!doc": "Register work which should be performed when the injector is done loading all modules."
                    },
                    service: "service.$provide.service",
                    value: "service.$provide.value",
                    name: {
                        "!type": "string",
                        "!url": "http://docs.angularjs.org/api/angular.Module#name",
                        "!doc": "Name of the module."
                    },
                    requires: {
                        "!type": "[string]",
                        "!url": "http://docs.angularjs.org/api/angular.Module#requires",
                        "!doc": "List of module names which must be loaded before this module."
                    }
                }
            },
            Promise: {
                "!url": "http://docs.angularjs.org/api/ng.$q",
                "!doc": "Allow for interested parties to get access to the result of the deferred task when it completes.",
                prototype: {
                    then: "fn(successCallback: fn(value: ?), errorCallback: fn(reason: ?), notifyCallback: fn(value: ?)) -> +Promise",
                    "catch": "fn(errorCallback: fn(reason: ?))",
                    "finally": "fn(callback: fn()) -> +Promise",
                    success: "fn(callback: fn(data: ?, status: number, headers: ?, config: ?)) -> +Promise",
                    error: "fn(callback: fn(data: ?, status: number, headers: ?, config: ?)) -> +Promise"
                }
            },
            Deferred: {
                "!url": "http://docs.angularjs.org/api/ng.$q",
                prototype: {
                    resolve: "fn(value: ?)",
                    reject: "fn(reason: ?)",
                    notify: "fn(value: ?)",
                    promise: "+Promise"
                }
            },
            ResourceClass: {
                "!url": "http://docs.angularjs.org/api/ngResource.$resource",
                prototype: {
                    $promise: "+Promise",
                    $save: "fn()"
                }
            },
            Resource: {
                "!url": "http://docs.angularjs.org/api/ngResource.$resource",
                prototype: {
                    get: "fn(params: ?, callback: fn()) -> +ResourceClass",
                    save: "fn(params: ?, callback: fn()) -> +ResourceClass",
                    query: "fn(params: ?, callback: fn()) -> +ResourceClass",
                    remove: "fn(params: ?, callback: fn()) -> +ResourceClass",
                    "delete": "fn(params: ?, callback: fn()) -> +ResourceClass"
                }
            },
            service: {
                $anchorScroll: {
                    "!type": "fn()",
                    "!url": "http://docs.angularjs.org/api/ng.$anchorScroll",
                    "!doc": "Checks current value of $location.hash() and scroll to related element."
                },
                $animate: {
                    "!url": "http://docs.angularjs.org/api/ng.$animate",
                    "!doc": "Rudimentary DOM manipulation functions to insert, remove, move elements within the DOM.",
                    addClass: {
                        "!type": "fn(element: +Element, className: string, done?: fn()) -> !this",
                        "!url": "http://docs.angularjs.org/api/ng.$animate#addClass",
                        "!doc": "Adds the provided className CSS class value to the provided element."
                    },
                    enter: {
                        "!type": "fn(element: +Element, parent: +Element, after: +Element, done?: fn()) -> !this",
                        "!url": "http://docs.angularjs.org/api/ng.$animate#enter",
                        "!doc": "Inserts the element into the DOM either after the after element or within the parent element."
                    },
                    leave: {
                        "!type": "fn(element: +Element, done?: fn()) -> !this",
                        "!url": "http://docs.angularjs.org/api/ng.$animate#leave",
                        "!doc": "Removes the element from the DOM."
                    },
                    move: {
                        "!type": "fn(element: +Element, parent: +Element, after: +Element, done?: fn()) -> !this",
                        "!url": "http://docs.angularjs.org/api/ng.$animate#move",
                        "!doc": "Moves element to be placed either after the after element or inside of the parent element."
                    },
                    removeClass: {
                        "!type": "fn(element: +Element, className: string, done?: fn()) -> !this",
                        "!url": "http://docs.angularjs.org/api/ng.$animate#removeClass",
                        "!doc": "Removes the provided className CSS class value from the provided element."
                    }
                },
                $cacheFactory: {
                    "!type": "fn(cacheId: string, options?: ?) -> cacheObj",
                    "!url": "http://docs.angularjs.org/api/ng.$cacheFactory",
                    "!doc": "Factory that constructs cache objects and gives access to them."
                },
                $compile: {
                    "!type": "fn(element: +Element, transclude: fn(scope: ?), maxPriority: number)",
                    "!url": "http://docs.angularjs.org/api/ng.$compile",
                    "!doc": "Compiles a piece of HTML string or DOM into a template and produces a template function."
                },
                $controller: {
                    "!type": "fn(controller: fn(), locals: ?) -> ?",
                    "!url": "http://docs.angularjs.org/api/ng.$controller",
                    "!doc": "Instantiates controllers."
                },
                $document: {
                    "!type": "jQuery.fn",
                    "!url": "http://docs.angularjs.org/api/ng.$document",
                    "!doc": "A jQuery (lite)-wrapped reference to the browser's window.document element."
                },
                $exceptionHandler: {
                    "!type": "fn(exception: +Error, cause?: string)",
                    "!url": "http://docs.angularjs.org/api/ng.$exceptionHandler",
                    "!doc": "Any uncaught exception in angular expressions is delegated to this service."
                },
                $filter: {
                    "!type": "fn(name: string) -> fn(input: string) -> string",
                    "!url": "http://docs.angularjs.org/api/ng.$filter",
                    "!doc": "Retrieve a filter function."
                },
                $http: {
                    "!type": "fn(config: ?) -> service.$q",
                    "!url": "http://docs.angularjs.org/api/ng.$http",
                    "!doc": "Facilitates communication with remote HTTP servers.",
                    "delete": "fn(url: string, config?: ?) -> +Promise",
                    get: "fn(url: string, config?: ?) -> +Promise",
                    head: "fn(url: string, config?: ?) -> +Promise",
                    jsonp: "fn(url: string, config?: ?) -> +Promise",
                    post: "fn(url: string, data: ?, config?: ?) -> +Promise",
                    put: "fn(url: string, data: ?, config?: ?) -> +Promise"
                },
                $interpolate: {
                    "!type": "fn(text: string, mustHaveExpression?: bool, trustedContext?: string) -> fn(context: ?) -> string",
                    "!url": "http://docs.angularjs.org/api/ng.$interpolate",
                    "!doc": "Compiles a string with markup into an interpolation function."
                },
                $locale: {
                    "!url": "http://docs.angularjs.org/api/ng.$locale",
                    id: "string"
                },
                $location: {
                    "!url": "http://docs.angularjs.org/api/ng.$location",
                    "!doc": "Parses the URL in the browser address bar.",
                    absUrl: {
                        "!type": "fn() -> string",
                        "!url": "http://docs.angularjs.org/api/ng.$location#absUrl",
                        "!doc": "Return full url representation."
                    },
                    hash: {
                        "!type": "fn(value?: string) -> string",
                        "!url": "http://docs.angularjs.org/api/ng.$location#hash",
                        "!doc": "Get or set the hash fragment."
                    },
                    host: {
                        "!type": "fn() -> string",
                        "!url": "http://docs.angularjs.org/api/ng.$location#host",
                        "!doc": "Return host of current url."
                    },
                    path: {
                        "!type": "fn(value?: string) -> string",
                        "!url": "http://docs.angularjs.org/api/ng.$location#path",
                        "!doc": "Get or set the URL path."
                    },
                    port: {
                        "!type": "fn() -> number",
                        "!url": "http://docs.angularjs.org/api/ng.$location#port",
                        "!doc": "Returns the port of the current url."
                    },
                    protocol: {
                        "!type": "fn() -> string",
                        "!url": "http://docs.angularjs.org/api/ng.$location#protocol",
                        "!doc": "Return protocol of current url."
                    },
                    replace: {
                        "!type": "fn()",
                        "!url": "http://docs.angularjs.org/api/ng.$location#replace",
                        "!doc": "Changes to $location during current $digest will be replacing current history record, instead of adding new one."
                    },
                    search: {
                        "!type": "fn(search: string, paramValue?: string) -> string",
                        "!url": "http://docs.angularjs.org/api/ng.$location#search",
                        "!doc": "Get or set the URL query."
                    },
                    url: {
                        "!type": "fn(url: string, replace?: string) -> string",
                        "!url": "http://docs.angularjs.org/api/ng.$location#url",
                        "!doc": "Get or set the current url."
                    }
                },
                $log: {
                    "!url": "http://docs.angularjs.org/api/ng.$log",
                    "!doc": "Simple service for logging.",
                    debug: {
                        "!type": "fn(message: string)",
                        "!url": "http://docs.angularjs.org/api/ng.$log#debug",
                        "!doc": "Write a debug message."
                    },
                    error: {
                        "!type": "fn(message: string)",
                        "!url": "http://docs.angularjs.org/api/ng.$log#error",
                        "!doc": "Write an error message."
                    },
                    info: {
                        "!type": "fn(message: string)",
                        "!url": "http://docs.angularjs.org/api/ng.$log#info",
                        "!doc": "Write an info message."
                    },
                    log: {
                        "!type": "fn(message: string)",
                        "!url": "http://docs.angularjs.org/api/ng.$log#log",
                        "!doc": "Write a log message."
                    },
                    warn: {
                        "!type": "fn(message: string)",
                        "!url": "http://docs.angularjs.org/api/ng.$log#warn",
                        "!doc": "Write a warning message."
                    }
                },
                $parse: {
                    "!type": "fn(expression: string) -> fn(context: ?, locals: ?) -> ?",
                    "!url": "http://docs.angularjs.org/api/ng.$parse",
                    "!doc": "Converts Angular expression into a function."
                },
                $q: {
                    "!url": "http://docs.angularjs.org/api/ng.$q",
                    "!doc": "A promise/deferred implementation.",
                    all: {
                        "!type": "fn(promises: [+Promise]) -> +Promise",
                        "!url": "http://docs.angularjs.org/api/ng.$q#all",
                        "!doc": "Combines multiple promises into a single promise."
                    },
                    defer: {
                        "!type": "fn() -> +Deferred",
                        "!url": "http://docs.angularjs.org/api/ng.$q#defer",
                        "!doc": "Creates a Deferred object which represents a task which will finish in the future."
                    },
                    reject: {
                        "!type": "fn(reasion: ?) -> +Promise",
                        "!url": "http://docs.angularjs.org/api/ng.$q#reject",
                        "!doc": "Creates a promise that is resolved as rejected with the specified reason."
                    },
                    when: {
                        "!type": "fn(value: ?) -> +Promise",
                        "!url": "http://docs.angularjs.org/api/ng.$q#when",
                        "!doc": "Wraps an object that might be a value or a (3rd party) then-able promise into a $q promise."
                    }
                },
                $rootElement: {
                    "!type": "+Element",
                    "!url": "http://docs.angularjs.org/api/ng.$rootElement",
                    "!doc": "The root element of Angular application."
                },
                $rootScope: {
                    "!url": "http://docs.angularjs.org/api/ng.$rootScope",
                    $apply: {
                        "!type": "fn(expression: string)",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$apply",
                        "!doc": "Execute an expression in angular from outside of the angular framework."
                    },
                    $broadcast: {
                        "!type": "fn(name: string, args?: ?) -> eventObj",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$broadcast",
                        "!doc": "Dispatches an event name downwards to all child scopes."
                    },
                    $destroy: {
                        "!type": "fn()",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$destroy",
                        "!doc": "Removes the current scope (and all of its children) from the parent scope."
                    },
                    $digest: {
                        "!type": "fn()",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$digest",
                        "!doc": "Processes all of the watchers of the current scope and its children."
                    },
                    $emit: {
                        "!type": "fn(name: string, args?: ?) -> eventObj",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$emit",
                        "!doc": "Dispatches an event name upwards through the scope hierarchy."
                    },
                    $eval: {
                        "!type": "fn(expression: string) -> ?",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$eval",
                        "!doc": "Executes the expression on the current scope and returns the result."
                    },
                    $evalAsync: {
                        "!type": "fn(expression: string)",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$evalAsync",
                        "!doc": "Executes the expression on the current scope at a later point in time."
                    },
                    $new: {
                        "!type": "fn(isolate: bool) -> service.$rootScope",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$new",
                        "!doc": "Creates a new child scope."
                    },
                    $on: {
                        "!type": "fn(name: string, listener: fn(event: ?)) -> fn()",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$on",
                        "!doc": "Listens on events of a given type."
                    },
                    $watch: {
                        "!type": "fn(watchExpression: string, listener?: fn(), objectEquality?: bool) -> fn()",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$watch",
                        "!doc": "Registers a listener callback to be executed whenever the watchExpression changes."
                    },
                    $watchCollection: {
                        "!type": "fn(obj: string, listener: fn()) -> fn()",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$watchCollection",
                        "!doc": "Shallow watches the properties of an object and fires whenever any of the properties."
                    },
                    $id: {
                        "!type": "number",
                        "!url": "http://docs.angularjs.org/api/ng.$rootScope.Scope#$id",
                        "!doc": "Unique scope ID."
                    }
                },
                $sce: {
                    HTML: "string",
                    CSS: "string",
                    URL: "string",
                    RESOURCE_URL: "string",
                    JS: "string",
                    getTrusted: "fn(type: string, maybeTrusted: ?) -> !1",
                    getTrustedCss: "fn(maybeTrusted: ?) -> !0",
                    getTrustedHtml: "fn(maybeTrusted: ?) -> !0",
                    getTrustedJs: "fn(maybeTrusted: ?) -> !0",
                    getTrustedResourceUrl: "fn(maybeTrusted: ?) -> !0",
                    getTrustedUrl: "fn(maybeTrusted: ?) -> !0",
                    parse: "fn(type: string, expression: string) -> fn(context: ?, locals: ?) -> ?",
                    parseAsCss: "fn(expression: string) -> fn(context: ?, locals: ?) -> ?",
                    parseAsHtml: "fn(expression: string) -> fn(context: ?, locals: ?) -> ?",
                    parseAsJs: "fn(expression: string) -> fn(context: ?, locals: ?) -> ?",
                    parseAsResourceUrl: "fn(expression: string) -> fn(context: ?, locals: ?) -> ?",
                    parseAsUrl: "fn(expression: string) -> fn(context: ?, locals: ?) -> ?",
                    trustAs: "fn(type: string, value: ?) -> !1",
                    trustAsHtml: "fn(value: ?) -> !0",
                    trustAsJs: "fn(value: ?) -> !0",
                    trustAsResourceUrl: "fn(value: ?) -> !0",
                    trustAsUrl: "fn(value: ?) -> !0",
                    isEnabled: "fn() -> bool"
                },
                $templateCache: {
                    "!url": "http://docs.angularjs.org/api/ng.$templateCache",
                    "!proto": "cacheObj"
                },
                $timeout: {
                    "!type": "fn(fn: fn(), delay?: number, invokeApply?: bool) -> +Promise",
                    "!url": "http://docs.angularjs.org/api/ng.$timeout",
                    "!doc": "Angular's wrapper for window.setTimeout.",
                    cancel: "fn(promise: +Promise)"
                },
                $window: "<top>",
                $injector: {
                    "!url": "http://docs.angularjs.org/api/AUTO.$injector",
                    "!doc": "Retrieve object instances as defined by provider.",
                    annotate: {
                        "!type": "fn(f: fn()) -> [string]",
                        "!url": "http://docs.angularjs.org/api/AUTO.$injector#annotate",
                        "!doc": "Returns an array of service names which the function is requesting for injection."
                    },
                    get: {
                        "!type": "fn(name: string) -> ?",
                        "!url": "http://docs.angularjs.org/api/AUTO.$injector#get",
                        "!doc": "Return an instance of a service."
                    },
                    has: {
                        "!type": "fn(name: string) -> bool",
                        "!url": "http://docs.angularjs.org/api/AUTO.$injector#has",
                        "!doc": "Allows the user to query if the particular service exist."
                    },
                    instantiate: {
                        "!type": "fn(type: fn(), locals?: ?) -> +!0",
                        "!url": "http://docs.angularjs.org/api/AUTO.$injector#instantiate",
                        "!doc": "Create a new instance of JS type."
                    },
                    invoke: {
                        "!type": "fn(type: fn(), self?: ?, locals?: ?) -> !0.!ret",
                        "!url": "http://docs.angularjs.org/api/AUTO.$injector#invoke",
                        "!doc": "Invoke the method and supply the method arguments from the $injector."
                    }
                },
                $provide: {
                    "!url": "http://docs.angularjs.org/api/AUTO.$provide",
                    "!doc": "Use $provide to register new providers with the $injector.",
                    constant: {
                        "!type": "fn(name: string, value: ?) -> !this",
                        "!effects": ["custom angular_regField"],
                        "!url": "http://docs.angularjs.org/api/AUTO.$provide#constant",
                        "!doc": "A constant value."
                    },
                    decorator: {
                        "!type": "fn(name: string, decorator: fn())",
                        "!effects": ["custom angular_regFieldCall"],
                        "!url": "http://docs.angularjs.org/api/AUTO.$provide#decorator",
                        "!doc": "Decoration of service, allows the decorator to intercept the service instance creation."
                    },
                    factory: {
                        "!type": "fn(name: string, providerFunction: fn()) -> !this",
                        "!effects": ["custom angular_regFieldCall"],
                        "!url": "http://docs.angularjs.org/api/AUTO.$provide#factory",
                        "!doc": "A short hand for configuring services if only $get method is required."
                    },
                    provider: {
                        "!type": "fn(name: string, providerType: fn()) -> !this",
                        "!effects": ["custom angular_regFieldCall"],
                        "!url": "http://docs.angularjs.org/api/AUTO.$provide#provider",
                        "!doc": "Register a provider for a service."
                    },
                    service: {
                        "!type": "fn(name: string, constructor: fn()) -> !this",
                        "!effects": ["custom angular_regFieldNew"],
                        "!url": "http://docs.angularjs.org/api/AUTO.$provide#provider",
                        "!doc": "Register a provider for a service."
                    },
                    value: {
                        "!type": "fn(name: string, object: ?) -> !this",
                        "!effects": ["custom angular_regField"],
                        "!url": "http://docs.angularjs.org/api/AUTO.$providevalue",
                        "!doc": "A short hand for configuring services if the $get method is a constant."
                    }
                },
                $cookies: {
                    "!url": "http://docs.angularjs.org/api/ngCookies.$cookies",
                    "!doc": "Provides read/write access to browser's cookies.",
                    text: "string"
                },
                $resource: {
                    "!type": "fn(url: string, paramDefaults?: ?, actions?: ?) -> +Resource",
                    "!url": "http://docs.angularjs.org/api/ngResource.$resource",
                    "!doc": "Creates a resource object that lets you interact with RESTful server-side data sources."
                },
                $route: {
                    "!url": "http://docs.angularjs.org/api/ngRoute.$route",
                    "!doc": "Deep-link URLs to controllers and views.",
                    reload: {
                        "!type": "fn()",
                        "!url": "http://docs.angularjs.org/api/ngRoute.$route#reload",
                        "!doc": "Reload the current route even if $location hasn't changed."
                    },
                    current: {
                        "!url": "http://docs.angularjs.org/api/ngRoute.$route#current",
                        "!doc": "Reference to the current route definition.",
                        controller: "?",
                        locals: "?"
                    },
                    routes: "[?]"
                },
                $sanitize: {
                    "!type": "fn(string) -> string",
                    "!url": "http://docs.angularjs.org/api/ngSanitize.$sanitize",
                    "!doc": "Sanitize HTML input."
                },
                $swipe: {
                    "!url": "http://docs.angularjs.org/api/ngTouch.$swipe",
                    "!doc": "A service that abstracts the messier details of hold-and-drag swipe behavior.",
                    bind: {
                        "!type": "fn(element: +Element, handlers: ?)",
                        "!url": "http://docs.angularjs.org/api/ngTouch.$swipe#bind",
                        "!doc": "Abstracts the messier details of hold-and-drag swipe behavior."
                    }
                }
            }
        },
        angular: {
            bind: {
                "!type": "fn(self: ?, fn: fn(), args?: ?) -> !custom:angular_bind",
                "!url": "http://docs.angularjs.org/api/angular.bind",
                "!doc": "Returns a function which calls function fn bound to self."
            },
            bootstrap: {
                "!type": "fn(element: +Element, modules?: [string]) -> service.$injector",
                "!url": "http://docs.angularjs.org/api/angular.bootstrap",
                "!doc": "Use this function to manually start up angular application."
            },
            copy: {
                "!type": "fn(source: ?, target?: ?) -> !0",
                "!url": "http://docs.angularjs.org/api/angular.copy",
                "!doc": "Creates a deep copy of source, which should be an object or an array."
            },
            element: {
                "!type": "fn(element: +Element) -> jQuery.fn",
                "!url": "http://docs.angularjs.org/api/angular.element",
                "!doc": "Wraps a raw DOM element or HTML string as a jQuery element."
            },
            equals: {
                "!type": "fn(o1: ?, o2: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.equals",
                "!doc": "Determines if two objects or two values are equivalent."
            },
            extend: {
                "!type": "fn(dst: ?, src: ?) -> !0",
                "!url": "http://docs.angularjs.org/api/angular.extend",
                "!doc": "Extends the destination object dst by copying all of the properties from the src object(s) to dst."
            },
            forEach: {
                "!type": "fn(obj: ?, iterator: fn(value: ?, key: ?), context?: ?) -> !0",
                "!effects": ["call !1 this=!2 !0.<i> number"],
                "!url": "http://docs.angularjs.org/api/angular.forEach",
                "!doc": "Invokes the iterator function once for each item in obj collection, which can be either an object or an array."
            },
            fromJson: {
                "!type": "fn(json: string) -> ?",
                "!url": "http://docs.angularjs.org/api/angular.fromJson",
                "!doc": "Deserializes a JSON string."
            },
            identity: {
                "!type": "fn(val: ?) -> !0",
                "!url": "http://docs.angularjs.org/api/angular.identity",
                "!doc": "A function that returns its first argument."
            },
            injector: {
                "!type": "fn(modules: [string]) -> service.$injector",
                "!url": "http://docs.angularjs.org/api/angular.injector",
                "!doc": "Creates an injector function"
            },
            isArray: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isArray",
                "!doc": "Determines if a reference is an Array."
            },
            isDate: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isDate",
                "!doc": "Determines if a reference is a date."
            },
            isDefined: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isDefined",
                "!doc": "Determines if a reference is defined."
            },
            isElement: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isElement",
                "!doc": "Determines if a reference is a DOM element."
            },
            isFunction: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isFunction",
                "!doc": "Determines if a reference is a function."
            },
            isNumber: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isNumber",
                "!doc": "Determines if a reference is a number."
            },
            isObject: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isObject",
                "!doc": "Determines if a reference is an object."
            },
            isString: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isString",
                "!doc": "Determines if a reference is a string."
            },
            isUndefined: {
                "!type": "fn(val: ?) -> bool",
                "!url": "http://docs.angularjs.org/api/angular.isUndefined",
                "!doc": "Determines if a reference is undefined."
            },
            lowercase: {
                "!type": "fn(val: string) -> string",
                "!url": "http://docs.angularjs.org/api/angular.lowercase",
                "!doc": "Converts the specified string to lowercase."
            },
            module: {
                "!type": "fn(name: string, deps: [string]) -> !custom:angular_module",
                "!url": "http://docs.angularjs.org/api/angular.module",
                "!doc": "A global place for creating, registering and retrieving Angular modules."
            },
            Module: "Module",
            noop: {
                "!type": "fn()",
                "!url": "http://docs.angularjs.org/api/angular.noop",
                "!doc": "A function that performs no operations."
            },
            toJson: {
                "!type": "fn(val: ?) -> string",
                "!url": "http://docs.angularjs.org/api/angular.toJson",
                "!doc": "Serializes input into a JSON-formatted string."
            },
            uppercase: {
                "!type": "fn(string) -> string",
                "!url": "http://docs.angularjs.org/api/angular.uppercase",
                "!doc": "Converts the specified string to uppercase."
            },
            version: {
                "!url": "http://docs.angularjs.org/api/angular.version",
                full: "string",
                major: "number",
                minor: "number",
                dot: "number",
                codename: "string"
            }
        }
    };
});

//#endregion

//#region tern/defs/ecma5.json

var def_ecma5 = {
    "!name": "ecma5",
    "!define": {
        "Error.prototype": "Error.prototype"
    },
    "Infinity": {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Infinity",
        "!doc": "A numeric value representing infinity."
    },
    "undefined": {
        "!type": "?",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/undefined",
        "!doc": "The value undefined."
    },
    "NaN": {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/NaN",
        "!doc": "A value representing Not-A-Number."
    },
    "Object": {
        "!type": "fn()",
        "getPrototypeOf": {
            "!type": "fn(obj: ?) -> ?",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/getPrototypeOf",
            "!doc": "Returns the prototype (i.e. the internal prototype) of the specified object."
        },
        "create": {
            "!type": "fn(proto: ?) -> !custom:Object_create",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/create",
            "!doc": "Creates a new object with the specified prototype object and properties."
        },
        "defineProperty": {
            "!type": "fn(obj: ?, prop: string, desc: ?) -> !custom:Object_defineProperty",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/defineProperty",
            "!doc": "Defines a new property directly on an object, or modifies an existing property on an object, and returns the object. If you want to see how to use the Object.defineProperty method with a binary-flags-like syntax, see this article."
        },
        "defineProperties": {
            "!type": "fn(obj: ?, props: ?)",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/defineProperty",
            "!doc": "Defines a new property directly on an object, or modifies an existing property on an object, and returns the object. If you want to see how to use the Object.defineProperty method with a binary-flags-like syntax, see this article."
        },
        "getOwnPropertyDescriptor": {
            "!type": "fn(obj: ?, prop: string) -> ?",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor",
            "!doc": "Returns a property descriptor for an own property (that is, one directly present on an object, not present by dint of being along an object's prototype chain) of a given object."
        },
        "keys": {
            "!type": "fn(obj: ?) -> [string]",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/keys",
            "!doc": "Returns an array of a given object's own enumerable properties, in the same order as that provided by a for-in loop (the difference being that a for-in loop enumerates properties in the prototype chain as well)."
        },
        "getOwnPropertyNames": {
            "!type": "fn(obj: ?) -> [string]",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames",
            "!doc": "Returns an array of all properties (enumerable or not) found directly upon a given object."
        },
        "seal": {
            "!type": "fn(obj: ?)",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/seal",
            "!doc": "Seals an object, preventing new properties from being added to it and marking all existing properties as non-configurable. Values of present properties can still be changed as long as they are writable."
        },
        "isSealed": {
            "!type": "fn(obj: ?) -> bool",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/isSealed",
            "!doc": "Determine if an object is sealed."
        },
        "freeze": {
            "!type": "fn(obj: ?)",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/freeze",
            "!doc": "Freezes an object: that is, prevents new properties from being added to it; prevents existing properties from being removed; and prevents existing properties, or their enumerability, configurability, or writability, from being changed. In essence the object is made effectively immutable. The method returns the object being frozen."
        },
        "isFrozen": {
            "!type": "fn(obj: ?) -> bool",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/isFrozen",
            "!doc": "Determine if an object is frozen."
        },
        "preventExtensions": {
            "!type": "fn(obj: ?)",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/preventExtensions",
            "!doc": "Prevents new properties from ever being added to an object."
        },
        "isExtensible": {
            "!type": "fn(obj: ?) -> bool",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isExtensible",
            "!doc": "The Object.isExtensible() method determines if an object is extensible (whether it can have new properties added to it)."
        },
        "prototype": {
            "!stdProto": "Object",
            "toString": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/toString",
                "!doc": "Returns a string representing the object."
            },
            "toLocaleString": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/toLocaleString",
                "!doc": "Returns a string representing the object. This method is meant to be overriden by derived objects for locale-specific purposes."
            },
            "valueOf": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/valueOf",
                "!doc": "Returns the primitive value of the specified object"
            },
            "hasOwnProperty": {
                "!type": "fn(prop: string) -> bool",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/hasOwnProperty",
                "!doc": "Returns a boolean indicating whether the object has the specified property."
            },
            "propertyIsEnumerable": {
                "!type": "fn(prop: string) -> bool",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/propertyIsEnumerable",
                "!doc": "Returns a Boolean indicating whether the specified property is enumerable."
            },
            "isPrototypeOf": {
                "!type": "fn(obj: ?) -> bool",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isPrototypeOf",
                "!doc": "Tests for an object in another object's prototype chain."
            }
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object",
        "!doc": "Creates an object wrapper."
    },
    "Function": {
        "!type": "fn(body: string) -> fn()",
        "prototype": {
            "!stdProto": "Function",
            "apply": {
                "!type": "fn(this: ?, args: [?])",
                "!effects": ["call and return !this this=!0 !1.<i> !1.<i> !1.<i>"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/apply",
                "!doc": "Calls a function with a given this value and arguments provided as an array (or an array like object)."
            },
            "call": {
                "!type": "fn(this: ?, args?: ?) -> !this.!ret",
                "!effects": ["call and return !this this=!0 !1 !2 !3 !4"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/call",
                "!doc": "Calls a function with a given this value and arguments provided individually."
            },
            "bind": {
                "!type": "fn(this: ?, args?: ?) -> !custom:Function_bind",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind",
                "!doc": "Creates a new function that, when called, has its this keyword set to the provided value, with a given sequence of arguments preceding any provided when the new function was called."
            },
            "prototype": "?"
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function",
        "!doc": "Every function in JavaScript is actually a Function object."
    },
    "Array": {
        "!type": "fn(size: number) -> !custom:Array_ctor",
        "isArray": {
            "!type": "fn(value: ?) -> bool",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/isArray",
            "!doc": "Returns true if an object is an array, false if it is not."
        },
        "prototype": {
            "!stdProto": "Array",
            "length": {
                "!type": "number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/length",
                "!doc": "An unsigned, 32-bit integer that specifies the number of elements in an array."
            },
            "concat": {
                "!type": "fn(other: [?]) -> !this",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/concat",
                "!doc": "Returns a new array comprised of this array joined with other array(s) and/or value(s)."
            },
            "join": {
                "!type": "fn(separator?: string) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/join",
                "!doc": "Joins all elements of an array into a string."
            },
            "splice": {
                "!type": "fn(pos: number, amount: number)",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/splice",
                "!doc": "Changes the content of an array, adding new elements while removing old elements."
            },
            "pop": {
                "!type": "fn() -> !this.<i>",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/pop",
                "!doc": "Removes the last element from an array and returns that element."
            },
            "push": {
                "!type": "fn(newelt: ?) -> number",
                "!effects": ["propagate !0 !this.<i>"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/push",
                "!doc": "Mutates an array by appending the given elements and returning the new length of the array."
            },
            "shift": {
                "!type": "fn() -> !this.<i>",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/shift",
                "!doc": "Removes the first element from an array and returns that element. This method changes the length of the array."
            },
            "unshift": {
                "!type": "fn(newelt: ?) -> number",
                "!effects": ["propagate !0 !this.<i>"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/unshift",
                "!doc": "Adds one or more elements to the beginning of an array and returns the new length of the array."
            },
            "slice": {
                "!type": "fn(from: number, to?: number) -> !this",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/slice",
                "!doc": "Returns a shallow copy of a portion of an array."
            },
            "reverse": {
                "!type": "fn()",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/reverse",
                "!doc": "Reverses an array in place.  The first array element becomes the last and the last becomes the first."
            },
            "sort": {
                "!type": "fn(compare?: fn(a: ?, b: ?) -> number)",
                "!effects": ["call !0 !this.<i> !this.<i>"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/sort",
                "!doc": "Sorts the elements of an array in place and returns the array."
            },
            "indexOf": {
                "!type": "fn(elt: ?, from?: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/indexOf",
                "!doc": "Returns the first index at which a given element can be found in the array, or -1 if it is not present."
            },
            "lastIndexOf": {
                "!type": "fn(elt: ?, from?: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/lastIndexOf",
                "!doc": "Returns the last index at which a given element can be found in the array, or -1 if it is not present. The array is searched backwards, starting at fromIndex."
            },
            "every": {
                "!type": "fn(test: fn(elt: ?, i: number) -> bool, context?: ?) -> bool",
                "!effects": ["call !0 this=!1 !this.<i> number"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/every",
                "!doc": "Tests whether all elements in the array pass the test implemented by the provided function."
            },
            "some": {
                "!type": "fn(test: fn(elt: ?, i: number) -> bool, context?: ?) -> bool",
                "!effects": ["call !0 this=!1 !this.<i> number"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/some",
                "!doc": "Tests whether some element in the array passes the test implemented by the provided function."
            },
            "filter": {
                "!type": "fn(test: fn(elt: ?, i: number) -> bool, context?: ?) -> !this",
                "!effects": ["call !0 this=!1 !this.<i> number"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/filter",
                "!doc": "Creates a new array with all elements that pass the test implemented by the provided function."
            },
            "forEach": {
                "!type": "fn(f: fn(elt: ?, i: number), context?: ?)",
                "!effects": ["call !0 this=!1 !this.<i> number"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/forEach",
                "!doc": "Executes a provided function once per array element."
            },
            "map": {
                "!type": "fn(f: fn(elt: ?, i: number) -> ?, context?: ?) -> [!0.!ret]",
                "!effects": ["call !0 this=!1 !this.<i> number"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/map",
                "!doc": "Creates a new array with the results of calling a provided function on every element in this array."
            },
            "reduce": {
                "!type": "fn(combine: fn(sum: ?, elt: ?, i: number) -> ?, init?: ?) -> !0.!ret",
                "!effects": ["call !0 !1 !this.<i> number"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/Reduce",
                "!doc": "Apply a function against an accumulator and each value of the array (from left-to-right) as to reduce it to a single value."
            },
            "reduceRight": {
                "!type": "fn(combine: fn(sum: ?, elt: ?, i: number) -> ?, init?: ?) -> !0.!ret",
                "!effects": ["call !0 !1 !this.<i> number"],
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/ReduceRight",
                "!doc": "Apply a function simultaneously against two values of the array (from right-to-left) as to reduce it to a single value."
            }
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array",
        "!doc": "The JavaScript Array global object is a constructor for arrays, which are high-level, list-like objects."
    },
    "String": {
        "!type": "fn(value: ?) -> string",
        "fromCharCode": {
            "!type": "fn(code: number) -> string",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/fromCharCode",
            "!doc": "Returns a string created by using the specified sequence of Unicode values."
        },
        "prototype": {
            "!stdProto": "String",
            "length": {
                "!type": "number",
                "!url": "https://developer.mozilla.org/en/docs/JavaScript/Reference/Global_Objects/String/length",
                "!doc": "Represents the length of a string."
            },
            "<i>": "string",
            "charAt": {
                "!type": "fn(i: number) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/charAt",
                "!doc": "Returns the specified character from a string."
            },
            "charCodeAt": {
                "!type": "fn(i: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/charCodeAt",
                "!doc": "Returns the numeric Unicode value of the character at the given index (except for unicode codepoints > 0x10000)."
            },
            "indexOf": {
                "!type": "fn(char: string, from?: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/indexOf",
                "!doc": "Returns the index within the calling String object of the first occurrence of the specified value, starting the search at fromIndex,\nreturns -1 if the value is not found."
            },
            "lastIndexOf": {
                "!type": "fn(char: string, from?: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/lastIndexOf",
                "!doc": "Returns the index within the calling String object of the last occurrence of the specified value, or -1 if not found. The calling string is searched backward, starting at fromIndex."
            },
            "substring": {
                "!type": "fn(from: number, to?: number) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/substring",
                "!doc": "Returns a subset of a string between one index and another, or through the end of the string."
            },
            "substr": {
                "!type": "fn(from: number, length?: number) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/substr",
                "!doc": "Returns the characters in a string beginning at the specified location through the specified number of characters."
            },
            "slice": {
                "!type": "fn(from: number, to?: number) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/slice",
                "!doc": "Extracts a section of a string and returns a new string."
            },
            "trim": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/Trim",
                "!doc": "Removes whitespace from both ends of the string."
            },
            "toUpperCase": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/toUpperCase",
                "!doc": "Returns the calling string value converted to uppercase."
            },
            "toLowerCase": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/toLowerCase",
                "!doc": "Returns the calling string value converted to lowercase."
            },
            "toLocaleUpperCase": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/toLocaleUpperCase",
                "!doc": "Returns the calling string value converted to upper case, according to any locale-specific case mappings."
            },
            "toLocaleLowerCase": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase",
                "!doc": "Returns the calling string value converted to lower case, according to any locale-specific case mappings."
            },
            "split": {
                "!type": "fn(pattern: string) -> [string]",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/split",
                "!doc": "Splits a String object into an array of strings by separating the string into substrings."
            },
            "concat": {
                "!type": "fn(other: string) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/concat",
                "!doc": "Combines the text of two or more strings and returns a new string."
            },
            "localeCompare": {
                "!type": "fn(other: string) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/localeCompare",
                "!doc": "Returns a number indicating whether a reference string comes before or after or is the same as the given string in sort order."
            },
            "match": {
                "!type": "fn(pattern: +RegExp) -> [string]",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/match",
                "!doc": "Used to retrieve the matches when matching a string against a regular expression."
            },
            "replace": {
                "!type": "fn(pattern: +RegExp, replacement: string) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/replace",
                "!doc": "Returns a new string with some or all matches of a pattern replaced by a replacement.  The pattern can be a string or a RegExp, and the replacement can be a string or a function to be called for each match."
            },
            "search": {
                "!type": "fn(pattern: +RegExp) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/search",
                "!doc": "Executes the search for a match between a regular expression and this String object."
            }
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String",
        "!doc": "The String global object is a constructor for strings, or a sequence of characters."
    },
    "Number": {
        "!type": "fn(value: ?) -> number",
        "MAX_VALUE": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/MAX_VALUE",
            "!doc": "The maximum numeric value representable in JavaScript."
        },
        "MIN_VALUE": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/MIN_VALUE",
            "!doc": "The smallest positive numeric value representable in JavaScript."
        },
        "POSITIVE_INFINITY": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/POSITIVE_INFINITY",
            "!doc": "A value representing the positive Infinity value."
        },
        "NEGATIVE_INFINITY": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/NEGATIVE_INFINITY",
            "!doc": "A value representing the negative Infinity value."
        },
        "prototype": {
            "!stdProto": "Number",
            "toString": {
                "!type": "fn(radix?: number) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/toString",
                "!doc": "Returns a string representing the specified Number object"
            },
            "toFixed": {
                "!type": "fn(digits: number) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/toFixed",
                "!doc": "Formats a number using fixed-point notation"
            },
            "toExponential": {
                "!type": "fn(digits: number) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/toExponential",
                "!doc": "Returns a string representing the Number object in exponential notation"
            },
            "toPrecision": {
                "!type": "fn(digits: number) -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/toPrecision",
                "!doc": "The toPrecision() method returns a string representing the number to the specified precision."
            }
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number",
        "!doc": "The Number JavaScript object is a wrapper object allowing you to work with numerical values. A Number object is created using the Number() constructor."
    },
    "Boolean": {
        "!type": "fn(value: ?) -> bool",
        "prototype": {
            "!stdProto": "Boolean"
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Boolean",
        "!doc": "The Boolean object is an object wrapper for a boolean value."
    },
    "RegExp": {
        "!type": "fn(source: string, flags?: string)",
        "prototype": {
            "!stdProto": "RegExp",
            "exec": {
                "!type": "fn(input: string) -> [string]",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/exec",
                "!doc": "Executes a search for a match in a specified string. Returns a result array, or null."
            },
            "test": {
                "!type": "fn(input: string) -> bool",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/test",
                "!doc": "Executes the search for a match between a regular expression and a specified string. Returns true or false."
            },
            "global": {
                "!type": "bool",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp",
                "!doc": "Creates a regular expression object for matching text with a pattern."
            },
            "ignoreCase": {
                "!type": "bool",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp",
                "!doc": "Creates a regular expression object for matching text with a pattern."
            },
            "multiline": {
                "!type": "bool",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/multiline",
                "!doc": "Reflects whether or not to search in strings across multiple lines.\n"
            },
            "source": {
                "!type": "string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/source",
                "!doc": "A read-only property that contains the text of the pattern, excluding the forward slashes.\n"
            },
            "lastIndex": {
                "!type": "number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/lastIndex",
                "!doc": "A read/write integer property that specifies the index at which to start the next match."
            }
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp",
        "!doc": "Creates a regular expression object for matching text with a pattern."
    },
    "Date": {
        "!type": "fn(ms: number)",
        "parse": {
            "!type": "fn(source: string) -> +Date",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/parse",
            "!doc": "Parses a string representation of a date, and returns the number of milliseconds since January 1, 1970, 00:00:00 UTC."
        },
        "UTC": {
            "!type": "fn(year: number, month: number, date: number, hour?: number, min?: number, sec?: number, ms?: number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/UTC",
            "!doc": "Accepts the same parameters as the longest form of the constructor, and returns the number of milliseconds in a Date object since January 1, 1970, 00:00:00, universal time."
        },
        "now": {
            "!type": "fn() -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/now",
            "!doc": "Returns the number of milliseconds elapsed since 1 January 1970 00:00:00 UTC."
        },
        "prototype": {
            "toUTCString": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toUTCString",
                "!doc": "Converts a date to a string, using the universal time convention."
            },
            "toISOString": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toISOString",
                "!doc": "JavaScript provides a direct way to convert a date object into a string in ISO format, the ISO 8601 Extended Format."
            },
            "toDateString": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toDateString",
                "!doc": "Returns the date portion of a Date object in human readable form in American English."
            },
            "toTimeString": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toTimeString",
                "!doc": "Returns the time portion of a Date object in human readable form in American English."
            },
            "toLocaleDateString": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toLocaleDateString",
                "!doc": "Converts a date to a string, returning the \"date\" portion using the operating system's locale's conventions.\n"
            },
            "toLocaleTimeString": {
                "!type": "fn() -> string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toLocaleTimeString",
                "!doc": "Converts a date to a string, returning the \"time\" portion using the current locale's conventions."
            },
            "getTime": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getTime",
                "!doc": "Returns the numeric value corresponding to the time for the specified date according to universal time."
            },
            "getFullYear": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getFullYear",
                "!doc": "Returns the year of the specified date according to local time."
            },
            "getYear": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getYear",
                "!doc": "Returns the year in the specified date according to local time."
            },
            "getMonth": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getMonth",
                "!doc": "Returns the month in the specified date according to local time."
            },
            "getUTCMonth": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCMonth",
                "!doc": "Returns the month of the specified date according to universal time.\n"
            },
            "getDate": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getDate",
                "!doc": "Returns the day of the month for the specified date according to local time."
            },
            "getUTCDate": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCDate",
                "!doc": "Returns the day (date) of the month in the specified date according to universal time.\n"
            },
            "getDay": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getDay",
                "!doc": "Returns the day of the week for the specified date according to local time."
            },
            "getUTCDay": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCDay",
                "!doc": "Returns the day of the week in the specified date according to universal time.\n"
            },
            "getHours": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getHours",
                "!doc": "Returns the hour for the specified date according to local time."
            },
            "getUTCHours": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCHours",
                "!doc": "Returns the hours in the specified date according to universal time.\n"
            },
            "getMinutes": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getMinutes",
                "!doc": "Returns the minutes in the specified date according to local time."
            },
            "getUTCMinutes": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date",
                "!doc": "Creates JavaScript Date instances which let you work with dates and times."
            },
            "getSeconds": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getSeconds",
                "!doc": "Returns the seconds in the specified date according to local time."
            },
            "getUTCSeconds": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCSeconds",
                "!doc": "Returns the seconds in the specified date according to universal time.\n"
            },
            "getMilliseconds": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getMilliseconds",
                "!doc": "Returns the milliseconds in the specified date according to local time."
            },
            "getUTCMilliseconds": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCMilliseconds",
                "!doc": "Returns the milliseconds in the specified date according to universal time.\n"
            },
            "getTimezoneOffset": {
                "!type": "fn() -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset",
                "!doc": "Returns the time-zone offset from UTC, in minutes, for the current locale."
            },
            "setTime": {
                "!type": "fn(date: +Date) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setTime",
                "!doc": "Sets the Date object to the time represented by a number of milliseconds since January 1, 1970, 00:00:00 UTC.\n"
            },
            "setFullYear": {
                "!type": "fn(year: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setFullYear",
                "!doc": "Sets the full year for a specified date according to local time.\n"
            },
            "setUTCFullYear": {
                "!type": "fn(year: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCFullYear",
                "!doc": "Sets the full year for a specified date according to universal time.\n"
            },
            "setMonth": {
                "!type": "fn(month: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setMonth",
                "!doc": "Set the month for a specified date according to local time."
            },
            "setUTCMonth": {
                "!type": "fn(month: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCMonth",
                "!doc": "Sets the month for a specified date according to universal time.\n"
            },
            "setDate": {
                "!type": "fn(day: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setDate",
                "!doc": "Sets the day of the month for a specified date according to local time."
            },
            "setUTCDate": {
                "!type": "fn(day: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCDate",
                "!doc": "Sets the day of the month for a specified date according to universal time.\n"
            },
            "setHours": {
                "!type": "fn(hour: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setHours",
                "!doc": "Sets the hours for a specified date according to local time, and returns the number of milliseconds since 1 January 1970 00:00:00 UTC until the time represented by the updated Date instance."
            },
            "setUTCHours": {
                "!type": "fn(hour: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCHours",
                "!doc": "Sets the hour for a specified date according to universal time.\n"
            },
            "setMinutes": {
                "!type": "fn(min: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setMinutes",
                "!doc": "Sets the minutes for a specified date according to local time."
            },
            "setUTCMinutes": {
                "!type": "fn(min: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCMinutes",
                "!doc": "Sets the minutes for a specified date according to universal time.\n"
            },
            "setSeconds": {
                "!type": "fn(sec: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setSeconds",
                "!doc": "Sets the seconds for a specified date according to local time."
            },
            "setUTCSeconds": {
                "!type": "fn(sec: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCSeconds",
                "!doc": "Sets the seconds for a specified date according to universal time.\n"
            },
            "setMilliseconds": {
                "!type": "fn(ms: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setMilliseconds",
                "!doc": "Sets the milliseconds for a specified date according to local time.\n"
            },
            "setUTCMilliseconds": {
                "!type": "fn(ms: number) -> number",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCMilliseconds",
                "!doc": "Sets the milliseconds for a specified date according to universal time.\n"
            }
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date",
        "!doc": "Creates JavaScript Date instances which let you work with dates and times."
    },
    "Error": {
        "!type": "fn(message: string)",
        "prototype": {
            "name": {
                "!type": "string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Error/name",
                "!doc": "A name for the type of error."
            },
            "message": {
                "!type": "string",
                "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Error/message",
                "!doc": "A human-readable description of the error."
            }
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Error",
        "!doc": "Creates an error object."
    },
    "SyntaxError": {
        "!type": "fn(message: string)",
        "prototype": "Error.prototype",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/SyntaxError",
        "!doc": "Represents an error when trying to interpret syntactically invalid code."
    },
    "ReferenceError": {
        "!type": "fn(message: string)",
        "prototype": "Error.prototype",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/ReferenceError",
        "!doc": "Represents an error when a non-existent variable is referenced."
    },
    "URIError": {
        "!type": "fn(message: string)",
        "prototype": "Error.prototype",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/URIError",
        "!doc": "Represents an error when a malformed URI is encountered."
    },
    "EvalError": {
        "!type": "fn(message: string)",
        "prototype": "Error.prototype",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/EvalError",
        "!doc": "Represents an error regarding the eval function."
    },
    "RangeError": {
        "!type": "fn(message: string)",
        "prototype": "Error.prototype",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RangeError",
        "!doc": "Represents an error when a number is not within the correct range allowed."
    },
    "TypeError": {
        "!type": "fn(message: string)",
        "prototype": "Error.prototype",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/TypeError",
        "!doc": "Represents an error an error when a value is not of the expected type."
    },
    "parseInt": {
        "!type": "fn(string: string, radix?: number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/parseInt",
        "!doc": "Parses a string argument and returns an integer of the specified radix or base."
    },
    "parseFloat": {
        "!type": "fn(string: string) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/parseFloat",
        "!doc": "Parses a string argument and returns a floating point number."
    },
    "isNaN": {
        "!type": "fn(value: number) -> bool",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/isNaN",
        "!doc": "Determines whether a value is NaN or not. Be careful, this function is broken. You may be interested in ECMAScript 6 Number.isNaN."
    },
    "isFinite": {
        "!type": "fn(value: number) -> bool",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/isFinite",
        "!doc": "Determines whether the passed value is a finite number."
    },
    "eval": {
        "!type": "fn(code: string) -> ?",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/eval",
        "!doc": "Evaluates JavaScript code represented as a string."
    },
    "encodeURI": {
        "!type": "fn(uri: string) -> string",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/encodeURI",
        "!doc": "Encodes a Uniform Resource Identifier (URI) by replacing each instance of certain characters by one, two, three, or four escape sequences representing the UTF-8 encoding of the character (will only be four escape sequences for characters composed of two \"surrogate\" characters)."
    },
    "encodeURIComponent": {
        "!type": "fn(uri: string) -> string",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/encodeURIComponent",
        "!doc": "Encodes a Uniform Resource Identifier (URI) component by replacing each instance of certain characters by one, two, three, or four escape sequences representing the UTF-8 encoding of the character (will only be four escape sequences for characters composed of two \"surrogate\" characters)."
    },
    "decodeURI": {
        "!type": "fn(uri: string) -> string",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/decodeURI",
        "!doc": "Decodes a Uniform Resource Identifier (URI) previously created by encodeURI or by a similar routine."
    },
    "decodeURIComponent": {
        "!type": "fn(uri: string) -> string",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/decodeURIComponent",
        "!doc": "Decodes a Uniform Resource Identifier (URI) component previously created by encodeURIComponent or by a similar routine."
    },
    "Math": {
        "E": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/E",
            "!doc": "The base of natural logarithms, e, approximately 2.718."
        },
        "LN2": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/LN2",
            "!doc": "The natural logarithm of 2, approximately 0.693."
        },
        "LN10": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/LN10",
            "!doc": "The natural logarithm of 10, approximately 2.302."
        },
        "LOG2E": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/LOG2E",
            "!doc": "The base 2 logarithm of E (approximately 1.442)."
        },
        "LOG10E": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/LOG10E",
            "!doc": "The base 10 logarithm of E (approximately 0.434)."
        },
        "SQRT1_2": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/SQRT1_2",
            "!doc": "The square root of 1/2; equivalently, 1 over the square root of 2, approximately 0.707."
        },
        "SQRT2": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/SQRT2",
            "!doc": "The square root of 2, approximately 1.414."
        },
        "PI": {
            "!type": "number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/PI",
            "!doc": "The ratio of the circumference of a circle to its diameter, approximately 3.14159."
        },
        "abs": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/abs",
            "!doc": "Returns the absolute value of a number."
        },
        "cos": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/cos",
            "!doc": "Returns the cosine of a number."
        },
        "sin": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/sin",
            "!doc": "Returns the sine of a number."
        },
        "tan": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/tan",
            "!doc": "Returns the tangent of a number."
        },
        "acos": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/acos",
            "!doc": "Returns the arccosine (in radians) of a number."
        },
        "asin": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/asin",
            "!doc": "Returns the arcsine (in radians) of a number."
        },
        "atan": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/atan",
            "!doc": "Returns the arctangent (in radians) of a number."
        },
        "atan2": {
            "!type": "fn(y: number, x: number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/atan2",
            "!doc": "Returns the arctangent of the quotient of its arguments."
        },
        "ceil": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/ceil",
            "!doc": "Returns the smallest integer greater than or equal to a number."
        },
        "floor": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/floor",
            "!doc": "Returns the largest integer less than or equal to a number."
        },
        "round": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/round",
            "!doc": "Returns the value of a number rounded to the nearest integer."
        },
        "exp": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/exp",
            "!doc": "Returns Ex, where x is the argument, and E is Euler's constant, the base of the natural logarithms."
        },
        "log": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/log",
            "!doc": "Returns the natural logarithm (base E) of a number."
        },
        "sqrt": {
            "!type": "fn(number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/sqrt",
            "!doc": "Returns the square root of a number."
        },
        "pow": {
            "!type": "fn(number, number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/pow",
            "!doc": "Returns base to the exponent power, that is, baseexponent."
        },
        "max": {
            "!type": "fn(number, number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/max",
            "!doc": "Returns the largest of zero or more numbers."
        },
        "min": {
            "!type": "fn(number, number) -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/min",
            "!doc": "Returns the smallest of zero or more numbers."
        },
        "random": {
            "!type": "fn() -> number",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/random",
            "!doc": "Returns a floating-point, pseudo-random number in the range [0, 1) that is, from 0 (inclusive) up to but not including 1 (exclusive), which you can then scale to your desired range."
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math",
        "!doc": "A built-in object that has properties and methods for mathematical constants and functions."
    },
    "JSON": {
        "parse": {
            "!type": "fn(json: string) -> ?",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/JSON/parse",
            "!doc": "Parse a string as JSON, optionally transforming the value produced by parsing."
        },
        "stringify": {
            "!type": "fn(value: ?) -> string",
            "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/JSON/stringify",
            "!doc": "Convert a value to JSON, optionally replacing values if a replacer function is specified, or optionally including only the specified properties if a replacer array is specified."
        },
        "!url": "https://developer.mozilla.org/en-US/docs/JSON",
        "!doc": "JSON (JavaScript Object Notation) is a data-interchange format.  It closely resembles a subset of JavaScript syntax, although it is not a strict subset. (See JSON in the JavaScript Reference for full details.)  It is useful when writing any kind of JavaScript-based application, including websites and browser extensions.  For example, you might store user information in JSON format in a cookie, or you might store extension preferences in JSON in a string-valued browser preference."
    }
};

//#endregion

//#region tern/defs/underscore.json
var def_underscore = {
    "!name": "underscore",
    "_": {
        "!doc": "Save the previous value of the `_` variable.",
        "!type": "fn(obj: ?) -> +_",
        "VERSION": {
            "!type": "string",
            "!url": "http://underscorejs.org/#VERSION"
        },
        "after": {
            "!doc": "Returns a function that will only be executed after being called N times.",
            "!url": "http://underscorejs.org/#after",
            "!type": "fn(times: number, func: fn()) -> !1"
        },
        "all": "_.every",
        "any": "_.some",
        "bind": {
            "!doc": "Create a function bound to a given object (assigning `this`, and arguments, optionally).",
            "!type": "fn(func: ?, context?: ?, args?: ?) -> !0",
            "!url": "http://underscorejs.org/#bind"
        },
        "bindAll": {
            "!doc": "Bind all of an object's methods to that object.",
            "!type": "fn(obj: ?, names?: [string])",
            "!url": "http://underscorejs.org/#bindAll"
        },
        "chain": {
            "!doc": "Add a \"chain\" function, which will delegate to the wrapper.",
            "!type": "fn(obj: ?)",
            "!url": "http://underscorejs.org/#chain"
        },
        "clone": {
            "!doc": "Create a (shallow-cloned) duplicate of an object.",
            "!type": "fn(obj: ?) -> !0",
            "!url": "http://underscorejs.org/#clone"
        },
        "collect": "_.map",
        "compact": {
            "!doc": "Trim out all falsy values from an array.",
            "!type": "fn(array: [?]) -> [?]",
            "!url": "http://underscorejs.org/#compact"
        },
        "compose": {
            "!doc": "Returns a function that is the composition of a list of functions, each consuming the return value of the function that follows.",
            "!type": "fn(a: fn(), b: fn()) -> fn() -> !1.!ret",
            "!url": "http://underscorejs.org/#compose"
        },
        "contains": {
            "!doc": "Determine if the array or object contains a given value (using `===`).",
            "!type": "fn(list: [?], target: ?) -> bool",
            "!url": "http://underscorejs.org/#contains"
        },
        "countBy": {
            "!doc": "Counts instances of an object that group by a certain criterion.",
            "!type": "fn(obj: ?, iterator: fn(elt: ?, i: number) -> ?, context?: ?) -> ?",
            "!url": "http://underscorejs.org/#countBy"
        },
        "debounce": {
            "!doc": "Returns a function, that, as long as it continues to be invoked, will not be triggered.",
            "!type": "fn(func: fn(), wait: number, immediate?: bool) -> !0",
            "!url": "http://underscorejs.org/#debounce"
        },
        "defaults": {
            "!doc": "Fill in a given object with default properties.",
            "!type": "fn(obj: ?, defaults: ?) -> !0",
            "!effects": ["copy !1 !0"],
            "!url": "http://underscorejs.org/#defaults"
        },
        "defer": {
            "!doc": "Defers a function, scheduling it to run after the current call stack has cleared.",
            "!type": "fn(func: fn(), args?: ?) -> number",
            "!url": "http://underscorejs.org/#defer"
        },
        "delay": {
            "!doc": "Delays a function for the given number of milliseconds, and then calls it with the arguments supplied.",
            "!type": "fn(func: fn(), wait: number, args?: ?) -> number",
            "!url": "http://underscorejs.org/#delay"
        },
        "detect": "_.find",
        "difference": {
            "!doc": "Take the difference between one array and a number of other arrays.",
            "!type": "fn(array: [?], others?: [?]) -> !0",
            "!url": "http://underscorejs.org/#difference"
        },
        "drop": "_.rest",
        "each": {
            "!doc": "Iterates over a list of elements, yielding each in turn to an iterator function.",
            "!type": "fn(obj: [?], iterator: fn(value: ?, index: number), context?: ?)",
            "!effects": ["call !1 this=!2 !0.<i> number"],
            "!url": "http://underscorejs.org/#each"
        },
        "escape": {
            "!doc": "Escapes a string for insertion into HTML.",
            "!type": "fn(string) -> string",
            "!url": "http://underscorejs.org/#escape"
        },
        "every": {
            "!doc": "Determine whether all of the elements match a truth test.",
            "!type": "fn(list: [?], iterator: fn(elt: ?, i: number) -> bool, context?: ?) -> bool",
            "!effects": ["call !1 this=!2 !0.<i> number"],
            "!url": "http://underscorejs.org/#every"
        },
        "extend": {
            "!doc": "Extend a given object with all the properties in passed-in object(s).",
            "!type": "fn(destination: ?, source1: ?, source2?: ?) -> !0",
            "!effects": ["copy !1 !0", "copy !2 !0"],
            "!url": "http://underscorejs.org/#extend"
        },
        "filter": {
            "!doc": "Looks through each value in the list, returning an array of all the values that pass a truth test.",
            "!type": "fn(list: [?], test: fn(value: ?, index: number) -> bool, context?: ?) -> !0",
            "!effects": ["call !1 this=!2 !0.<i> number"],
            "!url": "http://underscorejs.org/#filter"
        },
        "find": {
            "!doc": "Return the first value which passes a truth test.",
            "!type": "fn(list: [?], test: fn(?) -> bool, context?: ?) -> !0.<i>",
            "!effects": ["call !1 !0.<i>"],
            "!url": "http://underscorejs.org/#find"
        },
        "findWhere": {
            "!doc": "Looks through the list and returns the first value that matches all of the key-value pairs listed in properties.",
            "!type": "fn(list: [?], attrs: ?) -> !0.<i>",
            "!url": "http://underscorejs.org/#findWhere"
        },
        "first": {
            "!doc": "Get the first element of an array. Passing n will return the first N values in the array.",
            "!type": "fn(list: [?], n?: number) -> !0.<i>",
            "!url": "http://underscorejs.org/#first"
        },
        "flatten": {
            "!doc": "Return a completely flattened version of an array.",
            "!type": "fn(array: [?], shallow?: bool) -> [?]",
            "!url": "http://underscorejs.org/#flatten"
        },
        "foldl": "_.reduce",
        "foldr": "_.reduceRight",
        "forEach": "_.each",
        "functions": {
            "!doc": "Return a sorted list of the function names available on the object.",
            "!type": "fn(obj: _) -> [string]",
            "!url": "http://underscorejs.org/#functions"
        },
        "groupBy": {
            "!doc": "Groups the object's values by a criterion.",
            "!type": "fn(obj: [?], iterator: fn(elt: ?, i: number) -> ?, context?: ?) -> ?",
            "!url": "http://underscorejs.org/#groupBy"
        },
        "has": {
            "!doc": "Shortcut function for checking if an object has a given property directly on itself (in other words, not on a prototype).",
            "!type": "fn(obj: ?, key: string) -> bool",
            "!url": "http://underscorejs.org/#has"
        },
        "head": "_.first",
        "identity": {
            "!doc": "Returns the same value that is used as the argument.",
            "!type": "fn(value: ?) -> !0",
            "!url": "http://underscorejs.org/#identity"
        },
        "include": "_.contains",
        "indexOf": {
            "!doc": "Returns the index at which value can be found in the array, or -1 if value is not present in the array.",
            "!type": "fn(list: [?], item: ?, isSorted?: bool) -> number",
            "!url": "http://underscorejs.org/#indexOf"
        },
        "initial": {
            "!doc": "Returns everything but the last entry of the array.",
            "!type": "fn(array: [?], n?: number) -> !0",
            "!url": "http://underscorejs.org/#initial"
        },
        "inject": "_.reduce",
        "intersection": {
            "!doc": "Produce an array that contains every item shared between all the passed-in arrays.",
            "!type": "fn(array: [?], others?: [?]) -> !0",
            "!url": "http://underscorejs.org/#intersection"
        },
        "invert": {
            "!doc": "Invert the keys and values of an object.",
            "!type": "fn(obj: ?) -> ?",
            "!url": "http://underscorejs.org/#invert"
        },
        "invoke": {
            "!doc": "Invoke a method (with arguments) on every item in a collection.",
            "!type": "fn(obj: ?, method: string, args?: ?) -> [?]",
            "!url": "http://underscorejs.org/#invoke"
        },
        "isArguments": {
            "!doc": "Returns true if object is an Arguments object.",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isArguments"
        },
        "isArray": {
            "!doc": "Is a given value an array? Delegates to ECMA5's native Array.isArray",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isArray"
        },
        "isBoolean": {
            "!doc": "Is a given value a boolean?",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isBoolean"
        },
        "isDate": {
            "!doc": "Returns true if object is a Date object.",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isDate"
        },
        "isElement": {
            "!doc": "Is a given value a DOM element?",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isElement"
        },
        "isEmpty": {
            "!doc": "Is a given array, string, or object empty? An \"empty\" object has no enumerable own-properties.",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isEmpty"
        },
        "isEqual": {
            "!doc": "Perform a deep comparison to check if two objects are equal.",
            "!type": "fn(a: ?, b: ?) -> bool",
            "!url": "http://underscorejs.org/#isEqual"
        },
        "isFinite": {
            "!doc": "Is a given object a finite number?",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isFinite"
        },
        "isFunction": {
            "!doc": "Returns true if object is a Function.",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isFunction"
        },
        "isNaN": {
            "!doc": "Is the given value `NaN`? (NaN is the only number which does not equal itself).",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isNaN"
        },
        "isNull": {
            "!doc": "Is a given value equal to null?",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isNull"
        },
        "isNumber": {
            "!doc": "Returns true if object is a Number (including NaN).",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isNumber"
        },
        "isObject": {
            "!doc": "Is a given variable an object?",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isObject"
        },
        "isRegExp": {
            "!doc": "Returns true if object is a regular expression.",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isRegExp"
        },
        "isString": {
            "!doc": "Returns true if object is a String.",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isString"
        },
        "isUndefined": {
            "!doc": "Is a given variable undefined?",
            "!type": "fn(obj: ?) -> bool",
            "!url": "http://underscorejs.org/#isUndefined"
        },
        "keys": {
            "!doc": "Retrieve the names of an object's properties. Delegates to ECMAScript 5's native `Object.keys`",
            "!type": "fn(obj: ?) -> [string]",
            "!url": "http://underscorejs.org/#keys"
        },
        "last": {
            "!doc": "Get the last element of an array.",
            "!type": "fn(array: [?], n?: number) -> !0.<i>",
            "!url": "http://underscorejs.org/#last"
        },
        "lastIndexOf": {
            "!doc": "Returns the index of the last occurrence of value in the array, or -1 if value is not present.",
            "!type": "fn(array: [?], item: ?, from?: number) -> number",
            "!url": "http://underscorejs.org/#lastIndexOf"
        },
        "map": {
            "!doc": "Produces a new array of values by mapping each value in list through a transformation function (iterator).",
            "!type": "fn(obj: [?], iterator: fn(elt: ?, i: number) -> ?, context?: ?) -> [!1.!ret]",
            "!effects": ["call !1 !this=!2 !0.<i> number"],
            "!url": "http://underscorejs.org/#map"
        },
        "max": {
            "!doc": "Returns the maximum value in list.",
            "!type": "fn(list: [?], iterator?: fn(elt: ?, i: number) -> number, context?: ?) -> number",
            "!url": "http://underscorejs.org/#max"
        },
        "memoize": {
            "!doc": "Memoize an expensive function by storing its results.",
            "!type": "fn(func: fn(), hasher?: fn(args: ?) -> ?) -> !0",
            "!url": "http://underscorejs.org/#memoize"
        },
        "methods": "_.functions",
        "min": {
            "!doc": "Returns the minimum value in list.",
            "!type": "fn(list: [?], iterator?: fn(elt: ?, i: number) -> number, context?: ?) -> number",
            "!url": "http://underscorejs.org/#min"
        },
        "mixin": {
            "!doc": "Add your own custom functions to the Underscore object.",
            "!type": "fn(obj: _)",
            "!url": "http://underscorejs.org/#mixin"
        },
        "noConflict": {
            "!doc": "Run Underscore.js in *noConflict* mode, returning the `_` variable to its previous owner. Returns a reference to the Underscore object.",
            "!type": "fn() -> _",
            "!url": "http://underscorejs.org/#noConflict"
        },
        "object": {
            "!doc": "Converts lists into objects.",
            "!type": "fn(list: [?], values?: [?]) -> ?",
            "!url": "http://underscorejs.org/#object"
        },
        "omit": {
            "!doc": "Return a copy of the object without the blacklisted properties.",
            "!type": "fn(obj: ?, keys?: string) -> !0",
            "!url": "http://underscorejs.org/#omit"
        },
        "once": {
            "!doc": "Returns a function that will be executed at most one time, no matter how often you call it.",
            "!type": "fn(func: fn() -> ?) -> !0",
            "!url": "http://underscorejs.org/#once"
        },
        "pairs": {
            "!doc": "Convert an object into a list of `[key, value]` pairs.",
            "!type": "fn(obj: ?) -> [[?]]",
            "!url": "http://underscorejs.org/#pairs"
        },
        "partial": {
            "!doc": "Partially apply a function by creating a version that has had some of its arguments pre-filled, without changing its dynamic `this` context.",
            "!type": "fn(func: ?, args?: ?) -> fn()",
            "!url": "http://underscorejs.org/#partial"
        },
        "pick": {
            "!doc": "Return a copy of the object only containing the whitelisted properties.",
            "!type": "fn(obj: ?, keys?: string) -> !0",
            "!url": "http://underscorejs.org/#pick"
        },
        "pluck": {
            "!doc": "Convenience version of a common use case of `map`: fetching a property.",
            "!type": "fn(obj: [?], key: string) -> [?]",
            "!url": "http://underscorejs.org/#pluck"
        },
        "prototype": {
            "chain": {
                "!doc": "Start chaining a wrapped Underscore object.",
                "!type": "fn() -> !this"
            },
            "value": {
                "!doc": "Extracts the result from a wrapped and chained object.",
                "!type": "fn() -> ?"
            },
            "pop": "fn() -> ?",
            "push": "fn(newelt: ?) -> number",
            "reverse": "fn()",
            "shift": "fn() -> ?",
            "sort": "fn() -> !this",
            "splice": "fn(pos: number, amount: number)",
            "unshift": "fn(elt: ?) -> number",
            "concat": "fn(other: ?) -> !this",
            "join": "fn(separator?: string) -> string",
            "slice": "fn(from: number, to?: number) -> !this"
        },
        "random": {
            "!doc": "Return a random integer between min and max (inclusive).",
            "!type": "fn(min: number, max: number) -> number",
            "!url": "http://underscorejs.org/#random"
        },
        "range": {
            "!doc": "A function to create flexibly-numbered lists of integers.",
            "!type": "fn(start?: number, stop: number, step?: number) -> [number]",
            "!url": "http://underscorejs.org/#range"
        },
        "reduce": {
            "!doc": "reduce boils down a list of values into a single value.",
            "!type": "fn(list: [?], iterator: fn(sum: ?, elt: ?, i: number) -> ?, init?: ?, context?: ?) -> !1.!ret",
            "!effects": ["call !1 this=!3 !2 !0.<i> number"],
            "!url": "http://underscorejs.org/#reduce"
        },
        "reduceRight": {
            "!doc": "The right-associative version of reduce, also known as `foldr`.",
            "!type": "fn(list: [?], iterator: fn(sum: ?, elt: ?, i: number) -> ?, init?: ?, context?: ?) -> !1.!ret",
            "!effects": ["call !1 this=!3 !2 !0.<i> number"],
            "!url": "http://underscorejs.org/#reduceRight"
        },
        "reject": {
            "!doc": "Returns the values in list without the elements that the truth test (iterator) passes. The opposite of filter.",
            "!type": "fn(list: [?], iterator: fn(elt: ?, i: number) -> bool, context?: ?) -> !0",
            "!effects": ["call !1 this=!3 !0.<i> number"],
            "!url": "http://underscorejs.org/#reject"
        },
        "rest": {
            "!doc": "Returns the rest of the elements in an array.",
            "!type": "fn(array: [?], n?: number) -> !0",
            "!url": "http://underscorejs.org/#rest"
        },
        "result": {
            "!doc": "If the value of the named `property` is a function then invoke it with the `object` as context; otherwise, return it.",
            "!type": "fn(object: ?, property: string) -> !0.<i>",
            "!url": "http://underscorejs.org/#result"
        },
        "select": "_.filter",
        "shuffle": {
            "!doc": "Shuffle an array.",
            "!type": "fn(list: [?]) -> !0",
            "!url": "http://underscorejs.org/#shuffle"
        },
        "size": {
            "!doc": "Return the number of elements in an object.",
            "!type": "fn(obj: ?) -> number",
            "!url": "http://underscorejs.org/#size"
        },
        "some": {
            "!doc": "Returns true if any of the values in the list pass the iterator truth test.",
            "!type": "fn(list: [?], iterator: fn(elt: ?, i: number) -> bool, context?: ?) -> bool",
            "!effects": ["call !1 this=!2 !0.<i> number"],
            "!url": "http://underscorejs.org/#some"
        },
        "sortBy": {
            "!doc": "Sort the object's values by a criterion produced by an iterator.",
            "!type": "fn(list: [?], iterator: fn(elt: ?, i: number) -> number, context?: ?) -> !0",
            "!url": "http://underscorejs.org/#sortBy"
        },
        "sortedIndex": {
            "!doc": "Use a comparator function to figure out the smallest index at which an object should be inserted so as to maintain order.",
            "!type": "fn(array: [?], obj: ?, iterator: fn(elt: ?, i: number), context?: ?) -> number",
            "!url": "http://underscorejs.org/#sortedIndex"
        },
        "tail": "_.rest",
        "take": "_.first",
        "tap": {
            "!doc": "Invokes interceptor with the obj, and then returns obj.",
            "!type": "fn(obj: ?, interceptor: fn()) -> !0",
            "!effects": ["call !1 !0"],
            "!url": "http://underscorejs.org/#tap"
        },
        "template": {
            "!doc": "Compiles JavaScript templates into functions that can be evaluated for rendering. ",
            "!type": "fn(text: string, data?: ?, settings?: _.templateSettings) -> fn(data: ?) -> string",
            "!url": "http://underscorejs.org/#template"
        },
        "templateSettings": {
            "!doc": "By default, Underscore uses ERB-style template delimiters, change the following template settings to use alternative delimiters.",
            "escape": "+RegExp",
            "evaluate": "+RegExp",
            "interpolate": "+RegExp",
            "!url": "http://underscorejs.org/#templateSettings"
        },
        "throttle": {
            "!doc": "Returns a function, that, when invoked, will only be triggered at most once during a given window of time.",
            "!type": "fn(func: fn(), wait: number, options?: ?) -> !0",
            "!url": "http://underscorejs.org/#throttle"
        },
        "times": {
            "!doc": "Run a function n times.",
            "!type": "fn(n: number, iterator: fn(), context?: ?) -> [!1.!ret]",
            "!url": "http://underscorejs.org/#times"
        },
        "toArray": {
            "!doc": "Safely create a real, live array from anything iterable.",
            "!type": "fn(obj: ?) -> [?]",
            "!url": "http://underscorejs.org/#toArray"
        },
        "unescape": {
            "!doc": "The opposite of escape.",
            "!type": "fn(string) -> string",
            "!url": "http://underscorejs.org/#unescape"
        },
        "union": {
            "!doc": "Produce an array that contains the union: each distinct element from all of the passed-in arrays.",
            "!type": "fn(array: [?], array2: [?]) -> ?0",
            "!url": "http://underscorejs.org/#union"
        },
        "uniq": {
            "!doc": "Produce a duplicate-free version of the array.",
            "!type": "fn(array: [?], isSorted?: bool, iterator?: fn(elt: ?, i: number), context?: ?) -> [?]",
            "!url": "http://underscorejs.org/#uniq"
        },
        "unique": "_.uniq",
        "uniqueId": {
            "!doc": "Generate a unique integer id (unique within the entire client session). Useful for temporary DOM ids.",
            "!type": "fn(prefix: string) -> string",
            "!url": "http://underscorejs.org/#uniqueId"
        },
        "values": {
            "!doc": "Retrieve the values of an object's properties.",
            "!type": "fn(obj: ?) -> [!0.<i>]",
            "!url": "http://underscorejs.org/#values"
        },
        "where": {
            "!doc": "Looks through each value in the list, returning an array of all the values that contain all of the key-value pairs listed in properties.",
            "!type": "fn(list: [?], attrs: ?) -> !0",
            "!url": "http://underscorejs.org/#where"
        },
        "without": {
            "!doc": "Return a version of the array that does not contain the specified value(s).",
            "!type": "fn(array: [?], values: [?]) -> !0",
            "!url": "http://underscorejs.org/#without"
        },
        "wrap": {
            "!doc": "Returns the first function passed as an argument to the second, allowing you to adjust arguments, run code before and after, and conditionally execute the original function.",
            "!type": "fn(func: fn(), wrapper: fn(?)) -> !0",
            "!effects": ["call !1 !0"],
            "!url": "http://underscorejs.org/#wrap"
        },
        "zip": {
            "!doc": "Zip together multiple lists into a single array -- elements that share an index go together.",
            "!type": "fn(array1: [?], array2: [?]) -> [?]",
            "!url": "http://underscorejs.org/#zip"
        }
    }
};

//#endregion

//#region tern/defs/ecma6.json

var def_ecma6 = {
    "!name": "ecma6",
    "!define": {
        "Promise.prototype": {
            "catch": {
                "!doc": "The catch() method returns a Promise and deals with rejected cases only. It behaves the same as calling Promise.prototype.then(undefined, onRejected).",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch",
                "!type": "fn(onRejected: fn(reason: ?))"
            },
            "then": {
                "!doc": "The then() method returns a Promise. It takes two arguments, both are callback functions for the success and failure cases of the Promise.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then",
                "!type": "fn(onFulfilled: fn(value: ?), onRejected: fn(reason: ?))",
                "!effects": ["call !0 !this.value"]
            }
        },
        "promiseReject": {
            "!type": "fn(reason: ?)"
        }
    },
    "Array": {
        "from": {
            "!type": "fn(arrayLike: [], mapFn?: fn(), thisArg?: ?) -> !custom:Array_ctor",
            "!doc": "The Array.from() method creates a new Array instance from an array-like or iterable object.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from"
        },
        "of": {
            "!type": "fn(elementN: ?) -> !custom:Array_ctor",
            "!doc": "The Array.of() method creates a new Array instance with a variable number of arguments, regardless of number or type of the arguments.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of"
        },
        "prototype": {
            "copyWithin": {
                "!type": "fn(target: number, start: number, end?: number) -> !custom:Array_ctor",
                "!doc": "The copyWithin() method copies the sequence of array elements within the array to the position starting at target. The copy is taken from the index positions of the second and third arguments start and end. The end argument is optional and defaults to the length of the array.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/copyWithin"
            },
            "entries": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The entries() method returns a new Array Iterator object that contains the key/value pairs for each index in the array.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/entries"
            },
            "fill": {
                "!type": "fn(value: ?, start?: number, end?: number)",
                "!doc": "The fill() method fills all the elements of an array from a start index to an end index with a static value.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill"
            },
            "find": {
                "!type": "fn(callback: fn(element: ?, index: number, array: []), thisArg?: ?) -> ?",
                "!doc": "The find() method returns a value in the array, if an element in the array satisfies the provided testing function. Otherwise undefined is returned.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find"
            },
            "findIndex": {
                "!type": "fn(callback: fn(element: ?, index: number, array: []), thisArg?: ?) -> number",
                "!doc": "The findIndex() method returns an index in the array, if an element in the array satisfies the provided testing function. Otherwise -1 is returned.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex"
            },
            "keys": {
                "!type": "fn() -> !custom:Array_ctor",
                "!doc": "The keys() method returns a new Array Iterator that contains the keys for each index in the array.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/keys"
            },
            "values": {
                "!type": "fn() -> !custom:Array_ctor",
                "!doc": "The values() method returns a new Array Iterator object that contains the values for each index in the array.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/values"
            }
        }
    },
    "ArrayBuffer": {
        "!type": "fn(length: number)",
        "!doc": "The ArrayBuffer object is used to represent a generic, fixed-length raw binary data buffer. You can not directly manipulate the contents of an ArrayBuffer; instead, you create one of the typed array objects or a DataView object which represents the buffer in a specific format, and use that to read and write the contents of the buffer.",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer",
        "isView": {
            "!type": "fn(arg: ?) -> bool",
            "!doc": "The ArrayBuffer.isView() method returns true if arg is a view one of the ArrayBuffer views, such as typed array objects or a DataView; false otherwise.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/isView"
        },
        "transfer": {
            "!type": "fn(oldBuffer: ?, newByteLength: ?)",
            "!doc": "The static ArrayBuffer.transfer() method returns a new ArrayBuffer whose contents are taken from the oldBuffer's data and then is either truncated or zero-extended by newByteLength. If newByteLength is undefined, the byteLength of the oldBuffer is used. This operation leaves oldBuffer in a detached state.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/transfer"
        },
        "prototype": {
            "byteLength": {
                "!type": "number",
                "!doc": "The byteLength accessor property represents the length of an ArrayBuffer in bytes.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/byteLength"
            },
            "slice": {
                "!type": "fn(begin: number, end?: number) -> +ArrayBuffer",
                "!doc": "The slice() method returns a new ArrayBuffer whose contents are a copy of this ArrayBuffer's bytes from begin, inclusive, up to end, exclusive.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/slice"
            }
        }
    },
    "DataView": {
        "!type": "fn(buffer: +ArrayBuffer, byteOffset?: number, byteLength?: number)",
        "!doc": "The DataView view provides a low-level interface for reading data from and writing it to an ArrayBuffer.",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView",
        "prototype": {
            "buffer": {
                "!type": "+ArrayBuffer",
                "!doc": "The buffer accessor property represents the ArrayBuffer referenced by the DataView at construction time.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/buffer"
            },
            "byteLength": {
                "!type": "number",
                "!doc": "The byteLength accessor property represents the length (in bytes) of this view from the start of its ArrayBuffer.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/byteLength"
            },
            "byteOffset": {
                "!type": "number",
                "!doc": "The byteOffset accessor property represents the offset (in bytes) of this view from the start of its ArrayBuffer.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/byteOffset"
            },
            "getFloat32": {
                "!type": "fn(byteOffset: number, littleEndian?: bool) -> number",
                "!doc": "The getFloat32() method gets a signed 32-bit integer (float) at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getFloat32"
            },
            "getFloat64": {
                "!type": "fn(byteOffset: number, littleEndian?: bool) -> number",
                "!doc": "The getFloat64() method gets a signed 64-bit float (double) at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getFloat64"
            },
            "getInt16": {
                "!type": "fn(byteOffset: number, littleEndian?: bool) -> number",
                "!doc": "The getInt16() method gets a signed 16-bit integer (short) at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getInt16"
            },
            "getInt32": {
                "!type": "fn(byteOffset: number, littleEndian?: bool) -> number",
                "!doc": "The getInt32() method gets a signed 32-bit integer (long) at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getInt32"
            },
            "getInt8": {
                "!type": "fn(byteOffset: number, littleEndian?: bool) -> number",
                "!doc": "The getInt8() method gets a signed 8-bit integer (byte) at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getInt8"
            },
            "getUint16": {
                "!type": "fn(byteOffset: number, littleEndian?: bool) -> number",
                "!doc": "The getUint16() method gets an unsigned 16-bit integer (unsigned short) at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint16"
            },
            "getUint32": {
                "!type": "fn(byteOffset: number, littleEndian?: bool) -> number",
                "!doc": "The getUint32() method gets an unsigned 32-bit integer (unsigned long) at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32"
            },
            "getUint8": {
                "!type": "fn(byteOffset: number) -> number",
                "!doc": "The getUint8() method gets an unsigned 8-bit integer (unsigned byte) at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint8"
            },
            "setFloat32": {
                "!type": "fn(byteOffset: number, value: number, littleEndian?: bool)",
                "!doc": "The setFloat32() method stores a signed 32-bit integer (float) value at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setFloat32"
            },
            "setFloat64": {
                "!type": "fn(byteOffset: number, value: number, littleEndian?: bool)",
                "!doc": "The setFloat64() method stores a signed 64-bit integer (double) value at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setFloat64"
            },
            "setInt16": {
                "!type": "fn(byteOffset: number, value: number, littleEndian?: bool)",
                "!doc": "The setInt16() method stores a signed 16-bit integer (short) value at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setInt16"
            },
            "setInt32": {
                "!type": "fn(byteOffset: number, value: number, littleEndian?: bool)",
                "!doc": "The setInt32() method stores a signed 32-bit integer (long) value at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setInt32"
            },
            "setInt8": {
                "!type": "fn(byteOffset: number, value: number)",
                "!doc": "The setInt8() method stores a signed 8-bit integer (byte) value at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setInt8"
            },
            "setUint16": {
                "!type": "fn(byteOffset: number, value: number, littleEndian?: bool)",
                "!doc": "The setUint16() method stores an unsigned 16-bit integer (unsigned short) value at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setUint16"
            },
            "setUint32": {
                "!type": "fn(byteOffset: number, value: number, littleEndian?: bool)",
                "!doc": "The setUint32() method stores an unsigned 32-bit integer (unsigned long) value at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setUint32"
            },
            "setUint8": {
                "!type": "fn(byteOffset: number, value: number)",
                "!doc": "The setUint8() method stores an unsigned 8-bit integer (byte) value at the specified byte offset from the start of the DataView.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setUint8"
            }
        }
    },
    "Float32Array": {
        "!type": "fn(length: number)",
        "!doc": "The Float32Array typed array represents an array of 32-bit floating point numbers (corresponding to the C float data type) in the platform byte order. If control over byte order is needed, use DataView instead. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array",
        "prototype": {
            "!proto": "TypedArray.prototype"
        },
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of"
    },
    "Float64Array": {
        "!type": "fn(length: number)",
        "!doc": "The Float64Array typed array represents an array of 64-bit floating point numbers (corresponding to the C double data type) in the platform byte order. If control over byte order is needed, use DataView instead. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float64Array",
        "prototype": {
            "!proto": "TypedArray.prototype"
        },
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of"
    },
    "Int16Array": {
        "!type": "fn(length: number)",
        "!doc": "The Int16Array typed array represents an array of twos-complement 16-bit signed integers in the platform byte order. If control over byte order is needed, use DataView instead. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int16Array",
        "prototype": {
            "!proto": "TypedArray.prototype"
        },
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of"
    },
    "Int32Array": {
        "!type": "fn(length: number)",
        "!doc": "The Int32Array typed array represents an array of twos-complement 32-bit signed integers in the platform byte order. If control over byte order is needed, use DataView instead. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int32Array",
        "prototype": {
            "!proto": "TypedArray.prototype"
        },
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of"
    },
    "Int8Array": {
        "!type": "fn(length: number)",
        "!doc": "The Int8Array typed array represents an array of twos-complement 8-bit signed integers. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int8Array",
        "prototype": {
            "!proto": "TypedArray.prototype"
        },
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of"
    },
    "Map": {
        "!type": "fn(iterable?: [])",
        "!doc": "The Map object is a simple key/value map. Any value (both objects and primitive values) may be used as either a key or a value.",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map",
        "prototype": {
            "clear": {
                "!type": "fn()",
                "!doc": "The clear() method removes all elements from a Map object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/clear"
            },
            "delete": {
                "!type": "fn(key: ?)",
                "!doc": "The delete() method removes the specified element from a Map object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete"
            },
            "entries": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The entries() method returns a new Iterator object that contains the [key, value] pairs for each element in the Map object in insertion order.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/entries"
            },
            "forEach": {
                "!type": "fn(callback: fn(value: ?, key: ?, map: +Map), thisArg?: ?)",
                "!effects": ["call !0 this=!1 !this.<i> number !this"],
                "!doc": "The forEach() method executes a provided function once per each key/value pair in the Map object, in insertion order.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach"
            },
            "get": {
                "!type": "fn(key: ?) -> !this.<i>",
                "!doc": "The get() method returns a specified element from a Map object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get"
            },
            "has": {
                "!type": "fn(key: ?) -> bool",
                "!doc": "The has() method returns a boolean indicating whether an element with the specified key exists or not.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/has"
            },
            "keys": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The keys() method returns a new Iterator object that contains the keys for each element in the Map object in insertion order.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/keys"
            },
            "set": {
                "!type": "fn(key: ?, value: ?) -> !this",
                "!doc": "The set() method adds a new element with a specified key and value to a Map object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set"
            },
            "size": {
                "!type": "number",
                "!doc": "The size accessor property returns the number of elements in a Map object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/size"
            },
            "values": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The values() method returns a new Iterator object that contains the values for each element in the Map object in insertion order.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/values"
            },
            "prototype[@@iterator]": {
                "!type": "fn()",
                "!doc": "The initial value of the @@iterator property is the same function object as the initial value of the entries property.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/@@iterator"
            }
        }
    },
    "Math": {
        "acosh": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.acosh() function returns the hyperbolic arc-cosine of a number, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/acosh"
        },
        "asinh": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.asinh() function returns the hyperbolic arcsine of a number, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/asinh"
        },
        "atanh": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.atanh() function returns the hyperbolic arctangent of a number, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atanh"
        },
        "cbrt": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.cbrt() function returns the cube root of a number, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/cbrt"
        },
        "clz32": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.clz32() function returns the number of leading zero bits in the 32-bit binary representation of a number.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32"
        },
        "cosh": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.cosh() function returns the hyperbolic cosine of a number, that can be expressed using the constant e:",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/cosh"
        },
        "expm1": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.expm1() function returns ex - 1, where x is the argument, and e the base of the natural logarithms.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/expm1"
        },
        "fround": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.fround() function returns the nearest single precision float representation of a number.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround"
        },
        "hypot": {
            "!type": "fn(value: number) -> number",
            "!doc": "The Math.hypot() function returns the square root of the sum of squares of its arguments, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/hypot"
        },
        "imul": {
            "!type": "fn(a: number, b: number) -> number",
            "!doc": "The Math.imul() function returns the result of the C-like 32-bit multiplication of the two parameters.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul"
        },
        "log10": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.log10() function returns the base 10 logarithm of a number, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log10"
        },
        "log1p": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.log1p() function returns the natural logarithm (base e) of 1 + a number, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log1p"
        },
        "log2": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.log2() function returns the base 2 logarithm of a number, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log2"
        },
        "sign": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.sign() function returns the sign of a number, indicating whether the number is positive, negative or zero.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sign"
        },
        "sinh": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.sinh() function returns the hyperbolic sine of a number, that can be expressed using the constant e:",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sinh"
        },
        "tanh": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.tanh() function returns the hyperbolic tangent of a number, that is",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/tanh"
        },
        "trunc": {
            "!type": "fn(x: number) -> number",
            "!doc": "The Math.trunc() function returns the integral part of a number by removing any fractional digits. It does not round any numbers. The function can be expressed with the floor() and ceil() function:",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc"
        }
    },
    "Number": {
        "EPSILON": {
            "!type": "number",
            "!doc": "The Number.EPSILON property represents the difference between one and the smallest value greater than one that can be represented as a Number.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON"
        },
        "MAX_SAFE_INTEGER": {
            "!type": "number",
            "!doc": "The Number.MAX_SAFE_INTEGER constant represents the maximum safe integer in JavaScript (253 - 1).",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER"
        },
        "MIN_SAFE_INTEGER": {
            "!type": "number",
            "!doc": "The Number.MIN_SAFE_INTEGER constant represents the minimum safe integer in JavaScript (-(253 - 1)).",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MIN_SAFE_INTEGER"
        },
        "isFinite": {
            "!type": "fn(testValue: ?) -> bool",
            "!doc": "The Number.isFinite() method determines whether the passed value is finite.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite"
        },
        "isInteger": {
            "!type": "fn(testValue: ?) -> bool",
            "!doc": "The Number.isInteger() method determines whether the passed value is an integer.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger"
        },
        "isNaN": {
            "!type": "fn(testValue: ?) -> bool",
            "!doc": "The Number.isNaN() method determines whether the passed value is NaN. More robust version of the original global isNaN().",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN"
        },
        "isSafeInteger": {
            "!type": "fn(testValue: ?) -> bool",
            "!doc": "The Number.isSafeInteger() method determines whether the provided value is a number that is a safe integer. A safe integer is an integer that",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isSafeInteger"
        },
        "parseFloat": {
            "!type": "fn(string: string) -> number",
            "!doc": "The Number.parseFloat() method parses a string argument and returns a floating point number. This method behaves identically to the global function parseFloat() and is part of ECMAScript 6 (its purpose is modularization of globals).",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/parseFloat"
        },
        "parseInt": {
            "!type": "fn(string: string, radix?: number) -> number",
            "!doc": "The Number.parseInt() method parses a string argument and returns an integer of the specified radix or base. This method behaves identically to the global function parseInt() and is part of ECMAScript 6 (its purpose is modularization of globals).",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/parseInt"
        }
    },
    "Object": {
        "assign": {
            "!type": "fn(target: ?, sources: ?) -> ?",
            "!doc": "The Object.assign() method is used to copy the values of all enumerable own properties from one or more source objects to a target object. It will return the target object.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign"
        },
        "getOwnPropertySymbols": {
            "!type": "fn(obj: ?) -> [?]",
            "!doc": "The Object.getOwnPropertySymbols() method returns an array of all symbol properties found directly upon a given object.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertySymbols"
        },
        "is": {
            "!type": "fn(value1: ?, value2: ?) -> bool",
            "!doc": "The Object.is() method determines whether two values are the same value.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is"
        },
        "setPrototypeOf": {
            "!type": "fn(obj: ?, prototype: ?)",
            "!doc": "The Object.setPrototype() method sets the prototype (i.e., the internal [[Prototype]] property) of a specified object to another object or null.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf"
        }
    },
    "Promise": {
        "!type": "fn(executor: fn(resolve: fn(value: ?), reject: promiseReject)) -> !custom:Promise_ctor",
        "!doc": "The Promise object is used for deferred and asynchronous computations. A Promise is in one of the three states:",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
        "all": {
            "!type": "fn(iterable: [+Promise]) -> !0.<i>",
            "!doc": "The Promise.all(iterable) method returns a promise that resolves when all of the promises in the iterable argument have resolved.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all"
        },
        "race": {
            "!type": "fn(iterable: [+Promise]) -> !0.<i>",
            "!doc": "The Promise.race(iterable) method returns a promise that resolves or rejects as soon as one of the promises in the iterable resolves or rejects, with the value or reason from that promise.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race"
        },
        "reject": {
            "!type": "fn(reason: ?) -> !this",
            "!doc": "The Promise.reject(reason) method returns a Promise object that is rejected with the given reason.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject"
        },
        "resolve": {
            "!type": "fn(value: ?) -> +Promise[value=!0]",
            "!doc": "The Promise.resolve(value) method returns a Promise object that is resolved with the given value. If the value is a thenable (i.e. has a then method), the returned promise will 'follow' that thenable, adopting its eventual state; otherwise the returned promise will be fulfilled with the value.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve"
        },
        "prototype": "Promise.prototype"
    },
    "Proxy": {
        "!type": "fn(target: ?, handler: ?)",
        "!doc": "The Proxy object is used to define the custom behavior in JavaScript fundamental operation (e.g. property lookup, assignment, enumeration, function invocation, etc).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy",
        "revocable": {
            "!doc": "The Proxy.revocable() method is used to create a revocable Proxy object.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/revocable"
        }
    },
    "RegExp": {
        "prototype": {
            "flags": {
                "!type": "string",
                "!doc": "The flags property returns a string consisting of the flags of the current regular expression object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/flags"
            },
            "sticky": {
                "!type": "bool",
                "!doc": "The sticky property reflects whether or not the search is sticky (searches in strings only from the index indicated by the lastIndex property of this regular expression). sticky is a read-only property of an individual regular expression object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/sticky"
            }
        }
    },
    "Set": {
        "!type": "fn(iterable: [?])",
        "!doc": "The Set object lets you store unique values of any type, whether primitive values or object references.",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set",
        "length": {
            "!type": "number",
            "!doc": "The value of the length property is 1."
        },
        "prototype": {
            "add": {
                "!type": "fn(value: ?) -> !this",
                "!doc": "The add() method appends a new element with a specified�value to the end of a Set object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/add"
            },
            "clear": {
                "!type": "fn()",
                "!doc": "The clear() method removes all elements from a Set object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/clear"
            },
            "delete": {
                "!type": "fn(value: ?) -> bool",
                "!doc": "The delete() method removes the specified element from a Set object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/delete"
            },
            "entries": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The entries() method returns a new Iterator object that contains an array of [value, value] for each element in the Set object, in insertion order. For Set objects there is no key like in Map objects. However, to keep the API similar to the Map object, each entry has the same value for its key and value here, so that an array [value, value] is returned.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/entries"
            },
            "forEach": {
                "!type": "fn(callback: fn(value: ?, value2: ?, set: +Set), thisArg?: ?)",
                "!effects": ["call !0 this=!1 !this.<i> number !this"]
            },
            "has": {
                "!type": "fn(value: ?) -> bool",
                "!doc": "The has() method returns a boolean indicating whether an element with the specified value exists in a Set object or not.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/has"
            },
            "keys": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The values() method returns a new Iterator object that contains the values for each element in the Set object in insertion order.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/keys"
            },
            "size": {
                "!type": "number",
                "!doc": "The size accessor property returns the number of elements in a Set object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/size"
            },
            "values": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The values() method returns a new Iterator object that contains the values for each element in the Set object in insertion order.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/values"
            },
            "prototype[@@iterator]": {
                "!type": "fn()",
                "!doc": "The initial value of the @@iterator property is the same function object as the initial value of the values property.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/@@iterator"
            }
        }
    },
    "String": {
        "fromCodePoint": {
            "!type": "fn(num1: ?) -> string",
            "!doc": "The static String.fromCodePoint() method returns a string created by using the specified sequence of code points.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint"
        },
        "raw": {
            "!type": "fn(callSite: ?, substitutions: ?, templateString: ?) -> string",
            "!doc": "The static String.raw() method is a tag function of template strings, like the r prefix in Python or the @ prefix in C# for string literals, this function is used to get the raw string form of template strings.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw"
        },
        "prototype": {
            "codePointAt": {
                "!type": "fn(pos: number) -> number",
                "!doc": "The codePointAt() method returns a non-negative integer that is the UTF-16 encoded code point value.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt"
            },
            "endsWith": {
                "!type": "fn(searchString: string, position?: number) -> bool",
                "!doc": "The endsWith() method determines whether a string ends with the characters of another string, returning true or false as appropriate.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith"
            },
            "includes": {
                "!type": "fn(searchString: string, position?: number) -> bool",
                "!doc": "The includes() method determines whether one string may be found within another string, returning true or false as appropriate.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/contains"
            },
            "normalize": {
                "!type": "fn(form: string) -> string",
                "!doc": "The normalize() method returns the Unicode Normalization Form of a given string (if the value isn't a string, it will be converted to one first).",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize"
            },
            "repeat": {
                "!type": "fn(count: number) -> string",
                "!doc": "The repeat() method constructs and returns a new string which contains the specified number of copies of the string on which it was called, concatenated together.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat"
            },
            "startsWith": {
                "!type": "fn(searchString: string, position?: number) -> bool",
                "!doc": "The startsWith() method determines whether a string begins with the characters of another string, returning true or false as appropriate.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith"
            }
        }
    },
    "Symbol": {
        "!type": "fn(description?: string)",
        "!doc": "A symbol is a unique and immutable data type and may be used as an identifier for object properties. The symbol object is an implicit object wrapper for the symbol primitive data type.",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol",
        "for": {
            "!type": "fn(key: string) -> +Symbol",
            "!doc": "The Symbol.for(key) method searches for existing symbols in a runtime-wide symbol registry with the given key and returns it if found. Otherwise a new symbol gets created in the global symbol registry with this key.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/for"
        },
        "keyFor": {
            "!type": "fn(sym: +Symbol) -> +Symbol",
            "!doc": "The Symbol.keyFor(sym) method retrieves a shared symbol key from the global symbol registry for the given symbol.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/keyFor"
        },
        "prototype": {
            "toString": {
                "!type": "fn() -> string",
                "!doc": "The toString() method returns a string representing the specified Symbol object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toString"
            },
            "valueOf": {
                "!type": "fn() -> ?",
                "!doc": "The valueOf() method returns the primitive value of a Symbol object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/valueOf"
            }
        }
    },
    "TypedArray": {
        "!type": "fn(length: number)",
        "!doc": "A TypedArray object describes an array-like view of an underlying binary data buffer. There is no global property named TypedArray, nor is there a directly visible TypedArray constructor.  Instead, there are a number of different global properties, whose values are typed array constructors for specific element types, listed below. On the following pages you will find common properties and methods that can be used with any typed array containing elements of any type.",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray",
        "BYTES_PER_ELEMENT": {
            "!type": "number",
            "!doc": "The TypedArray.BYTES_PER_ELEMENT property represents the size in bytes of each element in an typed array.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/BYTES_PER_ELEMENT"
        },
        "length": {
            "!type": "number",
            "!doc": "The length accessor property represents the length (in elements) of a typed array.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/length"
        },
        "name": {
            "!type": "string",
            "!doc": "The TypedArray.name property represents a string value of the typed array constructor name.",
            "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/name"
        },
        "prototype": {
            "buffer": {
                "!type": "+ArrayBuffer",
                "!doc": "The buffer accessor property represents the ArrayBuffer referenced by a TypedArray at construction time.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/buffer"
            },
            "byteLength": {
                "!type": "number",
                "!doc": "The byteLength accessor property represents the length (in bytes) of a typed array from the start of its ArrayBuffer.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/byteLength"
            },
            "byteOffset": {
                "!type": "number",
                "!doc": "The byteOffset accessor property represents the offset (in bytes) of a typed array from the start of its ArrayBuffer.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/byteOffset"
            },
            "copyWithin": {
                "!type": "fn(target: number, start: number, end?: number) -> ?",
                "!doc": "The copyWithin() method copies the sequence of array elements within the array to the position starting at target. The copy is taken from the index positions of the second and third arguments start and end. The end argument is optional and defaults to the length of the array. This method has the same algorithm as Array.prototype.copyWithin. TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/copyWithin"
            },
            "entries": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The entries() method returns a new Array Iterator object that contains the key/value pairs for each index in the array.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/entries"
            },
            "every": {
                "!type": "fn(callback: fn(currentValue: ?, index: number, array: +TypedArray) -> bool, thisArg?: ?) -> bool",
                "!effects": ["call !0 this=!1 !this.<i> number !this"],
                "!doc": "The every() method tests whether all elements in the typed array pass the test implemented by the provided function. This method has the same algorithm as Array.prototype.every(). TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/every"
            },
            "fill": {
                "!type": "fn(value: ?, start?: number, end?: number)",
                "!doc": "The fill() method fills all the elements of a typed array from a start index to an end index with a static value. This method has the same algorithm as Array.prototype.fill(). TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/fill"
            },
            "filter": {
                "!type": "fn(test: fn(elt: ?, i: number) -> bool, context?: ?) -> !this",
                "!effects": ["call !0 this=!1 !this.<i> number"],
                "!doc": "Creates a new array with all of the elements of this array for which the provided filtering function returns true. See also Array.prototype.filter().",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/filter"
            },
            "find": {
                "!type": "fn(callback: fn(element: ?, index: number, array: +TypedArray) -> bool, thisArg?: ?) -> ?",
                "!effects": ["call !0 this=!1 !this.<i> number !this"],
                "!doc": "The find() method returns a value in the typed array, if an element satisfies the provided testing function. Otherwise undefined is returned. TypedArray is one of the typed array types here.\nSee also the findIndex() method, which returns the index of a found element in the typed array instead of its value.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/find"
            },
            "findIndex": {
                "!type": "fn(callback: fn(element: ?, index: number, array: +TypedArray) -> bool, thisArg?: ?) -> number",
                "!effects": ["call !0 this=!1 !this.<i> number !this"],
                "!doc": "The findIndex() method returns an index in the typed array, if an element in the typed array satisfies the provided testing function. Otherwise -1 is returned.\nSee also the find() method, which returns the value of a found element in the typed array instead of its index.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/findIndex"
            },
            "forEach": {
                "!type": "fn(callback: fn(value: ?, key: ?, array: +TypedArray), thisArg?: ?)",
                "!effects": ["call !0 this=!1 !this.<i> number !this"],
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/forEach"
            },
            "includes": {
                "!type": "fn(searchElement: ?, fromIndex?: number) -> bool",
                "!doc": "The includes() method determines whether a typed array includes a certain element, returning true or false as appropriate. This method has the same algorithm as Array.prototype.includes(). TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/includes"
            },
            "indexOf": {
                "!type": "fn(searchElement: ?, fromIndex?: number) -> number",
                "!doc": "The indexOf() method returns the first index at which a given element can be found in the typed array, or -1 if it is not present. This method has the same algorithm as Array.prototype.indexOf(). TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/indexOf"
            },
            "join": {
                "!type": "fn(separator?: string) -> string",
                "!doc": "The join() method joins all elements of an array into a string. This method has the same algorithm as Array.prototype.join(). TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/join"
            },
            "keys": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The keys() method returns a new Array Iterator object that contains the keys for each index in the array.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/keys"
            },
            "lastIndexOf": {
                "!type": "fn(searchElement: ?, fromIndex?: number) -> number",
                "!doc": "The lastIndexOf() method returns the last index at which a given element can be found in the typed array, or -1 if it is not present. The typed array is searched backwards, starting at fromIndex. This method has the same algorithm as Array.prototype.lastIndexOf(). TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/lastIndexOf"
            },
            "length": {
                "!type": "number",
                "!doc": "Returns the number of elements hold in the typed array. Fixed at construction time and thus read only.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/length"
            },
            "map": {
                "!type": "fn(f: fn(elt: ?, i: number) -> ?, context?: ?) -> [!0.!ret]",
                "!effects": ["call !0 this=!1 !this.<i> number"],
                "!doc": "Creates a new array with the results of calling a provided function on every element in this array. See also Array.prototype.map().",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/map"
            },
            "reduce": {
                "!type": "fn(combine: fn(sum: ?, elt: ?, i: number) -> ?, init?: ?) -> !0.!ret",
                "!effects": ["call !0 !1 !this.<i> number"],
                "!doc": "Apply a function against an accumulator and each value of the array (from left-to-right) as to reduce it to a single value. See also Array.prototype.reduce().",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/reduce"
            },
            "reduceRight": {
                "!type": "fn(combine: fn(sum: ?, elt: ?, i: number) -> ?, init?: ?) -> !0.!ret",
                "!effects": ["call !0 !1 !this.<i> number"],
                "!doc": "Apply a function against an accumulator and each value of the array (from right-to-left) as to reduce it to a single value. See also Array.prototype.reduceRight().",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/reduceRight"
            },
            "reverse": {
                "!type": "fn()",
                "!doc": "The reverse() method reverses a typed array in place. The first typed array element becomes the last and the last becomes the first. This method has the same algorithm as Array.prototype.reverse(). TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/reverse"
            },
            "set": {
                "!type": "fn(array: [?], offset?: ?)",
                "!doc": "The set() method stores multiple values in the typed array, reading input values from a specified array.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/set"
            },
            "slice": {
                "!type": "fn(from: number, to?: number) -> !this",
                "!type": "Extracts a section of an array and returns a new array. See also Array.prototype.slice().",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/slice"
            },
            "some": {
                "!type": "fn(test: fn(elt: ?, i: number) -> bool, context?: ?) -> bool",
                "!effects": ["call !0 this=!1 !this.<i> number"],
                "!doc": "The some() method tests whether some element in the typed array passes the test implemented by the provided function. This method has the same algorithm as Array.prototype.some(). TypedArray is one of the typed array types here.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/some"
            },
            "sort": {
                "!type": "fn(compare?: fn(a: ?, b: ?) -> number)",
                "!effects": ["call !0 !this.<i> !this.<i>"],
                "!doc": "Sorts the elements of an array in place and returns the array. See also Array.prototype.sort().",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/sort"
            },
            "subarray": {
                "!type": "fn(begin?: number, end?: number) -> +TypedArray",
                "!doc": "The subarray() method returns a new TypedArray on the same ArrayBuffer store and with the same element types as for this TypedArray object. The begin offset is inclusive and the end offset is exclusive. TypedArray is one of the typed array types.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray"
            },
            "values": {
                "!type": "fn() -> TODO_ITERATOR",
                "!doc": "The values() method returns a new Array Iterator object that contains the values for each index in the array.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/values"
            },
            "prototype[@@iterator]": {
                "!type": "fn()",
                "!doc": "The initial value of the @@iterator property is the same function object as the initial value of the values property.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/@@iterator"
            }
        }
    },
    "Uint16Array": {
        "!type": "fn()",
        "!doc": "The Uint16Array typed array represents an array of 16-bit unsigned integers in the platform byte order. If control over byte order is needed, use DataView instead. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array",
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of",
        "prototype": {
            "!proto": "TypedArray.prototype"
        }
    },
    "Uint32Array": {
        "!type": "fn()",
        "!doc": "The Uint32Array typed array represents an array of 32-bit unsigned integers in the platform byte order. If control over byte order is needed, use DataView instead. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array",
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of",
        "prototype": {
            "!proto": "TypedArray.prototype"
        }
    },
    "Uint8Array": {
        "!type": "fn()",
        "!doc": "The Uint8Array typed array represents an array of 8-bit unsigned integers. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array",
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of",
        "prototype": {
            "!proto": "TypedArray.prototype"
        }
    },
    "Uint8ClampedArray": {
        "!type": "fn()",
        "!doc": "The Uint8ClampedArray typed array represents an array of 8-bit unsigned integers clamped to 0-255. The contents are initialized to 0. Once established, you can reference elements in the array using the object's methods, or using standard array index syntax (that is, using bracket notation).",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8ClampedArray",
        "length": "TypedArray.length",
        "BYTES_PER_ELEMENT": "TypedArray.BYTES_PER_ELEMENT",
        "name": "TypedArray.name",
        "from": "TypedArray.from",
        "of": "TypedArray.of",
        "prototype": {
            "!proto": "TypedArray.prototype"
        }
    },
    "WeakMap": {
        "!type": "fn(iterable: [?])",
        "!doc": "The WeakMap object is a collection of key/value pairs in which the keys are objects and the values can be arbitrary values.",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap",
        "prototype": {
            "delete": {
                "!type": "fn(key: ?) -> bool",
                "!doc": "The delete() method removes the specified element from a WeakMap object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap/delete"
            },
            "get": {
                "!type": "fn(key: ?) !this.<i>",
                "!doc": "The get() method returns a specified element from a WeakMap object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap/get"
            },
            "has": {
                "!type": "fn(key: ?) -> bool",
                "!doc": "The has() method returns a boolean indicating whether an element with the specified key exists in the WeakMap object or not.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap/has"
            },
            "set": {
                "!type": "fn(key: ?, value: ?)",
                "!doc": "The set() method adds a new element with a specified key and value to a WeakMap object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap/set"
            }
        }
    },
    "WeakSet": {
        "!type": "fn(iterable: [?])",
        "!doc": "The WeakSet object lets you store weakly held objects in a collection.",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet",
        "prototype": {
            "add": {
                "!type": "fn(value: ?)",
                "!doc": "The add() method appends a new object to the end of a WeakSet object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet/add"
            },
            "delete": {
                "!type": "fn(value: ?) -> bool",
                "!doc": "The delete() method removes the specified element from a WeakSet object.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet/delete"
            },
            "has": {
                "!type": "fn(value: ?) -> bool",
                "!doc": "The has() method returns a boolean indicating whether an object exists in a WeakSet or not.",
                "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet/has"
            }
        }
    }
};

//#endregion

//#region tern/defs/rageserver.json

const def_rageserver = {
    "!name": "Rage:MP Server",
    "!define": {
        Entity: {
            alpha: "number",
            data: {},
            dimension: "number",
            model: "number",
            position: "Vector3",
            id: "number",
            getVariable: "fn(name: string) -> string",
            setVariable: "fn(name: string, value: ?) -> ?"
        },
        ClothesComponent: {
            drawable: "number",
            texture: "number",
            palette: "number"
        },
        HeadBlendData: {
            shapes: "[number]",
            skins: "[number]",
            shapeMix: "number",
            skinMix: "number",
            thirdMix: "number"
        },
        PlayerProp: {
            drawable: "number",
            texture: "number"
        },
        Vector3: {
            "new": "fn(x: number, y: number, z: number) -> Vector3",
            x: "number",
            y: "number",
            z: "number"
        },
        Player: {
            armour: {
                "!type": "number"
            },
            eyeColor: {
                "!type": "number"
            },
            heading: {
                "!type": "number"
            },
            health: {
                "!type": "number"
            },
            name: {
                "!type": "number"
            },
            weapon: {
                "!type": "number"
            },
            weaponAmmo: {
                "!type": "number"
            },
            action: {
                "!type": "string"
            },
            aimTarget: {
                "!type": "Player"
            },
            allWeapons: {
                "!type": "[number]"
            },
            ip: {
                "!type": "string"
            },
            isAiming: {
                "!type": "bool"
            },
            isClimbing: {
                "!type": "bool"
            },
            isEnteringVehicle: {
                "!type": "bool"
            },
            isInCover: {
                "!type": "bool"
            },
            isInMelee: {
                "!type": "bool"
            },
            isJumping: {
                "!type": "bool"
            },
            isLeavingVehicle: {
                "!type": "bool"
            },
            isOnLadder: {
                "!type": "bool"
            },
            isReloading: {
                "!type": "bool"
            },
            hairColor: {
                "!type": "number"
            },
            hairHighlightColor: {
                "!type": "number"
            },
            packetLoss: {
                "!type": "number"
            },
            ping: {
                "!type": "number"
            },
            seat: {
                "!type": "number"
            },
            socialClubName: {
                "!type": "string"
            },
            streamedPlayers: {
                "!type": "[Player]"
            },
            vehicle: {
                "!type": "Vehicle"
            },
            ban: {
                "!type": "fn(reason: string)"
            },
            call: {
                "!type": "fn(eventName: string, args: ?)"
            },
            getClothes: {
                "!type": "fn(component: number) -> ClothesComponent"
            },
            getFaceFeature: "fn(index: number) -> number",
            getHeadBlend: "fn() -> HeadBlendData",
            getHeadOverlay: "fn(overlay: number) -> [number]",
            getProp: "fn(prop: number) -> PlayerProp",
            getWeaponAmmo: "fn(weapon: number) -> number",
            giveWeapon: "fn(weapon: number, ammo: number)",
            isStreamed: "fn(player: Player) -> bool",
            invoke: "fn(hash: string, args: ?)",
            kick: "fn(reason: string)",
            notify: "fn(message: string)",
            outputChatBox: "fn(message: string)",
            playAnimation: "fn(dict: string, name: string, speed: number, flag: number)",
            putIntoVehicle: "fn(vehicle: Vehicle, seat: number)",
            removeAllWeapons: "fn()",
            removeFromVehicle: "fn()",
            removeWeapon: "fn(weapon: number)",
            setClothes: "fn(component: number, drawable: number, texture: number, palette: number)",
            setFaceFeature: "fn(index: number, scale: number)",
            setHairColor: "fn(firstColor: number, secondColor: number)",
            setHeadBlend: "fn(shapeFirstId: number, shapeSecondId: number, shapeThirdId: number, skinFirstId: number, skinSecondId: number, skinThirdId: number, shapeMix: number, skinMix: number, thirdMix: number)",
            setHeadOverlay: "fn(overlay: number, value: [number])",
            setProp: "fn(prop: number, drawable: number, texture: number)",
            setWeaponAmmo: "fn(weapon: number, ammo: number)",
            spawn: "fn(position: Vector3)",
            updateHeadBlend: "fn(shapeMix: number, skinMix: number, thirdMix: number)"
        }
    },
    mp: {
        blips: "string",
        checkpoints: "string",
        colshapes: "string",
        events: {
            add: "fn(eventName: string, callback: fn(args: ?))",
            addCommand: "fn(commandName: string, callback: ?)"
        },
        labels: "string",
        markers: "string",
        pickups: "string",
        players: {
            length: "number",
            size: "number",
            at: "fn(id: number) -> Player",
            exists: "fn(player: Player) -> bool",
            forEach: "fn(callback: fn(player: Player))",
            forEachInRange: "fn(position: Vector3, range: number, callback: fn(player: Player))",
            forEachInDimension: "fn(dimension: number, callback: fn(player: Player))",
            toArray: "fn() -> [Player]",
            broadcast: "fn(text: string)",
            broadcastInDimension: "fn(dimension: number, text: string)",
            broadcastInRange: "fn(position: Vector3, range: number, text: string)"
        },
        objects: "string",
        vehicles: "string",
        world: "string",
        Vector3: "string",
        Event: "string",
        joaat: "fn(str: string) -> number",
        player: "Player"
    }
};

//#endregion