const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const plugins = [
  new webpack.DefinePlugin({
    'process.env.IS_PROD': false,
  }),
  new CopyWebpackPlugin({
    patterns: [{
      from: 'node_modules/jasmine-core/lib/jasmine-core/*.*',
      to: 'tests/jasmine-core/',
      context: '../',
    },
    {
      from: 'node_modules/webextension-polyfill/dist/browser-polyfill.js',
      to: 'lib/',
      context: '../',
      transform: function(content, path) {
        return content.toString().replace('//# sourceMappingURL=browser-polyfill.js.map', '')
      },
    }],
  }),
];

module.exports = {
  entry: {
    'tests/tests/unit/all.spec': './tests/tests/unit/all.spec.js',
    'tests/tests/integration/all.spec': './tests/tests/integration/all.spec.js',
  },
  output: {
    path: path.resolve(__dirname, './build'),
  },
  resolve: {
    fallback: {fs: false},
  },
  target: 'web',
  mode: 'development',
  plugins,
  /**
   * Only one that works on FF
   * Issue on webpack: https://github.com/webpack/webpack/issues/1194
   * Issue on web-ext toolbox: https://github.com/webextension-toolbox/webextension-toolbox/issues/58
   */
  // Webpack 4's source-map plugin uses MD4, which is unavailable in current
  // Node/OpenSSL builds. Keep development builds portable until webpack is
  // upgraded separately.
  devtool: false,
};
