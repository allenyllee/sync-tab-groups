module.exports = {
  verbose: false,
  build: {
    overwriteDest: true,
  },
  run: {
    startUrl: ["about:debugging"],
    pref: [
      "extensions.webextensions.tabhide.enabled=true",
    ],
    firefox: "firefoxdeveloperedition",
  },
};
