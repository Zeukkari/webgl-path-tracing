require("babel-polyfill");
const webpack = require("webpack");
module.exports = {
  entry: {
    app: ["babel-polyfill", "./src/index.js"]
  },
  output: {
    filename: "bundle.js",
    pathh: path.resolve(__dirname, "static")
  },
  context: __dirname,
  node: {
    __filename: true
  },
  module: {
    loaders: [
      // use ES2015 on this app
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        loader: "babel"
      }
    ]
  }
};
