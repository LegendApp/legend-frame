#pragma once
#include <unknwn.h>
#include <cstdint>
#include <windef.h>
// Private ABI for the pinned RNW adapter. Do not alter RNW's existing interfaces.
struct __declspec(uuid("29DAD809-CE78-4F6F-89B4-5DC3BC7AC136")) IFrameComponentGeometry : IUnknown {
  virtual RECT __stdcall FrameClientRect() noexcept = 0;
  virtual int64_t __stdcall FrameHitTest(float x, float y, float *localX, float *localY) noexcept = 0;
};
