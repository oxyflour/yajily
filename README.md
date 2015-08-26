# yajily
Yet Another Javascript Implement of Lexer and Yacc

### features & usage
The source in src folder is written in ES6, thus can only run on latest Firefox. If you want to use it in other browsers, please include the script in the build folder.

The lexer is based on RegExps. If you define an action and return a token, it should have a 'type' property or the parser will not work.
```javascript
var tokens = lex(input, [
	[/\^|\+|-|\*|\/|%|\(|\)/, function(m) {
		return { type:m, value:m }
	}],
	[/\d+/, function(m) {
		return { type:'NUM', value:parseInt(m) }
	}],
	[/\s+/],
])
```

It takes some time for the parser to generate the LALR(1) table from the grammars. You may want to save the table and pass it to the the parser later.
```javascript
var table = parse.buildState([
	['S', ['E']],
	['E', ['(', 'E', ')'], function(_l, e, _r){ return e }],
	['E', ['-', 'E'],      function(_s, e    ){ return [_s, e] }],
	['E', ['E', '+', 'E'], function(e1, _, e2){ return [_, e1, e2] }],
	['E', ['E', '-', 'E'], function(e1, _, e2){ return [_, e1, e2] }],
	['E', ['E', '*', 'E'], function(e1, _, e2){ return [_, e1, e2] }],
	['E', ['E', '/', 'E'], function(e1, _, e2){ return [_, e1, e2] }],
	['E', ['E', '%', 'E'], function(e1, _, e2){ return [_, e1, e2] }],
	['E', ['E', '^', 'E'], function(e1, _, e2){ return [_, e1, e2] }],
	['E', ['NUM']],
])
```

Ambiguous grammars are ok. The table saves all the edges, and shift-reduce conflicts can be resolved with the precedence definitions when parsing.
```javascript
var tree = parse(tokens, grammars, table, {
	'+': [11, 'left'],
	'-': [11, 'left'],
	'*': [12, 'left'],
	'/': [12, 'left'],
	'%': [12, 'left'],
	'^': [20, 'right'],
})
```

See example.html for more details. Also see the following project for advanced uses.
* to be added later

### todo
* add a method to resolve reduce-reduce conflicts
* add error handlers to recover from errors

### license
GPL