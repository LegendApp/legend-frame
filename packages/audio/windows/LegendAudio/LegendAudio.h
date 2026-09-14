#pragma once
#include "NativeModules.h"
#include <winrt/Windows.Media.h>
#include <winrt/Windows.Media.Core.h>
#include <winrt/Windows.Media.Playback.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Data.Json.h>
#include <map>
#include <memory>
#include <cmath>
#include <atomic>
namespace winrt::LegendAudio {
namespace React = Microsoft::ReactNative;
namespace Json = Windows::Data::Json;
struct Entry { Windows::Media::Playback::MediaPlayer player{nullptr}; std::atomic<bool> ended{false}; std::atomic<bool> failed{false}; std::atomic<bool> loaded{false}; };
struct Players { std::map<std::string, std::shared_ptr<Entry>> values; };
REACT_MODULE(LegendAudio, L"NativeLegendAudio")
struct LegendAudio {
  React::ReactContext context;
  std::shared_ptr<Players> players = std::make_shared<Players>();
  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &value) noexcept { context = value; }
  static fire_and_forget Invoke(std::shared_ptr<Players> players, std::string method, std::string encoded, React::ReactPromise<std::string> promise) {
    try {
      auto args = Json::JsonObject::Parse(to_hstring(encoded)); auto id = to_string(args.GetNamedString(L"id"));
      if (method == "create") {
        auto uri = args.GetNamedString(L"uri"); Windows::Media::Core::MediaSource source{nullptr};
        if ((uri.size() > 2 && uri[1] == L':') || std::wstring(uri).starts_with(L"\\\\")) {
          auto file = co_await Windows::Storage::StorageFile::GetFileFromPathAsync(uri);
          source = Windows::Media::Core::MediaSource::CreateFromStorageFile(file);
        } else source = Windows::Media::Core::MediaSource::CreateFromUri(Windows::Foundation::Uri(uri));
        Windows::Media::Playback::MediaPlayer player; player.AutoPlay(false);
        auto controls = player.SystemMediaTransportControls(); controls.IsEnabled(true); controls.IsPlayEnabled(true); controls.IsPauseEnabled(true);
        auto display = controls.DisplayUpdater(); display.Type(Windows::Media::MediaPlaybackType::Music); display.MusicProperties().Title(args.GetNamedString(L"title", L"Music")); display.Update();
        auto entry = std::make_shared<Entry>(); entry->player = player; std::weak_ptr<Entry> weak = entry;
        player.MediaEnded([weak](auto const &, auto const &) { if (auto entry = weak.lock()) entry->ended = true; });
        player.MediaFailed([weak](auto const &, auto const &) { if (auto entry = weak.lock()) entry->failed = true; });
        player.MediaOpened([weak](auto const &, auto const &) { if (auto entry = weak.lock()) entry->loaded = true; });
        player.Source(source);
        players->values.emplace(id, entry);
      } else {
        auto found = players->values.find(id);
        if (found == players->values.end()) throw hresult_invalid_argument(L"Audio player is not available");
        auto entry = found->second; auto player = entry->player; auto session = player.PlaybackSession();
        if (method == "ready") { if (entry->failed) throw hresult_error(E_FAIL, L"Audio could not be decoded or loaded"); promise.Resolve(entry->loaded ? "true" : "false"); co_return; }
        else if (method == "play") { entry->ended = false; player.Play(); }
        else if (method == "pause") player.Pause();
        else if (method == "seek") { entry->ended = false; auto seconds = args.GetNamedNumber(L"seconds"); if (!std::isfinite(seconds) || seconds < 0) throw hresult_invalid_argument(L"Invalid seek position"); session.Position(std::chrono::duration_cast<Windows::Foundation::TimeSpan>(std::chrono::duration<double>(seconds))); }
        else if (method == "remove") { player.Pause(); player.Close(); players->values.erase(found); }
        else if (method == "status") {
          auto position = std::chrono::duration<double>(session.Position()).count(), duration = std::chrono::duration<double>(session.NaturalDuration()).count();
          Json::JsonObject status;
          status.SetNamedValue(L"playing", Json::JsonValue::CreateBooleanValue(session.PlaybackState() == Windows::Media::Playback::MediaPlaybackState::Playing));
          status.SetNamedValue(L"currentTime", Json::JsonValue::CreateNumberValue(position)); status.SetNamedValue(L"duration", Json::JsonValue::CreateNumberValue(duration));
          status.SetNamedValue(L"didJustFinish", Json::JsonValue::CreateBooleanValue(entry->ended.load())); status.SetNamedValue(L"error", entry->failed ? Json::JsonValue::CreateStringValue(L"Audio could not be decoded or loaded") : Json::JsonValue::CreateNullValue());
          promise.Resolve(to_string(status.Stringify())); co_return;
        } else throw hresult_invalid_argument(L"Unknown audio operation");
      }
      promise.Resolve("null");
    } catch (hresult_error const &error) { promise.Reject(React::ReactError{"E_AUDIO", to_string(error.message())}); }
    catch (std::exception const &error) { promise.Reject(error.what()); }
  }
  REACT_METHOD(call)
  void call(std::string method, std::string args, React::ReactPromise<std::string> promise) noexcept {
    context.UIDispatcher().Post([players = players, method, args, promise]() { Invoke(players, method, args, promise); });
  }
};
}
