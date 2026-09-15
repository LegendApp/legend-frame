#pragma once
#include "NativeModules.h"
#include <LegendComponentGeometry.h>
#include <cmath>
#include <map>
#include <memory>
#include <winrt/Microsoft.ReactNative.Composition.h>
#include <winrt/Microsoft.ReactNative.Composition.Input.h>
#include <winrt/Microsoft.UI.Input.DragDrop.h>
#include <winrt/Microsoft.UI.Content.h>
#include <winrt/Windows.ApplicationModel.DataTransfer.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Data.Json.h>
namespace winrt::LegendDragDrop {
namespace React = Microsoft::ReactNative;
namespace Composition = Microsoft::ReactNative::Composition;
namespace Drag = Microsoft::UI::Input::DragDrop;
namespace Transfer = Windows::ApplicationModel::DataTransfer;
namespace Json = Windows::Data::Json;
using Operation = Transfer::DataPackageOperation;
using Point = Windows::Foundation::Point;
using Windows::Foundation::IAsyncAction;
using Windows::Foundation::IAsyncOperation;
struct Props : implements<Props, React::IComponentProps> {
  React::ViewProps view{nullptr}; std::string source; bool disabled = false;
  void SetProp(uint32_t, hstring const &name, React::IJSValueReader const &reader) noexcept {
    if (name == L"sourceJson") React::ReadValue(reader, source); else if (name == L"disabled") React::ReadValue(reader, disabled);
  }
};
struct DragView;
struct RootState {
  apartment_context ui;
  weak_ref<Composition::RootComponentView> root;
  Drag::DragDropManager manager{nullptr}; event_token requested{};
  std::map<int32_t, weak_ref<DragView>> views;
  ~RootState() { if (manager) try { manager.TargetRequested(requested); } catch (...) {} }
  static React::ComponentView Find(React::ComponentView const &view, int64_t tag) {
    if (view.Tag() == tag) return view;
    for (auto const &child : view.Children()) if (auto found = Find(child, tag)) return found;
    return nullptr;
  }
  com_ptr<DragView> Target(Point point);
};
struct DragView : implements<DragView, Windows::Foundation::IInspectable> {
  weak_ref<Composition::ViewComponentView> view;
  React::EventEmitter emitter{nullptr};
  std::shared_ptr<RootState> root;
  std::string source, failure;
  bool disabled = false, pressed = false, dragging = false, mounted = false;
  Point origin{};
  Drag::DragOperation operation{nullptr};
  void Emit(hstring const &event, Json::JsonObject const &value = {}) {
    if (!emitter || !mounted) return;
    const auto json = value.Stringify();
    emitter.DispatchEvent(event, [json](React::IJSValueWriter const &writer) { writer.WriteObjectBegin(); writer.WritePropertyName(L"json"); writer.WriteString(json); writer.WriteObjectEnd(); });
  }
  Point Local(Point point) {
    auto strong = view.get(); if (!strong) return {};
    auto rect = strong.as<ILegendComponentGeometry>()->LegendClientRect(); auto scale = strong.LayoutMetrics().PointScaleFactor; if (scale <= 0) scale = 1;
    return {point.X - rect.left / scale, point.Y - rect.top / scale};
  }
  void Fail(hresult_error const &error) { failure = to_string(error.message()); Json::JsonObject value; value.SetNamedValue(L"message", Json::JsonValue::CreateStringValue(error.message())); Emit(L"unavailable", value); }
  fire_and_forget Start(Microsoft::UI::Input::PointerPoint point, Composition::Input::Pointer pointer) {
    auto keepAlive = get_strong();
    bool accepted = false;
    try {
      if (!root || source.empty() || disabled) { dragging = false; co_return; }
      auto session = root;
      operation = Drag::DragOperation(); operation.AllowedOperations(Operation::Copy);
      auto data = operation.Data(); auto payload = Json::JsonObject::Parse(to_hstring(source));
      data.SetData(L"application/x-legend-drag", box_value(to_hstring(source)));
      if (payload.HasKey(L"text")) data.SetText(payload.GetNamedString(L"text"));
      if (payload.HasKey(L"urls")) { auto urls = payload.GetNamedArray(L"urls"); if (urls.Size()) data.SetWebLink(Windows::Foundation::Uri(urls.GetStringAt(0))); }
      if (payload.HasKey(L"files")) {
        auto items = single_threaded_vector<Windows::Storage::IStorageItem>();
        for (auto const &entry : payload.GetNamedArray(L"files")) {
          auto path = entry.GetString(); auto attributes = GetFileAttributesW(path.c_str()); if (attributes == INVALID_FILE_ATTRIBUTES) throw_last_error();
          if (attributes & FILE_ATTRIBUTE_DIRECTORY) items.Append(co_await Windows::Storage::StorageFolder::GetFolderFromPathAsync(path));
          else items.Append(co_await Windows::Storage::StorageFile::GetFileFromPathAsync(path));
        }
        data.SetStorageItems(items);
      }
      if (mounted && !disabled && root == session) accepted = (co_await operation.StartAsync(session->manager, point)) != Operation::None;
    } catch (hresult_error const &error) { /* Failed or cancelled sources report accepted=false. */ }
    if (auto strong = view.get()) strong.ReleasePointerCapture(pointer);
    if (operation) { try { operation.Close(); } catch (...) {} operation = nullptr; }
    dragging = false; Json::JsonObject result; result.SetNamedValue(L"accepted", Json::JsonValue::CreateBooleanValue(accepted)); Emit(L"dragEnd", result);
  }
  void Close(bool destroy = false) noexcept {
    mounted = false; pressed = false;
    if (root) { if (auto strong = view.get()) root->views.erase(strong.Tag()); root.reset(); }
    if (operation) try { operation.Close(); } catch (...) {}
    if (destroy) emitter = nullptr;
  }
};
inline com_ptr<DragView> RootState::Target(Point point) {
  auto strong = root.get(); if (!strong) return nullptr;
  float x = 0, y = 0; auto tag = strong.as<ILegendComponentGeometry>()->LegendHitTest(point.X, point.Y, &x, &y);
  if (tag < 0) return nullptr;
  auto target = Find(strong, tag);
  while (target) {
    auto found = views.find(target.Tag());
    if (found != views.end()) if (auto state = found->second.get(); state && state->mounted && !state->disabled) return state;
    target = target.Parent();
  }
  return nullptr;
}
inline IAsyncOperation<Json::JsonObject> Payload(Drag::DragInfo info, Point point) {
  auto data = info.Data(); Json::JsonObject result;
  if (data.Contains(L"application/x-legend-drag")) result = Json::JsonObject::Parse(unbox_value<hstring>(co_await data.GetDataAsync(L"application/x-legend-drag")));
  else {
    if (data.Contains(Transfer::StandardDataFormats::Text())) result.SetNamedValue(L"text", Json::JsonValue::CreateStringValue(co_await data.GetTextAsync()));
    if (data.Contains(Transfer::StandardDataFormats::StorageItems())) { Json::JsonArray files; for (auto const &item : co_await data.GetStorageItemsAsync()) files.Append(Json::JsonValue::CreateStringValue(item.Path())); result.SetNamedValue(L"files", files); }
    if (data.Contains(Transfer::StandardDataFormats::WebLink())) { Json::JsonArray urls; urls.Append(Json::JsonValue::CreateStringValue((co_await data.GetWebLinkAsync()).AbsoluteUri())); result.SetNamedValue(L"urls", urls); }
  }
  result.SetNamedValue(L"x", Json::JsonValue::CreateNumberValue(point.X)); result.SetNamedValue(L"y", Json::JsonValue::CreateNumberValue(point.Y)); co_return result;
}
struct DropTarget : implements<DropTarget, Drag::IDropOperationTarget> {
  std::shared_ptr<RootState> root; weak_ref<DragView> current;
  DropTarget(std::shared_ptr<RootState> value) : root(std::move(value)) {}
  IAsyncOperation<Operation> OverAsync(Drag::DragInfo info, Drag::DragUIOverride) {
    auto keepAlive = get_strong(); co_await root->ui;
    try {
      auto data = info.Data(); const bool supported = data.Contains(L"application/x-legend-drag") || data.Contains(Transfer::StandardDataFormats::Text()) || data.Contains(Transfer::StandardDataFormats::StorageItems()) || data.Contains(Transfer::StandardDataFormats::WebLink());
      auto target = supported && (info.AllowedOperations() & Operation::Copy) != Operation::None ? root->Target(info.Position()) : nullptr;
      auto previous = current.get();
      if (target != previous) {
        if (previous) previous->Emit(L"dragLeave"); current = target ? target->get_weak() : weak_ref<DragView>{};
        if (target) { auto payload = co_await Payload(info, target->Local(info.Position())); if (target->mounted && !target->disabled && current.get() == target) target->Emit(L"dragEnter", payload); }
      }
      co_return target && target->mounted && !target->disabled ? Operation::Copy : Operation::None;
    } catch (...) { co_return Operation::None; }
  }
  IAsyncOperation<Operation> EnterAsync(Drag::DragInfo info, Drag::DragUIOverride ui) { return OverAsync(info, ui); }
  IAsyncAction LeaveAsync(Drag::DragInfo) { auto keepAlive = get_strong(); co_await root->ui; if (auto previous = current.get()) previous->Emit(L"dragLeave"); current = {}; co_return; }
  IAsyncOperation<Operation> DropAsync(Drag::DragInfo info) {
    auto keepAlive = get_strong(); co_await root->ui;
    try {
      auto target = root->Target(info.Position()); if (!target || (info.AllowedOperations() & Operation::Copy) == Operation::None) co_return Operation::None;
      auto payload = co_await Payload(info, target->Local(info.Position()));
      if (!target->mounted || target->disabled) co_return Operation::None;
      target->Emit(L"drop", payload); current = {}; co_return Operation::Copy;
    } catch (...) { co_return Operation::None; }
  }
};
inline std::shared_ptr<RootState> ForRoot(Composition::RootComponentView const &root) {
  static thread_local std::map<int32_t, std::weak_ptr<RootState>> roots;
  if (auto existing = roots[root.Tag()].lock()) if (existing->root.get() == root) return existing;
  auto state = std::make_shared<RootState>(); state->root = root; state->manager = Drag::DragDropManager::GetForIsland(root.ReactNativeIsland().Island());
  // Fail at mount if an unpatched runtime was selected, instead of crashing on a drop.
  root.as<ILegendComponentGeometry>();
  state->requested = state->manager.TargetRequested([weak = std::weak_ptr(state)](auto const &, auto const &args) { if (auto state = weak.lock()) args.SetTarget(make<DropTarget>(state)); });
  roots[root.Tag()] = state; return state;
}
inline void Register(React::IReactPackageBuilder const &package) {
  package.as<React::IReactPackageBuilderFabric>().AddViewComponent(L"DesktopDragView", [](React::IReactViewComponentBuilder const &builder) {
    builder.SetCreateProps([](React::ViewProps const &view, React::IComponentProps const &previous) { auto props = make_self<Props>(); if (previous) { auto old = get_self<Props>(previous); props->source = old->source; props->disabled = old->disabled; } props->view = view; return props.as<React::IComponentProps>(); });
    builder.as<Composition::IReactCompositionViewComponentBuilder>().SetViewComponentViewInitializer([](Composition::ViewComponentView const &view) {
      auto state = make_self<DragView>(); state->view = view; view.UserData(state.as<Windows::Foundation::IInspectable>()); auto weak = state->get_weak();
      view.Mounted([weak](auto const &, React::ComponentView const &) { if (auto self = weak.get()) try { self->mounted = true; auto view = self->view.get(); self->root = ForRoot(view.Root()); self->root->views[view.Tag()] = self->get_weak(); } catch (hresult_error const &error) { self->Fail(error); } });
      view.Unmounted([weak](auto const &, auto const &) { if (auto self = weak.get()) self->Close(); });
      view.Destroying([weak](auto const &, auto const &) { if (auto self = weak.get()) self->Close(true); });
      view.PointerPressed([weak](auto const &, Composition::Input::PointerRoutedEventArgs const &args) { if (auto self = weak.get(); self && !args.Handled() && !self->disabled && !self->source.empty()) { auto point = args.GetCurrentPoint(self->view.get().Tag()); self->pressed = point.Properties().IsLeftButtonPressed(); self->origin = point.Position(); } });
      view.PointerReleased([weak](auto const &, auto const &) { if (auto self = weak.get()) self->pressed = false; });
      view.PointerMoved([weak](auto const &, Composition::Input::PointerRoutedEventArgs const &args) {
        if (auto self = weak.get(); self && self->mounted && self->root && self->pressed && !self->dragging && !self->disabled && !args.Handled()) {
          auto view = self->view.get(); auto point = args.GetCurrentPoint(view.Tag()); if (!point.Properties().IsLeftButtonPressed()) { self->pressed = false; return; }
          if (std::hypot(point.Position().X - self->origin.X, point.Position().Y - self->origin.Y) < 6) return;
          self->dragging = true; self->pressed = false; args.Handled(true); view.CapturePointer(args.Pointer()); self->Start(point.Inner(), args.Pointer());
        }
      });
    });
    builder.SetUpdatePropsHandler([](React::ComponentView const &view, React::IComponentProps const &props, React::IComponentProps const &) { auto state = get_self<DragView>(view.UserData()); auto value = get_self<Props>(props); state->source = value->source; state->disabled = value->disabled; });
    builder.SetUpdateEventEmitterHandler([](React::ComponentView const &view, React::EventEmitter const &emitter) { auto state = get_self<DragView>(view.UserData()); state->emitter = emitter; if (!state->failure.empty()) { Json::JsonObject error; error.SetNamedValue(L"message", Json::JsonValue::CreateStringValue(to_hstring(state->failure))); state->Emit(L"unavailable", error); } });
  });
}
}
