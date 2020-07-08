import json
import os
import requests
import boto3
from .util import response

lambdaClient = boto3.client('lambda')

def callLambda(event, context):
  '''
    Calls downstream lambda and returns response
  '''
  print('request: {}'.format(json.dumps(event)))

  resp = lambdaClient.invoke(
      FunctionName=os.environ['DOWNSTREAM_FUNCTION_NAME'],
      Payload=json.dumps(event),
  )

  body = resp['Payload'].read()

  print('downstream response: {}'.format(body))
  return json.loads(body)

def callEndpoint(event, context):
  '''
    Calls downstream api and returns response
  '''
  print('request: {}'.format(json.dumps(event)))

  endpoint = os.environ['DOWNSTREAM_ENDPOINT']
  print('endpoint: {}'.format(endpoint))

  res = requests.get(endpoint)

  if res:
    print('Success!')
    print('downstream response: {}'.format(res))
  else:
    print('Error: {}'.format(res))

  print('downstream response body: {}'.format(res.text))
  return response(res.json(), res.status_code)

