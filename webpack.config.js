const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    config: './features/tracker/config/fsrsConfig.js',
    fsrsScheduler: './features/tracker/scheduler/fsrsScheduler.js'
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'dist/[name].bundle.js',
    publicPath: '/'
  },
  module: {
    rules: [
      // No loaders needed, native Chrome V8 handles modern JS
    ]
  },
  resolve: {
    extensions: ['.js']
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { 
          from: 'background', 
          to: 'background',
          globOptions: { ignore: ['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts'] }
        },
        { 
          from: 'content', 
          to: 'content',
          globOptions: { ignore: ['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts'] }
        },
        { 
          from: 'features', 
          to: 'features',
          globOptions: { ignore: ['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts'] }
        },
        { from: 'icons', to: 'icons' }
      ]
    })
  ]
};
