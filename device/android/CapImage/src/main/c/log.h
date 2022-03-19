#pragma once

#ifndef LOG_MODULE
#error Must define LOG_MODULE first
#endif

#ifndef LOG_LEVEL
#define LOG_LEVEL 4 // 0 = nothing, 5 = verbose
#endif

#ifndef LOG_FILE_LINE
#define LOG_FILE_LINE 0
#endif

#include <android/log.h>
#include <stdlib.h> // abort
#include <sys/time.h> // gettimeofday

#define _NOP do{}while(0)

#if LOG_FILE_LINE
#define _LOG(level, fmt, ...) __android_log_print(level, LOG_MODULE, "%s:%d: " fmt, __FILE__, __LINE__, ##__VA_ARGS__)
#else
#define _LOG(level, fmt, ...) __android_log_print(level, LOG_MODULE, fmt, ##__VA_ARGS__)
#endif

#if LOG_LEVEL >= 5
#define LOG_VERBOSE
#define VERBOSE(fmt, ...) _LOG(ANDROID_LOG_VERBOSE, fmt, ##__VA_ARGS__)
#else
#define VERBOSE(fmt, ...) _NOP
#endif

#if LOG_LEVEL >= 4
#define LOG_DEBUG
#define DEBUG(fmt, ...) _LOG(ANDROID_LOG_DEBUG, fmt, ##__VA_ARGS__)
/* DEBUG_TS: log a message with a high-precision timer */
#define DEBUG_TS(fmt, ...) do { \
    struct timeval _tv; \
    gettimeofday(&_tv, NULL); \
    DEBUG("%lu.%06lu " fmt, _tv.tv_sec, _tv.tv_usec, ##__VA_ARGS__); \
} while(0)
#else
#define DEBUG(fmt, ...) _NOP
#define DEBUG_TS(fmt, ...) _NOP
#endif

#if LOG_LEVEL >= 3
#define LOG_INFO
#define INFO(fmt, ...) _LOG(ANDROID_LOG_INFO, fmt, ##__VA_ARGS__)
#else
#define INFO(fmt, ...) _NOP
#endif

#if LOG_LEVEL >= 2
#define LOG_WARN
#define WARN(fmt, ...) _LOG(ANDROID_LOG_WARN, fmt, ##__VA_ARGS__)
#else
#define WARN(fmt, ...) _NOP
#endif

#if LOG_LEVEL >= 1
#define LOG_ERROR
#define ERROR(fmt, ...) _LOG(ANDROID_LOG_ERROR, fmt, ##__VA_ARGS__)
#else
#define ERROR(fmt, ...) _NOP
#endif

#define FATAL(fmt, ...) do { _LOG(ANDROID_LOG_FATAL, "FATAL: " fmt, ##__VA_ARGS__); abort(); } while(0)
