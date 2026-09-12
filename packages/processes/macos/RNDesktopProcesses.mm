#import "RNDesktopProcesses.h"
#import <RNDesktopApp/LegendDesktop.h>
#import <signal.h>
@interface LegendProcess : NSObject
@property NSTask *task;
@property NSFileHandle *input;
@property BOOL timedOut;
@property BOOL truncated;
@property BOOL ended;
@property dispatch_queue_t inputQueue;
@end
@implementation LegendProcess
@end
@interface RNDesktopProcesses ()
@property NSMutableDictionary<NSString *, LegendProcess *> *processes;
@property BOOL invalidated;
@end
@implementation RNDesktopProcesses
RCT_EXPORT_MODULE(NativeDesktopProcesses)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (instancetype)init { if (self = [super init]) _processes = [NSMutableDictionary new]; return self; }
- (void)terminate:(LegendProcess *)process {
  if (process.task.running) {
    [process.task terminate];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
      if (process.task.running) kill(process.task.processIdentifier, SIGKILL);
    });
  }
}
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *args = LegendArgs(json); NSString *key = args[@"id"];
    if (self.invalidated) { reject(@"E_CLOSED", @"Process module is closed", nil); return; }
    LegendProcess *process = self.processes[key];
    if ([method isEqual:@"spawn"]) {
      if (process) { reject(@"E_EXISTS", @"Process id already exists", nil); return; }
      NSString *executable = args[@"executable"];
      if ([executable hasPrefix:@"helper:"]) {
        NSString *name = [executable substringFromIndex:7];
        if (!name.length || [name containsString:@"/"] || [name isEqual:@".."] || [name isEqual:@"."]) { LegendInvalid(reject, @"Invalid helper name"); return; }
        executable = [[NSBundle.mainBundle.bundlePath stringByAppendingPathComponent:@"Contents/Helpers"] stringByAppendingPathComponent:name];
      }
      if (![executable hasPrefix:@"/"]) { LegendInvalid(reject, @"Executable path must be absolute"); return; }
      process = [LegendProcess new]; process.task = [NSTask new];
      process.inputQueue = dispatch_queue_create("desktop.process.input", DISPATCH_QUEUE_SERIAL);
      process.task.executableURL = [NSURL fileURLWithPath:executable]; process.task.arguments = args[@"args"] ?: @[];
      NSMutableDictionary *environment = [NSProcessInfo.processInfo.environment mutableCopy]; [environment addEntriesFromDictionary:args[@"env"] ?: @{}]; process.task.environment = environment;
      if (args[@"cwd"]) process.task.currentDirectoryURL = [NSURL fileURLWithPath:args[@"cwd"] isDirectory:YES];
      NSPipe *input = [NSPipe pipe], *output = [NSPipe pipe], *errorPipe = [NSPipe pipe];
      process.task.standardInput = input; process.task.standardOutput = output; process.task.standardError = errorPipe; process.input = input.fileHandleForWriting;
      NSError *error; if (![process.task launchAndReturnError:&error]) { LegendReject(reject, error); return; }
      self.processes[key] = process;
      NSMutableData *stdoutData = [NSMutableData new], *stderrData = [NSMutableData new];
      dispatch_group_t group = dispatch_group_create();
      NSArray *streams = @[output.fileHandleForReading, errorPipe.fileHandleForReading];
      for (NSUInteger index = 0; index < streams.count; index++) {
        NSFileHandle *handle = streams[index]; NSMutableData *buffer = index ? stderrData : stdoutData;
        NSString *stream = index ? @"stderr" : @"stdout";
        dispatch_group_async(group, dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
          @try {
            while (YES) {
              NSData *data = [handle readDataOfLength:16384]; if (!data.length) break;
              @synchronized(process) { NSUInteger remaining = 8 * 1024 * 1024 - buffer.length; if (data.length > remaining) process.truncated = YES; [buffer appendData:[data subdataWithRange:NSMakeRange(0, MIN(remaining, data.length))]]; }
              if ([args[@"streamOutput"] boolValue]) dispatch_sync(dispatch_get_main_queue(), ^{ if (!self.invalidated) LegendEmit(@{ @"type": @"processOutput", @"processId": key, @"stream": stream, @"base64": [data base64EncodedStringWithOptions:0] }); });
            }
          } @catch (NSException *exception) { /* Closing the runtime interrupts pipe reads. */ }
          [handle closeFile];
        });
      }
      dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        [process.task waitUntilExit];
        dispatch_group_notify(group, dispatch_get_main_queue(), ^{
          process.ended = YES;
          dispatch_async(process.inputQueue, ^{ @try { [process.input closeFile]; } @catch (NSException *exception) {} });
          if (!self.invalidated) LegendEmit(@{ @"type": @"processExit", @"processId": key, @"result": @{
            @"exitCode": @(process.task.terminationStatus), @"signal": @(process.task.terminationReason == NSTaskTerminationReasonUncaughtSignal),
            @"stdout": [[NSString alloc] initWithData:stdoutData encoding:NSUTF8StringEncoding] ?: @"", @"stderr": [[NSString alloc] initWithData:stderrData encoding:NSUTF8StringEncoding] ?: @"",
            @"stdoutBase64": [stdoutData base64EncodedStringWithOptions:0], @"stderrBase64": [stderrData base64EncodedStringWithOptions:0],
            @"timedOut": @(process.timedOut), @"outputTruncated": @(process.truncated) } });
          [self.processes removeObjectForKey:key];
        });
      });
      if (args[@"input"]) { NSData *data = [args[@"input"] dataUsingEncoding:NSUTF8StringEncoding]; dispatch_async(process.inputQueue, ^{ @try { [process.input writeData:data]; } @catch (NSException *exception) {} }); }
      if (args[@"timeoutMs"]) dispatch_after(dispatch_time(DISPATCH_TIME_NOW, [args[@"timeoutMs"] doubleValue] * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
        if (process.task.running) { process.timedOut = YES; [self terminate:process]; }
      });
    } else {
      if (!process || process.ended) { if ([method isEqual:@"terminate"] || [method isEqual:@"closeInput"]) { resolve(@"null"); return; } reject(@"E_CLOSED", @"Process has exited", nil); return; }
      if ([method isEqual:@"terminate"]) [self terminate:process];
      else if ([method isEqual:@"write"] || [method isEqual:@"closeInput"]) {
        dispatch_async(process.inputQueue, ^{
          @try { if ([method isEqual:@"write"]) [process.input writeData:[args[@"text"] dataUsingEncoding:NSUTF8StringEncoding]]; else [process.input closeFile]; resolve(@"null"); }
          @catch (NSException *exception) { reject(@"E_PIPE", @"Process input is closed", nil); }
        }); return;
      } else { LegendInvalid(reject, @"Unknown process operation"); return; }
    }
    resolve(@"null");
  });
}
- (void)invalidate { dispatch_async(dispatch_get_main_queue(), ^{ self.invalidated = YES; for (LegendProcess *process in self.processes.allValues) [self terminate:process]; }); }
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params { return std::make_shared<facebook::react::NativeDesktopProcessesSpecJSI>(params); }
@end
