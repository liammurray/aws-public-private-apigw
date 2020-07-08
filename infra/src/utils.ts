import * as cdk from '@aws-cdk/core'

/**
 * Adds output with optional export.
 *
 * Export can be used like this (should be globally unique in account):
 *
 *  Fn.importValue('PrivateDemoPrivateApi:EchoFuncAliasLive')
 *
 * You can also reference resources across stacks in CDK code. In that case exports are auto-generated
 * and you don't need to define output or export.
 *
 */
export function cfnOutput(
  scope: cdk.Construct,
  name: string,
  value: string,
  addExport = false,
  props?: Omit<cdk.CfnOutputProps, 'exportName' | 'value'>
): void {
  const stack = cdk.Stack.of(scope)
  new cdk.CfnOutput(cdk.Stack.of(scope), name, {
    value,
    exportName: addExport ? `${stack.stackName}:${name}` : undefined,
    ...props,
  })
}

/**
 * VPC ID (vpc-xxxxxx) or name of ImportValue containing ID
 */
export function getVpcId(vpc: string): string {
  return vpc.startsWith('vpc-') ? vpc : cdk.Fn.importValue(vpc)
}
