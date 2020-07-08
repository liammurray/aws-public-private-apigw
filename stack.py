#!/usr/bin/env python3
# -*- mode: python3 -*-

import click
from colorama import init, Fore, Back, Style
import yaml
import boto3
cloudformation = boto3.resource('cloudformation')


def bold(text):
  '''
    Usage: print bold("bold text")
  '''
  return Style.BRIGHT + text + Style.NORMAL


def blue(text):
  return Fore.BLUE + text + Fore.RESET


def green(text):
  return Fore.GREEN + text + Fore.RESET


def red(text):
  return Fore.RED + text + Fore.RESET


def dim(text):
  return Style.DIM + text + Style.NORMAL

def bred(text):
  return Style.BRIGHT + Fore.RED + text + Fore.RESET + Style.NORMAL

def dump(ob):
  # Use YAML for raw output of dictionary
  print(yaml.safe_dump(ob, default_flow_style=False))

def getStackOutputDict(stackName):
  print('Getting stack output for {}...'.format(stackName))
  stack = cloudformation.Stack(stackName)
  d = {}
  for out in stack.outputs or []:
    key = out['OutputKey']
    d[key] = {
      'val': out['OutputValue'],
      'desc': out.get('Description'),
      'exp': out.get('ExportName')
    }
  return d

def getStackNames():
  return [(s.stack_name, s.stack_status) for s in cloudformation.stacks.all()]


def getStackInfo(stack_name, simple=True):
  if not stack_name:
    print('Please specifiy a stack name')
    info = getStackNames()
    active=['CREATE_COMPLETE', 'UPDATE_COMPLETE']
    for (name, status) in info:
      col = blue if status in active else dim
      print(col(name), dim(status))
    return
  d = getStackOutputDict(stack_name)
  if simple:
    d = { k: v['val'] for (k,v) in d.items() }
  return d

@click.group()
def stack():
  '''
    Stack helper tool
  '''
  pass


@click.command()
@click.argument('stack_name', required=False)
def info(stack_name):
  """
    Shows stack outputs

    Works with any stack. Example:

      /stack.py info orders-dev

  """

  si = getStackInfo(stack_name, simple=False)
  if not si:
    return

  print()

  for (key, val) in si.items():
    print('{}:'.format(bold(key)))
    print('  {}'.format(green(val['val'])))
    desc = val.get('desc')
    exp = val.get('exp')
    if desc:
      print('  Description: {}'.format(desc))
    if exp:
      print('  Export: {}'.format(exp))
    print()


@click.command()
@click.argument('stack_name', required=False)
def private(stack_name):
  siVpc = getStackInfo('PrivateDemoVpc')
  siPrivateApi = getStackInfo('PrivateDemoPrivateApi')

  vpceId=siVpc['VpcEnpointId']
  apiId=siPrivateApi['ApiId']
  # URL for private API (not visible from VPC)
  apiUrl=siPrivateApi['ApiUrl']

  # Form special DNS endpoint with VPCE ID embedded in path
  apiIdPlus='{}-{}'.format(apiId, vpceId)
  endpoint=apiUrl.replace(apiId, apiIdPlus)

  print('VPC Endpoint URL for private API access:')
  print(blue(endpoint))


stack.add_command(info)
stack.add_command(private)

if __name__ == "__main__":
  stack()  # pylint: disable=no-value-for-parameter
