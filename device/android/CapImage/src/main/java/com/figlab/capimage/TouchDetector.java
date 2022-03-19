package com.figlab.capimage;

import android.util.Size;
import android.view.MotionEvent.PointerCoords;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;

/** Simple, somewhat stupid finger locator.
 */
public class TouchDetector {
    private static final int CAPW, CAPH, SCREENW, SCREENH;
    static {
        Size capSize = CapImage.getCapSize();
        CAPW = capSize.getWidth();
        CAPH = capSize.getHeight();
        Size screenSize = CapImage.getScreenSize();
        SCREENW = screenSize.getWidth();
        SCREENH = screenSize.getHeight();
    }

    public int FILTER_WINDOW = 0;
    public int FINGER_PRESENT_THRESHOLD = 65;
    public int ERASE_THRESHOLD = 35;

    public List<PointerCoords> findTouchPoints(short[] capImage) {
        /* XXX single-touch only for now */
        /* TODO add multitouch support */
        List<PointerCoords> ret = new ArrayList<>();

        /* Uniform filter with (2*win+1) window */
        float[] filtered = new float[CAPW * CAPH];
        int win = FILTER_WINDOW;
        float div = 1f / ((win * 2 + 1) * (win * 2 + 1));
        for (int y = 0; y < CAPH; y++) {
            for (int x = 0; x < CAPW; x++) {
                float val = 0;
                for (int yy = y - win; yy <= y + win; yy++) {
                    for (int xx = x - win; xx <= x + win; xx++) {
                        if (yy >= 0 && yy < CAPH && xx >= 0 && xx < CAPW) {
                            val += capImage[yy * CAPW + xx];
                        }
                    }
                }
                filtered[y * CAPW + x] = val * div;
            }
        }

        while(true) {
            /* Find peak */
            float maxval = 0;
            int maxx = 0, maxy = 0;
            for(int y = 0; y < CAPH; y++) {
                for(int x = 0; x < CAPW; x++) {
                    if(filtered[y * CAPW + x] > maxval) {
                        maxval = filtered[y * CAPW + x];
                        maxx = x;
                        maxy = y;
                    }
                }
            }

            if(maxval < FINGER_PRESENT_THRESHOLD)
                break;

            PointerCoords coords = findTouchFromPeak(filtered, maxx, maxy);
            ret.add(coords);
            eraseTouch(filtered, maxx, maxy);
        }

        return ret;
    }

    private PointerCoords findTouchFromPeak(float[] capImage, int maxx, int maxy) {
        /* Y adjustment */
        float yadj;
        if (maxy == 0) {
            yadj = 0.5f;
        } else if (maxy == CAPH - 1) {
            yadj = -0.5f;
        } else {
            List<float[]> rows = new ArrayList<>();
            for (int x = maxx - 1; x <= maxx + 1; x++) {
                if (x < 0 || x >= CAPW)
                    continue;
                float[] row = new float[3];
                for (int dy = -1; dy <= 1; dy++) {
                    row[dy + 1] = capImage[(maxy + dy) * CAPW + x];
                }
                rows.add(row);
            }
            yadj = peak_adj_mat(rows);
        }

        /* X adjustment */
        float xadj;
        if (maxx == 0) {
            xadj = 0.5f;
        } else if (maxx == CAPW - 1) {
            xadj = -0.5f;
        } else {
            List<float[]> rows = new ArrayList<>();
            for (int y = maxy - 1; y <= maxy + 1; y++) {
                if (y < 0 || y >= CAPH)
                    continue;
                float[] row = new float[3];
                for (int dx = -1; dx <= 1; dx++) {
                    row[dx + 1] = capImage[y * CAPW + (maxx + dx)];
                }
                rows.add(row);
            }
            xadj = peak_adj_mat(rows);
        }

        PointerCoords coords = new PointerCoords();
        coords.x = (maxx + xadj) * SCREENW / (CAPW - 1);
        coords.y = (maxy + yadj) * SCREENH / (CAPH - 1);
        return coords;
    }

    private void eraseTouch(float[] filtered, int maxx, int maxy) {
        Queue<Integer> todo = new ArrayDeque<>();
        todo.add(maxy * CAPW + maxx);
        while(!todo.isEmpty()) {
            int idx = todo.remove();
            if(filtered[idx] == 0)
                continue;
            filtered[idx] = 0;
            int x = idx % CAPW;
            int y = idx / CAPW;
            if(x > 0 && filtered[idx - 1] >= ERASE_THRESHOLD)
                todo.add(idx - 1);
            if(x < CAPW - 1 && filtered[idx + 1] >= ERASE_THRESHOLD)
                todo.add(idx + 1);
            if(y > 0 && filtered[idx - CAPW] >= ERASE_THRESHOLD)
                todo.add(idx - CAPW);
            if(y < CAPH - 1 && filtered[idx + CAPW] >= ERASE_THRESHOLD)
                todo.add(idx + CAPW);
        }
    }

    private float peak_adj_mat(List<float[]> rows) {
        float tw = 0;
        float tadj = 0;
        for (float[] row : rows) {
            float[] ret = peak_adj(row);
            float adj = ret[0];
            float w = ret[1];
            tw += w;
            tadj += adj * w;
        }
        if (tw > 0)
            tadj /= tw;
        return tadj;
    }

    private float[] peak_adj(float[] row) {
        float a = row[0];
        float b = row[1];
        float c = row[2];
        if (a == b && b == c) {
            /* Atypical case */
            return new float[] { 0, 0 };
        } else if (a <= b && c <= b) {
            /* Typical case: b is the peak value */
            float da = b - a;
            float dc = b - c;
            return new float[] { da / (da + dc) - 0.5f, da + dc };
        } else if (a >= b && c >= b) {
            /* Atypical case: b is the smallest value */
            float da = a - b;
            float dc = c - b;
            /* Lean towards the value furthest from b */
            return new float[] { dc / (da + dc) - 0.5f, da + dc };
        } else if (a <= b && b <= c) {
            /* Lean completely towards c */
            return new float[] { 0.5f, (c - b) + (b - a) };
        } else {
            /* Lean completely towards a */
            return new float[] { -0.5f, (a - b) + (b - c) };
        }
    }
}
