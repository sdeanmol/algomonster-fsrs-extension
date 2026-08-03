const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

// Standard ignore patterns for static asset copying
const ignorePatterns = ['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts'];

module.exports = {
  target: "web",
  mode: 'production',
  entry: {
    // Bundles
    config: './features/tracker/config/fsrsConfig.ts',
    fsrsScheduler: './features/tracker/scheduler/fsrsScheduler.ts',

    // Core Extension Scripts
    'background/background': './background/background.ts',
    'content/content': './content/content.ts',

    // Common & Page Scripts
    'features/common/theme-sync': './features/common/theme-sync.ts',
    'features/common/websites/websites': './features/common/websites/websites.ts',
    'features/common/data/data': './features/common/data/data.ts',
    'features/common/help/help': './features/common/help/help.ts',
    'features/common/welcome/welcome': './features/common/welcome/welcome.ts',

    // Feature UIs
    'features/highlighter/manager/highlights': './features/highlighter/manager/highlights.ts',
    'features/highlighter/options/highlightOptions': './features/highlighter/options/highlightOptions.ts',
    'features/tracker/editor/editor': './features/tracker/editor/editor.ts',

    // Dashboard UIs
    'features/dashboard/popup/popup': './features/dashboard/popup/popup.ts',
    'features/dashboard/analytics/analytics': './features/dashboard/analytics/analytics.ts',
    'features/dashboard/heatmap/heatmap': './features/dashboard/heatmap/heatmap.ts',
    'features/dashboard/pomodoro/pomodoro': './features/dashboard/pomodoro/pomodoro.ts',
    'features/dashboard/history/history': './features/dashboard/history/history.ts',
    'features/dashboard/forecast/forecast': './features/dashboard/forecast/forecast.ts',
    'features/dashboard/studyplan/studyplan': './features/dashboard/studyplan/studyplan.ts',
    'features/dashboard/summary/summary': './features/dashboard/summary/summary.ts'
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: (pathData) =>
      ['config', 'fsrsScheduler'].includes(pathData.chunk.name)
        ? 'dist/[name].bundle.js'
        : '[name].js',
    chunkFilename: 'dist/[id].bundle.js',
    assetModuleFilename: 'dist/[hash][ext][query]',
    publicPath: 'auto',
    clean: true
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              noEmit: false
            }
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.wasm$/,
        type: "asset/resource",
        generator: {
          filename: 'dist/[name][ext]'
        }
      },

      {
        test: /\.mjs$/,
        type: "javascript/auto"
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
      '@dashboard': path.resolve(__dirname, 'features/dashboard'),
      '@open-spaced-repetition/binding/dynamic-wasi': path.resolve(
        __dirname,
        'node_modules/@open-spaced-repetition/binding/dist/dynamic-wasi-browser.js'
      ),
    },
    fallback: {
      fs: false,
      path: false,
      worker_threads: false,
      module: false
    },
    conditionNames: ["browser", "import", "module", "default"]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'icons', to: 'icons', noErrorOnMissing: true },
        { from: 'background', to: 'background', noErrorOnMissing: true, globOptions: { ignore: ignorePatterns } },
        { from: 'content', to: 'content', noErrorOnMissing: true, globOptions: { ignore: ignorePatterns } },
        { from: 'features', to: 'features', noErrorOnMissing: true, globOptions: { ignore: ignorePatterns } }
      ]
    })
  ]
};