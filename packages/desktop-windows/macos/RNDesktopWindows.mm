#import "RNDesktopWindows.h"
#import <RNDesktopApp/LegendDesktop.h>
#import <React-RCTAppDelegate/RCTRootViewFactory.h>
#import <React/RCTSurfaceHostingView.h>

@protocol LegendRootFactory
- (RCTRootViewFactory *)rootViewFactory;
@end
@interface LegendWindowDelegate : NSObject <NSWindowDelegate>
@property NSString *windowID;
@property BOOL guarded;
@property BOOL allowingClose;
@property NSUInteger request;
@property BOOL pending;
- (void)requestClose;
@end
static NSMutableDictionary<NSString *, NSWindow *> *windows;
static NSMutableDictionary<NSString *, LegendWindowDelegate *> *delegates;
static NSWindow *Window(NSString *key) {
  if (!windows) windows = [NSMutableDictionary new];
  NSWindow *window = windows[key];
  if (!window && [key isEqual:@"main"]) {
    for (NSWindow *candidate in NSApp.windows) {
      if ([candidate.identifier isEqual:@"legend.main"]) { window = candidate; break; }
    }
    if (window) windows[key] = window;
  }
  return window;
}
static void Event(NSString *type, NSString *key) { LegendEmit(@{ @"type": type, @"windowId": key }); }
@implementation LegendWindowDelegate
- (void)requestClose {
  if (self.pending) return;
  self.pending = YES; NSUInteger request = ++self.request;
  LegendEmit(@{ @"type": @"beforeClose", @"windowId": self.windowID, @"requestId": @(request) });
  __weak LegendWindowDelegate *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    LegendWindowDelegate *delegate = weakSelf;
    if (delegate.request == request) delegate.pending = NO;
  });
}
- (BOOL)windowShouldClose:(NSWindow *)sender {
  if (self.guarded && !self.allowingClose) { [self requestClose]; return NO; }
  return YES;
}
- (void)windowWillClose:(NSNotification *)note {
  NSWindow *closing = note.object;
  if (closing.sheetParent) [closing.sheetParent endSheet:closing];
  if (closing.parentWindow) [closing.parentWindow removeChildWindow:closing];
  Event(@"closed", self.windowID);
  if (![self.windowID isEqual:@"main"]) {
    NSWindow *window = note.object;
    NSView *root = [window.contentView isKindOfClass:NSVisualEffectView.class] ? window.contentView.subviews.firstObject : window.contentView;
    if ([root isKindOfClass:RCTSurfaceHostingView.class]) [((RCTSurfaceHostingView *)root).surface stop];
    [root removeFromSuperview];
    window.contentView = [[NSView alloc] initWithFrame:root.frame];
    [windows removeObjectForKey:self.windowID];
    // Retain self until the delegate callback returns.
    dispatch_async(dispatch_get_main_queue(), ^{ [delegates removeObjectForKey:self.windowID]; });
  }
}
- (void)windowDidMove:(NSNotification *)note { Event(@"move", self.windowID); }
- (void)windowDidResize:(NSNotification *)note { Event(@"resize", self.windowID); }
- (void)windowDidChangeScreen:(NSNotification *)note { Event(@"screenChanged", self.windowID); }
- (void)windowDidEnterFullScreen:(NSNotification *)note { Event(@"enterFullscreen", self.windowID); }
- (void)windowDidExitFullScreen:(NSNotification *)note { Event(@"leaveFullscreen", self.windowID); }
- (void)windowDidBecomeKey:(NSNotification *)note { Event(@"focus", self.windowID); }
- (void)windowDidResignKey:(NSNotification *)note { Event(@"blur", self.windowID); }
@end
static void InstallDelegate(NSWindow *window, NSString *key) {
  if (!delegates) delegates = [NSMutableDictionary new];
  if (delegates[key]) return;
  LegendWindowDelegate *delegate = [LegendWindowDelegate new];
  delegate.windowID = key;
  delegates[key] = delegate;
  window.delegate = delegate;
}
static void RequestClose(NSWindow *window, NSString *key) {
  LegendWindowDelegate *delegate = delegates[key];
  if (delegate.guarded && !delegate.allowingClose) { [delegate requestClose]; return; }
  if (window.sheetParent) [window.sheetParent endSheet:window];
  [window close];
}
static NSDictionary *Frame(NSRect frame) {
  return @{ @"x": @(frame.origin.x), @"y": @(frame.origin.y), @"width": @(frame.size.width), @"height": @(frame.size.height) };
}
static NSDictionary *Info(NSString *key, NSWindow *window) {
  return @{ @"id": key, @"title": window.title, @"visible": @(window.visible), @"focused": @(window.keyWindow),
    @"resizable": @((window.styleMask & NSWindowStyleMaskResizable) != 0), @"alwaysOnTop": @(window.level == NSFloatingWindowLevel),
    @"minWidth": @(window.contentMinSize.width), @"maxWidth": @(window.contentMaxSize.width),
    @"minimized": @(window.miniaturized), @"fullscreen": @((window.styleMask & NSWindowStyleMaskFullScreen) != 0), @"frame": Frame(window.frame) };
}
@implementation RNDesktopWindows
RCT_EXPORT_MODULE(NativeDesktopWindowManager)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *args = LegendArgs(json);
    NSString *key = [args[@"id"] isKindOfClass:NSString.class] ? args[@"id"] : @"main";
    NSWindow *main = Window(@"main");
    if (main) InstallDelegate(main, @"main");
    if ([method isEqual:@"displays"]) {
      NSMutableArray *result = [NSMutableArray new];
      for (NSScreen *screen in NSScreen.screens) [result addObject:@{ @"id": [screen.deviceDescription[@"NSScreenNumber"] stringValue],
        @"name": screen.localizedName, @"frame": Frame(screen.frame), @"workArea": Frame(screen.visibleFrame), @"scale": @(screen.backingScaleFactor) }];
      resolve(LegendJSON(result)); return;
    }
    if ([method isEqual:@"list"]) {
      NSMutableArray *result = [NSMutableArray new];
      for (NSString *windowID in windows) [result addObject:Info(windowID, windows[windowID])];
      resolve(LegendJSON(result)); return;
    }
    NSWindow *window = Window(key);
    if ([method isEqual:@"open"]) {
      if (!key.length || [key isEqual:@"main"]) { LegendInvalid(reject, @"Secondary windows need a non-main id"); return; }
      NSWindow *parent = args[@"parentId"] ? Window(args[@"parentId"]) : nil;
      if (args[@"parentId"] && !parent) { reject(@"E_NOT_FOUND", @"Parent window not found", nil); return; }
      if (parent && parent == window) { LegendInvalid(reject, @"Invalid parent window"); return; }
      if ([args[@"modal"] boolValue] && (!parent || parent.attachedSheet)) { reject(@"E_BUSY", @"Modal window requires an available parent", nil); return; }
      if (!window) {
        id delegate = NSApp.delegate;
        if (![delegate respondsToSelector:@selector(rootViewFactory)]) { reject(@"E_HOST", @"Host has no React root factory", nil); return; }
        CGFloat width = args[@"width"] ? [args[@"width"] doubleValue] : 640;
        CGFloat height = args[@"height"] ? [args[@"height"] doubleValue] : 480;
        window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, width, height)
          styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
          backing:NSBackingStoreBuffered defer:NO];
        window.releasedWhenClosed = NO;
        window.identifier = [@"legend." stringByAppendingString:key];
        window.title = args[@"title"] ?: LegendContext()[@"name"];
        window.contentView = [(id<LegendRootFactory>)delegate rootViewFactory] ? [[(id<LegendRootFactory>)delegate rootViewFactory]
          viewWithModuleName:@"main" initialProperties:LegendInitialProps(key, args[@"props"])] : nil;
        window.contentView = LegendWindowContent(window.contentView);
        LegendApplyWindowOptions(window, args);
        LegendRestoreWindow(window, key, args);
        windows[key] = window;
        InstallDelegate(window, key);
        Event(@"opened", key);
      }
      if ([args[@"modal"] boolValue]) [parent beginSheet:window completionHandler:nil];
      else { NSInteger level = window.level; if (parent) [parent addChildWindow:window ordered:NSWindowAbove]; [window makeKeyAndOrderFront:nil]; window.level = level; }
      resolve(LegendJSON(Info(key, window))); return;
    }
    if (!window) { reject(@"E_NOT_FOUND", @"Window does not exist", nil); return; }
    if ([method isEqual:@"info"]) { resolve(LegendJSON(Info(key, window))); return; }
    if ([method isEqual:@"close"]) RequestClose(window, key);
    else if ([method isEqual:@"closeGuard"]) { delegates[key].guarded = [args[@"enabled"] boolValue]; delegates[key].pending = NO; delegates[key].request++; }
    else if ([method isEqual:@"replyClose"]) {
      LegendWindowDelegate *delegate = delegates[key];
      if (delegate.pending && delegate.request == [args[@"requestId"] unsignedIntegerValue]) {
        delegate.pending = NO;
        if ([args[@"allow"] boolValue]) { delegate.allowingClose = YES; RequestClose(window, key); delegate.allowingClose = NO; }
      }
    }
    else if ([method isEqual:@"show"]) { [window deminiaturize:nil]; [window makeKeyAndOrderFront:nil]; }
    else if ([method isEqual:@"options"]) LegendApplyWindowOptions(window, args[@"options"]);
    else if ([method isEqual:@"maximize"]) { if (!window.zoomed) [window zoom:nil]; }
    else if ([method isEqual:@"unmaximize"]) { if (window.zoomed) [window zoom:nil]; }
    else if ([method isEqual:@"center"]) [window center];
    else if ([method isEqual:@"hide"]) [window orderOut:nil];
    else if ([method isEqual:@"minimize"]) [window miniaturize:nil];
    else if ([method isEqual:@"fullscreen"]) {
      BOOL current = (window.styleMask & NSWindowStyleMaskFullScreen) != 0;
      if (current != [args[@"enabled"] boolValue]) [window toggleFullScreen:nil];
    }
    else if ([method isEqual:@"title"]) window.title = args[@"title"] ?: @"";
    else if ([method isEqual:@"frame"]) {
      NSDictionary *frame = args[@"frame"];
      [window setFrame:NSMakeRect([frame[@"x"] doubleValue], [frame[@"y"] doubleValue], [frame[@"width"] doubleValue], [frame[@"height"] doubleValue]) display:YES];
    }
    else { LegendInvalid(reject, @"Unknown window operation"); return; }
    resolve(@"null");
  });
}
- (void)invalidate {
  dispatch_async(dispatch_get_main_queue(), ^{
    for (NSString *key in [windows.allKeys copy]) {
      NSWindow *window = windows[key];
      window.delegate = nil;
      if (![key isEqual:@"main"]) {
        NSView *root = [window.contentView isKindOfClass:NSVisualEffectView.class] ? window.contentView.subviews.firstObject : window.contentView;
        if ([root isKindOfClass:RCTSurfaceHostingView.class]) [((RCTSurfaceHostingView *)root).surface stop];
        [root removeFromSuperview]; window.contentView = nil;
        [window close];
      }
    }
    [windows removeAllObjects]; [delegates removeAllObjects];
  });
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeDesktopWindowManagerSpecJSI>(params);
}
@end
