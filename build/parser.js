'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

(function () {

	function unique(array) {
		return Array.from(new Set(array));
	}

	function values(object) {
		return Object.keys(object).map(function (key) {
			return object[key];
		});
	}

	function each(object, func) {
		return Object.keys(object).map(function (k, i) {
			return func(k, object[k], i);
		});
	}

	function fix(func, data) {
		var next = func(data);
		while (next !== data) next = func(data = next);
	}

	function dict(keys, func) {
		var d = {};
		keys.forEach(function (k, i) {
			return d[k] = func(k, i);
		});
		return d;
	}

	function build(grammars) {

		var indexMap = {};
		grammars.forEach(function (prod, index) {
			var _prod = _slicedToArray(prod, 2);

			var symbol = _prod[0];
			var grammar = _prod[1];
			(indexMap[symbol] || (indexMap[symbol] = [])).push(index);
		});

		var nullableMap = {};
		fix(function (data) {
			grammars.forEach(function (prod) {
				var _prod2 = _slicedToArray(prod, 2);

				var symbol = _prod2[0];
				var grammar = _prod2[1];

				if (grammar.every(function (symbol) {
					return !symbol || nullableMap[symbol];
				})) nullableMap[symbol] = true;
			});
			return values(nullableMap).join(',');
		});

		var firstMap = {};
		fix(function (data) {
			grammars.forEach(function (prod) {
				var _prod3 = _slicedToArray(prod, 2);

				var symbol = _prod3[0];
				var grammar = _prod3[1];
				var set = firstMap[symbol] || (firstMap[symbol] = new Set());
				first(grammar).forEach(function (symbol) {
					return set.add(symbol);
				});
			});
			return values(firstMap).map(function (t) {
				return Array.from(t).join(',');
			}).join(',,');
		});

		function first(grammar) {
			var set = new Set();
			grammar.forEach(function (symbol, index) {
				var prev = grammar.slice(0, index);
				if (!prev.length || prev.every(function (symbol) {
					return !symbol || nullableMap[symbol];
				})) {
					if (!symbol) return;else if (!indexMap[symbol]) set.add(symbol);else if (firstMap[symbol]) Array.from(firstMap[symbol]).forEach(function (t) {
						return set.add(t);
					});
				}
			});
			return Array.from(set);
		}

		function firstCached(grammar) {
			var key = 'cache:' + grammar.join(',');
			return firstCached[key] !== undefined ? firstCached[key] : firstCached[key] = first(grammar);
		}

		function closure(item) {
			var hash = function hash(pair) {
				return pair.join(',');
			},
			    map = dict(item.map(hash), function (r, i) {
				return item[i];
			});
			fix(function (data) {
				values(map).forEach(function (pair) {
					var _pair = _slicedToArray(pair, 3);

					var index = _pair[0];
					var position = _pair[1];
					var forward = _pair[2];
					var symbol = grammars[index][1][position];
					var follow = grammars[index][1][position + 1];
					var firstSet = firstCached([follow, forward]);
					if (symbol && indexMap[symbol]) indexMap[symbol].forEach(function (index) {
						(firstSet.length ? firstSet : [undefined]).forEach(function (forward) {
							var pair = [index, 0, forward];
							map[hash(pair)] = pair;
						});
					});
				});
				return Object.keys(map).length;
			});
			return values(map);
		}

		function closureCached(item) {
			var key = 'cache:' + item.map(function (i) {
				return i.join(',');
			}).join(',,');
			return closureCached[key] !== undefined ? closureCached[key] : closureCached[key] = closure(item);
		}

		function next(item, symbol0) {
			var list = [];
			item.forEach(function (pair) {
				var _pair2 = _slicedToArray(pair, 3);

				var index = _pair2[0];
				var position = _pair2[1];
				var forward = _pair2[2];
				var symbol = grammars[index][1][position];
				if (symbol === symbol0) list.push([index, position + 1, forward]);
			});
			return closureCached(list);
		}

		function compile(grammars) {
			var hash = function hash(item) {
				return item.map(function (pair) {
					return pair.join(',');
				}).join(',,');
			},
			    init = closure([[0, 0]]),
			    states = _defineProperty({}, hash(init), init),
			    edges = {/* hash -> hash */};

			fix(function (data) {
				each(states, function (key, item, state) {
					if (edges[key]) return;
					var edge = edges[key] = {};
					var symbols = item.map(function (pair) {
						var _pair3 = _slicedToArray(pair, 3);

						var index = _pair3[0];
						var position = _pair3[1];
						var forward = _pair3[2];

						return grammars[index][1][position];
					});
					unique(symbols).forEach(function (s) {
						var nextItem = s && next(item, s);
						nextItem && (states[edge[s] = hash(nextItem)] = nextItem);
					});
				});
				return Object.keys(states).length;
			});

			return { states: states, edges: edges };
		}

		function merge(states, edges) {

			// merge states with same index and position to build LALR(1) table
			var newStates = {},
			    newKeys = {};
			each(states, function (key, item, state) {
				var newKey = unique(item.map(function (i) {
					return i[0] + ',' + i[1];
				})).sort().join(',,'),
				    newItem = newStates[newKey] || (newStates[newKey] = {});
				item.forEach(function (i) {
					return newItem[i.join(',')] = i;
				});
				newKeys[key] = newKey;
			});

			// build edges (from state index to state index)
			var newEdges = {},
			    indices = dict(Object.keys(newStates), function (key, state) {
				return state;
			});
			each(edges, function (key, edge) {
				var state = indices[newKeys[key]],
				    newEdge = newEdges[state] || (newEdges[state] = {});
				each(edge, function (symbol, key) {
					var index = indices[newKeys[key]];
					newEdge[symbol] = indexMap[symbol] ? index : 's' + index;
				});
				values(newStates[newKeys[key]]).forEach(function (i) {
					var _i = _slicedToArray(i, 3);

					var index = _i[0];
					var position = _i[1];
					var follow = _i[2];

					if (position === grammars[index][1].length) {
						var val = newEdge[follow],
						    next = 'r' + index;
						newEdge[follow] = val === undefined || val === next ? next : Array.isArray(val) ? unique(val.concat([next])) : [val, next];
					}
				});
			});

			var conflicts = 0;
			each(newEdges, function (state, edge) {
				each(edge, function (symbol, next) {
					if (Array.isArray(next)) conflicts++;
				});
			});
			conflicts && console.warn(conflicts + ' conflicts found.');

			return newEdges;
		}

		var _compile = compile(grammars);

		var states = _compile.states;
		var edges = _compile.edges;

		return merge(states, edges);
	}

	function parse(tokens, grammars, edges, symbolConfig) {
		if (tokens[tokens.length - 1] !== undefined) tokens.push(undefined);

		if (!edges) edges = build(grammars);

		var stack = [0];

		function resolve(token, states) {
			var lastToken = {};
			stack.some(function (t, i) {
				var token = stack[stack.length - 1 - i];
				return token && symbolConfig[token.type] && (lastToken = token);
			});
			// TODO: resolve reduce-reduce conflicts
			if (symbolConfig[lastToken.type] || symbolConfig[token.type]) {
				var currentRule = symbolConfig[token.type] || [0],
				    lastRule = symbolConfig[lastToken.type] || [0];
				if (currentRule[0] > lastRule[0]) return states.filter(function (s) {
					return s[0] === 's';
				})[0];else if (lastRule[0] > currentRule[0]) return states.filter(function (s) {
					return s[0] === 'r';
				})[0];else if (lastRule[1] === 'left') return states.filter(function (s) {
					return s[0] === 'r';
				})[0];else if (lastRule[1] === 'right') return states.filter(function (s) {
					return s[0] === 's';
				})[0];
			}
		}

		function feed(token) {
			var state = stack[stack.length - 1],
			    action = edges[state][token && token.type];

			if (Array.isArray(action) && !(action = resolve(token, action))) {
				var l = token && token.line || 0,
				    c = token && token.col || 0;
				console.log('conflict: ');
				action = edges[state][token && token.type];
				action.filter(function (a) {
					return a[0] === 'r';
				}).forEach(function (a) {
					var index = parseInt(a.substr(1));

					var _grammars$index = _slicedToArray(grammars[index], 2);

					var symbol = _grammars$index[0];
					var grammar = _grammars$index[1];

					console.log('reduce grammar ' + index + ': ' + symbol + ' -> ' + grammar.join(' '));
				});
				action.filter(function (a) {
					return a[0] === 's';
				}).forEach(function (a) {
					var state = parseInt(a.substr(1));
					console.log('shift to state ' + state);
				});
				throw ':' + l + ':' + c + ' unresolve conflict!\n' + 'token: `' + (token && token.value || token) + '` ' + (token && token.type ? '[' + token.type + '] ' : ' ');
			}

			if (!action) {
				var l = token && token.line || 0,
				    c = token && token.col || 0;
				throw ':' + l + ':' + c + ' syntax error!\n' + 'unexpected token: `' + (token && token.value || token) + '` ' + (token && token.type ? '[' + token.type + '] ' : ' ');
			} else if (action[0] === 's') {
				stack.push(token);
				stack.push(parseInt(action.substr(1)));
			} else if (action[0] === 'r') {
				var index = parseInt(action.substr(1)),
				    left = grammars[index][0],
				    right = grammars[index][1],
				    args = [];
				right.forEach(function (symbol) {
					stack.pop();
					args.push(stack.pop());
				});

				var reduced = (grammars[index][2] || function (a) {
					return a;
				}).apply(null, args.reverse()),
				    oldState = stack[stack.length - 1],
				    nextState = edges[oldState][left];
				stack.push(reduced);
				stack.push(nextState);
				return nextState >= 0;
			}
		}

		tokens.forEach(function (token, index) {
			while (feed(token));
		});
		return stack[1];
	}

	parse.build = build;

	if (typeof module !== 'undefined') module.exports = parse;else if (typeof window !== 'undefined') (window.yajily || (window.yajily = {})).parse = parse;
})();