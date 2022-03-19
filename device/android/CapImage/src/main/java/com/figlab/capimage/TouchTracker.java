package com.figlab.capimage;

import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.MotionEvent.PointerCoords;
import android.view.MotionEvent.PointerProperties;

import java.util.Comparator;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.TreeMap;

public class TouchTracker {
    public static class TouchMap extends TreeMap<PointerProperties, PointerCoords> {
        private static final Comparator<PointerProperties> pointerPropertiesComparator = new Comparator<PointerProperties>() {
            @Override
            public int compare(PointerProperties p1, PointerProperties p2) {
                if(p1.toolType != p2.toolType)
                    return Integer.compare(p1.toolType, p2.toolType);
                return Integer.compare(p1.id, p2.id);
            }
        };

        public TouchMap() {
            super(pointerPropertiesComparator);
        }
    }

    public interface TouchMapCallback {
        void onNewTouchMap(TouchMap newTouchMap);
    }

    public interface TouchEventListener {
        boolean onTouchEvent(MotionEvent event);
    }

    /* Maximum number of pixels that a finger can move per frame */
    public float MAX_MOVE_PX = 10 * CapImage.getScreenSize().getHeight() / CapImage.getCapSize().getHeight();

    private long downTime;
    private int nextId = 0;
    private TouchMap touchMap = new TouchMap();

    private static PointerProperties newPointerProperties(int id, int toolType) {
        PointerProperties pp = new PointerProperties();
        pp.id = id;
        pp.toolType = toolType;
        return pp;
    }

    private static class TouchDist implements Comparable<TouchDist> {
        PointerProperties props;
        PointerCoords coords;
        float dist;

        @Override
        public int compareTo(TouchDist other) {
            return Float.compare(dist, other.dist);
        }
    }

    private TouchMap computeTouchMap(TouchMap oldTouchMap, List<PointerCoords> touches) {
        TouchMap touchMap = new TouchMap();
        if(touches.size() == 0)
            return touchMap;

        PriorityQueue<TouchDist> dists = new PriorityQueue<>();
        HashSet<PointerProperties> oldMatched = new HashSet<>();
        HashSet<PointerCoords> newMatched = new HashSet<>();

        float dispx = 0, dispy = 0;
        if(oldTouchMap.size() == touches.size()) {
            /* Calculate overall displacement to improve matching */
            for(PointerCoords coords : oldTouchMap.values()) {
                dispx -= coords.x;
                dispy -= coords.y;
            }
            for(PointerCoords coords : touches) {
                dispx += coords.x;
                dispy += coords.y;
            }
            dispx /= touches.size();
            dispy /= touches.size();
            /* disallow global offset > MAX_MOVE_PX */
            if(dispx * dispx + dispy * dispy > MAX_MOVE_PX * MAX_MOVE_PX) {
                dispx = 0;
                dispy = 0;
            }
        }

        /* Calculate all pairs of distances */
        for(Map.Entry<PointerProperties, PointerCoords> ent : oldTouchMap.entrySet()) {
            for(PointerCoords coords : touches) {
                TouchDist dist = new TouchDist();
                dist.props = ent.getKey();
                dist.coords = coords;
                float dx = coords.x - (ent.getValue().x + dispx);
                float dy = coords.y - (ent.getValue().y + dispy);
                dist.dist = dx * dx + dy * dy;
                dists.add(dist);
            }
        }

        /* Match best distances */
        while(!dists.isEmpty()) {
            TouchDist dist = dists.remove();
            if(dist.dist > MAX_MOVE_PX * MAX_MOVE_PX)
                break;

            if(oldMatched.contains(dist.props))
                continue;
            if(newMatched.contains(dist.coords))
                continue;

            oldMatched.add(dist.props);
            newMatched.add(dist.coords);
            touchMap.put(dist.props, dist.coords);
        }

        /* Add in new touches */
        for(PointerCoords coords : touches) {
            if(!newMatched.contains(coords)) {
                touchMap.put(newPointerProperties(nextId++, MotionEvent.TOOL_TYPE_FINGER), coords);
            }
        }
        return touchMap;
    }

