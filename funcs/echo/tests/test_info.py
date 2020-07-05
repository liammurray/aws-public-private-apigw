

from code.info import handler
import json

def test_handler():
  event = {'foo': 'hi'}
  res = handler(event=event, context={})
  assert res['statusCode'] == 200
  body =  json.loads(res['body'])
  assert body['event'] !=None, 'Has event'
  assert body['event']['foo'] == 'hi', 'Event we add matches'
