// CarPlay native setup for @iternio/react-native-auto-play (which ships no config
// plugin). Injects: scene manifest (library's own delegate classes), the
// driving-task entitlement, and the getRootViewForAutoplay AppDelegate hook the
// library's scene delegates call. Blind-written — cannot run before Apple grants
// the CarPlay entitlement (Simulator included); see ADR-0029.
const { withAppDelegate, withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

const SCENE_MANIFEST = {
  CPSupportsDashboardNavigationScene: true,
  CPSupportsInstrumentClusterNavigationScene: true,
  UIApplicationSupportsMultipleScenes: true,
  UISceneConfigurations: {
    CPTemplateApplicationDashboardSceneSessionRoleApplication: [
      {
        UISceneClassName: 'CPTemplateApplicationDashboardScene',
        UISceneConfigurationName: 'CarPlayDashboard',
        UISceneDelegateClassName: 'DashboardSceneDelegate',
      },
    ],
    CPTemplateApplicationInstrumentClusterSceneSessionRoleApplication: [
      {
        UISceneClassName: 'CPTemplateApplicationInstrumentClusterScene',
        UISceneConfigurationName: 'CarPlayCluster',
        UISceneDelegateClassName: 'ClusterSceneDelegate',
      },
    ],
    CPTemplateApplicationSceneSessionRoleApplication: [
      {
        UISceneClassName: 'CPTemplateApplicationScene',
        UISceneConfigurationName: 'CarPlayHeadUnit',
        UISceneDelegateClassName: 'HeadUnitSceneDelegate',
      },
    ],
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneClassName: 'UIWindowScene',
        UISceneConfigurationName: 'WindowApplication',
        UISceneDelegateClassName: 'WindowApplicationSceneDelegate',
      },
    ],
  },
};

const GET_ROOT_VIEW = `
  @objc func getRootViewForAutoplay(
    moduleName: String,
    initialProperties: [String: Any]?
  ) -> UIView? {
    if RCTIsNewArchEnabled() {
      if let factory = reactNativeFactory?.rootViewFactory as? ExpoReactRootViewFactory {
        return factory.superView(
          withModuleName: moduleName,
          initialProperties: initialProperties,
          launchOptions: nil
        )
      }

      return reactNativeFactory?.rootViewFactory.view(
        withModuleName: moduleName,
        initialProperties: initialProperties
      )
    }

    if let rootView = window?.rootViewController?.view as? RCTRootView {
      return RCTRootView(
        bridge: rootView.bridge,
        moduleName: moduleName,
        initialProperties: initialProperties
      )
    }

    return nil
  }
`;

function withCarPlay(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return c;
  });
  config = withEntitlementsPlist(config, (c) => {
    c.modResults['com.apple.developer.carplay-driving-task'] = true;
    return c;
  });
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('withCarPlay: expected a Swift AppDelegate (Expo SDK 57 default)');
    }
    if (!c.modResults.contents.includes('getRootViewForAutoplay')) {
      const anchor = /class AppDelegate[^{]*\{/;
      if (!anchor.test(c.modResults.contents)) {
        throw new Error('withCarPlay: AppDelegate class declaration not found');
      }
      c.modResults.contents = c.modResults.contents.replace(anchor, (m) => `${m}\n${GET_ROOT_VIEW}`);
    }
    return c;
  });
  return config;
}

module.exports = withCarPlay;
