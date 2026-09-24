#import "RNSDKTestDriver.h"
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <MediaPlayer/MediaPlayer.h>
#import <RNDesktopApp/SparkDesktop.h>
#import <React/RCTView.h>
#import <React/RCTViewKeyboardEvent.h>
#import <React/RCTHandledKey.h>
#import <React/UIView+React.h>
@interface RCTView (SparkKeyboardTest)
- (BOOL)handleKeyboardEvent:(NSEvent *)event;
@end
// A recording dispatcher keeps the regression independent of the JS event queue.
@interface SparkKeyboardRecorder : NSObject
@property NSMutableArray *events;
@end
@implementation SparkKeyboardRecorder
- (instancetype)init { if ((self = [super init])) _events = [NSMutableArray new]; return self; }
- (void)sendEvent:(id<RCTEvent>)event { [self.events addObject:event]; }
@end
static NSDictionary *CheckKeyboardEvents(void) {
  NSMutableDictionary *checks = [NSMutableDictionary new];
  @try {
    SparkKeyboardRecorder *recorder = [SparkKeyboardRecorder new];
    RCTView *untagged = [[RCTView alloc] initWithEventDispatcher:(id)recorder];
    RCTView *tagged = [[RCTView alloc] initWithEventDispatcher:(id)recorder]; tagged.reactTag = @101;
    RCTView *noDispatcher = [RCTView new]; noDispatcher.reactTag = @102;
    for (NSNumber *type in @[@(NSEventTypeKeyDown), @(NSEventTypeKeyUp)]) {
      NSString *name = type.integerValue == NSEventTypeKeyDown ? @"down" : @"up";
      NSString *key = [NSString stringWithFormat:@"%C", (unichar)NSF12FunctionKey];
      NSEvent *event = [NSEvent keyEventWithType:(NSEventType)type.integerValue location:NSZeroPoint
        modifierFlags:NSEventModifierFlagCommand | NSEventModifierFlagShift timestamp:0
        windowNumber:0 context:nil characters:key charactersIgnoringModifiers:key isARepeat:NO keyCode:111];
      [recorder.events removeAllObjects];
      checks[[name stringByAppendingString:@"UntaggedFactory"]] = @([RCTViewKeyboardEvent keyEventFromEvent:event reactTag:nil] == nil);
      checks[[name stringByAppendingString:@"NativeHandling"]] = @(![untagged handleKeyboardEvent:event] && ![noDispatcher handleKeyboardEvent:event] && recorder.events.count == 0);
      [tagged handleKeyboardEvent:event]; [tagged handleKeyboardEvent:event];
      id<RCTEvent> emitted = recorder.events.firstObject;
      NSDictionary *body = emitted.arguments.lastObject;
      checks[[name stringByAppendingString:@"TaggedDeliveryOnce"]] = @(recorder.events.count == 1 && [emitted.viewTag isEqual:@101]
        && [emitted.eventName isEqual:(type.integerValue == NSEventTypeKeyDown ? @"topKeyDown" : @"topKeyUp")]
        && [body[@"key"] isEqual:@"F12"] && [body[@"metaKey"] boolValue] && [body[@"shiftKey"] boolValue]);
      if (type.integerValue == NSEventTypeKeyDown) tagged.keyDownEvents = @[[[RCTHandledKey alloc] initWithKey:@"F12"]];
      else tagged.keyUpEvents = @[[[RCTHandledKey alloc] initWithKey:@"F12"]];
      checks[[name stringByAppendingString:@"NativeFilter"]] = @([tagged handleKeyboardEvent:event]);
    }
    NSEvent *dead = [NSEvent keyEventWithType:NSEventTypeKeyDown location:NSZeroPoint modifierFlags:0 timestamp:0 windowNumber:0 context:nil characters:@"" charactersIgnoringModifiers:@"" isARepeat:NO keyCode:0];
    NSUInteger count = recorder.events.count;
    checks[@"deadKey"] = @([RCTViewKeyboardEvent keyEventFromEvent:dead reactTag:@101] == nil && ![tagged handleKeyboardEvent:dead] && recorder.events.count == count);
  } @catch (NSException *exception) { checks[@"exception"] = exception.description; }
  return checks;
}
@interface RNSDKTestDriver ()
@property NSArray<NSPasteboardItem *> *savedClipboard;
@end
static NSMenuItem *FindItem(NSMenu *menu, NSString *title) {
  for (NSMenuItem *item in menu.itemArray) {
    if ([item.title isEqual:title]) return item;
    NSMenuItem *child = item.submenu ? FindItem(item.submenu, title) : nil;
    if (child) return child;
  }
  return nil;
}
static void PostKey(NSString *key, NSUInteger flags) {
  NSWindow *window = NSApp.keyWindow ?: NSApp.mainWindow;
  NSEvent *event = [NSEvent keyEventWithType:NSEventTypeKeyDown location:NSZeroPoint modifierFlags:flags
    timestamp:NSProcessInfo.processInfo.systemUptime windowNumber:window.windowNumber context:nil
    characters:key charactersIgnoringModifiers:key isARepeat:NO keyCode:[key isEqual:@"\x1b"] ? 53 : [key isEqual:@"\r"] ? 36 : 40];
  [NSApp postEvent:event atStart:NO];
}
// Calls the AppKit destination protocol on real mounted Fabric views. This fixture
// stays outside Go and does not synthesize system input or change the clipboard.
@interface SparkTestDragInfo : NSObject
@property NSPasteboard *draggingPasteboard;
@property NSPoint draggingLocation;
@property NSDragOperation draggingSourceOperationMask;
@end
@implementation SparkTestDragInfo
@end
static NSButton *FindButton(NSView *view, NSString *title) {
  if ([view isKindOfClass:NSButton.class] && [((NSButton *)view).title isEqual:title]) return (NSButton *)view;
  for (NSView *child in view.subviews) { NSButton *found = FindButton(child, title); if (found) return found; }
  return nil;
}
static NSView *FindView(NSView *view, NSString *identifier) {
  if ([view.accessibilityIdentifier isEqual:identifier]) return view;
  for (NSView *child in view.subviews) { NSView *found = FindView(child, identifier); if (found) return found; }
  return nil;
}
static NSControl *FindControl(NSView *view, NSString *identifier) {
  if ([view isKindOfClass:NSControl.class] && [view.accessibilityIdentifier isEqual:identifier]) return (NSControl *)view;
  for (NSView *child in view.subviews) { NSControl *found = FindControl(child, identifier); if (found) return found; }
  return nil;
}
static NSButton *FindControlButton(NSView *view, NSString *identifier) {
  if ([view isKindOfClass:NSButton.class] && [view.accessibilityIdentifier isEqual:identifier]) return (NSButton *)view;
  for (NSView *child in view.subviews) { NSButton *found = FindControlButton(child, identifier); if (found) return found; }
  return nil;
}
@interface NSView (SparkDragTest)
- (NSView *)hitTest:(CGPoint)point withEvent:(id)event;
- (void)draggingSession:(NSDraggingSession *)session endedAtPoint:(NSPoint)point operation:(NSDragOperation)operation;
@end
@implementation RNSDKTestDriver
RCT_EXPORT_MODULE(NativeSDKTestDriver)
- (void)findPanel:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject attempts:(int)attempts {
  for (NSWindow *window in NSApp.windows) {
    if ([window isKindOfClass:NSSavePanel.class] && window.visible) { [(NSSavePanel *)window cancel:nil]; resolve(@"null"); return; }
  }
  if (!attempts) { reject(@"E_TEST", @"No file panel appeared", nil); return; }
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 50 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{ [self findPanel:resolve reject:reject attempts:attempts - 1]; });
}
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *args = SparkArgs(json);
    if ([method isEqual:@"keyboardRegression"]) { resolve(SparkJSON(CheckKeyboardEvents())); return; }
    else if ([method isEqual:@"key"]) PostKey(args[@"key"], [args[@"modifiers"] unsignedIntegerValue]);
    else if ([method isEqual:@"escape"]) {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 300 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{ PostKey(@"\x1b", 0); resolve(@"null"); }); return;
    }
    else if ([method isEqual:@"menu"] || [method isEqual:@"menuState"]) {
      NSMenuItem *item = FindItem(NSApp.mainMenu, args[@"title"]);
      if (!item) { reject(@"E_TEST", @"Menu item not found", nil); return; }
      if ([method isEqual:@"menuState"]) { resolve(SparkJSON(!item.enabled ? @"disabled" : item.state == NSControlStateValueOn ? @"checked" : @"normal")); return; }
      if (!item.enabled || ![NSApp sendAction:item.action to:item.target from:item]) { reject(@"E_TEST", @"Menu action refused", nil); return; }
    }
    else if ([method isEqual:@"cancelPanel"]) { [self findPanel:resolve reject:reject attempts:100]; return; }
    else if ([method isEqual:@"secondInstance"]) {
      NSTask *task = [NSTask new]; task.executableURL = NSBundle.mainBundle.executableURL;
      task.arguments = @[@"--spark-second-instance-probe"];
      task.terminationHandler = ^(NSTask *completed) { resolve(SparkJSON(@(completed.terminationStatus))); };
      NSError *error; if (![task launchAndReturnError:&error]) SparkReject(reject, error);
      return;
    }
    else if ([method isEqual:@"openURLs"]) {
      NSMutableArray *urls = [NSMutableArray new];
      for (NSString *url in args[@"urls"]) [urls addObject:[NSURL URLWithString:url]];
      [NSApp.delegate application:NSApp openURLs:urls];
    }
    else if ([method isEqual:@"mediaInfo"]) {
      NSDictionary *info = MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo;
      resolve(SparkJSON(@{ @"title": info[MPMediaItemPropertyTitle] ?: @"", @"artist": info[MPMediaItemPropertyArtist] ?: @"",
        @"position": info[MPNowPlayingInfoPropertyElapsedPlaybackTime] ?: @0,
        @"next": @(MPRemoteCommandCenter.sharedCommandCenter.nextTrackCommand.enabled), @"previous": @(MPRemoteCommandCenter.sharedCommandCenter.previousTrackCommand.enabled) })); return;
    }
    else if ([method isEqual:@"overlayInfo"]) {
      for (NSWindow *window in NSApp.windows) if ([window.identifier isEqual:args[@"identifier"]]) {
        resolve(SparkJSON(@{ @"panel": @([window isKindOfClass:NSPanel.class]), @"canBecomeKey": @(window.canBecomeKeyWindow), @"borderless": @((window.styleMask & NSWindowStyleMaskTitled) == 0), @"transparent": @(!window.opaque), @"statusLevel": @(window.level == NSStatusWindowLevel) })); return;
      }
      reject(@"E_TEST", @"Overlay window not found", nil); return;
    }
    else if ([method isEqual:@"dragDrop"]) {
      NSView *source = nil, *destination = nil;
      for (NSWindow *window in NSApp.windows) {
        source = source ?: FindView(window.contentView, args[@"source"] ?: @"expansion-drag-source");
        destination = destination ?: FindView(window.contentView, args[@"target"] ?: @"expansion-drop-target");
      }
      if (!source || !destination) { reject(@"E_TEST", @"Drag views have not mounted", nil); return; }
      NSPoint point = NSMakePoint(NSMidX(source.bounds), NSMidY(source.bounds));
      // Both AppKit's route and Fabric's nested-view route must select the drag handle.
      if ([source hitTest:point withEvent:nil] != source || [source hitTest:[source convertPoint:point toView:source.superview]] != source || source.mouseDownCanMoveWindow) {
        reject(@"E_TEST", @"Drag source does not own hit testing over its child", nil); return;
      }
      SparkTestDragInfo *info = [SparkTestDragInfo new];
      info.draggingPasteboard = [NSPasteboard pasteboardWithUniqueName];
      info.draggingSourceOperationMask = [args[@"operation"] isEqual:@"move"] ? NSDragOperationMove : NSDragOperationCopy;
      if ([args[@"custom"] boolValue]) {
        NSPasteboardItem *item = [NSPasteboardItem new]; [item setString:@"{\"id\":42}" forType:[UTType typeWithMIMEType:@"application/x-spark-test-item"].identifier];
        [info.draggingPasteboard writeObjects:@[item]];
      } else [info.draggingPasteboard writeObjects:@[@"Native drag regression"]];
      info.draggingLocation = [destination convertPoint:NSMakePoint(12, 14) toView:nil];
      NSDragOperation operation = [destination draggingEntered:(id<NSDraggingInfo>)info];
      [destination draggingUpdated:(id<NSDraggingInfo>)info];
      BOOL accepted = operation == info.draggingSourceOperationMask && [destination performDragOperation:(id<NSDraggingInfo>)info];
      [source draggingSession:nil endedAtPoint:NSZeroPoint operation:accepted ? operation : NSDragOperationNone];
      if (accepted == [args[@"expectRejected"] boolValue]) { reject(@"E_TEST", [NSString stringWithFormat:@"Unexpected drag acceptance: operation=%lu source=%lu registered=%@ available=%@", (unsigned long)operation, (unsigned long)info.draggingSourceOperationMask, destination.registeredDraggedTypes, info.draggingPasteboard.types], nil); [info.draggingPasteboard releaseGlobally]; return; }
      [info.draggingPasteboard releaseGlobally];
    }
    else if ([method isEqual:@"acceptMessage"]) {
      NSWindow *sheet = nil;
      for (NSWindow *window in NSApp.windows) if (window.sheetParent) { sheet = window; break; }
      NSButton *button = FindButton(sheet.contentView, @"Keep");
      if (!button) { reject(@"E_TEST", @"Message sheet button not found", nil); return; }
      [button performClick:nil];
    }
    else if ([method isEqual:@"buttonState"] || [method isEqual:@"buttonClick"]) {
      NSButton *button = nil;
      for (NSWindow *window in NSApp.windows) button = button ?: FindControlButton(window.contentView, args[@"id"]);
      if (!button) { reject(@"E_TEST", @"Native button has not mounted", nil); return; }
      if ([method isEqual:@"buttonClick"]) [button performClick:nil];
      NSPoint center = NSMakePoint(NSMidX(button.frame), NSMidY(button.frame));
      BOOL hit = [button.superview hitTest:center withEvent:nil] == button;
      resolve(SparkJSON(@{ @"enabled": @(button.enabled), @"title": button.title, @"native": @YES,
        @"width": @(button.bounds.size.width), @"height": @(button.bounds.size.height), @"hit": @(hit) })); return;
    }
    else if ([method isEqual:@"fieldState"] || [method isEqual:@"fieldEdit"] || [method isEqual:@"selectState"] || [method isEqual:@"selectChange"]) {
      NSControl *control = nil;
      for (NSWindow *window in NSApp.windows) control = control ?: FindControl(window.contentView, args[@"id"]);
      if (!control) { reject(@"E_TEST", @"Native control has not mounted", nil); return; }
      if ([control isKindOfClass:NSTextField.class]) {
        NSTextField *field = (NSTextField *)control;
        if ([method isEqual:@"fieldEdit"]) {
          field.stringValue = args[@"value"];
          [field.delegate controlTextDidChange:[NSNotification notificationWithName:NSControlTextDidChangeNotification object:field]];
        }
        resolve(SparkJSON(@{ @"value": field.stringValue, @"width": @(field.bounds.size.width), @"height": @(field.bounds.size.height) })); return;
      }
      if ([control isKindOfClass:NSPopUpButton.class]) {
        NSPopUpButton *select = (NSPopUpButton *)control;
        if ([method isEqual:@"selectChange"]) {
          for (NSMenuItem *item in select.itemArray) if ([item.representedObject isEqual:args[@"value"]]) { [select selectItem:item]; break; }
          [select sendAction:select.action to:select.target];
        }
        resolve(SparkJSON(@{ @"value": select.selectedItem.representedObject ?: @"", @"count": @(select.numberOfItems), @"width": @(select.bounds.size.width), @"height": @(select.bounds.size.height) })); return;
      }
      reject(@"E_TEST", @"Unexpected native control type", nil); return;
    }
    else if ([method isEqual:@"saveClipboard"]) {
      NSMutableArray *items = [NSMutableArray new];
      for (NSPasteboardItem *source in NSPasteboard.generalPasteboard.pasteboardItems) {
        NSPasteboardItem *copy = [NSPasteboardItem new];
        for (NSString *type in source.types) { NSData *data = [source dataForType:type]; if (data) [copy setData:data forType:type]; }
        [items addObject:copy];
      }
      self.savedClipboard = items;
    }
    else if ([method isEqual:@"restoreClipboard"]) {
      if (!self.savedClipboard) { reject(@"E_TEST", @"No clipboard snapshot", nil); return; }
      [NSPasteboard.generalPasteboard clearContents];
      if (self.savedClipboard.count) [NSPasteboard.generalPasteboard writeObjects:self.savedClipboard];
      self.savedClipboard = nil;
    }
    else { SparkInvalid(reject, @"Unknown test driver operation"); return; }
    resolve(@"null");
  });
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeSDKTestDriverSpecJSI>(params);
}
@end
