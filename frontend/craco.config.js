module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules.push({
        test: /\.txt$/,
        type: 'asset/source',
      });

      // Suppress missing source map warnings from node_modules (e.g. html5-qrcode)
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        /Failed to parse source map/,
      ];

      return webpackConfig;
    },
  },
  devServer: {
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    ],
  },
};