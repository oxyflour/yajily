(function() {

function unique(array) {
	return Array.from(new Set(array))
}

function values(object) {
	return Object.keys(object).map(key => object[key])
}

function each(object, func) {
	return Object.keys(object).map((k, i) => func(k, object[k], i))
}

function fix(func, data) {
	var next = func(data)
	while (next !== data)
		next = func(data = next)
}

function dict(keys, func) {
	var d = { }
	keys.forEach((k, i) => d[k] = func(k, i))
	return d
}

function id(x) {
	return x
}

function build(grammars) {

	var indexMap = { }
	grammars.forEach((prod, index) => {
		var [symbol, grammar] = prod
		;(indexMap[symbol] || (indexMap[symbol] = [ ])).push(index)
	})

	var nullableMap = { }
	fix(data => {
		grammars.forEach(prod => {
			var [symbol, grammar] = prod
			if (grammar.every(symbol => {
				return !symbol || nullableMap[symbol]
			})) nullableMap[symbol] = true
		})
		return values(nullableMap).join(',')
	})

	var firstMap = { }
	fix(data => {
		grammars.forEach(prod => {
			var [symbol, grammar] = prod,
				set = firstMap[symbol] || (firstMap[symbol] = new Set())
			first(grammar).forEach(symbol => set.add(symbol))
		})
		return values(firstMap).map(t => Array.from(t).join(',')).join(',,')
	})

	function first(grammar) {
		var set = new Set()
		grammar.forEach((symbol, index) => {
			var prev = grammar.slice(0, index)
			if (!prev.length || prev.every(symbol => !symbol || nullableMap[symbol])) {
				if (!symbol)
					return
				else if (!indexMap[symbol])
					set.add(symbol)
				else if (firstMap[symbol])
					Array.from(firstMap[symbol]).forEach(t => set.add(t))
			}
		})
		return Array.from(set)
	}

	function firstCached(grammar) {
		var key = 'cache:' + grammar.join(',')
		return firstCached[key] !== undefined ?
			firstCached[key] : (firstCached[key] = first(grammar))
	}

	function closure(item) {
		var hash = (pair => pair.join(',')),
			map = dict(item.map(hash), (r, i) => item[i])
		fix(data => {
			values(map).forEach(pair => {
				var [index, position, forward] = pair,
					symbol = grammars[index][1][position],
					follow = grammars[index][1][position + 1],
					firstSet = firstCached([follow, forward])
				if (symbol && indexMap[symbol]) indexMap[symbol].forEach(index => {
					(firstSet.length ? firstSet : [ undefined ]).forEach(forward => {
						var pair = [index, 0, forward]
						map[ hash(pair) ] = pair
					})
				})
			})
			return Object.keys(map).length
		})
		return values(map)
	}

	function closureCached(item) {
		var key = 'cache:' + item.map(i => i.join(',')).join(',,')
		return closureCached[key] !== undefined ?
			closureCached[key] : (closureCached[key] = closure(item))
	}

	function next(item, symbol0) {
		var list = [ ]
		item.forEach(pair => {
			var [index, position, forward] = pair,
				symbol = grammars[index][1][position]
			if (symbol === symbol0)
				list.push([index, position + 1, forward])
		})
		return closureCached(list)
	}

	function compile(grammars) {
		var hash = (item => item.map(pair => pair.join(',')).join(',,')),
			init = closure([ [0, 0] ]),
			states = { [hash(init)]: init },
			edges = { /* hash -> hash */ }

		fix(data => {
			each(states, (key, item, state) => {
				if (edges[key]) return
				var edge = (edges[key] = { })
				var symbols = item.map(pair => {
					var [index, position, forward] = pair
					return grammars[index][1][position]
				})
				unique(symbols).forEach(s => {
					var nextItem = s && next(item, s)
					nextItem && (states[ edge[s] = hash(nextItem) ] = nextItem)
				})
			})
			return Object.keys(states).length
		})

		return { states, edges }
	}

	function merge(states, edges) {

		// merge states with same index and position to build LALR(1) table
		var newStates = { },
			newKeys = { }
		each(states, (key, item, state) => {
			var newKey = unique(item.map(i => i[0] + ',' + i[1])).sort().join(',,'),
				newItem = newStates[newKey] || (newStates[newKey] = { })
			item.forEach(i => newItem[i.join(',')] = i)
			newKeys[key] = newKey
		})

		// build edges (from state index to state index)
		var newEdges = { },
			indices = dict(Object.keys(newStates), (key, state) => state)
		each(edges, (key, edge) => {
			var state = indices[ newKeys[key] ],
				newEdge = newEdges[state] || (newEdges[state] = { })
			each(edge, (symbol, key) => {
				var index = indices[ newKeys[key] ]
				newEdge[symbol] = indexMap[symbol] ? index : 's' + index
			})
			values(newStates[ newKeys[key] ]).forEach(i => {
				var [index, position, follow] = i
				if (position === grammars[index][1].length) {
					var val = newEdge[follow], next = 'r' + index
					newEdge[follow] = (val === undefined || val === next) ? next :
						(Array.isArray(val) ? unique(val.concat([next])) : [val, next])
				}
			})
		})

		// output info
		var rsConflicts = [ ], rrConflicts = [ ]
		each(newEdges, (state, edge) => {
			each(edge, (symbol, next) => {
				if (Array.isArray(next)) {
					if (next.some(s => s[0] === 's'))
						rsConflicts.push({ state, symbol, next })
					if (next.filter(s => s[0] === 'r').length > 1)
						rrConflicts.push({ state, symbol, next })
				}
			})
		})
		if (rsConflicts.length || rrConflicts.length) {
			console.warn(
				`${rsConflicts.length} reduce-shift and ` +
				`${rrConflicts.length} reduce-reduce conflicts found`)
			var conflictGrammars = { }
			rsConflicts.concat(rrConflicts).forEach(info => {
				info.next.filter(s => s[0] === 'r')
					.map(s => parseInt(s.substr(1)))
					.forEach(i => {
						(conflictGrammars[i] || (conflictGrammars[i] = [ ])).push(info.symbol)
					})
			})
			each(conflictGrammars, (index, symbols) => {
				var grammar = grammars[index]
				console.log(`${grammar[0]} -> ${grammar[1].join(' ')} { ${symbols.join(', ')} }`)
			})
		}

		return newEdges
	}

	var { states, edges } = compile(grammars)
	return merge(states, edges)
}

function parse(tokens, grammars, edges, precedence, recoverHanlder) {
	if (tokens[tokens.length - 1] !== undefined)
		tokens.push(undefined)

	if (!edges)
		edges = build(grammars)

	var stack = [ 0 ]

	function resolve(token, states) {
		function getShiftState() {
			var s = states.filter(s => s[0] === 's')
			return s[0]
		}
		function getReduceState() {
			var s = states.filter(s => s[0] === 'r')
			// reduce with the grammar at first
			s.sort((s1, s2) => parseInt(s1[1]) - parseInt(s2[1]))
			return s[0]
		}
		var lastToken = { }
		stack.some((t, i) => {
			var token = stack[stack.length - 1 - i]
			return token && precedence[token.type] && (lastToken = token)
		})
		if (precedence[lastToken.type] || precedence[token.type]) {
			var currentRule = precedence[token.type] || [ 0 ],
				lastRule = precedence[lastToken.type] || [ 0 ]
			if (currentRule[0] > lastRule[0])
				return getShiftState()
			else if (lastRule[0] > currentRule[0])
				return getReduceState()
			else if (lastRule[1] === 'left')
				return getReduceState()
			else if (lastRule[1] === 'right')
				return getShiftState()
		}
	}

	function feed(token) {
		var state = stack[stack.length - 1],
			action = edges[state][token && token.type]

		if (Array.isArray(action) && !(action = resolve(token, action))) {
			var l = token && token.line || 0, c = token && token.col || 0
			console.log('conflict: ')
			action = edges[state][token && token.type]
			action.filter(a => a[0] === 'r').forEach(a => {
				var index = parseInt(a.substr(1)),
					[symbol, grammar] = grammars[index]
				console.log('reduce grammar ' + index + ': ' +  symbol + ' -> ' + grammar.join(' '))
			})
			action.filter(a => a[0] === 's').forEach(a => {
				var state = parseInt(a.substr(1))
				console.log('shift to state ' + state)
			})
			throw ':' + l + ':' + c + ' unresolve conflict!\n' +
				'token: `' + (token && token.value || token) + '` ' + 
					(token && token.type ? '[' + token.type + '] ': ' ')
		}

		if (!action && recoverHanlder) {
			if (recoverHanlder(token, stack, edges, feed))
				return
		}

		if (!action) {
			var l = token && token.line || 0, c = token && token.col || 0
			throw ':' + l + ':' + c + ' syntax error!\n' +
				'unexpected token: `' + (token && token.value || token) + '` ' + 
					(token && token.type ? '[' + token.type + '] ': ' ')
		}
		else if (action[0] === 's') {
			stack.push(token)
			stack.push(parseInt(action.substr(1)))
		}
		else if (action[0] === 'r') {
			var index = parseInt(action.substr(1)),
				left = grammars[index][0],
				right = grammars[index][1],
				args = [ ]
			right.forEach(symbol => {
				stack.pop()
				args.push(stack.pop())
			})

			var reduced = (grammars[index][2] || (a => a))
					.apply(null, args.reverse()),
				oldState = stack[stack.length - 1],
				nextState = edges[oldState][left]
			stack.push(reduced)
			stack.push(nextState)
			return nextState >= 0
		}
	}

	tokens.forEach((token, index) => {
		while(feed(token));
	})
	return stack[1]
}

parse.build = build

if (typeof(module) !== 'undefined')
	module.exports = parse
else if (typeof(window) !== 'undefined')
	(window.yajily || (window.yajily = { })).parse = parse

})()
