#include "pch.h"

#include "ReactPackageProvider.h"
#if __has_include("ReactPackageProvider.g.cpp")
#include "ReactPackageProvider.g.cpp"
#endif

#include "FrameDragDrop.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::FrameDragDrop::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
  AddAttributedModules(packageBuilder, true);
  winrt::FrameDragDrop::Register(packageBuilder);
}

} // namespace winrt::FrameDragDrop::implementation
