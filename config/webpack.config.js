const path = require('path');
const webpack = require('webpack');
const ROOT = process.cwd();  // 根目录
const ENV = process.env.NODE_ENV;
const IsProduction = (ENV === 'production') ? true : false;
//const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackPlugin = require("html-webpack-plugin-for-multihtml");
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const PostcssConfigPath = './config/postcss.config.js';
const Glob = require('glob');
const HappyPack = require('happypack');
const HappyThreadPool = HappyPack.ThreadPool({ size: (IsProduction ? 10 : 4) });
const CopyWebpackPlugin = require('copy-webpack-plugin');
const staticUrl = '/dist/';
const publicPath = IsProduction ? staticUrl : '/';
const extraPath = IsProduction ? '' : '';
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
let runtime = require('art-template/lib/runtime');
let rule = require('art-template/lib/compile/adapter/rule.art');
let fs = require("fs");
rule.test = /<{([@#]?)[ \t]*(\/?)([\w\W]*?)[ \t]*}>/;

// @see http://aui.github.io/art-template/webpack/index.html#Filter
// 模板变量
runtime.Date = () => {
	return global.Date
}

//判断是否为正式环境
global.IsProduction = IsProduction;
runtime.IsProduction = global.IsProduction;

//文件添加版本号，版本号为文件修改时间
global.versions = function(url){
	url = url.replace('..','src'); 

	let v = IsProduction? (+fs.statSync(url).mtime) : Date.now();

	v = String(v).substr(-8);

	return url.replace('src','..') + '?'+v;
};

runtime.versions = function(){ 
	return global.versions;
};

let entryHtml = getEntryHtml('./src/**/*.html'),
	entryJs = getEntry('./src/**/*.js'),
	configPlugins = [
		// @see https://doc.webpack-china.org/plugins/provide-plugin/
		// jQuery 设为自动加载，不必 import 或 require
		//  new webpack.ProvidePlugin({
		// 	$: 'jquery',
		// 	Vue: 'vue'
		// }), 
		new webpack.optimize.ModuleConcatenationPlugin(),
		new HappyPack({
			id: 'js',
			// @see https://github.com/amireh/happypack
			threadPool: HappyThreadPool,
			loaders: ['babel-loader']
		}),
		new HappyPack({
			id: 'styles',
			threadPool: HappyThreadPool,
			loaders: ['style-loader', 'css-loader', 'less-loader', 'postcss-loader']
		}),
		new webpack.optimize.CommonsChunkPlugin({
			name: 'common',
			minChunks: 3 // 包含 3 次即打包到 commons chunk @see https://doc.webpack-china.org/plugins/commons-chunk-plugin/
		}),
		// @see https://github.com/webpack/webpack/tree/master/examples/multiple-entry-points-commons-chunk-css-bundle
		new ExtractTextPlugin({
			filename: 'css/[name].css?[contenthash:8]',
			allChunks: true
		}),
		// 手动 copy 一些文件
		// @see https://github.com/kevlened/copy-webpack-plugin
		new CopyWebpackPlugin([
			{
				from:  'src/static/js',
				to: 'static/js'
			},
			{
				from:  'src/static/css',
				to: 'static/css'
			}
		]),
	];

// html
entryHtml.forEach(function (v) {
	v.multihtmlCache = true;
	configPlugins.push(new HtmlWebpackPlugin(v));
});

// 开发环境不压缩 js

// 注：这里修改了原版，取消移除console.log及取消打包分析 wjh
if (IsProduction) {
	configPlugins.push(new webpack.optimize.UglifyJsPlugin({
		compress: {
			warnings: false,
			drop_console: false,
			//pure_funcs: ['console.log']
		}
	}));
} else {
	// @see https://github.com/th0r/webpack-bundle-analyzer
	// configPlugins.push(new BundleAnalyzerPlugin({
	// 	openAnalyzer: false
	// }));
}

// 开发环境不压缩图片，提升热更新效率
let imageMin = [{
  loader: 'url-loader',
  options: {
    limit: 100,
    publicPath: publicPath + extraPath,
    outputPath: function (path) {
      return path.replace('src/static/images', 'images');
    },
    name: '[path][name].[ext]?[hash:8]'
  }
}]
if (IsProduction) {
  imageMin.push({
    // @see https://github.com/tcoopman/image-webpack-loader
    loader: 'image-webpack-loader',
    query: {
      mozjpeg: {
        quality: 65
      },
      pngquant: {
        quality: '65-90',
        speed: 4
      }
    }
  })
}

// 配置
const config = {
	entry: entryJs,
	// @see https://github.com/webpack-contrib/extract-text-webpack-plugin/blob/master/example/webpack.config.js
	output: {
		filename: 'js/[name].js?[chunkhash:8]',
		chunkFilename: 'js/[name].js?[chunkhash:8]',
		path: path.resolve(ROOT, 'dist'),
		publicPath: publicPath
	},
	module: {
		// @see https://doc.webpack-china.org/configuration/module/#module-noparse
		// 排除不需要 webpack 解析的文件，提高速度
		/* noParse: function (content) {
			return /jquery|zepto/.test(content);
		}, */
		noParse: /jquery|layer|layer|vue/,
		rules: [
			{
				test: /\.js$/i,
				exclude: /(node_modules|bower_components)/,
				use: {
					loader: 'babel-loader?id=js',
					options: {
						presets: ['env']
					}
				}
			},
			{
				test: /\.(less|css)$/i,
				use: ExtractTextPlugin.extract({
					fallback: 'style-loader?id=styles',
					use: [{
							loader: 'css-loader?id=styles',
							options: {
								minimize:  IsProduction
							}
						},
						{
							loader: 'less-loader?id=styles'
						},
						{
							loader: 'postcss-loader?id=styles',
							options: {
								config: {
									path: PostcssConfigPath
								}
							}
						}
					]
				})
			},
			{
				test: /\.(png|jpe?g|gif|svg)$/i,
				use: imageMin
			},
			{
				test: /\.(eot|svg|ttf|woff)$/i,
				use: [
					{
						loader: 'url-loader',
						options: {
							limit: 100,
							publicPath: publicPath + extraPath,
							name: 'font/[name].[ext]?[hash:8]'
						}
					}
				]
			},
      // @see http://aui.github.io/art-template/webpack/index.html#Options
      {
        test: /\.(htm|html|art)$/i,
        loader: 'art-template-loader',
        options: {
        	imports: require.resolve('art-template/lib/runtime')
        }
      },
			// @see https://github.com/wzsxyz/html-withimg-loader
			/*{
				test: /\.(htm|html)$/i,
				loader: 'html-withimg-loader?min=false'
			}*/
		]
	},
	resolve: {
		alias: {
			views:  path.resolve(ROOT, './src'),
		}
	},
	plugins: configPlugins,
	/**
	 * @see https://doc.webpack-china.org/configuration/externals/
	 * CDN 引入 jQuery，jQuery 不打包到 bundle 中
	 */
	/**externals: {
		jquery: 'jQuery'
	},*/
	// @see http://webpack.github.io/docs/webpack-dev-server.html
	// @see http://www.css88.com/doc/webpack2/configuration/dev-server/
	devServer: {
		contentBase: [
			path.join(ROOT, 'src/')
		],
		disableHostCheck: true,  // https://stackoverflow.com/questions/43650550/invalid-host-header-in-when-running-react-app
		hot: false,
		host: '0.0.0.0',
		port: 8080,
		/**
	     * http://localhost:8080/api/get => http://httpbin.org/get
	     */
	    proxy: {
	      '/api': {
	        target: 'http://httpbin.org',
	        changeOrigin: true,
	        pathRewrite: {
	          '^/api': ''
	        }
	      }
	    }
	}
};

/**
 * 根据目录获取入口
 * @param  {[type]} globPath [description]
 * @return {[type]}          [description]
 */
function getEntry (globPath) {
	let entries = {};
	Glob.sync(globPath).forEach(function (entry) {
		let basename = path.basename(entry, path.extname(entry)),
			pathname = path.dirname(entry),
      fileDir = pathname.split('/').splice(2).join('/');

		// static/*.js 不作为入口
		if (!entry.match(/\/static\//)) {
			entries[(fileDir ? fileDir + '/' : fileDir) + basename] = pathname + '/' + basename;
		}
	});
	return entries;
}

/**
 * 根据目录获取 Html 入口
 * @param  {[type]} globPath [description]
 * @return {[type]}          [description]
 */
function getEntryHtml (globPath) {
	let entries = [];
	Glob.sync(globPath).forEach(function (entry) {
		let basename = path.basename(entry, path.extname(entry)),
			pathname = path.dirname(entry),
      fileDir = pathname.split('/').splice(2).join('/'),
			// @see https://github.com/kangax/html-minifier#options-quick-reference
			minifyConfig = !IsProduction ? '' : {
				removeComments: true,
				// collapseWhitespace: true,
				minifyCSS: true,
				minifyJS: true
			};

		entries.push({
			filename: entry.split('/').splice(2).join('/'),
			template: entry,
			chunks: ['common', (fileDir ? fileDir + '/' : fileDir) + basename],
			minify: minifyConfig
		});

	});
	return entries;
}

module.exports = config;
