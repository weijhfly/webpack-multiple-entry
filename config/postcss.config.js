module.exports = {
	plugins: [
		require('postcss-pxtorem')({
			"rootValue": 100,
			"propList": ["*"]
		}),
		require('autoprefixer')({
			browsers: ['> 1%', 'last 5 versions', 'not ie <= 9'],
		})
	]
}