#include "../packages/desktop-links/common/AuthLoopback.h"
#include <iostream>
int main() {
  legend::AuthLoopback callback(0, "/auth/callback");
  std::cout << callback.RedirectURI() << std::endl;
  std::string line;
  while (std::getline(std::cin, line)) {
    if (line == "quit") return 0;
    const auto values = callback.Drain();
    for (auto const &url : values) std::cout << url << std::endl;
    std::cout << "END" << std::endl;
  }
}
