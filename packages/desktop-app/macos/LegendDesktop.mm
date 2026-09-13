#import "LegendDesktop.h"
#import <CommonCrypto/CommonDigest.h>
#import <sys/file.h>
#import <fcntl.h>
#import <unistd.h>
NSString * const LegendDesktopEvent = @"LegendDesktopEvent";
static BOOL quitGuard = NO;
static BOOL quitting = NO;
static NSUInteger quitGeneration = 0;
static NSMutableArray *pendingURLs;
static NSString *initialURL;
static BOOL launchComplete = NO;

NSString *LegendJSON(id value) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:value ?: NSNull.null options:NSJSONWritingFragmentsAllowed error:nil];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"null";
}
NSDictionary *LegendArgs(NSString *json) {
  id value = [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  return [value isKindOfClass:NSDictionary.class] ? value : @{};
}
void LegendInvalid(RCTPromiseRejectBlock reject, NSString *message) { reject(@"E_INVALID_ARGUMENT", message, nil); }
void LegendReject(RCTPromiseRejectBlock reject, NSError *error) {
  NSString *code = @"E_IO";
  if ([error.domain isEqualToString:NSCocoaErrorDomain]) {
    if (error.code == NSFileReadNoSuchFileError || error.code == NSFileNoSuchFileError) code = @"E_NOT_FOUND";
    if (error.code == NSFileReadNoPermissionError || error.code == NSFileWriteNoPermissionError) code = @"E_PERMISSION";
    if (error.code == NSFileWriteFileExistsError) code = @"E_EXISTS";
  }
  reject(code, error.localizedDescription ?: @"Native operation failed", error);
}
NSDictionary *LegendContext(void) {
  static NSDictionary *context;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    NSBundle *bundle = NSBundle.mainBundle;
    NSString *runtimePath = [bundle pathForResource:@"legend-runtime" ofType:@"json"];
    NSData *data = runtimePath ? [NSData dataWithContentsOfFile:runtimePath] : nil;
    NSDictionary *runtime = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : @{};
    NSString *project = [bundle objectForInfoDictionaryKey:@"LegendProjectIdentifier"] ?: bundle.bundleIdentifier;
    NSString *version = [bundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"0.0.0";
    NSString *name = [bundle objectForInfoDictionaryKey:@"CFBundleDisplayName"] ?: [bundle objectForInfoDictionaryKey:@"CFBundleName"];
#if DEBUG
    // Only the reusable Go host takes identity from its launching CLI.
    if ([runtime[@"mode"] isEqual:@"go"]) {
      project = NSProcessInfo.processInfo.environment[@"LEGEND_PROJECT_ID"] ?: project;
      version = NSProcessInfo.processInfo.environment[@"LEGEND_PROJECT_VERSION"] ?: version;
      name = NSProcessInfo.processInfo.environment[@"LEGEND_PROJECT_NAME"] ?: name;
    }
#endif
    context = @{ @"projectId": project ?: @"desktop.app", @"name": name ?: @"Desktop App",
      @"version": version,
      @"runtime": runtime ?: @{}, @"launchArguments": NSProcessInfo.processInfo.arguments };
  });
  return context;
}
NSString *LegendNamespace(void) {
  NSString *project = LegendContext()[@"projectId"];
  NSData *data = [project dataUsingEncoding:NSUTF8StringEncoding];
  unsigned char hash[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(data.bytes, (CC_LONG)data.length, hash);
  NSMutableString *result = [NSMutableString stringWithString:@"legend.desktop."];
  for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) [result appendFormat:@"%02x", hash[i]];
  return result;
}
NSDictionary *LegendInitialProps(NSString *windowID, NSDictionary *props) {
  NSMutableDictionary *result = [LegendContext() mutableCopy];
  result[@"windowId"] = windowID;
  result[@"windowProps"] = props ?: @{};
  return result;
}
void LegendEmit(NSDictionary *event) {
  NSCAssert(NSThread.isMainThread, @"Desktop events are main-thread confined");
  [NSNotificationCenter.defaultCenter postNotificationName:LegendDesktopEvent object:nil userInfo:event];
}
void LegendMarkLaunchComplete(void) { launchComplete = YES; }
NSString *LegendInitialURL(void) { return initialURL; }
void LegendOpenURLs(NSArray<NSURL *> *urls) {
  if (!pendingURLs) pendingURLs = [NSMutableArray new];
  for (NSURL *url in urls) {
    if (!launchComplete && !url.isFileURL && !initialURL) initialURL = url.absoluteString;
    NSDictionary *event = @{ @"type": url.isFileURL ? @"openFile" : @"openURL", @"url": url.absoluteString,
      @"id": NSUUID.UUID.UUIDString, @"initial": @(!launchComplete) };
    [pendingURLs addObject:event];
    if (pendingURLs.count > 100) [pendingURLs removeObjectAtIndex:0];
    LegendEmit(event);
  }
}
NSArray *LegendPendingURLs(void) { return [pendingURLs copy] ?: @[]; }
void LegendSetQuitGuard(BOOL value) {
  if (value != quitGuard) {
    if (value) [NSProcessInfo.processInfo disableSuddenTermination];
    else [NSProcessInfo.processInfo enableSuddenTermination];
  }
  quitGuard = value;
  if (!value && quitting) { quitting = NO; [NSApp replyToApplicationShouldTerminate:NO]; }
}
void LegendReplyQuit(BOOL allow, NSUInteger generation) {
  if (!quitting || generation != quitGeneration) return;
  quitting = NO;
  [NSApp replyToApplicationShouldTerminate:allow];
}
NSApplicationTerminateReply LegendShouldQuit(void) {
  if (!quitGuard) return NSTerminateNow;
  if (quitting) return NSTerminateLater;
  quitting = YES;
  NSUInteger generation = ++quitGeneration;
  // Emit after returning Later so synchronous JS replies cannot race AppKit.
  dispatch_async(dispatch_get_main_queue(), ^{ LegendEmit(@{ @"type": @"beforeQuit", @"requestId": @(generation) }); });
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    if (quitting && generation == quitGeneration) LegendReplyQuit(NO, generation);
  });
  return NSTerminateLater;
}

BOOL LegendAcquireInstance(void) {
  static int lockFD = -1;
  static id observer;
  NSString *lockPath = [NSTemporaryDirectory() stringByAppendingPathComponent:[LegendNamespace() stringByAppendingString:@".lock"]];
  lockFD = open(lockPath.fileSystemRepresentation, O_CREAT | O_RDWR | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (lockFD < 0) { NSLog(@"Unable to establish desktop instance lock: %s", strerror(errno)); return YES; }
  NSString *name = [LegendNamespace() stringByAppendingString:@".secondInstance"];
  if (flock(lockFD, LOCK_EX | LOCK_NB) != 0) {
    close(lockFD); lockFD = -1;
    [NSDistributedNotificationCenter.defaultCenter postNotificationName:name object:nil userInfo:@{ @"arguments": NSProcessInfo.processInfo.arguments } deliverImmediately:YES];
    return NO;
  }
  observer = [NSDistributedNotificationCenter.defaultCenter addObserverForName:name object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) {
    [NSApp activateIgnoringOtherApps:YES];
    for (NSWindow *window in NSApp.windows) if ([window.identifier isEqual:@"legend.main"]) [window makeKeyAndOrderFront:nil];
    LegendEmit(@{ @"type": @"secondInstance", @"arguments": note.userInfo[@"arguments"] ?: @[] });
  }];
  return YES;
}
NSMenu *LegendDockMenu = nil;
