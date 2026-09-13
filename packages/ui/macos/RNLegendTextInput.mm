#import "RNLegendTextInput.h"
#import <react/renderer/components/RNLegendUISpec/ComponentDescriptors.h>
#import <react/renderer/components/RNLegendUISpec/EventEmitters.h>
#import <react/renderer/components/RNLegendUISpec/Props.h>
using namespace facebook::react;
@implementation RNLegendTextInput {
  NSTextField *_field;
  BOOL _initialized;
}
- (instancetype)init {
  if (self = [super init]) {
    _props = std::make_shared<const LegendTextInputProps>();
    _field = [NSTextField textFieldWithString:@""];
    _field.delegate = self;
    _field.bezelStyle = NSTextFieldRoundedBezel;
    _field.cell.scrollable = YES;
    _field.cell.wraps = NO;
    _field.cell.usesSingleLineMode = YES;
    [self addSubview:_field];
  }
  return self;
}
- (BOOL)isFlipped { return YES; }
- (void)controlTextDidChange:(NSNotification *)notification {
  const auto emitter = std::static_pointer_cast<const LegendTextInputEventEmitter>(_eventEmitter);
  if (emitter) emitter->onTextChange({ .text = _field.stringValue.UTF8String ?: "" });
}
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &value = *std::static_pointer_cast<const LegendTextInputProps>(props);
  if (!_initialized) { _field.stringValue = [NSString stringWithUTF8String:value.defaultText.c_str()]; _initialized = YES; }
  _field.accessibilityIdentifier = [NSString stringWithUTF8String:value.testId.c_str()];
  _field.accessibilityLabel = [NSString stringWithUTF8String:value.accessibilityLabel.c_str()];
  [super updateProps:props oldProps:oldProps];
}
- (void)layoutSubviews { [super layoutSubviews]; _field.frame = self.bounds; }
- (void)updateLayoutMetrics:(const LayoutMetrics &)layoutMetrics oldLayoutMetrics:(const LayoutMetrics &)oldLayoutMetrics {
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics]; [self layoutSubviews];
}
- (void)prepareForRecycle {
  [_field abortEditing];
  [super prepareForRecycle];
  _initialized = NO; _field.stringValue = @""; _field.accessibilityIdentifier = nil; _field.accessibilityLabel = nil;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider { return concreteComponentDescriptorProvider<LegendTextInputComponentDescriptor>(); }
@end
