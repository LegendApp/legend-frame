#import "RNDesktopApp.h"
#import "FrameDesktop.h"
extern void FrameSetQuitGuard(BOOL value);
extern void FrameReplyQuit(BOOL allow, NSUInteger generation);
@implementation RNDesktopApp
RCT_EXPORT_MODULE(NativeDesktopApp)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (NSArray<NSString *> *)supportedEvents { return @[@"desktop"]; }
- (void)startObserving { [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(event:) name:FrameDesktopEvent object:nil]; }
- (void)stopObserving { [NSNotificationCenter.defaultCenter removeObserver:self]; }
- (void)event:(NSNotification *)note { [self sendEventWithName:@"desktop" body:note.userInfo]; }
- (void)invalidate { [self stopObserving]; dispatch_async(dispatch_get_main_queue(), ^{ FrameSetQuitGuard(NO); }); [super invalidate]; }
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *args = FrameArgs(json);
    if ([method isEqual:@"context"]) resolve(FrameJSON(FrameContext()));
    else if ([method isEqual:@"initialURL"]) resolve(FrameJSON(FrameInitialURL()));
    else if ([method isEqual:@"pendingURLs"]) resolve(FrameJSON(FramePendingURLs()));
    else if ([method isEqual:@"quit"]) { resolve(@"null");
      // AppKit can enter a modal run loop while awaiting the JS decision. Do
      // not hold the main GCD queue that must deliver that decision.
      [NSRunLoop.mainRunLoop performBlock:^{ [NSApp terminate:nil]; }]; }
    else if ([method isEqual:@"quitGuard"]) { FrameSetQuitGuard([args[@"enabled"] boolValue]); resolve(@"null"); }
    else if ([method isEqual:@"replyQuit"]) { FrameReplyQuit([args[@"allow"] boolValue], [args[@"requestId"] unsignedIntegerValue]); resolve(@"null"); }
    else if ([method isEqual:@"hide"]) { [NSApp hide:nil]; resolve(@"null"); }
    else if ([method isEqual:@"activate"]) { [NSApp activateIgnoringOtherApps:YES]; resolve(@"null"); }
    else FrameInvalid(reject, @"Unknown app operation");
  });
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeDesktopAppSpecJSI>(params);
}
@end
