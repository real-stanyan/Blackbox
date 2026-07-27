// Expo config plugin —— CarPlay Driving Task 的原生配置。
//
// 为什么自己写:@iternio/react-native-auto-play 的 package.json 在 `files` 里声明了
// app.plugin.js,但发布的 tarball 里根本没这个文件(0.5.11 实测)。直接写
// plugins: ["@iternio/react-native-auto-play"] 会报找不到插件。
//
// 只做两件事:
//   1. Entitlements 加 com.apple.developer.carplay-driving-task
//   2. Info.plist 加 UIApplicationSceneManifest —— 只声明手机窗口 + 车机两个 role
//
// 刻意不声明 Dashboard / InstrumentCluster scene:那两个(连带
// CPSupportsDashboardNavigationScene / CPSupportsInstrumentClusterNavigationScene)
// 是导航类 app 的东西,Driving Task 用不上,声明了反而多一份说不清的 native 表面。
//
// ⚠️ 未经真机验证:scene manifest 会把手机主窗口的创建从 AppDelegate 改走
// WindowApplicationSceneDelegate。读过库的实现 —— 它是从
// UIApplication.shared.delegate.window.rootViewController 取现成的根视图再挂到
// scene 窗口上,所以不需要改 Expo 的 AppDelegate。但这条只在真机 build 上能证实,
// 配错的表现是手机端黑屏。
const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

const ENTITLEMENT = 'com.apple.developer.carplay-driving-task';

/** 库内自带的 scene delegate 类名(ios/scenes/*.swift 里 @objc 暴露的)。 */
const HEAD_UNIT_DELEGATE = 'HeadUnitSceneDelegate';
const WINDOW_DELEGATE = 'WindowApplicationSceneDelegate';

const withCarPlayEntitlement = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    cfg.modResults[ENTITLEMENT] = true;
    return cfg;
  });

const withCarPlaySceneManifest = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        // 车机屏
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneClassName: 'CPTemplateApplicationScene',
            UISceneConfigurationName: 'CarPlayHeadUnit',
            UISceneDelegateClassName: HEAD_UNIT_DELEGATE,
          },
        ],
        // 手机屏 —— 声明了 scene manifest 就必须把它也列出来,
        // 否则 iOS 不知道怎么建主窗口。
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneClassName: 'UIWindowScene',
            UISceneConfigurationName: 'WindowApplication',
            UISceneDelegateClassName: WINDOW_DELEGATE,
          },
        ],
      },
    };
    return cfg;
  });

module.exports = function withCarPlayDrivingTask(config) {
  return withCarPlaySceneManifest(withCarPlayEntitlement(config));
};