    private static int getActionIndex(TouchMap touchMap, PointerProperties properties) {
        int i=0;
        for(PointerProperties pp : touchMap.keySet()) {
            if(pp.equals(properties))
                return i;
            i++;
        }
        return -1;
    }

    private static MotionEvent getMotionEvent(long downTime, long eventTime, int action, TouchMap touchMap) {
        return MotionEvent.obtain(
                downTime,
                eventTime,
                action,
                touchMap.size(),
                touchMap.keySet().toArray(new PointerProperties[0]),
                touchMap.values().toArray(new PointerCoords[0]),
                0 /* metaState */,
                0 /* buttonState */,
                1 /* xPrecision */,
                1 /* yPrecision */,
                0x31337 /* deviceId */,
                0 /* edgeFlags */,
                InputDevice.SOURCE_TOUCHSCREEN,
                0 /* flags */
        );
    }

    /** Update the tracker and call a specified callback on completion.
     * Only call one {@code update} function per cap image.
     * @param touches
     * @param callback
     */
    public void update(List<PointerCoords> touches, TouchMapCallback callback) {
        TouchMap newTouchMap = computeTouchMap(touchMap, touches);
        callback.onNewTouchMap(newTouchMap);
        touchMap = newTouchMap;
    }

    /** Update the tracker and inject the resulting touch events into the specified view.
     * Only call one {@code update} function per cap image.
     * @param touches
     * @param tel
     */
    public void update(List<PointerCoords> touches, TouchEventListener tel) {
        TouchMap newTouchMap = computeTouchMap(touchMap, touches);
        long eventTime = SystemClock.uptimeMillis();
        boolean move = false;

        /* handle down first */
        for(Map.Entry<PointerProperties, PointerCoords> e : newTouchMap.entrySet()) {
            if(touchMap.containsKey(e.getKey())) {
                /* at least one touch in common */
                move = true;
                continue;
            }

            /* touch appeared this frame */
            touchMap.put(e.getKey(), e.getValue());
            MotionEvent evt;
            if(touchMap.size() == 1) {
                /* down */
                downTime = eventTime;
                evt = getMotionEvent(downTime, eventTime, MotionEvent.ACTION_DOWN, touchMap);
            } else {
                int actionIndex = getActionIndex(touchMap, e.getKey()) << MotionEvent.ACTION_POINTER_INDEX_SHIFT;
                evt = getMotionEvent(downTime, eventTime, MotionEvent.ACTION_POINTER_DOWN | actionIndex, touchMap);
            }
            tel.onTouchEvent(evt);
            evt.recycle();
        }

        /* now handle up; explicit iterator so we can remove */
        for(Iterator<Map.Entry<PointerProperties, PointerCoords>> it = touchMap.entrySet().iterator(); it.hasNext();) {
            Map.Entry<PointerProperties, PointerCoords> e = it.next();
            if(newTouchMap.containsKey(e.getKey()))
                continue;

            /* touch disappeared this frame */
            MotionEvent evt;
            if(touchMap.size() == 1) {
                /* up */
                evt = getMotionEvent(downTime, eventTime, MotionEvent.ACTION_UP, touchMap);
            } else {
                int actionIndex = getActionIndex(touchMap, e.getKey()) << MotionEvent.ACTION_POINTER_INDEX_SHIFT;
                evt = getMotionEvent(downTime, eventTime, MotionEvent.ACTION_POINTER_UP | actionIndex, touchMap);
            }
            tel.onTouchEvent(evt);
            evt.recycle();
            it.remove();
        }

        if(move) {
            MotionEvent evt = getMotionEvent(downTime, eventTime, MotionEvent.ACTION_MOVE, newTouchMap);
            tel.onTouchEvent(evt);
            evt.recycle();
        }

        touchMap = newTouchMap;
    }
}
