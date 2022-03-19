#pragma once

void sudo_chmod(int mode, const char *fmt, ...) __attribute__((format (printf, 2, 3)));
void sudo_chcon(const char *type, const char *fmt, ...) __attribute__((format (printf, 2, 3)));
