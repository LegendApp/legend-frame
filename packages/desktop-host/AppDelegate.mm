#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@implementation AppDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  self.moduleName = @"main";
  self.dependencyProvider = [RCTAppDependencyProvider new];
  NSString *path = [[NSBundle mainBundle] pathForResource:@"legend-runtime" ofType:@"json"];
  NSData *data = path ? [NSData dataWithContentsOfFile:path] : nil;
  NSDictionary *runtime = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : @{};
  self.initialProps = @{ @"runtime": runtime ?: @{},
                        @"launchArguments": NSProcessInfo.processInfo.arguments ?: @[] };
  [super applicationDidFinishLaunching:notification];
}
- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge { return [self bundleURL]; }
- (NSURL *)bundleURL
{
#if DEBUG
  NSString *value = NSProcessInfo.processInfo.environment[@"LEGEND_BUNDLE_URL"];
  NSURL *url = value.length ? [NSURL URLWithString:value] : nil;
  if (url && ([@"127.0.0.1" isEqualToString:url.host] || [@"localhost" isEqualToString:url.host])) {
    return url;
  }
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}
- (BOOL)concurrentRootEnabled { return YES; }
@end
