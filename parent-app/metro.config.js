const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');
const shimPath = path.resolve(sharedRoot, 'design', 'RNShim.tsx');

const config = getDefaultConfig(projectRoot);

// The shared design system lives outside this package, so Metro must watch it
// and resolve its dependency imports against this app's node_modules.
config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// Resolve `react-native` to the shared font shim for our own source files only
// (never for node_modules or the shim itself, which would recurse). The shim
// re-exports the real react-native and wraps Text/TextInput with Poppins.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native') {
    const origin = context.originModulePath || '';
    const fromApp =
      origin !== '' &&
      !origin.includes(`node_modules`) &&
      path.resolve(origin) !== path.resolve(shimPath);
    if (fromApp) {
      return context.resolveRequest(context, shimPath, platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
