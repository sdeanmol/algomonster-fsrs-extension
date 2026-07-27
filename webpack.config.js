const fs = require('fs');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const getEntryPoint = (relativePathWithoutExt) => {
  const tsPath = `${relativePathWithoutExt}.ts`;
  if (fs.existsSync(path.resolve(__dirname, tsPath))) {
    return `./${tsPath}`;
  }
  return `./${relativePathWithoutExt}.js`;
};

module.exports = {
  entry: {
    config: getEntryPoint('features/tracker/config/fsrsConfig'),
    fsrsScheduler: getEntryPoint('features/tracker/scheduler/fsrsScheduler')
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'dist/[name].bundle.js',
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
          globOptions: { 
            ignore: [
              '**/*.test.js', 
              '**/__tests__/**', 
              '**/*.md', 
              '**/*.ts',
              '**/tracker/config/fsrsConfig.js',
              '**/tracker/scheduler/fsrsScheduler.js',
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
