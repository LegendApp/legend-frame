#include "pch.h"

#include "ReactPackageProvider.h"
#if __has_include("ReactPackageProvider.g.cpp")
#include "ReactPackageProvider.g.cpp"
#endif

#include "FrameUI.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::FrameUI::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
  AddAttributedModules(packageBuilder, true);
  winrt::FrameUI::RegisterControls(packageBuilder);
}

} // namespace winrt::FrameUI::implementation
