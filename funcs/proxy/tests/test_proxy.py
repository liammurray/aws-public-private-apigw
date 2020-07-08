import pytest
import responses
from unittest import mock
from code.proxy import callEndpoint
import json


def load_data(name):
  datafile = './tests/data/{}'.format(name)
  with open(datafile) as f:
    return json.load(f)


@pytest.fixture()
def apigw_event():
  return load_data('apigw-event.json')


ENV_VARS = {"DOWNSTREAM_ENDPOINT": "https://foo.com/api"}


@responses.activate
@mock.patch.dict('os.environ', ENV_VARS)
def test_handler(apigw_event):
  responses.add(
      responses.GET,
      'https://foo.com/api',
      json={'code': 'it worked'},
      status=200)
  res = callEndpoint(event=apigw_event, context={})
  assert res['statusCode'] == 200
  body = json.loads(res['body'])
  print(body)
