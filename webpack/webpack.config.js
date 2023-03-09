/* eslint-disable max-len */
/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');
const glob = require('glob');
const yaml = require('yaml');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

/**
 * 获取当前目录下所有的entry.js文件
 * 然后将其作为入口文件，key为文件名，value为文件路径
 * 例如:
 * - src
 *  - - index.entry.js
 * - main.entry.js
*/
const getEntryList = () => {
  const entryList = {};
  glob.sync(path.resolve(__dirname, './**/**.entry.js')).forEach((entry) => {
    console.log('🚀 ~ file: webpack.config.js:11 ~ glob.sync ~ entry:', entry);
    const entryName = entry.split('/')[entry.split('/').length - 1].split('.')[0];
    entryList[entryName] = entry;
  });
  console.log('🚀 ~ file: webpack.config.js:11 ~ glob.sync ~ entryList:', entryList);
  return entryList;
};

const entryList = getEntryList();

module.exports = {
  entry: {
    ...Object.keys(entryList).reduce((acc, cur) => {
      const obj = {
        import: entryList[cur], // 入口文件
        // dependOn: 'shared', // 依赖shared模块
      };
      acc[cur] = obj;
      return acc;
    }, {}),
    // shared: ['lodash-es'], // 公共模块, 用于提取公共代码
  }, // 入口文件
  output: {
    clean: true, // 删除上一次打包的文件
    path: path.join(__dirname, 'dist'), // 输出路径, 必须是绝对路径
    filename: 'js/[name].[contenthash:8].js', // 输出文件名, name为entry的key值, contenthash:8为文件内容的hash值, 8位
    assetModuleFilename: 'images/[name].[contenthash:8][ext]', // 用于打包图片文件, [ext]为文件后缀名
  },
  // 设置环境变量, 用于区分生产环境和开发环境, 默认为production, 可以通过cross-env设置环境变量, 也可以通过webpack的--mode参数设置环境变量
  mode: process.env.production ? 'production' : 'development',
  devtool: 'cheap-source-map', // 生成source-map文件, 用于调试, 会影响打包速度
  devServer: {
    compress: true, // 开启gzip压缩
    port: 8080, // 设置端口号为8080
    hot: true, // 热加载
    host: '127.0.0.1', // 设置域名
    historyApiFallback: {
      disableDotRule: true, // 用于解决单页面应用路由刷新404的问题
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/, // 匹配js文件
        exclude: /node_modules/, // 排除node_modules文件夹
        include: path.join(__dirname, 'src'), // 只匹配src文件夹
        use: [
          // 缓存打包结果, 用于加快打包速度, 不兼容webpack5, 需要安装@2版本, 或者使用webpack5的cache: { type: 'filesystem' }
          // 'cache-loader',
          {
            loader: 'babel-loader', // 使用babel-loader, 用于将es6转换为es5
            options: {
              // 使用@babel/preset-env, 这是babel7的默认预设, 用于将es6转换为es5, 需要安装@babel/core和@babel/preset-env，配合@babel/plugin-transform-runtime使用
              presets: ['@babel/preset-env'],
              plugins: [
                ['@babel/plugin-transform-runtime', { // 使用@babel/plugin-transform-runtime, 用于减少打包后的文件体积
                  corejs: 3, // 使用corejs3
                }],
              ],
            },
          },
          {
            loader: 'thread-loader', // 多进程打包, 用于加快打包速度
            options: {
              workers: 3, // 进程数
              workerParallelJobs: 50, // 每个进程并行处理的任务数
              workerNodeArgs: ['--max-old-space-size=1024'], // 每个进程的node参数
              poolTimeout: 2000, // 空闲时等待的毫秒数
              poolParallelJobs: 50, // 池中并行处理的任务数
              name: 'my-pool', // 池的名称
            },
          },
        ],
      },
      {
        test: /\.css$/i, // 匹配css文件
        use: [MiniCssExtractPlugin.loader, 'css-loader'], // 使用MiniCssExtractPlugin.loader, 用于将css文件单独打包, 使用css-loader, 用于解析css文件
      },
      // {
      //   test: /\.vue$/i, // 匹配vue文件
      //   use: [
      //     {
      //       loader: 'vue-loader', // 使用vue-loader, 用于解析vue文件
      //       plugins: [
      //         {
      //           postTransformNode: (astEl) => {
      //             // 用于解决vue文件中的img标签src属性不生效的问题
      //             astEl.attrsList = astEl.attrsList.filter((attr) => attr.name !== 'src');
      //           },
      //         },
      //       ],
      //       options: {
      //         compilerOptions: {
      //           whitespace: 'condense', // 去除vue文件中的空格
      //         },
      //       },
      //     },
      //   ],
      // },
      {
        test: /\.(png|jpg|gif)$/i, // 匹配png/jpg文件
        type: 'asset', // 使用asset, 用于将图片文件打包到dist目录下, 自动根据文件大小选择使用asset/resource或asset/inline
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024, // 8kb, 小于8kb的图片文件会被转换为base64字符串
          },
        },
        generator: {
          filename: 'images/[name].[contenthash:8][ext]', // 用于打包图片文件, [ext]为文件后缀名, 优先级高于output.assetModuleFilename
        },
      },
      {
        test: /\.svg$/i, // 匹配svg文件
        type: 'asset/inline', // 使用asset/inline, 用于将svg文件转换为base64字符串
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i, // 匹配字体文件
        type: 'asset/resource', // 使用asset/resource, 这是所有资源文件的默认生成器, 用于将字体文件打包到dist目录下
      },
      {
        test: /\.txt$/i, // 匹配txt文件
        type: 'asset/source', // 使用asset/source, 用于将txt文件打包到dist目录下
      },
      // 解析自定义文件
      {
        test: /\.yaml$/i, // 匹配yaml文件
        type: 'json', // 使用json, 用于将yaml文件转换为json文件
        parser: {
          parse: yaml.parse, // 使用yaml.parse, 用于将yaml文件转换为json文件
        },
      },
    ],
  },
  plugins: [
    // 将css文件单独打包, 配合MiniCssExtractPlugin.loader使用
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css', // 输出文件名, name为entry的key值, contenthash:8为文件内容的hash值, 8位
      chunkFilename: 'css/[id].[contenthash:8].css', // 用于按需加载的css文件名
    }),
    ...Object.keys(entryList).map((name) => new HtmlWebpackPlugin({
      inject: 'body', // 将js文件插入到body底部
      chunks: [name], // 与entry的key值对应, 用于多页面应用, 一个页面对应一个entry, 一个entry对应一个chunk, 一个chunk对应一个js文件, 一个js文件对应一个html文件
      template: path.join(__dirname, 'src/template.html'), // 模板文件
      filename: `${name}.html`, // 输出文件名
      title: `这是${name}页面`, // 传递给模板文件的参数, 通过htmlWebpackPlugin.options.title获取, 例如: <%= htmlWebpackPlugin.options.title %>
      hash: true, // 为静态资源生成hash值, 例如: <script src="main_1b2c3d4e.js"></script>
      // minify: {
      //   removeComments: true, // 删除注释
      //   collapseWhitespace: true, // 删除空格
      //   removeAttributeQuotes: true, // 删除属性的引号
      //   minifyCSS: true, // 压缩内联css
      //   minifyJS: true, // 压缩内联js
      // },
    })),
  ],
  cache: {
    type: 'filesystem', // 使用文件系统缓存, 用于加快打包速度
  },
  optimization: {
    runtimeChunk: 'single', // 将runtime代码单独打包, 用于加快打包速度, 例如: runtime~main_1b2c3d4e.js
    // 将node_modules中的代码单独打包, 用于加快打包速度
    splitChunks: {
      // chunks: 'all', // 将所有的chunks代码单独打包
      cacheGroups: { // 缓存组, 用于将多个chunks中的公共代码单独打包，并缓存起来供后面使用
        // 将node_modules中的代码单独打包
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all', // 将所有的chunks代码单独打包
        },
      },
    },
    minimizer: [
      new ESLintPlugin({
        extensions: ['js'], // 指定需要检查的文件后缀名
        exclude: 'node_modules', // 指定不需要检查的文件夹
        // fix: true, // 自动修复
      }),
      // 压缩css文件
      new CssMinimizerPlugin({
        // parallel: true, // 使用多进程并行运行来提高构建速度, 默认是os.cpus().length - 1, 也可以设置为数字
        minimizerOptions: {
          preset: [
            'default',
            {
              discardComments: { removeAll: true }, // 删除所有注释
            },
          ],
        },
      }),
      // 压缩js文件
      new TerserPlugin({
        // parallel: true, // 使用多进程并行运行来提高构建速度
        terserOptions: {
          compress: {
            drop_console: true, // 删除所有的console语句
          },
        },
      }),
    ],
  },
};
