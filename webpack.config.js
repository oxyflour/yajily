module.exports = {
	entry: './index.js',
	output: {
		libraryTarget: 'umd',
		library: 'yajily',
		filename: './build/index.js'
	},
    module: {
    	exclude: /node_modules/,
        loaders: [
            { test: /\.js$/, loader: 'babel-loader?presets[]=es2015' }
        ]
    },
}