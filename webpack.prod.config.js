const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const plugins = [
  new webpack.DefinePlugin({
    'process.env.IS_PROD': true,
  }),
  new CopyWebpackPlugin({
    patterns: [{
      from: 'node_modules/webextension-polyfill/dist/browser-polyfill.min.js',
      to: 'lib/browser-polyfill.js',
      context: '../',
      transform: function(content, path) {
        return content.toString().replace('//# sourceMappingURL=browser-polyfill.min.js.map', '')
      },
    }],
  }),
];

module.exports = {
  output: {
    path: path.resolve(__dirname, './release/build'),
  },
  target: 'web',
  mode: 'production',
  plugins,
  // Prefer size and performance
  devtool: false,
};
