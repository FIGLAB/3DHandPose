const path = require("path");

module.exports = {
  mode: "development",

  entry: {
    index: "./src/views/index.tsx",
    "flow/ranking": "./src/views/flow/ranking.tsx",
    "flow/ranking2": "./src/views/flow/ranking2.tsx",
    "hand/simple": "./src/views/hand/simple.tsx",
    "hand/blender": "./src/views/hand/blender.tsx",
    "hand/blender2": "./src/views/hand/blender2.tsx",
    "study/user": "./src/views/study/user.tsx",
    "study/researcher": "./src/views/study/researcher.tsx",
    "tools/labeler": "./src/views/tools/labeler.tsx"
  },

  output: {
    path: path.resolve(__dirname, "js")
  },

  // Enable sourcemaps for debugging webpack's output.
  devtool: "source-map",

  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },

  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader"
          }
        ]
      },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      {
        enforce: "pre",
        test: /\.js$/,
        loader: "source-map-loader"
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"]
      }
    ]
  },

  // When importing a module whose path matches one of the following, just
  // assume a corresponding global variable exists and use that instead.
  // This is important because it allows us to avoid bundling all of our
  // dependencies, which allows browsers to cache those libraries between builds.
  externals: {
    react: "React",
    "react-dom": "ReactDOM"
  }
};
