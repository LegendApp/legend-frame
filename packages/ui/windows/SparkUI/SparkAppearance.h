#pragma once
#include "NativeModules.h"
#include <winrt/Windows.UI.ViewManagement.h>

namespace winrt::SparkUI {
namespace React = Microsoft::ReactNative;
// Per React host, shared by all its XAML islands. No application-level XAML
// RequestedTheme mutation: WinUI does not allow changing that after startup.
inline React::ReactPropertyId<int32_t> ThemePreference() { return {L"Spark.UI", L"ThemePreference"}; }
inline React::ReactNotificationId<int32_t> ThemeChanged() { return {L"Spark.UI", L"ThemeChanged"}; }
inline int32_t SystemTheme() {
  auto foreground = Windows::UI::ViewManagement::UISettings().GetColorValue(Windows::UI::ViewManagement::UIColorType::Foreground);
  return (5 * foreground.G + 2 * foreground.R + foreground.B) > 8 * 128 ? 1 : 0;
}
inline int32_t EffectiveTheme(React::ReactContext const &context) {
  auto preference = context.Properties().Get(ThemePreference()).value_or(-1);
  return preference < 0 ? SystemTheme() : preference;
}

// RNW 0.81's built-in Appearance setter is a no-op. Package-provided TurboModules
// override built-ins through RNW's public package builder, preserving the RN API.
REACT_MODULE(SparkAppearance, L"Appearance")
struct SparkAppearance : std::enable_shared_from_this<SparkAppearance> {
  React::ReactContext context;
  int32_t lastTheme = -1;
  Windows::UI::ViewManagement::UISettings settings;
  Windows::UI::ViewManagement::UISettings::ColorValuesChanged_revoker changed;
  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &value) noexcept {
    context = value;
    context.Properties().Set(ThemePreference(), -1);
    changed = settings.ColorValuesChanged(auto_revoke, [weak = weak_from_this()](auto const &, auto const &) {
      if (auto self = weak.lock()) self->Notify();
    });
    Notify();
  }
  void Notify() {
    context.UIDispatcher().Post([weak = weak_from_this()]() {
      if (auto self = weak.lock()) {
        auto theme = EffectiveTheme(self->context);
        if (self->lastTheme == theme) return;
        self->lastTheme = theme;
        self->context.Notifications().SendNotification(ThemeChanged(), nullptr, theme);
        self->context.EmitJSEvent(L"RCTDeviceEventEmitter", L"appearanceChanged", React::JSValueObject{{"colorScheme", theme ? "dark" : "light"}});
      }
    });
  }
  REACT_SYNC_METHOD(getColorScheme)
  std::string getColorScheme() noexcept { return EffectiveTheme(context) ? "dark" : "light"; }
  // Synchronous state update is intentional: RN calls getColorScheme immediately
  // after setColorScheme. XAML work and change events still run on the UI thread.
  REACT_SYNC_METHOD(setColorScheme)
  bool setColorScheme(std::string style) noexcept {
    context.Properties().Set(ThemePreference(), style == "dark" ? 1 : style == "light" ? 0 : -1);
    Notify();
    return true;
  }
  REACT_METHOD(addListener) void addListener(std::string const &) noexcept {}
  REACT_METHOD(removeListeners) void removeListeners(double) noexcept {}
};
}
