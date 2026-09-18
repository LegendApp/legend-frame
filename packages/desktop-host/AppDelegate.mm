#import "AppDelegate.h"
#import <RNDesktopApp/FrameDesktop.h>
#import <React/RCTBundleURLProvider.h>
#import <React-RCTAppDelegate/RCTRootViewFactory.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

#if __has_include(<NativeComposeThreadedRuntime/ThreadedRuntime.h>)
#import <NativeComposeThreadedRuntime/ThreadedRuntime.h>
#import <React/RCTReloadCommand.h>
#endif

@implementation AppDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  if (!FrameAcquireInstance()) { [NSApp terminate:nil]; return; }
  FrameMarkLaunchComplete();
  self.moduleName = @"main";
  self.dependencyProvider = [RCTAppDependencyProvider new];
  self.initialProps = FrameInitialProps(@"main", @{});
#if __has_include(<NativeComposeThreadedRuntime/ThreadedRuntime.h>)
  [ThreadedRuntime configureWithReactNativeDelegate:self launchOptions:@{}];
  // Fired before React Native enumerates reload listeners, so workers are
  // discarded before the main app restarts. Worker invalidation owns no app UI.
  [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(frameResetRuntimes:)
    name:RCTTriggerReloadCommandNotification object:nil];
#endif
  [super applicationDidFinishLaunching:notification];
}
#if __has_include(<NativeComposeThreadedRuntime/ThreadedRuntime.h>)
- (void)frameResetRuntimes:(NSNotification *)notification { [ThreadedRuntime destroyAllRuntimes]; }
- (void)applicationWillTerminate:(NSNotification *)notification { [ThreadedRuntime destroyAllRuntimes]; }
#endif
- (void)loadReactNativeWindow:(NSDictionary *)launchOptions {
  NSView *root = [self.rootViewFactory viewWithModuleName:self.moduleName initialProperties:self.initialProps launchOptions:launchOptions];
  self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1000, 700)
    styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskResizable | NSWindowStyleMaskMiniaturizable
    backing:NSBackingStoreBuffered defer:NO];
  self.window.releasedWhenClosed = NO;
  self.window.identifier = @"frame.main";
  self.window.title = FrameContext()[@"name"];
  root.frame = NSMakeRect(0, 0, 1000, 700);
  self.window.contentView = FrameWindowContent(root);
  NSDictionary *options = FrameWindowConfiguration();
  FrameApplyWindowOptions(self.window, options);
  FrameRestoreWindow(self.window, @"main", options);
  if (![[NSBundle.mainBundle objectForInfoDictionaryKey:@"FrameMenuBarOnly"] boolValue]) [self.window makeKeyAndOrderFront:nil];
}
- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender { return FrameShouldQuit(); }
- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender { return NO; }
- (void)applicationDidBecomeActive:(NSNotification *)note { FrameEmit(@{ @"type": @"activate" }); }
- (void)applicationDidResignActive:(NSNotification *)note { FrameEmit(@{ @"type": @"deactivate" }); }
- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender hasVisibleWindows:(BOOL)visible {
  if (!visible) for (NSWindow *window in NSApp.windows) if ([window.identifier isEqual:@"frame.main"]) [window makeKeyAndOrderFront:nil];
  FrameEmit(@{ @"type": @"reopen" }); return YES;
}
- (void)application:(NSApplication *)sender openURLs:(NSArray<NSURL *> *)urls { FrameOpenURLs(urls); }
- (void)application:(NSApplication *)sender openFiles:(NSArray<NSString *> *)files {
  NSMutableArray *urls = [NSMutableArray new];
  for (NSString *file in files) [urls addObject:[NSURL fileURLWithPath:file]];
  FrameOpenURLs(urls);
  [sender replyToOpenOrPrint:NSApplicationDelegateReplySuccess];
}
- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge { return [self bundleURL]; }
- (NSURL *)bundleURL
{
#if DEBUG
  NSString *value = NSProcessInfo.processInfo.environment[@"FRAME_BUNDLE_URL"];
  NSURL *url = value.length ? [NSURL URLWithString:value] : nil;
  if (url && ([@"127.0.0.1" isEqualToString:url.host] || [@"localhost" isEqualToString:url.host])) {
    return url;
  }
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}
- (NSMenu *)applicationDockMenu:(NSApplication *)sender { return FrameDockMenu; }
- (BOOL)concurrentRootEnabled { return YES; }
@end
