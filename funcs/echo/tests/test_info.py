

from code.info import get_runtime_env


def test_getInfo():
  event = {'foo': 'hi'}
  res = get_runtime_env(event=event, context={})
  print(res)
  assert res != None
  assert res['event'] !=None, 'Has event'
  assert res['event']['foo'] == 'hi', 'Event we add matches'
