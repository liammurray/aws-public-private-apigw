import os
import sys
from .util import response

def get_runtime_env(event, context):
  path = os.popen("echo $PATH").read()
  directories = os.popen("find /opt -type d -maxdepth 4").read().split("\n")
  return {
      'path': path,
      'syspath': sys.path,
      'directories': directories,
      'event': event
  }


def handler(event, context):
  env = get_runtime_env(event)
  return response(res=env)
