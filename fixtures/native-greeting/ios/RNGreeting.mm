#import "RNGreeting.h"
#import <React/RCTBridgeModule.h>
@implementation RNGreeting
RCT_EXPORT_MODULE(NativeGreeting)
- (NSString *)getGreeting { return @"Hello from native code"; }
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{ return std::make_shared<facebook::react::NativeGreetingSpecJSI>(params); }
@end
