#import "RNDesktopLinks.h"
#import <RNDesktopApp/LegendDesktop.h>
@implementation RNDesktopLinks
RCT_EXPORT_MODULE(NativeDesktopLinks)
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *args = LegendArgs(json);
    if ([method isEqual:@"recent"]) {
      NSArray *result = [NSUserDefaults.standardUserDefaults arrayForKey:[LegendNamespace() stringByAppendingString:@".recentDocuments"]] ?: @[];
      resolve(LegendJSON(result)); return;
    }
    if ([method isEqual:@"clearRecent"]) {
      [NSUserDefaults.standardUserDefaults removeObjectForKey:[LegendNamespace() stringByAppendingString:@".recentDocuments"]];
      if (![LegendContext()[@"runtime"][@"mode"] isEqual:@"go"]) [NSDocumentController.sharedDocumentController clearRecentDocuments:nil];
      resolve(@"null"); return;
    }
    NSURL *url = [NSURL URLWithString:args[@"url"] ?: @""];
    if (!url.scheme.length) { LegendInvalid(reject, @"URL must have a scheme"); return; }
    if ([method isEqual:@"canOpen"]) resolve(LegendJSON(@([NSWorkspace.sharedWorkspace URLForApplicationToOpenURL:url] != nil)));
    else if ([method isEqual:@"open"]) {
      // Opening a URL can deliver an Apple event back to this app. Keep its
      // main run loop free while LaunchServices resolves and opens the target.
      [NSWorkspace.sharedWorkspace openURL:url configuration:NSWorkspaceOpenConfiguration.configuration
        completionHandler:^(NSRunningApplication *application, NSError *error) {
          if (error) reject(@"E_OPEN_URL", error.localizedDescription, error);
          else resolve(@"null");
        }];
    } else if ([method isEqual:@"noteRecent"]) {
      if (!url.isFileURL) { LegendInvalid(reject, @"Recent documents must be file URLs"); return; }
      NSString *key = [LegendNamespace() stringByAppendingString:@".recentDocuments"];
      NSMutableArray *recent = [[NSUserDefaults.standardUserDefaults arrayForKey:key] mutableCopy] ?: [NSMutableArray new];
      [recent removeObject:url.absoluteString]; [recent insertObject:url.absoluteString atIndex:0];
      if (recent.count > 20) [recent removeLastObject];
      [NSUserDefaults.standardUserDefaults setObject:recent forKey:key];
      if (![LegendContext()[@"runtime"][@"mode"] isEqual:@"go"]) [NSDocumentController.sharedDocumentController noteNewRecentDocumentURL:url];
      resolve(@"null");
    } else LegendInvalid(reject, @"Unknown links operation");
  });
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeDesktopLinksSpecJSI>(params);
}
@end
