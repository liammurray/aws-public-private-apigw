import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2'
import { cfnOutput } from '~/utils'

// import * as sqs from '@aws-cdk/aws-sqs'
// import * as apigateway from '@aws-cdk/aws-apigateway'
// import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2'
// import * as iam from '@aws-cdk/aws-iam'
// import * as logs from '@aws-cdk/aws-logs'
// import * as route53 from '@aws-cdk/aws-route53'
// import * as lambda from '@aws-cdk/aws-lambda'
// import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources'
// import * as certman from '@aws-cdk/aws-certificatemanager'
// import * as path from 'path'
// import { addCorsOptions } from './apiGatewayUtils'

export interface VpcStackProps extends cdk.StackProps {
  includeNlb: boolean
  cidr: string
}

//https://docs.aws.amazon.com/cdk/api/latest/docs/aws-s3-readme.html#sharing-buckets-between-stacks

/**
 * VPC that connects to private API Gateway.
 * It provides an NLB for VPCLink and a VPC endpoint that connects
 * privately to the private API.
 *
 */
export default class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly vpcEndpoint: ec2.VpcEndpoint
  public readonly nlb: elbv2.NetworkLoadBalancer

  constructor(scope: cdk.Construct, id: string, props: VpcStackProps) {
    super(scope, id, props)

    const cidr = props.cidr

    // Default VPC has public and private in each AZ (plus NAT and IGW)
    // With NAT:0 we get public and isolated privated subnets
    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      cidr,
      maxAzs: 2,
      natGateways: 0,
    })

    // EC2 for SSM
    // Public so we can install dev tools (without NAT)
    const host = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc: this.vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    })
    cfnOutput(this, 'BastionHostId', host.instanceId)
    cfnOutput(this, 'BastionHostPrivateIp', host.instancePrivateIp)

    // Default is to add to one subnet per AZ (preferring private?)
    // $0.01 per hour per endpoint per AZ (~$7.50 per month) plus a $0.01 fee per GB of data processed
    // Creates security group without rules
    // Attaching API will add from 10.1.0.0/16:443 to it (I think. Somebody does. Maybe based on servcie below.)
    // The endpoint itself gets a DNS name that can be used to address the private API (see endpoint in console).
    this.vpcEndpoint = this.vpc.addInterfaceEndpoint('MyVpcEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      privateDnsEnabled: false,
      // Allow all VPC traffic to endpoint
      open: true,
    })
    cfnOutput(this, 'VpcEndpointId', this.vpcEndpoint.vpcEndpointId)

    if (props.includeNlb) {
      this.nlb = new elbv2.NetworkLoadBalancer(this, 'NLB', {
        vpc: this.vpc,
      })
      cfnOutput(this, 'NlbArn', this.nlb.loadBalancerArn)
    }
  }
}
