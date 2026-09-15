#pragma once
#include "NativeModules.h"
#include <JSI/JsiApiContext.h>
#include <InstallNitro.hpp>
#include <CallInvokerDispatcher.hpp>
#include <optional>
namespace margelo::nitro { void SetWindowsUIDispatcher(winrt::Microsoft::ReactNative::ReactDispatcher const &); }
REACT_MODULE(LegendNitroModule, L"NitroModules")
struct LegendNitroModule {
  winrt::Microsoft::ReactNative::ReactContext context;
  REACT_INIT(Initialize) void Initialize(winrt::Microsoft::ReactNative::ReactContext const &value) noexcept { context = value; margelo::nitro::SetWindowsUIDispatcher(context.UIDispatcher()); }
  REACT_SYNC_METHOD(install) std::optional<std::string> install() noexcept {
    try {
      auto handle = context.Handle().JSRuntime();
      if (!handle) return "The Windows runtime does not expose JSI";
      auto &runtime = winrt::Microsoft::ReactNative::GetOrCreateContextRuntime(context, handle);
      // This synchronous TurboModule method is invoked on the owning JS thread.
      margelo::nitro::install(runtime, std::make_shared<margelo::nitro::CallInvokerDispatcher>(context.CallInvoker()));
      return std::nullopt;
    } catch (std::exception const &error) { return error.what(); }
    catch (winrt::hresult_error const &error) { return winrt::to_string(error.message()); }
  }
};
