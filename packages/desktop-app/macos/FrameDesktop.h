#import <AppKit/AppKit.h>
#import <React/RCTBridgeModule.h>

FOUNDATION_EXPORT NSString * const FrameDesktopEvent;
FOUNDATION_EXPORT BOOL FrameAcquireInstance(void);
FOUNDATION_EXPORT NSDictionary *FrameContext(void);
FOUNDATION_EXPORT NSDictionary *FrameInitialProps(NSString *windowID, NSDictionary *props);
FOUNDATION_EXPORT NSString *FrameNamespace(void);
FOUNDATION_EXPORT void FrameEmit(NSDictionary *event);
FOUNDATION_EXPORT void FrameOpenURLs(NSArray<NSURL *> *urls);
FOUNDATION_EXPORT NSArray *FramePendingURLs(void);
FOUNDATION_EXPORT NSString *FrameInitialURL(void);
FOUNDATION_EXPORT void FrameMarkLaunchComplete(void);
FOUNDATION_EXPORT NSApplicationTerminateReply FrameShouldQuit(void);
FOUNDATION_EXPORT NSString *FrameJSON(id value);
FOUNDATION_EXPORT NSDictionary *FrameArgs(NSString *json);
FOUNDATION_EXPORT void FrameReject(RCTPromiseRejectBlock reject, NSError *error);
FOUNDATION_EXPORT void FrameInvalid(RCTPromiseRejectBlock reject, NSString *message);
FOUNDATION_EXPORT NSDictionary *FrameWindowConfiguration(void);
FOUNDATION_EXPORT void FrameApplyWindowOptions(NSWindow *window, NSDictionary *options);
FOUNDATION_EXPORT NSView *FrameWindowContent(NSView *root);
FOUNDATION_EXPORT void FrameRestoreWindow(NSWindow *window, NSString *key, NSDictionary *options);
FOUNDATION_EXPORT NSMenu *FrameDockMenu;
