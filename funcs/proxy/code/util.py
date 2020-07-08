import sys
import json


def get_path_params(event, *names):
  '''
    Returns list of values extracted from given path parameter names
  '''
  params = event.get('pathParameters') or {}
  return [params.get(name) for name in names]


# TODO see https://github.com/dschep/lambda-decorators


def response(body, status=200):
  return {
      'statusCode': status,
      'body': json.dumps(body),
      'headers': {
          'Content-Type':
              'application/json',
          'Access-Control-Allow-Origin':
              '*',
          "Access-Control-Allow-Headers":
              "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
          "Access-Control-Allow-Methods":
              "GET, OPTIONS, POST",
          "Cache-Control":
              "no-store, no-cache, must-revalidate, max-age = 0",
      },
  }
