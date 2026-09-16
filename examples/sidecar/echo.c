// An app-owned executable, with no Node or framework runtime dependency.
#include <stdio.h>
#include <string.h>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#include <process.h>
#else
#include <unistd.h>
#endif
int main(int argc, char **argv) {
#ifdef _WIN32
  _setmode(_fileno(stdin), _O_BINARY);
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  if (argc > 1 && strcmp(argv[1], "--identity") == 0) {
#ifdef _WIN32
    printf("%d\n", _getpid());
#else
    printf("%d\n", getpid());
#endif
    fflush(stdout);
  }
  if (argc > 1 && strcmp(argv[1], "--fail") == 0) {
    fputs("requested failure\n", stderr); return 7;
  }
  if (argc > 1 && strcmp(argv[1], "--binary") == 0) {
    unsigned char bytes[16384];
    for (int i = 0; i < sizeof(bytes); ++i) bytes[i] = (unsigned char)i;
    for (int i = 0; i < 576; ++i) if (fwrite(bytes, 1, sizeof(bytes), stdout) != sizeof(bytes)) return 2;
    return 0;
  }
  fputs("ready\n", stderr); fflush(stderr);
  unsigned char buffer[16384];
  size_t count;
  while ((count = fread(buffer, 1, sizeof(buffer), stdin)) > 0) {
    if (fwrite(buffer, 1, count, stdout) != count || fflush(stdout)) return 2;
  }
  return ferror(stdin) ? 3 : 0;
}
