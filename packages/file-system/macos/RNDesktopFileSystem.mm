#import "RNDesktopFileSystem.h"
#import <RNDesktopApp/LegendDesktop.h>
#import <fcntl.h>
#import <unistd.h>

@interface RNDesktopFileSystem ()
@property dispatch_queue_t ioQueue;
@property NSMutableDictionary<NSString *, dispatch_source_t> *watches;
@end
static NSURL *FileURL(id value) {
  if (![value isKindOfClass:NSString.class] || ![value length]) return nil;
  if ([value hasPrefix:@"file://"]) return [NSURL URLWithString:value];
  return [value hasPrefix:@"/"] ? [NSURL fileURLWithPath:value] : nil;
}
@implementation RNDesktopFileSystem
RCT_EXPORT_MODULE(NativeDesktopFileSystem)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (instancetype)init { if (self = [super init]) { _ioQueue = dispatch_queue_create("legend.files", DISPATCH_QUEUE_SERIAL); _watches = [NSMutableDictionary new]; } return self; }
- (NSArray<NSString *> *)supportedEvents { return @[@"change"]; }
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(self.ioQueue, ^{
    NSDictionary *args = LegendArgs(json); NSFileManager *fm = NSFileManager.defaultManager;
    NSError *error = nil; id result = NSNull.null;
    if ([method isEqual:@"directory"]) {
      NSString *kind = args[@"kind"];
      NSURL *base;
      if ([kind isEqual:@"data"]) base = [fm URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:YES error:&error];
      else if ([kind isEqual:@"cache"]) base = [fm URLForDirectory:NSCachesDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:YES error:&error];
      else if ([kind isEqual:@"temp"]) base = [NSURL fileURLWithPath:NSTemporaryDirectory() isDirectory:YES];
      else { LegendInvalid(reject, @"Unknown directory kind"); return; }
      NSURL *url = [base URLByAppendingPathComponent:LegendNamespace() isDirectory:YES];
      if (!error) [fm createDirectoryAtURL:url withIntermediateDirectories:YES attributes:nil error:&error];
      result = url.path;
    } else if ([method isEqual:@"unwatch"]) {
      dispatch_source_t source = self.watches[args[@"id"]];
      if (source) { dispatch_source_cancel(source); [self.watches removeObjectForKey:args[@"id"]]; }
    } else {
      NSURL *url = FileURL(args[@"path"]);
      if (!url || !url.isFileURL || (url.host.length && ![url.host isEqual:@"localhost"])) { LegendInvalid(reject, @"Expected an absolute local path or file URL"); return; }
      if ([method isEqual:@"readText"]) result = [NSString stringWithContentsOfURL:url encoding:NSUTF8StringEncoding error:&error];
      else if ([method isEqual:@"readBytes"]) {
        NSData *data = [NSData dataWithContentsOfURL:url options:0 error:&error];
        result = [data base64EncodedStringWithOptions:0];
      }
      else if ([method isEqual:@"writeText"]) [args[@"text"] writeToURL:url atomically:YES encoding:NSUTF8StringEncoding error:&error];
      else if ([method isEqual:@"writeBytes"]) {
        NSData *data = [[NSData alloc] initWithBase64EncodedString:args[@"base64"] options:0];
        if (!data) { LegendInvalid(reject, @"Invalid base64 data"); return; }
        [data writeToURL:url options:NSDataWritingAtomic error:&error];
      }
      else if ([method isEqual:@"mkdir"]) [fm createDirectoryAtURL:url withIntermediateDirectories:[args[@"recursive"] boolValue] attributes:nil error:&error];
      else if ([method isEqual:@"remove"]) {
        BOOL directory = NO;
        if (![fm fileExistsAtPath:url.path isDirectory:&directory]) { resolve(@"false"); return; }
        if (directory && ![args[@"recursive"] boolValue] && [fm contentsOfDirectoryAtPath:url.path error:&error].count) {
          reject(@"E_NOT_EMPTY", @"Directory is not empty; pass recursive: true", nil); return;
        }
        if (!error) result = @([fm removeItemAtURL:url error:&error]);
      }
      else if ([method isEqual:@"copy"] || [method isEqual:@"move"]) {
        NSURL *to = FileURL(args[@"to"]);
        if (!to || !to.isFileURL || (to.host.length && ![to.host isEqual:@"localhost"])) { LegendInvalid(reject, @"Expected an absolute destination"); return; }
        if ([method isEqual:@"copy"]) [fm copyItemAtURL:url toURL:to error:&error];
        else [fm moveItemAtURL:url toURL:to error:&error];
      }
      else if ([method isEqual:@"stat"]) {
        NSDictionary *attrs = [fm attributesOfItemAtPath:url.path error:&error];
        if (attrs) result = @{ @"size": attrs[NSFileSize], @"modifiedAt": @([attrs[NSFileModificationDate] timeIntervalSince1970] * 1000),
          @"type": [attrs[NSFileType] isEqual:NSFileTypeDirectory] ? @"directory" : [attrs[NSFileType] isEqual:NSFileTypeSymbolicLink] ? @"symlink" : @"file" };
      }
      else if ([method isEqual:@"list"]) {
        NSArray *names = [fm contentsOfDirectoryAtPath:url.path error:&error];
        result = [names sortedArrayUsingSelector:@selector(compare:)];
      }
      else if ([method isEqual:@"watch"]) {
        // Observe the parent so replacing a file atomically does not lose its watch.
        BOOL isDirectory = NO;
        [fm fileExistsAtPath:url.path isDirectory:&isDirectory];
        NSURL *observed = isDirectory ? url : [url URLByDeletingLastPathComponent];
        int fd = open(observed.fileSystemRepresentation, O_EVTONLY);
        if (fd < 0) { LegendReject(reject, [NSError errorWithDomain:NSPOSIXErrorDomain code:errno userInfo:nil]); return; }
        NSString *watchID = args[@"id"];
        if (self.watches[watchID]) { close(fd); LegendInvalid(reject, @"Watch id already exists"); return; }
        dispatch_source_t source = dispatch_source_create(DISPATCH_SOURCE_TYPE_VNODE, fd,
          DISPATCH_VNODE_WRITE | DISPATCH_VNODE_DELETE | DISPATCH_VNODE_RENAME | DISPATCH_VNODE_EXTEND | DISPATCH_VNODE_ATTRIB,
          self.ioQueue);
        __weak RNDesktopFileSystem *weakSelf = self;
        dispatch_source_set_event_handler(source, ^{
          RNDesktopFileSystem *strongSelf = weakSelf;
          if (strongSelf) [strongSelf sendEventWithName:@"change" body:@{ @"id": watchID, @"path": url.path }];
        });
        dispatch_source_set_cancel_handler(source, ^{ close(fd); });
        self.watches[watchID] = source; dispatch_resume(source);
      }
      else { LegendInvalid(reject, @"Unknown filesystem operation"); return; }
    }
    if (error) LegendReject(reject, error); else resolve(LegendJSON(result));
  });
}
- (void)invalidate {
  dispatch_async(self.ioQueue, ^{ for (dispatch_source_t source in self.watches.allValues) dispatch_source_cancel(source); [self.watches removeAllObjects]; });
  [super invalidate];
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeDesktopFileSystemSpecJSI>(params);
}
@end
