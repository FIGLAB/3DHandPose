#define LOG_MODULE "CapImage.JavaBridge"
#include "log.h"

#include <jni.h>

#include "read_cap.h"

/* static native void init() */
JNIEXPORT void JNICALL Java_com_figlab_capimage_CapImage_init(JNIEnv *env, jclass clazz) {
	cap_init();

    /* Set static fields */
#define SET_STATIC_INT_FIELD(f, v) jfieldID field_##f = (*env)->GetStaticFieldID(env, clazz, #f, "I"); \
	(*env)->SetStaticIntField(env, clazz, field_##f, v);
#define SET_STATIC_FLOAT_FIELD(f, v) jfieldID field_##f = (*env)->GetStaticFieldID(env, clazz, #f, "F"); \
	(*env)->SetStaticFloatField(env, clazz, field_##f, v);

    SET_STATIC_INT_FIELD(capWidth, cap_image_width);
    SET_STATIC_INT_FIELD(capHeight, cap_image_height);
    SET_STATIC_INT_FIELD(screenWidth, cap_screen_width);
    SET_STATIC_INT_FIELD(screenHeight, cap_screen_height);
    SET_STATIC_FLOAT_FIELD(physWidth, cap_phys_width);
    SET_STATIC_FLOAT_FIELD(physHeight, cap_phys_height);
#undef SET_STATIC_FLOAT_FIELD
#undef SET_STATIC_INT_FIELD
}

/* static native void pause() */
JNIEXPORT void JNICALL Java_com_figlab_capimage_CapImage_pause(JNIEnv *env, jclass clazz) {
	cap_pause();
}

/* static native void resume() */
JNIEXPORT void JNICALL Java_com_figlab_capimage_CapImage_resume(JNIEnv *env, jclass clazz) {
	cap_resume();
}

/* static native short[] readImage(); */
JNIEXPORT jshortArray JNICALL Java_com_figlab_capimage_CapImage_readImage(JNIEnv *env, jclass clazz) {
    if(cap_request() < 0) {
        ERROR("Error #001: cap_request failed!");
        return NULL;
    }

    /* Do some work while the request is pending */
    int size = cap_image_width * cap_image_height;
    jshortArray result = (*env)->NewShortArray(env, size);
    if(result == NULL)
        return NULL;

    jshort *elems = (*env)->GetShortArrayElements(env, result, NULL);
    if(elems == NULL)
        return NULL;

    cap_read(elems);

    (*env)->ReleaseShortArrayElements(env, result, elems, 0/*mode*/);
    return result;
}

/* static native short[] waitForTouch(NativeTouch touch); */
JNIEXPORT jshortArray JNICALL Java_com_figlab_capimage_CapImage_waitForTouch(JNIEnv *env, jclass clazz, jobject jtouch) {
    int size = cap_image_width * cap_image_height;
    jshortArray result = (*env)->NewShortArray(env, size);
    if(result == NULL)
        return NULL;

    jshort *elems = (*env)->GetShortArrayElements(env, result, NULL);
    if(elems == NULL)
        return NULL;

    struct native_touch touch = cap_on_touch(elems);
    (*env)->ReleaseShortArrayElements(env, result, elems, 0/*mode*/);

    if(touch.id < 0) {
        ERROR("cap_wait_for_touch failed!");
        return NULL;
    }

	/* Fill in the fields of NativeTouch */
	jclass native_touch_class = (*env)->GetObjectClass(env, jtouch);

#define SET_INT_FIELD(f) static jfieldID field_##f; \
    if(!field_##f) { \
		field_##f = (*env)->GetFieldID(env, native_touch_class, #f, "I"); \
	} \
	(*env)->SetIntField(env, jtouch, field_##f, touch.f);

	SET_INT_FIELD(id)
	SET_INT_FIELD(x)
	SET_INT_FIELD(y)
	SET_INT_FIELD(touch_major)
    SET_INT_FIELD(width_major)
    SET_INT_FIELD(touch_minor)
	SET_INT_FIELD(width_minor)
    SET_INT_FIELD(orientation)
	SET_INT_FIELD(pressure)
    SET_INT_FIELD(distance)
#undef SET_INT_FIELD

    return result;
}

JNIEXPORT jboolean JNICALL Java_com_figlab_capimage_CapImage_setMode(JNIEnv *env, jclass type, jint mode) {
    return (jboolean)cap_set_mode((enum image_mode)mode);
}
