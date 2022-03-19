#define LOG_MODULE "CapImage.SystemUtils"
#include "log.h"

#include "sys_util.h"

#include <sys/stat.h>

#define MAX_CMDLEN 1024

static int get_mode(char *path) {
    struct stat st;

    if(stat(path, &st) < 0)
        return -1;

    return st.st_mode & 07777;
}

void sudo_chmod(int mode, const char *fmt, ...) {
    va_list ap;

    char cmdbuf[MAX_CMDLEN];
    char *ptr = cmdbuf;
    char *end = cmdbuf + sizeof(cmdbuf);
    ptr += snprintf(ptr, end-ptr, "su -c 'chmod %o ", mode);

    char *path = ptr;

    va_start(ap, fmt);
    ptr += vsnprintf(ptr, end-ptr, fmt, ap);
    va_end(ap);

    if(get_mode(path) == mode) {
        VERBOSE("Not changing mode of %s: already set to 0%o", path, mode);
        return;
    }

    ptr += snprintf(ptr, end-ptr, "'");

    int res = system(cmdbuf);
    if(res != 0) {
        ERROR("command <%s> failed: return %d", cmdbuf, res);
    }
}

void sudo_chcon(const char *type, const char *fmt, ...) {
    va_list ap;

    char cmdbuf[MAX_CMDLEN];
    char *ptr = cmdbuf;
    char *end = cmdbuf + sizeof(cmdbuf);
    ptr += snprintf(ptr, end-ptr, "su -c 'chcon %s ", type);

    va_start(ap, fmt);
    ptr += vsnprintf(ptr, end-ptr, fmt, ap);
    va_end(ap);

    ptr += snprintf(ptr, end-ptr, "'");

    int res = system(cmdbuf);
    if(res != 0) {
        ERROR("command <%s> failed: return %d", cmdbuf, res);
    }
}
