const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'background/background': './background/background.ts',
    'content/state': './content/state.ts',
    'content/utils': './content/utils.ts',
    'content/notifications': './content/notifications.ts',
    'content/content': './content/content.ts',
    'dist/config.bundle': './features/tracker/config/fsrsConfig.ts',
    'dist/fsrsScheduler.bundle': './features/tracker/scheduler/fsrsScheduler.ts',
    'features/common/logger': './features/common/logger.ts',
    'features/common/utils/cardUtils': './features/common/utils/cardUtils.ts'
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
    chunkFilename: 'dist/[id].bundle.js',
    assetModuleFilename: 'dist/[hash][ext][query]',
    publicPath: 'auto'
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        {
          from: 'background',
          to: 'background',
          noErrorOnMissing: true,
          globOptions: { ignore: ['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts'] }
        },
        {
          from: 'content',
          to: 'content',
          noErrorOnMissing: true,
          globOptions: { ignore: ['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts'] }
        },
        {
          from: 'features',
          to: 'features',
          globOptions: {
            ignore: [
              '**/*.test.js',
              '**/__tests__/**',
              '**/*.md',
              '**/*.ts',
              '**/tracker/config/fsrsConfig.*',
              '**/tracker/scheduler/fsrsScheduler.*',
              '**/tracker/scheduler/fsrsOptimizer.js',
              '**/tracker/scheduler/fsrsOptimizerFast.js'
            ]
          }
        },
        { from: 'icons', to: 'icons' }
      ]
    })
  ]
};
