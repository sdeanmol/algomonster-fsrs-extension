const path = require('path');


module.exports = {
  entry: {
    background: './background/background.js',
    popup: './features/dashboard/popup/popup.js',
    content: './content/content.js',
    config: './features/tracker/config/fsrsConfig.js',
    fsrsScheduler: './features/tracker/scheduler/fsrsScheduler.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
  module: {
    rules: [
      // No loaders needed, native Chrome V8 handles modern JS
    ]
  },
  resolve: {
    extensions: ['.js']
  }
};
