from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import bpy
from random import randint
import queue
from functools import partial
import json
import os
import sys
import signal
import numpy as np

DIR = os.path.join(os.path.dirname(bpy.data.filepath), '..')
if not DIR in sys.path:
    sys.path.append(DIR)

from hand_ik import compute_ik, reload_cap_image, record, depth_mode, shaded_mode


execution_queue = queue.Queue()


def run_in_main_thread(function, args):
    print(f"[{threading.current_thread().name}] adding {function} to queue")
    execution_queue.put((function, args))


routes = {
    "/compute-ik": compute_ik,
    "/reload-cap-image": reload_cap_image,
    "/record": record,
    "/depth-mode": depth_mode,
    "/shaded-mode": shaded_mode
}


class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        print(f"[{threading.current_thread().name}] POST request received")

        content_len = int(self.headers.get('Content-Length'))
        data = json.loads(self.rfile.read(content_len))
        
        if self.path not in routes:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'resource not found at "' + self.path + '"\n')
            return

        run_in_main_thread(routes[self.path], data)

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{}\n')

    def log_message(self, format, *args):
        return


class ServerThread(threading.Thread):
    def __init__(self, port):
        super(ServerThread, self).__init__()
        self.port = port

    def run(self):
        self.httpd = HTTPServer(('localhost', self.port), SimpleHTTPRequestHandler)
        self.httpd.serve_forever()

    def shutdown(self):
        self.httpd.shutdown()

i = 0
def execute_queued_functions():
    global i
    window = bpy.context.window_manager.windows[0]
    ctx = {'window': window, 'screen': window.screen}

    print(f"[{threading.current_thread().name}] waiting{'.'*(i + 1)}     ", end="\r")
    i += 1
    if i == 5:
        i = 0
    while not execution_queue.empty():
        function, args = execution_queue.get()
        print(f"[{threading.current_thread().name}] executing {function}")
        function(args)
    return 1/18

class ExitOK(Exception):
    pass

def main():
    httpServer = ServerThread(6070)
    httpServer.setDaemon(True)

    def shutdown(signal, frame):
        print("\nStopping...")
        bpy.app.timers.unregister(execute_queued_functions)
        httpServer.shutdown()
        httpServer.join()
        print("Done!")
        raise ExitOK

    signal.signal(signal.SIGINT, shutdown)
    forever = threading.Event()

    httpServer.start()
    bpy.app.timers.register(execute_queued_functions)

if __name__ == '__main__':
    try:
        main()
    except ExitOK:
        pass