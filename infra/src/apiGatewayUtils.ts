import * as apigateway from '@aws-cdk/aws-apigateway'
import * as iam from '@aws-cdk/aws-iam'

/**
 * Allows any principal coming from source VPC to invoke API
 */
export function getAllowVpcInvokePolicy(sourceVpcId: string): iam.PolicyDocument {
  return new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'aws:sourceVpc': sourceVpcId,
          },
        },
        principals: [new iam.AnyPrincipal()],
      }),
    ],
  })
}

/**
 * Add preflight OPTIONS response
 *
 * NOT needed if you specify defaultCorsPreflightOptions when creating API
 *
 * defaultCorsPreflightOptions: {
 *  allowOrigins: apigateway.Cors.ALL_ORIGINS,
 *  allowMethods: apigateway.Cors.ALL_METHODS,
 * },
 *
 */
export function addCorsOptions(apiResource: apigateway.IResource): void {
  apiResource.addMethod(
    'OPTIONS',
    new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers':
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials': "'false'",
            'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    }
  )
}
