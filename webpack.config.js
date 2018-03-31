require("babel-polyfill");
const path = require("path");
const webpack = require("webpack");
module.exports = {
  entry: {
    app: ["babel-polyfill", "./src"]
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist")
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
