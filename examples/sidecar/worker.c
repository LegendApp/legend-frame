// App-owned, bounded line protocol. No Node/runtime dependency.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#ifdef _WIN32
#include <windows.h>
#include <fcntl.h>
#include <io.h>
#else
#include <unistd.h>
#endif
static int hex(char c) { if(c >= '0' && c <= '9') return c-'0'; if(c >= 'a' && c <= 'f') return c-'a'+10; return -1; }
int main(int argc, char **argv) {
#ifdef _WIN32
  _setmode(_fileno(stdin), _O_BINARY); _setmode(_fileno(stdout), _O_BINARY);
#endif
  if (argc < 2 || strcmp(argv[1], "--no-ready")) { puts("ready 1"); fflush(stdout); }
  char line[33000], operation[16], payload[32769]; unsigned id;
  while (fgets(line, sizeof(line), stdin)) {
    if (!strchr(line, '\n') || sscanf(line, "%u %15s %32768s", &id, operation, payload) != 3) { fputs("invalid request\n", stderr); return 2; }
    if (!strcmp(operation, "crash")) { fputs("requested crash\n", stderr); return 7; }
    if (!strcmp(operation, "hang")) {
      for (;;) {
#ifdef _WIN32
        Sleep(1000);
#else
        sleep(1);
#endif
      }
    }
    size_t size = !strcmp(payload, "-") ? 0 : strlen(payload); uint32_t hash = 2166136261u; int valid = size % 2 == 0;
    for (size_t i = 0; valid && i < size; i += 2) { int a = hex(payload[i]), b = hex(payload[i+1]); if (a < 0 || b < 0) valid = 0; else hash = (hash ^ (uint8_t)((a<<4)|b)) * 16777619u; }
    if (!valid) printf("%u error invalid_payload\n", id);
    else if (!strcmp(operation, "echo")) printf("%u ok %s\n", id, payload);
    else if (!strcmp(operation, "hash")) printf("%u ok %08x\n", id, hash);
    else printf("%u error unknown_operation\n", id);
    if (fflush(stdout)) return 3;
  }
  return ferror(stdin) ? 4 : 0;
}
