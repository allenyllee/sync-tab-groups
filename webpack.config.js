const path = require('path');
const webpack = require('webpack');
const {merge} = require('webpack-merge');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const devConfig = require('./webpack.dev.config');
const prodConfig = require('./webpack.prod.config');

function copy(path) {
  return {
    from: path,
    to: path,
  };
}

function multipleCopy(...paths) {
  return paths.map(copy);
}

const config = {
  context: path.resolve(__dirname, './extension'),
  entry: {
    'background': './background/background.js',
    'popup/popup': './popup/popup.js',
    'options/option-page': './options/option-page.js',
    'manage/manage-groups': './manage/manage-groups-controller.jsx',
    'tabpages/lazytab/lazytab': './tabpages/lazytab/lazytab.js',
    'tabpages/privileged-tab/privileged-tab': './tabpages/privileged-tab/privileged-tab.jsx',
    'tabpages/selector-groups/selector-groups-controller': './tabpages/selector-groups/selector-groups-controller.jsx',
    'tabpages/shortcut-help/shortcut-help': './tabpages/shortcut-help/shortcut-help.jsx',
  },
  output: {
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    hashFunction: 'sha256',
    environment: {
      globalThis: true,
    },
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  watchOptions: {
    ignored: /node_modules/,
  },
  node: {
    global: false,
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          ecma: 8,
          compress: {
            drop_console: true,
          },
        },
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
      {
        test: /\.(scss|css)$/,
        use: [
          require.resolve('style-loader'),
          //MiniCssExtractPlugin.loader,
          {
            loader: require.resolve('css-loader'),
          },
          {
            loader: require.resolve('sass-loader'),
            options: {
              implementation: require('sass'),
            },
          },
        ],
      },
      {
        test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
    ],
  },
  plugins: [],
};

module.exports = (env, argv) => {
  let envConfig;
  const browserTarget = env && env.browser ? env.browser : 'firefox';

  if (!['chrome', 'firefox'].includes(browserTarget)) {
    throw new Error(`Unsupported browser target: ${browserTarget}`);
  }

  if (argv.mode === 'development') {
    envConfig = devConfig;
  }

  if (argv.mode === 'production') {
    envConfig = prodConfig;
  }

  const outputRoot = argv.mode === 'production' ? 'release' : 'build';
  const productionCopyIgnore = [
    '**/tests/**',
    '**/share/icons/chrome.png',
    '**/share/icons/firefox.png',
    '**/share/icons/sync-tab-groups.png',
    '**/share/icons/tabspace-16.png',
    '**/share/icons/tabspace-32.png',
    '**/share/icons/tabspace-active-32.png',
    '**/share/icons/tabspace-active-64.png',
    '**/share/icons/tabspace-light-16.png',
    '**/share/icons/tabspace-light-32.png',
  ];
  const copiedContent = ['**/*.html', '**/*.css', '**/*.png'].map(from => ({
    from,
    globOptions: argv.mode === 'production'
      ? {ignore: productionCopyIgnore}
      : undefined,
  }));

  return merge(config, envConfig, {
    output: {
      path: path.resolve(__dirname, `./${outputRoot}/${browserTarget}`),
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: multipleCopy('_locales', 'service-worker.js')
          .concat(copiedContent),
      }),
      new CopyWebpackPlugin({
        patterns: [{
          from: `manifest.${browserTarget}.json`,
          to: 'manifest.json',
        }],
      }),
    ],
  });
};
