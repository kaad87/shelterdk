const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch shared/ for changes
config.watchFolders = [monorepoRoot];

// Resolve from both app/ and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Ensure shared/ package resolves correctly
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
