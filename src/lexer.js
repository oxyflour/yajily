(function() {

// ref: https://github.com/aaditmshah/lexer/blob/master/lexer.js
function lex(string, rules) {

	// update rules
	rules = rules.map(rule => {
		var [pattern, action, prefix] = rule,
			// 'g' flag is required to use regex.lastIndex
			flags = 'g' + (pattern.ignoreCase ? 'i' : '') + (pattern.multiline ? 'm' : '')
		pattern = new RegExp(pattern.source, flags)
		action = action || (m => '')
		return { pattern, action, prefix }
	})

	var stack = [ ]
	// return { token, length }
	function feed(string, start) {
		var prefix = stack[stack.length - 1],
			fullPrefix = '/' + stack.join('/')
		var matches = rules.map(rule => {
			rule.pattern.lastIndex = start
			var shouldMatch = rule.prefix && rule.prefix[0] === '/' ?
				rule.prefix === fullPrefix : rule.prefix === prefix
			return shouldMatch && rule.pattern.exec(string)
		})
		var lengths = matches.map(match => {
			return match && match.index === start ? match[0].length : 0
		})
		// get the longest match
		var index = lengths.indexOf(Math.max.apply(Math, lengths)),
			rule = rules[index], length = lengths[index]
		return rule && length > 0 && {
			token: rule.action.apply(stack, matches[index]),
			length: length
		}
	}

	var start = 0,
		tokens = [ ],
		feeded = null
	while (start < string.length && (feeded = feed(string, start))) {
		if (feeded.token)
			tokens.push(feeded.token)
		start += feeded.length
	}
	if (start < string.length) {
		throw ('unexpected character near `' + string.substr(start, start + 10) + '`!')
	}
	return tokens
}

if (typeof(module) !== 'undefined')
	module.exports = lex
else if (typeof(window) !== 'undefined')
	(window.yajily || (window.yajily = { })).lex = lex

})()
