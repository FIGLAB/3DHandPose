# For more information about using CMake with Android Studio, read the
# documentation: https://d.android.com/studio/projects/add-native-code.html

cmake_minimum_required(VERSION 3.4.1)

find_library(log-lib log)

macro(CAPIMAGE_LIB libtag sources cflags)
    add_library(CapImage_${libtag} SHARED ${sources} src/main/c/sys_util.c src/main/c/java_cap_image.c)
    set_target_properties(CapImage_${libtag} PROPERTIES COMPILE_FLAGS "${cflags} -Wall -Wsign-compare -fvisibility=hidden")
    target_link_libraries(CapImage_${libtag} ${log-lib})
endmacro()

if(ANDROID_ABI MATCHES "armeabi-v7a.*")
    # Library for Nexus 5 with synaptics_rmi_dev kernel patch
    CAPIMAGE_LIB(hammerhead "src/main/c/cap_image_syn_rmi.c;src/main/c/syn_rmi.c;src/main/c/read_touch.c"
        "-DCI_CAPW=15 -DCI_CAPH=27 -DCI_SCREENW=1080 -DCI_SCREENH=1920 -DCI_PHYSW=61.5 -DCI_PHYSH=109.5 -DCI_INPUTNR=1 -DCI_NEEDS_TRANSPOSE=0 -DCI_RAW_MODE=F54_FULL_RAW_CAP")

    CAPIMAGE_LIB(gts210vewifixx "src/main/c/cap_image_syn_rmi.c;src/main/c/syn_rmi.c;src/main/c/read_touch.c"
            "-DCI_CAPW=37 -DCI_CAPH=49 -DCI_SCREENW=1536 -DCI_SCREENH=2048 -DCI_PHYSW=147.5 -DCI_PHYSH=197 -DCI_INPUTNR=2 -DCI_NEEDS_TRANSPOSE=1 -DCI_RAW_MODE=F54_FULL_RAW_CAP_RX_COUPLING_COMP -DCI_PERSISTENT_FD=0")

elseif(ANDROID_ABI MATCHES "arm64.*")
    # Library for Samsung Galaxy Tab 2 (SM-T813) with stock kernel
    CAPIMAGE_LIB(gts210vewifixx "src/main/c/cap_image_syn_rmi.c;src/main/c/syn_rmi.c;src/main/c/read_touch.c"
        "-DCI_CAPW=37 -DCI_CAPH=49 -DCI_SCREENW=1536 -DCI_SCREENH=2048 -DCI_PHYSW=147.5 -DCI_PHYSH=197 -DCI_INPUTNR=2 -DCI_NEEDS_TRANSPOSE=1 -DCI_RAW_MODE=F54_FULL_RAW_CAP_RX_COUPLING_COMP -DCI_PERSISTENT_FD=0")

    # Library for Nexus 9 with stock kernel
    CAPIMAGE_LIB(volantis "src/main/c/cap_image_syn_rmi.c;src/main/c/syn_rmi.c;src/main/c/read_touch.c"
        "-DCI_CAPW=28 -DCI_CAPH=38 -DCI_SCREENW=1536 -DCI_SCREENH=2048 -DCI_INPUTNR=0 -DCI_NEEDS_TRANSPOSE=1 -DCI_RAW_MODE=F54_RAW_16BIT_IMAGE -DCI_PERSISTENT_FD=1")

    # Library for Samsung S7 Edge (SM-G935F) with stock kernel
    CAPIMAGE_LIB(hero2ltexx "src/main/c/cap_image_sec_tsp.c;src/main/c/read_touch.c"
        "-DCI_CAPW=15 -DCI_CAPH=27 -DCI_SCREENW=1440 -DCI_SCREENH=2560 -DCI_INPUTNR=1 -DCI_NEEDS_TRANSPOSE=0")

endif()
