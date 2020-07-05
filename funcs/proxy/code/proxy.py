import json
import os

import boto3

def handler(event, context):
  '''
    Calls downstream lambda and returns response
  '''
    print('request: {}'.format(json.dumps(event)))

    resp = _lambda.invoke(
        FunctionName=os.environ['DOWNSTREAM_FUNCTION_NAME'],
        Payload=json.dumps(event),
    )

    body = resp['Payload'].read()

    print('downstream response: {}'.format(body))
    return json.loads(body)
