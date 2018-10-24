const antlr4 = require('./antlr4/index')
const { SolidityLexer } = require('./lib/SolidityLexer')
const { SolidityParser } = require('./lib/SolidityParser')
const ASTBuilder = require('./ASTBuilder')
const ErrorListener = require('./ErrorListener')
const { buildTokenList } = require('./tokens')
const hash = require('json-hash');

let elementId = 0;

function ParserError(args) {
  this.message = args.errors[0].message
  this.errors = args.errors

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor)
  } else {
    this.stack = (new Error()).stack
  }
}

ParserError.prototype = Object.create(Error.prototype)
ParserError.prototype.constructor = ParserError
ParserError.prototype.name = 'ParserError'

function tokenize(input, options) {
  options = options || {}

  const chars = antlr4.CharStreams.fromString(input)
  const lexer = new SolidityLexer(chars)
  const tokens = new antlr4.CommonTokenStream(lexer)

  return buildTokenList(tokens.tokenSource.getAllTokens(), options)
}

function parse(input, options) {
  options = options || {}

  const chars = antlr4.CharStreams.fromString(input)

  const listener = new ErrorListener()

  const lexer = new SolidityLexer(chars)
  lexer.removeErrorListeners()
  lexer.addErrorListener(listener)

  const tokens = new antlr4.CommonTokenStream(lexer)

  const parser = new SolidityParser(tokens)

  parser.removeErrorListeners()
  parser.addErrorListener(listener)
  parser.buildParseTrees = true

  const tree = parser.sourceUnit()

  let tokenList
  if (options.tokens) {
    const tokenSource = tokens.tokenSource
    tokenSource.reset()

    tokenList = buildTokenList(tokenSource.getAllTokens(), options)
  }

  if (!options.tolerant && listener.hasErrors()) {
    throw new ParserError({ errors: listener.getErrors() })
  }

  const visitor = new ASTBuilder(options)
  const ast = visitor.visit(tree)

  if (options.tolerant && listener.hasErrors()) {
    ast.errors = listener.getErrors()
  }
  if (options.tokens) {
    ast.tokens = tokenList
  }

  // visit the ast to add "depth" and "id"
  visit(ast, {}, true, true);
  return ast
}

function _isASTNode(node) {
  return !!node && typeof node === 'object' && node.hasOwnProperty('type')
}

function visit(node, visitor, depthf=false, idf=false) {
  let id = 0;
  let subVisit = (node, visitor, depth) => {
    if (_isASTNode(node)) {
      if (depthf) node.depth = depth;
      if (idf) {
        node.id = id;
        id += 1;
      }

      let cont = true

      if (visitor['PrevAll']) {
        cont = visitor['PrevAll'](node)
      }

      if (visitor[node.type]) {
        cont = visitor[node.type](node)
      }

      if (visitor['PostAll']) {
        cont = visitor['PostAll'](node)
      }

      if (visitor['all']) {
        cont = visitor['all'](node)
      }

      if (cont === false) return

      for (const prop in node) {
        if (node.hasOwnProperty(prop)) {
          subVisit(node[prop], visitor, depth+1);
        }
      }

      const selector = node.type + ':exit'
      if (visitor[selector]) {
        visitor[selector](node)
      }
    } else if (Array.isArray(node)) {
      for(var i in node) {
        subVisit(node[i], visitor, depth)
      }
    }
  }
  // run
  subVisit(node, visitor, 0);
}

function graph(node) {
  if (!_isASTNode(node)) {
    return null
  }
  if (! node['name']) {
    if (node['memberName']) node['name'] = node['memberName']
    else node['name'] = node['type']
  }
  if (node['name'] != node['type'])
    node['name'] = node['type'] +"--"+ node['name']
  if (node['loc']['start']['line'])
      node['name'] = node['name'] +"--"+ node['loc']['start']['line']

  for (var key in node) {
    if (Array.isArray(node[key])) {
      let tmp = node[key]
      delete node[key]
      if (!node['children']) node['children'] = []
      for (var i in tmp) {
        let ret = graph(tmp[i])
        if (ret != null) node['children'].push(ret)
      }
    }
  }


  if (!node['children']) node['children'] = []
  for (var key in node) {
    let ret = graph(node[key])
    if (ret != null) {
      node['children'].push(ret)
    }
  }

  if (node['children'] && node['children'].length == 0) {
    delete node['children']
  }
  return node
}


exports.tokenize = tokenize
exports.parse = parse
exports.visit = visit
exports.graph = graph
exports.ParserError = ParserError
exports.checkNode = _isASTNode
