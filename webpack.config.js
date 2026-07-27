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
    'features/common/utils/cardUtils': './features/common/utils/cardUtils.ts',
    'features/dashboard/popup/popup': './features/dashboard/popup/popup.ts',
    'features/highlighter/options/highlightOptions': './features/highlighter/options/highlightOptions.ts',
    'features/dashboard/analytics/analytics': './features/dashboard/analytics/analytics.ts',
    'features/tracker/scheduler/fsrsOptimizerFast': './features/tracker/scheduler/fsrsOptimizerFast.ts',
    'features/tracker/scheduler/scheduler': './features/tracker/scheduler/scheduler.ts',
    'features/tracker/scheduler/fsrsOptimizer': './features/tracker/scheduler/fsrsOptimizer.ts',
    'features/tracker/tracker': './features/tracker/tracker.ts',
    'features/tracker/editor/editor': './features/tracker/editor/editor.ts',
    'features/common/welcome/welcome': './features/common/welcome/welcome.ts',
    'features/common/theme-sync': './features/common/theme-sync.ts',
    'features/common/data/backupManager': './features/common/data/backupManager.ts',
    'features/common/data/data': './features/common/data/data.ts',
    'features/common/firebase': './features/common/firebase.ts',
    'features/common/websites/websites': './features/common/websites/websites.ts',
    'features/common/help/help': './features/common/help/help.ts',
    'features/common/markdown': './features/common/markdown.ts',
    'features/dashboard/forecast/forecast': './features/dashboard/forecast/forecast.ts',
    'features/dashboard/popup/rating': './features/dashboard/popup/rating.ts',
    'features/dashboard/popup/heatmap': './features/dashboard/popup/heatmap.ts',
    'features/dashboard/popup/DashboardComponent': './features/dashboard/popup/DashboardComponent.ts',
    'features/dashboard/popup/search': './features/dashboard/popup/search.ts',
    'features/dashboard/popup/notifications': './features/dashboard/popup/notifications.ts',
    'features/dashboard/popup/stats': './features/dashboard/popup/stats.ts',
    'features/dashboard/studyplan/studyplan': './features/dashboard/studyplan/studyplan.ts',
    'features/dashboard/history/history': './features/dashboard/history/history.ts',
    'features/dashboard/pomodoro/pomodoro': './features/dashboard/pomodoro/pomodoro.ts',
    'features/dashboard/heatmap/heatmap': './features/dashboard/heatmap/heatmap.ts',
    'features/dashboard/heatmap/heatmap-stats': './features/dashboard/heatmap/heatmap-stats.ts'
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
    extensions: ['.ts', '.js'],
    extensionAlias: {
      '.js': ['.ts', '.js']
    }
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
