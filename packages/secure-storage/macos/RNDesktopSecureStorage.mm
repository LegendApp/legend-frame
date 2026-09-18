#import "RNDesktopSecureStorage.h"
#import <RNDesktopApp/FrameDesktop.h>
#import <Security/Security.h>
@implementation RNDesktopSecureStorage
RCT_EXPORT_MODULE(NativeDesktopSecureStorage)
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSDictionary *args = FrameArgs(json);
    NSString *key = args[@"key"];
    if (![key isKindOfClass:NSString.class] || !key.length || key.length > 200) { FrameInvalid(reject, @"Expected a Keychain key of 1–200 characters"); return; }
    // Callers cannot override service identity and accidentally collide in Go.
    NSMutableDictionary *query = [@{ (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
      (__bridge id)kSecAttrService: FrameNamespace(), (__bridge id)kSecAttrAccount: key } mutableCopy];
    OSStatus status;
    if ([method isEqual:@"get"]) {
      query[(__bridge id)kSecReturnData] = @YES;
      query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;
      CFTypeRef value = NULL;
      status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &value);
      if (status == errSecItemNotFound) { resolve(@"null"); return; }
      NSData *data = CFBridgingRelease(value);
      if (status == errSecSuccess) {
        NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (!text) { reject(@"E_ENCODING", @"Keychain value is not UTF-8", nil); return; }
        resolve(FrameJSON(text)); return;
      }
    } else if ([method isEqual:@"set"]) {
      if (![args[@"value"] isKindOfClass:NSString.class]) { FrameInvalid(reject, @"Expected a string value"); return; }
      NSData *value = [args[@"value"] dataUsingEncoding:NSUTF8StringEncoding];
      NSDictionary *attributes = @{ (__bridge id)kSecValueData: value };
      status = SecItemUpdate((__bridge CFDictionaryRef)query, (__bridge CFDictionaryRef)attributes);
      if (status == errSecItemNotFound) {
        [query addEntriesFromDictionary:attributes];
        query[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
        status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
        // Another caller may have added it after our update lookup.
        if (status == errSecDuplicateItem) { [query removeObjectForKey:(__bridge id)kSecValueData]; [query removeObjectForKey:(__bridge id)kSecAttrAccessible]; status = SecItemUpdate((__bridge CFDictionaryRef)query, (__bridge CFDictionaryRef)attributes); }
      }
    } else if ([method isEqual:@"remove"]) {
      status = SecItemDelete((__bridge CFDictionaryRef)query);
      if (status == errSecItemNotFound) status = errSecSuccess;
    } else { FrameInvalid(reject, @"Unknown Keychain operation"); return; }
    if (status == errSecSuccess) resolve(@"null");
    else {
      NSString *message = CFBridgingRelease(SecCopyErrorMessageString(status, NULL));
      reject(@"E_KEYCHAIN", [NSString stringWithFormat:@"Keychain error %d: %@", (int)status, message ?: @"Unknown error"], nil);
    }
  });
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeDesktopSecureStorageSpecJSI>(params);
}
@end
