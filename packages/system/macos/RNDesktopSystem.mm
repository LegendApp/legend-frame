#import "RNDesktopSystem.h"
#import <RNDesktopApp/LegendDesktop.h>
#import <ServiceManagement/ServiceManagement.h>
#import <IOKit/pwr_mgt/IOPMLib.h>
#import <IOKit/ps/IOPowerSources.h>
#import <IOKit/ps/IOPSKeys.h>
#import <ApplicationServices/ApplicationServices.h>
static NSDictionary *Power(void) {
  id level = NSNull.null; BOOL battery = NO;
  CFTypeRef info = IOPSCopyPowerSourcesInfo();
  if (info) {
    battery = CFEqual(IOPSGetProvidingPowerSourceType(info), CFSTR(kIOPSBatteryPowerValue));
    CFArrayRef list = IOPSCopyPowerSourcesList(info);
    for (id source in (__bridge NSArray *)list) {
      NSDictionary *description = (__bridge NSDictionary *)IOPSGetPowerSourceDescription(info, (__bridge CFTypeRef)source);
      NSNumber *current = description[@kIOPSCurrentCapacityKey], *maximum = description[@kIOPSMaxCapacityKey];
      if (maximum.doubleValue > 0) level = @(current.doubleValue / maximum.doubleValue);
    }
    if (list) CFRelease(list); CFRelease(info);
  }
  return @{ @"onBattery": @(battery), @"batteryLevel": level };
}
static void PowerChanged(void *context) { LegendEmit(@{ @"type": @"powerChanged" }); }
@interface RNDesktopSystem ()
@property NSMutableArray *observers;
@property NSMutableSet *assertions;
@property NSMutableSet *attention;
@property CFRunLoopSourceRef powerSource;
@property BOOL observing;
@property NSString *dockOwner;
@end
@implementation RNDesktopSystem
RCT_EXPORT_MODULE(NativeDesktopSystem)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (instancetype)init { if (self = [super init]) { _observers = [NSMutableArray new]; _assertions = [NSMutableSet new]; _attention = [NSMutableSet new]; } return self; }
- (void)observe {
  if (self.observing) return; self.observing = YES;
  NSArray *definitions = @[
    @[NSWorkspace.sharedWorkspace.notificationCenter, NSWorkspaceWillSleepNotification, @"sleep"],
    @[NSWorkspace.sharedWorkspace.notificationCenter, NSWorkspaceDidWakeNotification, @"wake"],
    @[NSDistributedNotificationCenter.defaultCenter, @"com.apple.screenIsLocked", @"lock"],
    @[NSDistributedNotificationCenter.defaultCenter, @"com.apple.screenIsUnlocked", @"unlock"],
    @[NSDistributedNotificationCenter.defaultCenter, @"AppleInterfaceThemeChangedNotification", @"appearanceChanged"],
    @[NSNotificationCenter.defaultCenter, NSApplicationDidChangeScreenParametersNotification, @"displaysChanged"]
  ];
  for (NSArray *definition in definitions) {
    NSNotificationCenter *center = definition[0]; NSString *type = definition[2];
    id observer = [center addObserverForName:definition[1] object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) { LegendEmit(@{ @"type": type }); }];
    [self.observers addObject:@[center, observer]];
  }
  self.powerSource = IOPSNotificationCreateRunLoopSource(PowerChanged, NULL);
  if (self.powerSource) CFRunLoopAddSource(CFRunLoopGetMain(), self.powerSource, kCFRunLoopCommonModes);
}
- (void)dockAction:(NSMenuItem *)sender { LegendEmit(@{ @"type": @"dockAction", @"id": sender.representedObject, @"owner": self.dockOwner ?: @"" }); }
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *args = LegendArgs(json);
    if ([method isEqual:@"info"]) {
      NSMutableDictionary *value = [Power() mutableCopy];
      [value addEntriesFromDictionary:@{ @"osVersion": NSProcessInfo.processInfo.operatingSystemVersionString, @"architecture": @"arm64", @"locale": NSLocale.currentLocale.localeIdentifier,
        @"dark": @([[NSApp.effectiveAppearance bestMatchFromAppearancesWithNames:@[NSAppearanceNameAqua, NSAppearanceNameDarkAqua]] isEqual:NSAppearanceNameDarkAqua]),
        @"idleSeconds": @(CGEventSourceSecondsSinceLastEventType(kCGEventSourceStateCombinedSessionState, kCGAnyInputEventType)) }];
      resolve(LegendJSON(value)); return;
    }
    if ([method isEqual:@"observe"]) [self observe];
    else if ([method isEqual:@"loginStatus"] || [method isEqual:@"login"]) {
      BOOL available = [LegendContext()[@"runtime"][@"mode"] isEqual:@"release"];
      if ([method isEqual:@"loginStatus"]) {
        NSArray *statuses = @[@"disabled", @"enabled", @"requiresApproval", @"notFound"];
        NSInteger status = SMAppService.mainAppService.status;
        resolve(LegendJSON(available && status < statuses.count ? statuses[status] : @"unavailable")); return;
      }
      if (!available) { reject(@"E_UNAVAILABLE", @"Login startup requires a standalone distribution app", nil); return; }
      NSError *error;
      BOOL success = [args[@"enabled"] boolValue] ? [SMAppService.mainAppService registerAndReturnError:&error] : [SMAppService.mainAppService unregisterAndReturnError:&error];
      if (!success) { LegendReject(reject, error); return; }
    }
    else if ([method isEqual:@"badge"]) NSApp.dockTile.badgeLabel = args[@"label"];
    else if ([method isEqual:@"attention"]) { NSInteger token = [NSApp requestUserAttention:[args[@"critical"] boolValue] ? NSCriticalRequest : NSInformationalRequest]; [self.attention addObject:@(token)]; resolve(LegendJSON(@(token))); return; }
    else if ([method isEqual:@"cancelAttention"]) { if ([self.attention containsObject:args[@"id"]]) [NSApp cancelUserAttentionRequest:[args[@"id"] integerValue]]; [self.attention removeObject:args[@"id"]]; }
    else if ([method isEqual:@"clearDockMenu"]) { if ([self.dockOwner isEqual:args[@"owner"]]) { LegendDockMenu = nil; self.dockOwner = nil; } }
    else if ([method isEqual:@"dockMenu"]) {
      if (self.dockOwner) { reject(@"E_DOCK_MENU_EXISTS", @"Remove the existing Dock menu before replacing it", nil); return; }
      self.dockOwner = args[@"owner"];
      NSMenu *menu = [NSMenu new]; menu.autoenablesItems = NO;
      for (NSDictionary *item in args[@"items"]) { NSMenuItem *entry = [[NSMenuItem alloc] initWithTitle:item[@"title"] action:@selector(dockAction:) keyEquivalent:@""]; entry.target = self; entry.representedObject = item[@"id"]; entry.enabled = !item[@"enabled"] || [item[@"enabled"] boolValue]; entry.state = [item[@"checked"] boolValue] ? NSControlStateValueOn : NSControlStateValueOff; [menu addItem:entry]; }
      LegendDockMenu = menu;
    }
    else if ([method isEqual:@"preventSleep"]) {
      IOPMAssertionID assertion; CFStringRef kind = [args[@"kind"] isEqual:@"system"] ? kIOPMAssertionTypePreventUserIdleSystemSleep : kIOPMAssertionTypePreventUserIdleDisplaySleep;
      IOReturn status = IOPMAssertionCreateWithName(kind, kIOPMAssertionLevelOn, (__bridge CFStringRef)args[@"reason"], &assertion);
      if (status != kIOReturnSuccess) { reject(@"E_POWER", @"Could not create sleep assertion", nil); return; }
      [self.assertions addObject:@(assertion)]; resolve(LegendJSON(@(assertion))); return;
    }
    else if ([method isEqual:@"allowSleep"]) { if ([self.assertions containsObject:args[@"id"]]) IOPMAssertionRelease([args[@"id"] unsignedIntValue]); [self.assertions removeObject:args[@"id"]]; }
    else { LegendInvalid(reject, @"Unknown system operation"); return; }
    resolve(@"null");
  });
}
- (void)invalidate { dispatch_async(dispatch_get_main_queue(), ^{
  for (NSArray *entry in self.observers) [entry[0] removeObserver:entry[1]]; [self.observers removeAllObjects];
  if (self.powerSource) { CFRunLoopRemoveSource(CFRunLoopGetMain(), self.powerSource, kCFRunLoopCommonModes); CFRelease(self.powerSource); self.powerSource = NULL; }
  for (NSNumber *value in self.assertions) IOPMAssertionRelease(value.unsignedIntValue); [self.assertions removeAllObjects];
  for (NSNumber *value in self.attention) [NSApp cancelUserAttentionRequest:value.integerValue]; [self.attention removeAllObjects];
  LegendDockMenu = nil; NSApp.dockTile.badgeLabel = nil;
}); }
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params { return std::make_shared<facebook::react::NativeDesktopSystemSpecJSI>(params); }
@end
