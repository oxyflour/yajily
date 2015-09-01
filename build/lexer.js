'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

(function () {

	// ref: https://github.com/aaditmshah/lexer/blob/master/lexer.js
	function lex(string, rules) {

		// update rules
		rules = rules.map(function (rule) {
			var _rule = _slicedToArray(rule, 3);

			var pattern = _rule[0];
			var action = _rule[1];
			var prefix = _rule[2];
			// 'g' flag is required to use regex.lastIndex
			var flags = 'g' + (pattern.ignoreCase ? 'i' : '') + (pattern.multiline ? 'm' : '');
			pattern = new RegExp(pattern.source, flags);
			action = action || function (m) {
				return '';
			};
			return { pattern: pattern, action: action, prefix: prefix };
		});

		var stack = [];
		// return { token, length }
		function feed(string, start) {
			var prefix = stack[stack.length - 1];
			var matches = rules.map(function (rule) {
				rule.pattern.lastIndex = start;
				return rule.prefix === prefix && rule.pattern.exec(string);
			});
			var lengths = matches.map(function (match) {
				return match && match.index === start ? match[0].length : 0;
			});
			// get the longest match
			var index = lengths.indexOf(Math.max.apply(Math, lengths)),
			    rule = rules[index],
			    length = lengths[index];
			return rule && length > 0 && {
				token: rule.action.apply(stack, matches[index]),
				length: length
			};
		}

		var start = 0,
		    tokens = [],
		    feeded = null;
		while (start < string.length && (feeded = feed(string, start))) {
			if (feeded.token) tokens.push(feeded.token);
			start += feeded.length;
		}
		if (start < string.length) {
			throw 'unexpected character near `' + string.substr(start, start + 10) + '`!';
		}
		return tokens;
	}

	if (typeof module !== 'undefined') module.exports = lex;else if (typeof window !== 'undefined') (window.yajily || (window.yajily = {})).lex = lex;
})();