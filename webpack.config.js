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
    'features/common/markdown': './features/common/markdown.ts',
    'features/tracker/scheduler/scheduler': './features/tracker/scheduler/scheduler.ts',
    'features/tracker/tracker': './features/tracker/tracker.ts',
    'features/highlighter/highlighter': './features/highlighter/highlighter.ts',
    'features/dashboard/popup/popup': './features/dashboard/popup/popup.ts',
    'features/highlighter/options/highlightOptions': './features/highlighter/options/highlightOptions.ts',
    'features/dashboard/analytics/analytics': './features/dashboard/analytics/analytics.ts',
    'features/dashboard/forecast/forecast': './features/dashboard/forecast/forecast.ts',
    'features/dashboard/studyplan/studyplan': './features/dashboard/studyplan/studyplan.ts',
    'features/dashboard/history/history': './features/dashboard/history/history.ts',
    'features/dashboard/pomodoro/pomodoro': './features/dashboard/pomodoro/pomodoro.ts',
    'features/dashboard/heatmap/heatmap': './features/dashboard/heatmap/heatmap.ts',
    'features/tracker/editor/editor': './features/tracker/editor/editor.ts',
    'features/common/welcome/welcome': './features/common/welcome/welcome.ts',
    'features/common/data/data': './features/common/data/data.ts',
    'features/common/websites/websites': './features/common/websites/websites.ts',
    'features/common/help/help': './features/common/help/help.ts',
    'features/common/theme-sync': './features/common/theme-sync.ts',
    'features/highlighter/manager/highlights': './features/highlighter/manager/highlights.ts'
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
    },
    alias: {
      '@common': path.resolve(__dirname, 'features/common'),
      '@tracker': path.resolve(__dirname, 'features/tracker'),
      '@dashboard': path.resolve(__dirname, 'features/dashboard')
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
              '**/*.ts'
            ] 
          }
        },
        { from: 'icons', to: 'icons' }
      ]
    })
  ]
};
