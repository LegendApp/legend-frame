#import <AppKit/AppKit.h>
#import <React/RCTBridgeModule.h>

FOUNDATION_EXPORT NSString * const LegendDesktopEvent;
FOUNDATION_EXPORT BOOL LegendAcquireInstance(void);
FOUNDATION_EXPORT NSDictionary *LegendContext(void);
FOUNDATION_EXPORT NSDictionary *LegendInitialProps(NSString *windowID, NSDictionary *props);
FOUNDATION_EXPORT NSString *LegendNamespace(void);
FOUNDATION_EXPORT void LegendEmit(NSDictionary *event);
FOUNDATION_EXPORT void LegendOpenURLs(NSArray<NSURL *> *urls);
FOUNDATION_EXPORT NSArray *LegendPendingURLs(void);
FOUNDATION_EXPORT NSString *LegendInitialURL(void);
FOUNDATION_EXPORT void LegendMarkLaunchComplete(void);
FOUNDATION_EXPORT NSApplicationTerminateReply LegendShouldQuit(void);
FOUNDATION_EXPORT NSString *LegendJSON(id value);
FOUNDATION_EXPORT NSDictionary *LegendArgs(NSString *json);
FOUNDATION_EXPORT void LegendReject(RCTPromiseRejectBlock reject, NSError *error);
FOUNDATION_EXPORT void LegendInvalid(RCTPromiseRejectBlock reject, NSString *message);
FOUNDATION_EXPORT NSDictionary *LegendWindowConfiguration(void);
FOUNDATION_EXPORT void LegendApplyWindowOptions(NSWindow *window, NSDictionary *options);
FOUNDATION_EXPORT NSView *LegendWindowContent(NSView *root);
FOUNDATION_EXPORT void LegendRestoreWindow(NSWindow *window, NSString *key, NSDictionary *options);
FOUNDATION_EXPORT NSMenu *LegendDockMenu;
