#import "RNDesktopClipboard.h"
#import <RNDesktopApp/LegendDesktop.h>
@implementation RNDesktopClipboard
RCT_EXPORT_MODULE(NativeDesktopClipboard)
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSPasteboard *board = NSPasteboard.generalPasteboard;
    NSDictionary *args = LegendArgs(json);
    if ([method isEqual:@"formats"]) { resolve(LegendJSON(board.types ?: @[])); return; }
    if ([method isEqual:@"clear"]) { [board clearContents]; resolve(@"null"); return; }
    NSDictionary *types = @{ @"text": NSPasteboardTypeString, @"html": NSPasteboardTypeHTML, @"rtf": NSPasteboardTypeRTF };
    if ([method isEqual:@"read"]) {
      NSMutableDictionary *content = [NSMutableDictionary new];
      for (NSString *key in types) { NSString *value = [board stringForType:types[key]]; if (value) content[key] = value; }
      NSData *image = [board dataForType:NSPasteboardTypePNG];
      if (!image) { NSData *tiff = [board dataForType:NSPasteboardTypeTIFF]; if (tiff) image = [[NSBitmapImageRep imageRepWithData:tiff] representationUsingType:NSBitmapImageFileTypePNG properties:@{}]; }
      if (image) content[@"imagePNG"] = [image base64EncodedStringWithOptions:0];
      NSArray *urls = [board readObjectsForClasses:@[NSURL.class] options:@{ NSPasteboardURLReadingFileURLsOnlyKey: @YES }];
      if (urls.count) content[@"files"] = [urls valueForKey:@"path"];
      resolve(LegendJSON(content)); return;
    }
    if ([method isEqual:@"write"]) {
      NSMutableArray *objects = [NSMutableArray new];
      if (args[@"files"]) for (NSString *file in args[@"files"]) [objects addObject:[NSURL fileURLWithPath:file]];
      else {
        NSPasteboardItem *item = [NSPasteboardItem new];
        for (NSString *key in types) if (args[key]) [item setString:args[key] forType:types[key]];
        if (args[@"imagePNG"]) {
          NSData *image = [[NSData alloc] initWithBase64EncodedString:args[@"imagePNG"] options:0];
          if (!image || ![NSBitmapImageRep imageRepWithData:image]) { LegendInvalid(reject, @"Invalid clipboard image"); return; }
          [item setData:image forType:NSPasteboardTypePNG];
        }
        if (item.types.count) [objects addObject:item];
      }
      [board clearContents]; if (objects.count && ![board writeObjects:objects]) { reject(@"E_CLIPBOARD", @"Could not write clipboard", nil); return; }
      resolve(@"null"); return;
    }
    if ([method isEqual:@"readText"]) resolve(LegendJSON([board stringForType:NSPasteboardTypeString] ?: @""));
    else if ([method isEqual:@"hasText"]) resolve(LegendJSON(@([board availableTypeFromArray:@[NSPasteboardTypeString]] != nil)));
    else if ([method isEqual:@"writeText"]) {
      if (![args[@"text"] isKindOfClass:NSString.class]) { LegendInvalid(reject, @"Expected clipboard text"); return; }
      [board clearContents];
      if (![board setString:args[@"text"] forType:NSPasteboardTypeString]) { reject(@"E_CLIPBOARD", @"Could not write clipboard", nil); return; }
      resolve(@"null");
    } else LegendInvalid(reject, @"Unknown clipboard operation");
  });
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeDesktopClipboardSpecJSI>(params);
}
@end
