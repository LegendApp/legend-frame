#import "RNDesktopDragView.h"
#import <react/renderer/components/RNDesktopDragSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNDesktopDragSpec/EventEmitters.h>
#import <react/renderer/components/RNDesktopDragSpec/Props.h>
#import <react/renderer/components/RNDesktopDragSpec/RCTComponentViewHelpers.h>
using namespace facebook::react;
static std::string JSON(id value) { NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil]; NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]; return json.UTF8String ?: "{}"; }
@implementation RNDesktopDragView {
  NSDictionary *_source;
  BOOL _disabled;
  BOOL _dragging;
  BOOL _mouseDown;
  NSPoint _start;
}
- (instancetype)init { if (self = [super init]) { _props = std::make_shared<const DesktopDragViewProps>(); [self registerForDraggedTypes:@[NSPasteboardTypeFileURL, NSPasteboardTypeURL, NSPasteboardTypeString]]; } return self; }
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &value = *std::static_pointer_cast<DesktopDragViewProps const>(props);
  NSString *json = [NSString stringWithUTF8String:value.sourceJson.c_str()];
  _source = json.length ? [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil] : nil;
  _disabled = value.disabled; [super updateProps:props oldProps:oldProps];
}
- (BOOL)isFlipped { return YES; }
// Fabric parents call the UIKit-compatible overload directly when traversing children.
- (NSView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event { NSView *hit = [super hitTest:point withEvent:event]; return hit && _source.count && !_disabled ? self : hit; }
- (BOOL)mouseDownCanMoveWindow { return _source.count && !_disabled ? NO : [super mouseDownCanMoveWindow]; }
- (NSDictionary *)payload:(id<NSDraggingInfo>)sender {
  NSMutableArray *files = [NSMutableArray new], *urls = [NSMutableArray new]; NSPasteboard *board = sender.draggingPasteboard;
  for (NSURL *url in [board readObjectsForClasses:@[NSURL.class] options:nil]) { if (url.fileURL) [files addObject:url.path]; else [urls addObject:url.absoluteString]; }
  NSPoint point = [self convertPoint:sender.draggingLocation fromView:nil];
  return @{ @"files": files, @"urls": urls, @"text": [board stringForType:NSPasteboardTypeString] ?: @"", @"x": @(point.x), @"y": @(point.y) };
}
- (NSDragOperation)draggingEntered:(id<NSDraggingInfo>)sender {
  if (_disabled || ![sender.draggingPasteboard availableTypeFromArray:@[NSPasteboardTypeFileURL, NSPasteboardTypeURL, NSPasteboardTypeString]]) return NSDragOperationNone;
  auto emitter = std::static_pointer_cast<const DesktopDragViewEventEmitter>(_eventEmitter); if (emitter) emitter->onDragEnter({ JSON([self payload:sender]) }); return NSDragOperationCopy;
}
- (NSDragOperation)draggingUpdated:(id<NSDraggingInfo>)sender { return _disabled ? NSDragOperationNone : NSDragOperationCopy; }
- (void)draggingExited:(id<NSDraggingInfo>)sender { auto emitter = std::static_pointer_cast<const DesktopDragViewEventEmitter>(_eventEmitter); if (emitter) emitter->onDragLeave({ "{}" }); }
- (BOOL)performDragOperation:(id<NSDraggingInfo>)sender { if (_disabled) return NO; auto emitter = std::static_pointer_cast<const DesktopDragViewEventEmitter>(_eventEmitter); if (!emitter) return NO; emitter->onDrop({ JSON([self payload:sender]) }); return YES; }
- (void)mouseDown:(NSEvent *)event { _mouseDown = YES; _start = event.locationInWindow; if (!_source.count || _disabled) [super mouseDown:event]; }
- (void)mouseUp:(NSEvent *)event { _mouseDown = NO; [super mouseUp:event]; }
- (void)mouseDragged:(NSEvent *)event {
  if (!_mouseDown || _dragging || _disabled || !_source.count || hypot(event.locationInWindow.x - _start.x, event.locationInWindow.y - _start.y) < 6) { [super mouseDragged:event]; return; }
  NSMutableArray *writers = [NSMutableArray new];
  for (NSString *file in _source[@"files"]) if ([file hasPrefix:@"/"]) [writers addObject:[NSURL fileURLWithPath:file]];
  for (NSString *value in _source[@"urls"]) { NSURL *url = [NSURL URLWithString:value]; if (url) [writers addObject:url]; }
  if (_source[@"text"]) [writers addObject:_source[@"text"]];
  if (!writers.count) return;
  NSMutableArray *items = [NSMutableArray new];
  for (id<NSPasteboardWriting> writer in writers) {
    NSDraggingItem *item = [[NSDraggingItem alloc] initWithPasteboardWriter:writer];
    NSImage *image = [NSImage imageWithSystemSymbolName:@"doc" accessibilityDescription:@"Dragged item"];
    [item setDraggingFrame:NSMakeRect(0, 0, 32, 32) contents:image]; [items addObject:item];
  }
  _dragging = YES; [self beginDraggingSessionWithItems:items event:event source:self];
}
- (NSDragOperation)draggingSession:(NSDraggingSession *)session sourceOperationMaskForDraggingContext:(NSDraggingContext)context { return NSDragOperationCopy; }
- (void)draggingSession:(NSDraggingSession *)session endedAtPoint:(NSPoint)point operation:(NSDragOperation)operation {
  _dragging = NO; _mouseDown = NO; auto emitter = std::static_pointer_cast<const DesktopDragViewEventEmitter>(_eventEmitter); if (emitter) emitter->onDragEnd({ JSON(@{ @"accepted": @(operation != NSDragOperationNone) }) });
}
- (void)prepareForRecycle { [super prepareForRecycle]; _source = nil; _disabled = NO; _dragging = NO; _mouseDown = NO; _start = NSZeroPoint; }
+ (ComponentDescriptorProvider)componentDescriptorProvider { return concreteComponentDescriptorProvider<DesktopDragViewComponentDescriptor>(); }
@end
