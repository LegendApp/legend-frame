#import "RNLegendSelect.h"
#import <react/renderer/components/RNLegendUISpec/ComponentDescriptors.h>
#import <react/renderer/components/RNLegendUISpec/EventEmitters.h>
#import <react/renderer/components/RNLegendUISpec/Props.h>
using namespace facebook::react;
// Adapted from legend-apps/native-select's AppKit backend.
@implementation RNLegendSelect {
  NSPopUpButton *_select;
  NSString *_items;
}
- (instancetype)init {
  if (self = [super init]) {
    _props = std::make_shared<const LegendSelectProps>();
    _select = [[NSPopUpButton alloc] initWithFrame:NSZeroRect pullsDown:NO];
    _select.target = self; _select.action = @selector(changed:);
    [self addSubview:_select];
  }
  return self;
}
- (BOOL)isFlipped { return YES; }
- (void)changed:(id)sender {
  const auto emitter = std::static_pointer_cast<const LegendSelectEventEmitter>(_eventEmitter);
  NSString *value = _select.selectedItem.representedObject;
  if (emitter && value) emitter->onSelectionChange({ .value = value.UTF8String });
}
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &value = *std::static_pointer_cast<const LegendSelectProps>(props);
  NSString *items = [NSString stringWithUTF8String:value.itemsJson.c_str()];
  if (![_items isEqual:items]) {
    _items = items; [_select removeAllItems];
    NSArray *options = [NSJSONSerialization JSONObjectWithData:[items dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    for (NSDictionary *option in options) {
      NSMenuItem *item = [[NSMenuItem alloc] initWithTitle:option[@"label"] action:nil keyEquivalent:@""];
      item.representedObject = option[@"value"];
      [_select.menu addItem:item];
    }
  }
  NSString *selected = [NSString stringWithUTF8String:value.value.c_str()];
  for (NSMenuItem *item in _select.itemArray) if ([item.representedObject isEqual:selected]) { [_select selectItem:item]; break; }
  _select.accessibilityIdentifier = [NSString stringWithUTF8String:value.testId.c_str()];
  _select.accessibilityLabel = [NSString stringWithUTF8String:value.accessibilityLabel.c_str()];
  [super updateProps:props oldProps:oldProps];
}
- (void)layoutSubviews { [super layoutSubviews]; _select.frame = self.bounds; }
- (void)updateLayoutMetrics:(const LayoutMetrics &)layoutMetrics oldLayoutMetrics:(const LayoutMetrics &)oldLayoutMetrics {
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics]; [self layoutSubviews];
}
- (void)prepareForRecycle {
  [super prepareForRecycle]; _items = nil; [_select removeAllItems];
  _select.accessibilityIdentifier = nil; _select.accessibilityLabel = nil;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider { return concreteComponentDescriptorProvider<LegendSelectComponentDescriptor>(); }
@end
